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
const EXIT_CONTACT_Y = 154;
const FAR_SCALE = 0.07;
const NEAR_SCALE = 1.34;
const EXIT_SCALE = 1.75;
const FAR_LEFT_X = 46.8;
const NEAR_LEFT_X = 16.8;
const EXIT_LEFT_X = 5.8434782609;
const FAR_RIGHT_X = 53.2;
const NEAR_RIGHT_X = 83.2;
const EXIT_RIGHT_X = 94.1565217391;
const BELT_PLANE_END = 0.8;
const WINDOW_PLAYBACK_DURATION_MS = 60_000;
const MIN_TRAVEL_DURATION_MS = 450;

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
  perspective = 0.42,
): number {
  const world = clamp01(worldProgress);
  return world / (1 + perspective * (1 - world));
}

export function projectBeltPose(worldProgress: number, side: BeltSide): BeltPose {
  const world = clamp01(worldProgress);
  const onBelt = world <= BELT_PLANE_END;
  const beltWorld = clamp01(world / BELT_PLANE_END);
  const beltDepth = projectWorldProgress(beltWorld);
  const exitProgress = clamp01((world - BELT_PLANE_END) / (1 - BELT_PLANE_END));
  const nearX = side === 'left' ? NEAR_LEFT_X : NEAR_RIGHT_X;
  const exitX = side === 'left' ? EXIT_LEFT_X : EXIT_RIGHT_X;
  const leftPct = onBelt
    ? mix(side === 'left' ? FAR_LEFT_X : FAR_RIGHT_X, nearX, beltDepth)
    : mix(nearX, exitX, exitProgress);
  const topPct = onBelt
    ? mix(FAR_CONTACT_Y, NEAR_CONTACT_Y, beltDepth)
    : mix(NEAR_CONTACT_Y, EXIT_CONTACT_Y, exitProgress);
  const scale = onBelt
    ? mix(FAR_SCALE, NEAR_SCALE, beltDepth)
    : mix(NEAR_SCALE, EXIT_SCALE, exitProgress);
  const depth = onBelt ? beltDepth : 1 + exitProgress * 0.2;

  return {
    leftPct,
    topPct,
    scale,
    opacity: 1,
    depth,
  };
}

export interface LaneMotionTiming {
  intervalMs: number;
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
  laneCapacity: number,
): LaneMotionTiming | null {
  if (!Number.isFinite(burgersInWindow) || burgersInWindow < 0.005) return null;
  const safeCapacity = Math.max(1, laneCapacity);
  const visualRatePerSecond = burgersInWindow / (WINDOW_PLAYBACK_DURATION_MS / 1_000);
  const intervalMs = Math.max(16, Math.round(1_000 / visualRatePerSecond));
  const headwayDurationMs = intervalMs * Math.max(1, safeCapacity - 0.75);
  const travelDurationMs = Math.round(Math.max(
    MIN_TRAVEL_DURATION_MS,
    Math.min(WINDOW_PLAYBACK_DURATION_MS, headwayDurationMs),
  ));

  return { intervalMs, travelDurationMs, visualRatePerSecond };
}
