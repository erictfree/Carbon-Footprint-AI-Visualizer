import { describe, expect, it } from 'vitest';
import { distanceStageForMiles } from './PromptMilesScene';

describe('distanceStageForMiles', () => {
  it('uses the PRD distance bands for cinematic framing', () => {
    expect(distanceStageForMiles(5 / 5_280).id).toBe('driveway');
    expect(distanceStageForMiles(0.5).id).toBe('neighborhood');
    expect(distanceStageForMiles(13).id).toBe('regional');
    expect(distanceStageForMiles(650).id).toBe('continental');
  });

  it('switches stages at the documented boundaries', () => {
    expect(distanceStageForMiles(10 / 5_280).id).toBe('neighborhood');
    expect(distanceStageForMiles(2).id).toBe('regional');
    expect(distanceStageForMiles(50).id).toBe('continental');
  });
});
