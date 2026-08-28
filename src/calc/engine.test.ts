import { describe, expect, it } from 'vitest';
import { SYNTHETIC_USAGE_CSV } from '../fixtures/synthetic';
import { parseUsageCsvText } from '../ingest/parseUsageCsv';
import type { LifestyleProfile } from '../types';
import { calculateComparison, comparisonDays, formatDistance } from './engine';

const profile: LifestyleProfile = {
  diet: 'avg',
  region: 'us',
  homeEnergy: 'med',
  driving: 'davg',
  flyingFrequency: 'never',
  comparisonWindow: 'csv',
  startCity: 'Austin, TX',
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
    expect(result.lifestyle.total.miles).toBeGreaterThan(result.aiMiles.central);
    expect(result.lifestyle.components.diet.kgCo2e).toBeCloseTo((2_500 / 365) * 30, 8);
    expect(result.lifestyle.components.baseline.kgCo2e).toBeCloseTo((3_000 / 365) * 30, 8);
    expect(result.lifestyle.components.driving.kgCo2e).toBeCloseTo((4_800 / 365) * 30, 8);
    expect(result.lifestyle.components.flights.miles).toBe(0);
    expect(result.lifestyle.components.home.kgCo2e).toBeCloseTo((3_500 / 365) * 30, 8);
    expect(result.unknownModels).toEqual([]);
    expect(result.modelBreakdown).toHaveLength(2);
    expect(result.modelBreakdown[0]?.energyWh.central).toBeGreaterThan(0);
  });

  it('normalizes AI and lifestyle values to the selected comparison window', () => {
    const aggregate = parseUsageCsvText(SYNTHETIC_USAGE_CSV, { synthetic: true });
    const month = calculateComparison(aggregate, profile);
    const week = calculateComparison(aggregate, { ...profile, comparisonWindow: 'week' });

    expect(week.sourceDays).toBe(30);
    expect(week.comparisonDays).toBe(7);
    expect(week.windowScale).toBeCloseTo(7 / 30, 10);
    expect(week.energyWh.central).toBeCloseTo(month.energyWh.central * (7 / 30), 10);
    expect(week.lifestyle.components.driving.kgCo2e).toBeCloseTo(4_800 * (7 / 365), 10);
  });

  it('uses Masley’s categorical annual flying factor', () => {
    const aggregate = parseUsageCsvText(SYNTHETIC_USAGE_CSV, { synthetic: true });
    const result = calculateComparison(aggregate, {
      ...profile,
      comparisonWindow: 'week',
      flyingFrequency: 'often',
    });

    expect(result.lifestyle.components.flights.kgCo2e).toBeCloseTo(8_000 * (7 / 365), 10);
  });

  it('adds grid electricity and embodied hardware carbon exactly', () => {
    const aggregate = parseUsageCsvText(
      'timestamp,model,input_tokens,output_tokens,requests\n2026-08-01,gpt-5.5,100,400,1',
    );
    const result = calculateComparison(aggregate, profile);

    expect(result.aiEmbodiedCarbonGrams.central).toBeCloseTo(0.0692, 8);
    expect(result.aiCarbonKgCo2e.central).toBeCloseTo(
      ((2.6601 / 1_000) * 380 + 0.0692) / 1_000,
      10,
    );
    expect(result.ratio).toBeCloseTo(
      result.lifestyle.total.kgCo2e / result.aiCarbonKgCo2e.central,
      10,
    );
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
