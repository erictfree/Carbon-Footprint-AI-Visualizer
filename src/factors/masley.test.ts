import { describe, expect, it } from 'vitest';
import {
  COUNTRY_DIET,
  DRIVING,
  estimateRequestEmbodiedCarbon,
  estimateRequestEnergy,
  FALLBACK_MODEL_ID,
  FLYING,
  HOME_ENERGY,
  MODEL_CURVES,
  REGIONS,
  resolveModelCurve,
} from './masley';

describe('Masley factor interpolation', () => {
  it('contains the complete nine-model Masley snapshot', () => {
    expect(Object.keys(MODEL_CURVES)).toHaveLength(9);
    expect(MODEL_CURVES['claude-sonnet-4-6']?.name).toBe('Claude Sonnet 4.6');
    expect(MODEL_CURVES['gemini-3.5-flash']?.checkpoints).toHaveLength(8);
  });

  it('preserves a published checkpoint exactly', () => {
    const result = estimateRequestEnergy(MODEL_CURVES['gpt-5.5']!, 400);

    expect(result.central).toBeCloseTo(2.6601, 6);
    expect(result.low).toBeCloseTo(1.7417, 6);
    expect(result.high).toBeCloseTo(3.5784, 6);
  });

  it('interpolates between output-token checkpoints', () => {
    const result = estimateRequestEnergy(MODEL_CURVES['gpt-5.4-mini']!, 325);

    expect(result.low).toBeLessThan(result.central);
    expect(result.central).toBeLessThan(result.high);
    expect(result.central).toBeGreaterThan(0.1943);
    expect(result.central).toBeLessThan(0.3093);
  });

  it('preserves the published embodied-hardware checkpoint', () => {
    const result = estimateRequestEmbodiedCarbon(MODEL_CURVES['gpt-5.5']!, 400);

    expect(result).toEqual({ low: 0.0692, central: 0.0692, high: 0.0692 });
  });

  it('uses the documented fallback for an unknown model', () => {
    const resolved = resolveModelCurve('future-model-9000');

    expect(resolved.fallback).toBe(true);
    expect(resolved.curve.id).toBe(FALLBACK_MODEL_ID);
  });

  it('locks the Masley and PRD lifestyle conversion factors', () => {
    expect(Object.values(DRIVING).map((driving) => driving.annualKgCo2e)).toEqual([
      0,
      1_200,
      4_800,
      10_000,
    ]);
    expect(Object.values(HOME_ENERGY).map((home) => home.annualKgCo2e)).toEqual([1_500, 3_500, 7_000]);
    expect(Object.values(FLYING).map((flying) => flying.annualKgCo2e)).toEqual([0, 560, 2_300, 8_000]);
    expect(Object.values(REGIONS).map((region) => region.annualBaselineKgCo2e)).toEqual([
      3_000,
      1_800,
      1_700,
      2_500,
      900,
      1_800,
    ]);
    expect(COUNTRY_DIET).toEqual({
      us: 'avg',
      eu: 'light',
      uk: 'avg',
      cn: 'light',
      in: 'light',
      world: 'light',
    });
  });
});
