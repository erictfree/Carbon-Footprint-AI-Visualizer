import { describe, expect, it } from 'vitest';
import {
  columnOffsetForIndex,
  columnsForBeltLoad,
  laneMotionTiming,
  packedColumnSpreadScale,
  packedRailCenterOffset,
  projectBeltPose,
  projectWorldProgress,
  ROUND_PLAYBACK_DURATION_MS,
} from './conveyorPhysics';

function scheduledCompletionMs(burgers: number, rowCapacity: number, maxColumns = 3): number {
  const timing = laneMotionTiming(burgers, rowCapacity, maxColumns)!;
  const rowCount = Math.ceil(Math.max(1, Math.ceil(burgers)) / timing.columnCount);
  return (rowCount - 1) * timing.intervalMs * timing.columnCount + timing.travelDurationMs;
}

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

  it('keeps the photographed lane asymmetry and grows a grounded object with depth', () => {
    const farLeft = projectBeltPose(0.2, 'left');
    const nearLeft = projectBeltPose(0.8, 'left');
    const nearRight = projectBeltPose(0.8, 'right');

    expect(nearLeft.topPct).toBeGreaterThan(farLeft.topPct);
    expect(nearLeft.scale).toBeGreaterThan(farLeft.scale);
    expect(nearLeft.leftPct).toBeCloseTo(21.6, 5);
    expect(nearRight.leftPct).toBeCloseTo(80.55, 5);
  });

  it('follows the calibrated straight centerlines through the off-screen exit', () => {
    const far = projectBeltPose(0, 'right');
    const edge = projectBeltPose(0.8, 'right');
    const exit = projectBeltPose(1, 'right');
    const beltSlope = (edge.leftPct - far.leftPct) / (edge.topPct - far.topPct);
    const exitSlope = (exit.leftPct - edge.leftPct) / (exit.topPct - edge.topPct);

    expect(far.leftPct).toBeCloseTo(54.95, 4);
    expect(edge.leftPct).toBeCloseTo(80.55, 4);
    expect(exit.leftPct).toBeGreaterThan(100);
    expect(exitSlope).toBeCloseTo(beltSlope, 4);
  });

  it('fans multiple columns out from the same vanishing point', () => {
    const farInner = projectBeltPose(0, 'right', -1);
    const farOuter = projectBeltPose(0, 'right', 1);
    const nearInner = projectBeltPose(0.8, 'right', -1);
    const nearCenter = projectBeltPose(0.8, 'right', 0);
    const nearOuter = projectBeltPose(0.8, 'right', 1);

    expect(farOuter.leftPct - farInner.leftPct).toBeCloseTo(2.5, 5);
    expect(nearCenter.leftPct - nearInner.leftPct).toBeCloseTo(11.53, 5);
    expect(nearOuter.leftPct - nearCenter.leftPct).toBeCloseTo(11.53, 5);
  });

  it('keeps same-row sprites separated along straight belt rays', () => {
    const spriteWidthPct = 8.5;
    const progressSamples = [0, 0.2, 0.4, 0.6, 0.8];
    const edgeGaps = progressSamples.map((progress) => {
      const inner = projectBeltPose(progress, 'right', 0, spriteWidthPct);
      const outer = projectBeltPose(progress, 'right', 1, spriteWidthPct);
      const centerGap = outer.leftPct - inner.leftPct;
      return centerGap - spriteWidthPct * inner.scale;
    });

    expect(edgeGaps[0]).toBeCloseTo(0.4, 5);
    expect(edgeGaps.at(-1)).toBeCloseTo(1.5, 5);
    for (const edgeGap of edgeGaps) {
      expect(edgeGap).toBeGreaterThan(0);
    }

    const outerSamples = [0, 0.4, 0.8].map((progress) => (
      projectBeltPose(progress, 'right', 1, spriteWidthPct)
    ));
    const rearSlope = (
      outerSamples[1]!.leftPct - outerSamples[0]!.leftPct
    ) / (
      outerSamples[1]!.topPct - outerSamples[0]!.topPct
    );
    const frontSlope = (
      outerSamples[2]!.leftPct - outerSamples[1]!.leftPct
    ) / (
      outerSamples[2]!.topPct - outerSamples[1]!.topPct
    );
    expect(frontSlope).toBeCloseTo(rearSlope, 5);
  });

  it('applies a rear rail-safe nudge only when a packed lane requests it', () => {
    expect(packedRailCenterOffset('left', 2)).toBe(0);
    expect(packedRailCenterOffset('right', 2)).toBe(0);
    expect(packedRailCenterOffset('left', 3)).toBe(-2.4);
    expect(packedRailCenterOffset('right', 3)).toBe(0);

    const centeredFar = projectBeltPose(0, 'left');
    const packedFar = projectBeltPose(
      0,
      'left',
      0,
      8.5,
      packedRailCenterOffset('left', 3),
    );
    const centeredNear = projectBeltPose(0.8, 'left');
    const packedNear = projectBeltPose(
      0.8,
      'left',
      0,
      8.5,
      packedRailCenterOffset('left', 3),
    );

    expect(centeredFar.leftPct).toBeCloseTo(48.4, 5);
    expect(packedFar.leftPct).toBeCloseTo(46, 5);
    expect(packedNear.leftPct).toBeCloseTo(centeredNear.leftPct, 5);
  });

  it('compresses only the distant packed right row around its centerline', () => {
    const farScale = packedColumnSpreadScale('right', 3);
    const farInner = projectBeltPose(0, 'right', -1, 8.5, 0, farScale);
    const farCenter = projectBeltPose(0, 'right', 0, 8.5, 0, farScale);
    const farOuter = projectBeltPose(0, 'right', 1, 8.5, 0, farScale);
    const nearInner = projectBeltPose(0.8, 'right', -1, 8.5, 0, farScale);
    const nearOuter = projectBeltPose(0.8, 'right', 1, 8.5, 0, farScale);

    expect(farScale).toBe(0.56);
    expect(packedColumnSpreadScale('left', 3)).toBe(1);
    expect(farCenter.leftPct).toBeCloseTo(54.95, 5);
    expect(farOuter.leftPct - farInner.leftPct).toBeCloseTo(2.5 * 0.56, 5);
    expect(nearOuter.leftPct - nearInner.leftPct).toBeCloseTo(23.06, 5);
  });

  it('keeps the tightened lifestyle columns evenly spaced', () => {
    const offsets = [0, 1, 2].map((index) => (
      columnOffsetForIndex(index, 3, 'right')
    ));
    const firstGap = offsets[1]! - offsets[0]!;
    const secondGap = offsets[2]! - offsets[1]!;

    expect(offsets).toEqual([-1, 0, 1]);
    expect(firstGap).toBeCloseTo(1, 5);
    expect(secondGap).toBeCloseTo(firstGap, 5);
    expect(columnOffsetForIndex(1, 3, 'left')).toBe(0);
  });

  it('keeps burgers opaque and carries them fully below the frame', () => {
    const far = projectBeltPose(0, 'left');
    const edge = projectBeltPose(0.8, 'left');
    const exit = projectBeltPose(1, 'left');

    expect(far.opacity).toBe(1);
    expect(edge.opacity).toBe(1);
    expect(exit.opacity).toBe(1);
    expect(exit.topPct).toBeGreaterThan(250);
    expect(exit.scale).toBeGreaterThan(edge.scale);
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

  it('fills density and fits extreme rate gaps to the soundtrack', () => {
    const ai = laneMotionTiming(1.24 / 3, 10, 3)!;
    const lifestyle = laneMotionTiming(887 / 3, 10, 3)!;

    expect(ai.intervalMs / lifestyle.intervalMs).toBeGreaterThan(300);
    expect(ai.columnCount).toBe(1);
    expect(ai.continuousMarker).toBe(true);
    expect(ai.travelDurationMs).toBe(ROUND_PLAYBACK_DURATION_MS);
    expect(lifestyle.columnCount).toBe(3);
    expect(lifestyle.totalCapacity).toBe(30);
    expect(lifestyle.travelDurationMs).toBeGreaterThan(4_400);
    expect(lifestyle.travelDurationMs).toBeLessThan(4_500);
    expect(ai.travelDurationMs / lifestyle.travelDurationMs).toBeGreaterThan(10);
    expect(scheduledCompletionMs(1.24 / 3, 10, 3)).toBeCloseTo(ROUND_PLAYBACK_DURATION_MS, 5);
    expect(scheduledCompletionMs(887 / 3, 10, 3)).toBeCloseTo(ROUND_PLAYBACK_DURATION_MS, 5);
  });

  it('uses the full belt surface progressively from one to three columns', () => {
    expect(columnsForBeltLoad(1, 10, 3)).toBe(1);
    expect(columnsForBeltLoad(5, 10, 3)).toBe(1);
    expect(columnsForBeltLoad(8, 10, 3)).toBe(2);
    expect(columnsForBeltLoad(20, 10, 3)).toBe(2);
    expect(columnsForBeltLoad(21, 10, 3)).toBe(3);
    expect(columnsForBeltLoad(300, 10, 3)).toBe(3);
  });

  it('uses more density before shortening travel and always ends with the song', () => {
    const one = laneMotionTiming(1, 10, 3)!;
    const eight = laneMotionTiming(8, 10, 3)!;
    const twentyOne = laneMotionTiming(21, 10, 3)!;
    const thirty = laneMotionTiming(30, 10, 3)!;
    const threeHundred = laneMotionTiming(300, 10, 3)!;

    expect(one.columnCount).toBe(1);
    expect(one.travelDurationMs).toBe(ROUND_PLAYBACK_DURATION_MS);
    expect(eight.columnCount).toBe(2);
    expect(eight.travelDurationMs).toBeGreaterThan(27_000);
    expect(twentyOne.columnCount).toBe(3);
    expect(twentyOne.travelDurationMs).toBeGreaterThan(26_000);
    expect(thirty.travelDurationMs).toBeGreaterThan(25_000);
    expect(threeHundred.travelDurationMs).toBeGreaterThan(4_300);
    expect(threeHundred.travelDurationMs).toBeLessThan(4_500);
    expect(threeHundred.visualRatePerSecond).toBeCloseTo(
      300 / (ROUND_PLAYBACK_DURATION_MS / 1_000),
      5,
    );
    for (const burgers of [1, 8, 21, 30, 300]) {
      expect(scheduledCompletionMs(burgers, 10, 3)).toBeCloseTo(ROUND_PLAYBACK_DURATION_MS, 5);
    }
  });

  it('uses multiple columns while retaining a track-length batch', () => {
    const medium = laneMotionTiming(10, 6, 3)!;
    expect(medium.columnCount).toBe(2);
    expect(medium.travelDurationMs).toBeGreaterThan(27_000);
    expect(scheduledCompletionMs(10, 6, 3)).toBeCloseTo(ROUND_PLAYBACK_DURATION_MS, 5);
  });

  it('preserves compact headway and the below-threshold state', () => {
    const compact = laneMotionTiming(887 / 3, 3, 2)!;
    expect(compact.columnCount).toBe(2);
    expect(compact.totalCapacity).toBe(6);
    expect(compact.travelDurationMs).toBeGreaterThan(900);
    expect(compact.travelDurationMs).toBeLessThan(930);
    expect(scheduledCompletionMs(887 / 3, 3, 2)).toBeCloseTo(ROUND_PLAYBACK_DURATION_MS, 5);
    expect(laneMotionTiming(0.004, 3)).toBeNull();
  });
});
