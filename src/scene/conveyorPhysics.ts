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
const FAR_LEFT_X = 46.8;
const NEAR_LEFT_X = 16.8;
const FAR_RIGHT_X = 53.2;
const NEAR_RIGHT_X = 83.2;
const BELT_PLANE_END = 0.8;
const BELT_PERSPECTIVE = 2;
const WINDOW_PLAYBACK_DURATION_MS = 60_000;
const MIN_TRAVEL_DURATION_MS = 450;
const HEADWAY_MARGIN = 0.2;
const DEFAULT_SPRITE_WIDTH_PCT = 8.5;
const FAR_COLUMN_GAP_PCT = 0.5;
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
 * Maps one comparison window to one playback minute. Every lane begins at the
 * same one-minute belt speed; output first increases the number of burgers on
 * the belt, then shortens the travel time only after physical headway is full.
 */
export function laneMotionTiming(
  burgersInWindow: number,
  rowCapacity: number,
  maxColumns = 3,
): LaneMotionTiming | null {
  if (!Number.isFinite(burgersInWindow) || burgersInWindow < 0.005) return null;
  const safeRowCapacity = Math.max(1, rowCapacity);
  const safeMaxColumns = Math.max(1, Math.min(3, Math.floor(maxColumns)));
  const columnCount = Math.min(
    safeMaxColumns,
    Math.max(1, Math.ceil(burgersInWindow / safeRowCapacity)),
  );
  const visualRatePerSecond = burgersInWindow / (WINDOW_PLAYBACK_DURATION_MS / 1_000);
  const intervalMs = Math.max(16, Math.round(1_000 / visualRatePerSecond));
  const perColumnIntervalMs = intervalMs * columnCount;
  const headwayDurationMs = perColumnIntervalMs * Math.max(1, safeRowCapacity - HEADWAY_MARGIN);
  const travelDurationMs = Math.round(Math.max(
    MIN_TRAVEL_DURATION_MS,
    Math.min(WINDOW_PLAYBACK_DURATION_MS, headwayDurationMs),
  ));

  return {
    columnCount,
    continuousMarker: burgersInWindow < 1,
    intervalMs,
    totalCapacity: safeRowCapacity * columnCount,
    travelDurationMs,
    visualRatePerSecond,
  };
}
