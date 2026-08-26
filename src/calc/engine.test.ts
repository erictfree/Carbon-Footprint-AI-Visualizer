import { describe, expect, it } from 'vitest';
import { SYNTHETIC_USAGE_CSV } from '../fixtures/synthetic';
import { parseUsageCsvText } from '../ingest/parseUsageCsv';
import type { LifestyleProfile } from '../types';
import { calculateComparison, comparisonDays, formatDistance } from './engine';

const profile: LifestyleProfile = {
  diet: 'avg',
  region: 'us',
  model3Efficiency: 4,
};

describe('comparison engine', () => {
  it('calculates a deterministic bounded result for the synthetic month', () => {
    const aggregate = parseUsageCsvText(SYNTHETIC_USAGE_CSV, { synthetic: true });
    const result = calculateComparison(aggregate, profile);

    expect(comparisonDays(aggregate)).toBe(30);
    expect(result.energyWh.low).toBeLessThan(result.energyWh.central);
    expect(result.energyWh.central).toBeLessThan(result.energyWh.high);
    expect(result.aiMiles.central).toBeCloseTo((result.energyWh.central / 1_000) * 4, 8);
    expect(result.lifestyleMiles).toBeGreaterThan(result.aiMiles.central);
    expect(result.unknownModels).toEqual([]);
    expect(result.modelBreakdown).toHaveLength(2);
    expect(result.modelBreakdown[0]?.energyWh.central).toBeGreaterThan(0);
  });

  it('surfaces unknown models while still producing a fallback estimate', () => {
    const aggregate = parseUsageCsvText(
      'timestamp,model,input_tokens,output_tokens,requests\n2026-08-01,mystery-model,1000,400,1',
    );
    const result = calculateComparison(aggregate, profile);

    expect(result.unknownModels).toEqual(['mystery-model']);
    expect(result.energyWh.central).toBeGreaterThan(0);
    expect(result.modelBreakdown[0]?.fallback).toBe(true);
  });

  it('formats sub-mile distances in concrete units', () => {
    expect(formatDistance(1 / 63_360)).toBe('1.0 in');
    expect(formatDistance(10 / 5_280)).toBe('10 ft');
    expect(formatDistance(1.25)).toBe('1.25 mi');
  });
});
