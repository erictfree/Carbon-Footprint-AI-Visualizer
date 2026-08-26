import { describe, expect, it } from 'vitest';
import {
  DRIVING_KG_CO2E_PER_MILE,
  estimateRequestEnergy,
  FALLBACK_MODEL_ID,
  FLIGHT_KG_CO2E,
  HOME_ENERGY,
  MODEL_CURVES,
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

  it('uses the documented fallback for an unknown model', () => {
    const resolved = resolveModelCurve('future-model-9000');

    expect(resolved.fallback).toBe(true);
    expect(resolved.curve.id).toBe(FALLBACK_MODEL_ID);
  });

  it('locks the Masley and PRD lifestyle conversion factors', () => {
    expect(DRIVING_KG_CO2E_PER_MILE).toBe(0.4);
    expect(Object.values(HOME_ENERGY).map((home) => home.annualKgCo2e)).toEqual([1_500, 3_500, 7_000]);
    expect(Object.values(FLIGHT_KG_CO2E).map((flight) => flight.kgCo2ePerRoundTrip)).toEqual([250, 1_000, 1_600]);
  });
});
