import { describe, expect, it } from 'vitest';
import { SYNTHETIC_SCENARIOS } from '../fixtures/synthetic';
import { parseUsageCsvText } from '../ingest/parseUsageCsv';
import type { LifestyleProfile } from '../types';
import { deserializeSnapshot, serializeSnapshot } from './persistence';

describe('local aggregate persistence', () => {
  it('round-trips the profile and aggregate without raw CSV rows', () => {
    const profile: LifestyleProfile = { diet: 'vegan', region: 'uk', model3Efficiency: 4.3 };
    const aggregate = parseUsageCsvText(SYNTHETIC_SCENARIOS.light.csv, {
      sourceName: SYNTHETIC_SCENARIOS.light.filename,
      synthetic: true,
    });

    const restored = deserializeSnapshot(serializeSnapshot(profile, aggregate));

    expect(restored?.profile).toEqual(profile);
    expect(restored?.aggregate?.start).toBeInstanceOf(Date);
    expect(restored?.aggregate?.rowCount).toBe(7);
    expect(restored?.aggregate).not.toHaveProperty('rows');
  });

  it('rejects malformed or unknown snapshot versions', () => {
    expect(deserializeSnapshot('{"version":2}')).toBeNull();
    expect(deserializeSnapshot('not-json')).toBeNull();
  });
});
