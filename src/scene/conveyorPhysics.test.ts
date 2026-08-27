import { describe, expect, it } from 'vitest';
import {
  columnsForBeltLoad,
  laneMotionTiming,
  projectBeltPose,
  projectWorldProgress,
} from './conveyorPhysics';

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
    expect(exit.leftPct).toBeGreaterThan(120);
    expect(exitSlope).toBeCloseTo(beltSlope, 4);
  });

  it('fans multiple columns out from the same vanishing point', () => {
    const farInner = projectBeltPose(0, 'right', -1);
    const farOuter = projectBeltPose(0, 'right', 1);
    const nearInner = projectBeltPose(0.8, 'right', -1);
    const nearCenter = projectBeltPose(0.8, 'right', 0);
    const nearOuter = projectBeltPose(0.8, 'right', 1);

    expect(farOuter.leftPct - farInner.leftPct).toBeCloseTo(3.38, 5);
    expect(nearCenter.leftPct - nearInner.leftPct).toBeCloseTo(12.39, 5);
    expect(nearOuter.leftPct - nearCenter.leftPct).toBeCloseTo(12.39, 5);
  });

  it('opens the same-row edge gap as the photographed belt widens', () => {
    const spriteWidthPct = 8.5;
    const edgeGaps = [0, 0.2, 0.4, 0.6, 0.8].map((progress) => {
      const inner = projectBeltPose(progress, 'right', 0, spriteWidthPct);
      const outer = projectBeltPose(progress, 'right', 1, spriteWidthPct);
      const centerGap = outer.leftPct - inner.leftPct;
      return centerGap - spriteWidthPct * inner.scale;
    });

    expect(edgeGaps[0]).toBeCloseTo(0.5, 5);
    expect(edgeGaps.at(-1)).toBeCloseTo(1, 5);
    for (let index = 1; index < edgeGaps.length; index += 1) {
      expect(edgeGaps[index]).toBeGreaterThan(edgeGaps[index - 1]!);
    }
  });

  it('applies the rail nudge only when a packed lane requests it', () => {
    const centeredFar = projectBeltPose(0, 'left');
    const packedFar = projectBeltPose(0, 'left', 0, 8.5, -0.5);
    const centeredNear = projectBeltPose(0.8, 'left');
    const packedNear = projectBeltPose(0.8, 'left', 0, 8.5, -0.5);

    expect(centeredFar.leftPct).toBeCloseTo(46.8, 5);
    expect(packedFar.leftPct).toBeCloseTo(46.3, 5);
    expect(packedNear.leftPct).toBeCloseTo(centeredNear.leftPct, 5);
  });

  it('keeps burgers opaque and carries them fully below the frame', () => {
    const far = projectBeltPose(0, 'left');
    const edge = projectBeltPose(0.8, 'left');
    const exit = projectBeltPose(1, 'left');

    expect(far.opacity).toBe(1);
    expect(edge.opacity).toBe(1);
    expect(exit.opacity).toBe(1);
    expect(exit.topPct).toBeGreaterThan(250);
    expect(exit.scale).toBeGreaterThan(3);
    expect(exit.leftPct).toBeLessThan(edge.leftPct);
  });

  it('keeps perspective-correct visible headway between consecutive rows', () => {
    const worldHeadway = 1 / 9.8;
    const frameStep = 0.0425;
    const spriteHeightPct = 24.67;
    const clearance = (backProgress: number, frontProgress: number) => {
      const back = projectBeltPose(backProgress, 'right');
      const front = projectBeltPose(frontProgress, 'right');
      const backBottom = back.topPct + 0.08 * spriteHeightPct * back.scale;
      const frontTop = front.topPct - 0.92 * spriteHeightPct * front.scale;
      return frontTop - backBottom;
    };

    for (let back = 0; back + worldHeadway + frameStep < 0.96; back += frameStep) {
      const current = clearance(back, back + worldHeadway);
      const next = clearance(back + frameStep, back + worldHeadway + frameStep);
      expect(next).toBeGreaterThanOrEqual(current - 0.01);
    }
  });

  it('fills density before increasing belt velocity for extreme rate gaps', () => {
    const ai = laneMotionTiming(1.24 / 3, 10, 3)!;
    const lifestyle = laneMotionTiming(887 / 3, 10, 3)!;

    expect(ai.intervalMs / lifestyle.intervalMs).toBeGreaterThan(700);
    expect(ai.columnCount).toBe(1);
    expect(ai.continuousMarker).toBe(true);
    expect(ai.travelDurationMs).toBe(60_000);
    expect(lifestyle.columnCount).toBe(3);
    expect(lifestyle.totalCapacity).toBe(30);
    expect(lifestyle.travelDurationMs).toBeGreaterThanOrEqual(5_900);
    expect(lifestyle.travelDurationMs).toBeLessThanOrEqual(6_000);
    expect(ai.travelDurationMs / lifestyle.travelDurationMs).toBeGreaterThan(10);
  });

  it('uses the full belt surface progressively from one to three columns', () => {
    expect(columnsForBeltLoad(1, 10, 3)).toBe(1);
    expect(columnsForBeltLoad(5, 10, 3)).toBe(1);
    expect(columnsForBeltLoad(8, 10, 3)).toBe(2);
    expect(columnsForBeltLoad(20, 10, 3)).toBe(2);
    expect(columnsForBeltLoad(21, 10, 3)).toBe(3);
    expect(columnsForBeltLoad(300, 10, 3)).toBe(3);
  });

  it('holds base speed through physical capacity, then scales to 300 per month', () => {
    const one = laneMotionTiming(1, 10, 3)!;
    const eight = laneMotionTiming(8, 10, 3)!;
    const twentyOne = laneMotionTiming(21, 10, 3)!;
    const thirty = laneMotionTiming(30, 10, 3)!;
    const threeHundred = laneMotionTiming(300, 10, 3)!;

    expect(one.columnCount).toBe(1);
    expect(one.travelDurationMs).toBe(60_000);
    expect(eight.columnCount).toBe(2);
    expect(eight.travelDurationMs).toBe(60_000);
    expect(twentyOne.columnCount).toBe(3);
    expect(twentyOne.travelDurationMs).toBe(60_000);
    expect(thirty.travelDurationMs).toBeGreaterThanOrEqual(58_000);
    expect(threeHundred.travelDurationMs).toBeGreaterThanOrEqual(5_800);
    expect(threeHundred.travelDurationMs).toBeLessThanOrEqual(5_900);
    expect(threeHundred.visualRatePerSecond).toBe(5);
  });

  it('uses multiple columns at the base speed before accelerating', () => {
    const medium = laneMotionTiming(10, 6, 3)!;
    expect(medium.columnCount).toBe(2);
    expect(medium.travelDurationMs).toBe(60_000);
  });

  it('preserves compact headway and the below-threshold state', () => {
    const compact = laneMotionTiming(887 / 3, 3, 2)!;
    expect(compact.columnCount).toBe(2);
    expect(compact.totalCapacity).toBe(6);
    expect(compact.travelDurationMs).toBeGreaterThanOrEqual(1_100);
    expect(compact.travelDurationMs).toBeLessThanOrEqual(1_160);
    expect(laneMotionTiming(0.004, 3)).toBeNull();
  });
});
