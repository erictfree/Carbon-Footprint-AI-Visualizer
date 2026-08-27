import { describe, expect, it } from 'vitest';
import { calculateComparison } from '../calc/engine';
import { DEFAULT_PROFILE } from '../factors/masley';
import {
  createGameUsageAggregate,
  estimatePromptInputTokens,
} from './setup';

describe('game setup', () => {
  it('estimates prompt tokens from normalized text', () => {
    expect(estimatePromptInputTokens('12345678')).toBe(2);
    expect(estimatePromptInputTokens('   ')).toBe(1);
  });

  it('creates a one-day aggregate that the comparison engine can scale to a month', () => {
    const aggregate = createGameUsageAggregate({
      prompt: 'A twelve character prompt',
      model: 'gpt-5.5',
      outputTokens: 400,
      promptsPerDay: 10,
    }, new Date('2026-08-27T12:00:00Z'));

    expect(aggregate.requests).toBe(10);
    expect(aggregate.outputTokens).toBe(4_000);
    expect(aggregate.models).toEqual([expect.objectContaining({
      model: 'gpt-5.5',
      requests: 10,
      outputTokens: 4_000,
    })]);
    expect(aggregate.start).toEqual(aggregate.end);

    const result = calculateComparison(aggregate, {
      ...DEFAULT_PROFILE,
      flightsPerYear: { ...DEFAULT_PROFILE.flightsPerYear },
      comparisonWindow: 'month',
    });
    expect(result.sourceDays).toBe(1);
    expect(result.comparisonDays).toBe(30);
    expect(result.windowScale).toBe(30);
    expect(result.aiCarbonKgCo2e.central).toBeGreaterThan(0);
    expect(result.lifestyle.total.kgCo2e).toBeGreaterThan(0);
  });
});
