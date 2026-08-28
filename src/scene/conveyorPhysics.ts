export type BeltSide = 'left' | 'right';

export interface BeltPose {
  leftPct: number;
  topPct: number;
  scale: number;
  opacity: number;
  depth: number;
}

const FAR_CONTACT_Y = -3;
const NEAR_CONTACT_Y = 112;
const FAR_SCALE = 0.1;
const NEAR_SCALE = 1.18;
const FAR_LEFT_X = 48.4;
// The photographed AI ramp is less steep than the legacy trajectory. Its
// foreground center sits farther right, so the burger rays must rotate toward
// the divider instead of drifting across the outer-left half of the belt.
const NEAR_LEFT_X = 25.8;
const FAR_RIGHT_X = 54.75;
// The arcade background is less asymmetric than Burger Belt 2. Its lifestyle
// belt still fans right, but the usable surface center finishes several points
// left of the legacy trajectory.
const NEAR_RIGHT_X = 80.35;
const BELT_PLANE_END = 0.8;
const BELT_PERSPECTIVE = 2;
export const ROUND_PLAYBACK_DURATION_MS = 48_814;
const HEADWAY_MARGIN = 0.2;
const DEFAULT_SPRITE_WIDTH_PCT = 8.5;
const FAR_COLUMN_GAP_PCT = 0.4;
const NEAR_COLUMN_GAP_PCT = 1.5;
const SPRITE_SCALE_EASING = 1.35;

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

function mix(from: number, to: number, amount: number): number {
  return from + (to - from) * amount;
}

/**
 * Packed rows need a rear-only center correction for the current arcade
 * photograph, whose center divider is wider at the horizon than Burger Belt 2.
 * The offset is applied by projectBeltPose and naturally fades to zero at the
 * foreground edge.
 */
export function packedRailCenterOffset(
  side: BeltSide,
  columnCount: number,
): number {
  if (columnCount < 3) return 0;
  return side === 'left' ? -2.4 : 0;
}

/**
 * The right belt is especially narrow at the photographed horizon. Compress
 * only the distant three-wide row around its center ray, then open it back to
 * full physical spacing as the belt approaches the camera. This clears both
 * rails without moving the accepted centerline or foreground placement.
 */
export function packedColumnSpreadScale(
  side: BeltSide,
  columnCount: number,
): number {
  return side === 'right' && columnCount >= 3 ? 0.56 : 1;
}

/**
 * Returns evenly spaced column coordinates. Rear-only packing belongs in the
 * perspective spread calculation so foreground burgers always recover their
 * full physical width plus the intended air gap.
 */
export function columnOffsetForIndex(
  index: number,
  columnCount: number,
  _side: BeltSide,
): number {
  if (columnCount <= 1) return 0;
  if (columnCount === 2) return index % 2 === 0 ? -0.5 : 0.5;
  return [-1, 0, 1][index % 3] ?? 0;
}

/**
 * Projects constant world-space travel onto the photographed belt plane.
 * The fractional-linear form is the one-dimensional restriction of a planar
 * projective transform: distant screen-space steps are smaller and the same
 * world speed appears faster as the burger approaches the camera.
 */
export function projectWorldProgress(
  worldProgress: number,
  perspective = BELT_PERSPECTIVE,
): number {
  const world = clamp01(worldProgress);
  return world / (1 + perspective * (1 - world));
}

