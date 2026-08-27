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
const FAR_SCALE = 0.07;
const NEAR_SCALE = 1.34;
const FAR_LEFT_X = 43.3;
const NEAR_LEFT_X = 24.1;
const FAR_RIGHT_X = 56.7;
const NEAR_RIGHT_X = 75.9;

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

function mix(from: number, to: number, amount: number): number {
  return from + (to - from) * amount;
}

function smoothstep(from: number, to: number, value: number): number {
  if (from === to) return value < from ? 0 : 1;
  const t = clamp01((value - from) / (to - from));
  return t * t * (3 - 2 * t);
}

/**
 * Projects constant world-space travel onto the photographed belt plane.
 * A pinhole-camera homography supplies the perspective, while a small
 * perceptual compensation counters the foreground speed-up that otherwise
 * makes a constant belt look as though it accelerates toward the viewer.
 */
export function projectWorldProgress(
  worldProgress: number,
  perspective = 0.42,
  perceptualCompensation = 0.45,
): number {
  const world = clamp01(worldProgress);
  const pinhole = world / (1 + perspective * (1 - world));
  const compensated = 1 - (1 - world) ** 1.35;
  return mix(pinhole, compensated, clamp01(perceptualCompensation));
}

export function projectBeltPose(worldProgress: number, side: BeltSide): BeltPose {
  const world = clamp01(worldProgress);
  const depth = projectWorldProgress(world);
  const leftPct = side === 'left'
    ? mix(FAR_LEFT_X, NEAR_LEFT_X, depth)
    : mix(FAR_RIGHT_X, NEAR_RIGHT_X, depth);
  const fadeIn = smoothstep(0, 0.025, depth);
  const fadeOut = 1 - smoothstep(0.965, 1, depth);

  return {
    leftPct,
    topPct: mix(FAR_CONTACT_Y, NEAR_CONTACT_Y, depth),
    scale: mix(FAR_SCALE, NEAR_SCALE, depth),
    opacity: fadeIn * fadeOut,
    depth,
  };
}

/** Keeps the requested cadence unless it would exceed the readable lane load. */
export function physicalLaunchInterval(
  requestedIntervalMs: number,
  travelDurationMs: number,
  laneCapacity: number,
): number {
  const safeCapacity = Math.max(1, laneCapacity);
  const capacityInterval = travelDurationMs / Math.max(1, safeCapacity - 0.75);
  return Math.max(requestedIntervalMs, Math.ceil(capacityInterval));
}
