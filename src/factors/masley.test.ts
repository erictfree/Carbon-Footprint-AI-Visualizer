import { describe, expect, it } from 'vitest';
import {
  estimateRequestEnergy,
  FALLBACK_MODEL_ID,
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
});