export function projectBeltPose(
  worldProgress: number,
  side: BeltSide,
  columnOffset = 0,
  spriteWidthPct = DEFAULT_SPRITE_WIDTH_PCT,
  farCenterOffsetPct = 0,
  farColumnSpreadScale = 1,
): BeltPose {
  const world = clamp01(worldProgress);
  const beltWorld = world / BELT_PLANE_END;
  // Do not clamp at the photographed belt edge. Extending the same homography
  // below the frame prevents a leading burger from decelerating at the exit
  // while the following burger is still accelerating toward the camera.
  const beltDepth = beltWorld / (1 + BELT_PERSPECTIVE * (1 - beltWorld));
  const centerLeftPct = mix(
    side === 'left' ? FAR_LEFT_X : FAR_RIGHT_X,
    side === 'left' ? NEAR_LEFT_X : NEAR_RIGHT_X,
    beltDepth,
  ) + farCenterOffsetPct * (1 - clamp01(beltDepth));
  const topPct = mix(FAR_CONTACT_Y, NEAR_CONTACT_Y, beltDepth);
  // The square sprite extends well above its belt contact point. A slightly
  // delayed scale curve keeps that silhouette from consuming physical row
  // headway in the distance. Once the contact point leaves the photographed
  // belt, linear growth is sufficient because the sprite is already clipping.
  const scaleDepth = beltDepth <= 1
    ? Math.pow(Math.max(0, beltDepth), SPRITE_SCALE_EASING)
    : beltDepth;
  const scale = mix(FAR_SCALE, NEAR_SCALE, scaleDepth);
  // Each column follows a straight photographed belt ray. Interpolating the
  // two endpoint spreads with the same projective depth used by center X and
  // contact Y keeps every column collinear; tying X to the eased sprite-size
  // curve would make the outer burgers bow inward and then outward.
  const safeSpriteWidthPct = Math.max(0, spriteWidthPct);
  const farColumnSpread = (
    safeSpriteWidthPct * FAR_SCALE + FAR_COLUMN_GAP_PCT
  ) * Math.max(0, farColumnSpreadScale);
  const nearColumnSpread = (
    safeSpriteWidthPct * NEAR_SCALE + NEAR_COLUMN_GAP_PCT
  );
  const columnSpread = mix(farColumnSpread, nearColumnSpread, beltDepth);
  const leftPct = centerLeftPct + columnOffset * columnSpread;
  const depth = beltDepth;

  return {
    leftPct,
    topPct,
    scale,
    opacity: 1,
    depth,
  };
}

export interface LaneMotionTiming {
  columnCount: number;
  continuousMarker: boolean;
  intervalMs: number;
  totalCapacity: number;
  travelDurationMs: number;
  visualRatePerSecond: number;
}

/**
 * Chooses a lane shape that occupies both belt dimensions before asking the
 * camera-facing motion to get faster. The target aspect ratio mirrors the
 * physical grid (rows are deeper than the belt is wide), while the minimum
 * column count guarantees that the requested load fits on the belt.
 */
export function columnsForBeltLoad(
  burgersInWindow: number,
  rowCapacity: number,
  maxColumns = 3,
): number {
  const safeRowCapacity = Math.max(1, rowCapacity);
  const safeMaxColumns = Math.max(1, Math.min(3, Math.floor(maxColumns)));
  const visibleLoad = Math.min(
    safeRowCapacity * safeMaxColumns,
    Math.max(1, burgersInWindow),
  );
  const minimumColumns = Math.ceil(visibleLoad / safeRowCapacity);
  const aspectColumns = Math.round(Math.sqrt(
    visibleLoad * safeMaxColumns / safeRowCapacity,
  ));

  return Math.min(
    safeMaxColumns,
    Math.max(1, minimumColumns, aspectColumns),
  );
}

/**
 * Fits one complete comparison batch to the 48.8-second Burger Blitz track.
 * A sparse lane keeps one burger in motion for the whole song. Busier lanes
 * first occupy more rows and columns; their travel time then shortens just
 * enough for the final row to clear on the same beat as every other lane.
 */
export function laneMotionTiming(
  burgersInWindow: number,
  rowCapacity: number,
  maxColumns = 3,
): LaneMotionTiming | null {
  if (!Number.isFinite(burgersInWindow) || burgersInWindow < 0.005) return null;
  const safeRowCapacity = Math.max(1, rowCapacity);
  const safeMaxColumns = Math.max(1, Math.min(3, Math.floor(maxColumns)));
  const columnCount = columnsForBeltLoad(
    burgersInWindow,
    safeRowCapacity,
    safeMaxColumns,
  );
  const visibleBurgerCount = Math.max(1, Math.ceil(burgersInWindow));
  const rowCount = Math.ceil(visibleBurgerCount / columnCount);
  const occupiedRows = Math.min(rowCount, Math.max(1, safeRowCapacity - HEADWAY_MARGIN));
  const rowIntervalMs = ROUND_PLAYBACK_DURATION_MS / Math.max(1, rowCount - 1 + occupiedRows);
  const travelDurationMs = ROUND_PLAYBACK_DURATION_MS - rowIntervalMs * Math.max(0, rowCount - 1);
  const intervalMs = rowIntervalMs / columnCount;
  const visualRatePerSecond = burgersInWindow / (ROUND_PLAYBACK_DURATION_MS / 1_000);

  return {
    columnCount,
    continuousMarker: burgersInWindow < 1,
    intervalMs,
    totalCapacity: safeRowCapacity * columnCount,
    travelDurationMs,
    visualRatePerSecond,
  };
}
