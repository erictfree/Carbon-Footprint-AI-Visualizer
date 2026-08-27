import { describe, expect, it } from 'vitest';
import { physicalLaunchInterval, projectBeltPose, projectWorldProgress } from './conveyorPhysics';

describe('conveyor physics', () => {
  it('projects the world-space endpoints exactly', () => {
    expect(projectWorldProgress(0)).toBe(0);
    expect(projectWorldProgress(1)).toBe(1);
  });

  it('expands perspective spacing before easing the final foreground step', () => {
    const projected = [0, 0.25, 0.5, 0.75, 1].map((value) => projectWorldProgress(value));
    const gaps = projected.slice(1).map((value, index) => value - projected[index]!);
    expect(gaps[1]!).toBeGreaterThan(gaps[0]!);
    expect(gaps[2]!).toBeGreaterThan(gaps[1]!);
    expect(gaps[3]!).toBeLessThan(gaps[2]!);
  });

  it('compensates the foreground velocity without flattening perspective', () => {
    const projected = [0, 0.25, 0.5, 0.75, 1].map((value) => projectWorldProgress(value));
    const farGap = projected[1]! - projected[0]!;
    const nearGap = projected[4]! - projected[3]!;

    expect(nearGap / farGap).toBeLessThan(1.02);
  });

  it('keeps the two lanes mirrored and grows a grounded object with depth', () => {
    const farLeft = projectBeltPose(0.2, 'left');
    const nearLeft = projectBeltPose(0.8, 'left');
    const nearRight = projectBeltPose(0.8, 'right');

    expect(nearLeft.topPct).toBeGreaterThan(farLeft.topPct);
    expect(nearLeft.scale).toBeGreaterThan(farLeft.scale);
    expect(nearLeft.leftPct + nearRight.leftPct).toBeCloseTo(100, 5);
  });

  it('enforces physical headway without slowing sparse rates', () => {
    expect(physicalLaunchInterval(20_000, 22_000, 4)).toBe(20_000);
    expect(physicalLaunchInterval(1_000, 22_000, 4)).toBe(6_770);
    expect(physicalLaunchInterval(1_000, 22_000, 3)).toBe(9_778);
  });
});
