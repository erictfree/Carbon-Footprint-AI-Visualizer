import { describe, expect, it } from 'vitest';
import { SYNTHETIC_SCENARIOS } from '../fixtures/synthetic';
import { parseUsageCsvText } from '../ingest/parseUsageCsv';
import type { LifestyleProfile } from '../types';
import { deserializeSnapshot, getResumableSnapshot, serializeSnapshot } from './persistence';

describe('local aggregate persistence', () => {
  it('round-trips the profile and aggregate without raw CSV rows', () => {
    const profile: LifestyleProfile = {
      diet: 'vegan',
      region: 'uk',
      homeEnergy: 'apt',
      driving: 'dlo',
      flyingFrequency: 'rare',
      comparisonWindow: 'week',
      startCity: 'London',
      model3Efficiency: 4.3,
    };
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

  it('keeps synthetic demonstrations deterministic between browser sessions', () => {
    const profile: LifestyleProfile = {
      diet: 'vegan',
      region: 'uk',
      homeEnergy: 'apt',
      driving: 'dlo',
      flyingFrequency: 'rare',
      comparisonWindow: 'week',
      startCity: 'London',
      model3Efficiency: 4.3,
    };
    const synthetic = parseUsageCsvText(SYNTHETIC_SCENARIOS.light.csv, {
      sourceName: SYNTHETIC_SCENARIOS.light.filename,
      synthetic: true,
    });
    const imported = { ...synthetic, synthetic: false };

    expect(getResumableSnapshot({ profile, aggregate: synthetic })).toBeNull();
    expect(getResumableSnapshot({ profile, aggregate: imported })).toEqual({ profile, aggregate: imported });
  });

  it('migrates the original diet-only profile to the complete lifestyle defaults', () => {
    const restored = deserializeSnapshot(JSON.stringify({
      version: 1,
      savedAt: '2026-08-26T00:00:00.000Z',
      profile: { diet: 'vegan', region: 'uk', model3Efficiency: 4.3 },
      aggregate: null,
    }));

    expect(restored?.profile).toMatchObject({
      diet: 'vegan',
      region: 'uk',
      homeEnergy: 'med',
      driving: 'davg',
      flyingFrequency: 'some',
      comparisonWindow: 'csv',
    });
  });

  it('bounds invalid saved profile values before they reach the engine', () => {
    const restored = deserializeSnapshot(JSON.stringify({
      version: 2,
      savedAt: '2026-08-26T00:00:00.000Z',
      profile: {
        diet: 'vegan',
        region: 'uk',
        homeEnergy: 'castle',
        driving: 'everywhere',
        flyingFrequency: 'constantly',
        comparisonWindow: 'decade',
        model3Efficiency: 12,
      },
      aggregate: null,
    }));

    expect(restored?.profile).toMatchObject({
      homeEnergy: 'med',
      driving: 'davg',
      flyingFrequency: 'some',
      comparisonWindow: 'csv',
      model3Efficiency: 4.6,
    });
  });

  it('rejects malformed or unknown snapshot versions', () => {
    expect(deserializeSnapshot('{"version":2}')).toBeNull();
    expect(deserializeSnapshot('not-json')).toBeNull();
  });
});
