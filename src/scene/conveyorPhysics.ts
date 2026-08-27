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
const FAR_SCALE = 0.14;
const NEAR_SCALE = 1.34;
const FAR_LEFT_X = 48.4;
const NEAR_LEFT_X = 21.6;
const FAR_RIGHT_X = 55.8;
// Burger Belt 2 is not a perfect mirror: its lifestyle belt fans much farther
// toward the right edge in the foreground than the photographed AI belt.
const NEAR_RIGHT_X = 83.3;
const BELT_PLANE_END = 0.8;
const BELT_PERSPECTIVE = 2;
export const ROUND_PLAYBACK_DURATION_MS = 48_814;
const HEADWAY_MARGIN = 0.2;
const DEFAULT_SPRITE_WIDTH_PCT = 8.5;
const FAR_COLUMN_GAP_PCT = 0.4;
const NEAR_COLUMN_GAP_PCT = 1;
const SPRITE_SCALE_EASING = 1.35;

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

function mix(from: number, to: number, amount: number): number {
  return from + (to - from) * amount;
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
  // Each column advances from the vanishing point along its own belt ray.
  // Spacing follows the rendered sprite width plus a rail-safe air gap. The
  // gap opens with the photographed belt, keeping the distant three-wide row
  // inside the converging rails without allowing foreground convergence.
  const columnGapPct = mix(
    FAR_COLUMN_GAP_PCT,
    NEAR_COLUMN_GAP_PCT,
    clamp01(beltDepth),
  );
  const columnSpread = Math.max(0, spriteWidthPct) * scale + columnGapPct;
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
