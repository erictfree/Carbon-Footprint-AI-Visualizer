import { describe, expect, it } from 'vitest';
import { laneMotionTiming, projectBeltPose, projectWorldProgress } from './conveyorPhysics';

describe('conveyor physics', () => {
  it('projects the world-space endpoints exactly', () => {
    expect(projectWorldProgress(0)).toBe(0);
    expect(projectWorldProgress(1)).toBe(1);
  });

  it('accelerates screen-space motion toward the foreground', () => {
    const projected = [0, 0.25, 0.5, 0.75, 1].map((value) => projectWorldProgress(value));
    const gaps = projected.slice(1).map((value, index) => value - projected[index]!);
    expect(gaps[1]!).toBeGreaterThan(gaps[0]!);
    expect(gaps[2]!).toBeGreaterThan(gaps[1]!);
    expect(gaps[3]!).toBeGreaterThan(gaps[2]!);
  });

  it('makes the same world speed visibly slower in the distance', () => {
    const projected = [0, 0.25, 0.5, 0.75, 1].map((value) => projectWorldProgress(value));
    const farGap = projected[1]! - projected[0]!;
    const nearGap = projected[4]! - projected[3]!;

    expect(nearGap / farGap).toBeGreaterThan(1.6);
  });

  it('keeps the two lanes mirrored and grows a grounded object with depth', () => {
    const farLeft = projectBeltPose(0.2, 'left');
    const nearLeft = projectBeltPose(0.8, 'left');
    const nearRight = projectBeltPose(0.8, 'right');

    expect(nearLeft.topPct).toBeGreaterThan(farLeft.topPct);
    expect(nearLeft.scale).toBeGreaterThan(farLeft.scale);
    expect(nearLeft.leftPct + nearRight.leftPct).toBeCloseTo(100, 5);
  });

  it('follows the calibrated straight centerlines through the off-screen exit', () => {
    const far = projectBeltPose(0, 'right');
    const edge = projectBeltPose(0.8, 'right');
    const exit = projectBeltPose(1, 'right');
    const beltSlope = (edge.leftPct - far.leftPct) / (edge.topPct - far.topPct);
    const exitSlope = (exit.leftPct - edge.leftPct) / (exit.topPct - edge.topPct);

    expect(far.leftPct).toBeCloseTo(53.2, 4);
    expect(edge.leftPct).toBeCloseTo(83.2, 4);
    expect(exit.leftPct).toBeCloseTo(94.1565, 4);
    expect(exitSlope).toBeCloseTo(beltSlope, 4);
  });

  it('keeps burgers opaque and carries them fully below the frame', () => {
    const far = projectBeltPose(0, 'left');
    const edge = projectBeltPose(0.8, 'left');
    const exit = projectBeltPose(1, 'left');

    expect(far.opacity).toBe(1);
    expect(edge.opacity).toBe(1);
    expect(exit.opacity).toBe(1);
    expect(exit.topPct).toBe(154);
    expect(exit.scale).toBe(1.75);
    expect(exit.leftPct).toBeLessThan(edge.leftPct);
  });

  it('fills density before increasing belt velocity for extreme rate gaps', () => {
    const ai = laneMotionTiming(1.24 / 3, 6)!;
    const lifestyle = laneMotionTiming(887 / 3, 6)!;

    expect(ai.intervalMs / lifestyle.intervalMs).toBeGreaterThan(700);
    expect(ai.travelDurationMs).toBe(60_000);
    expect(lifestyle.travelDurationMs).toBeGreaterThanOrEqual(1_050);
    expect(lifestyle.travelDurationMs).toBeLessThanOrEqual(1_080);
    expect(ai.travelDurationMs / lifestyle.travelDurationMs).toBeGreaterThan(55);
  });

  it('preserves compact headway and the below-threshold state', () => {
    const compact = laneMotionTiming(887 / 3, 3)!;
    expect(compact.travelDurationMs).toBeGreaterThanOrEqual(450);
    expect(compact.travelDurationMs).toBeLessThanOrEqual(470);
    expect(laneMotionTiming(0.004, 3)).toBeNull();
  });
});
