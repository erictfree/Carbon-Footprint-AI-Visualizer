import { describe, expect, it } from 'vitest';
import { calculateComparison } from '../calc/engine';
import { DEFAULT_PROFILE } from '../factors/masley';
import {
  createGameUsageAggregate,
  DEFAULT_GAME_SETUP,
} from './setup';

describe('game setup', () => {
  it('creates a one-day aggregate that the comparison engine can scale to a month', () => {
    const aggregate = createGameUsageAggregate({
      model: 'gpt-5.5',
      outputTokens: 400,
      promptsPerDay: 10,
    }, new Date('2026-08-27T12:00:00Z'));

    expect(aggregate.requests).toBe(10);
    expect(aggregate.outputTokens).toBe(4_000);
    expect(aggregate.inputTokens).toBe(0);
    expect(aggregate.models).toEqual([expect.objectContaining({
      model: 'gpt-5.5',
      requests: 10,
      outputTokens: 4_000,
    })]);
    expect(aggregate.start).toEqual(aggregate.end);

    const result = calculateComparison(aggregate, {
      ...DEFAULT_PROFILE,
      comparisonWindow: 'month',
    });
    expect(result.sourceDays).toBe(1);
    expect(result.comparisonDays).toBe(30);
    expect(result.windowScale).toBe(30);
    expect(result.aiCarbonKgCo2e.central).toBeGreaterThan(0);
    expect(result.lifestyle.total.kgCo2e).toBeGreaterThan(0);
  });

  it('matches Masley’s three-row default AI mix', () => {
    const aggregate = createGameUsageAggregate(DEFAULT_GAME_SETUP);
    const result = calculateComparison(aggregate, {
      ...DEFAULT_PROFILE,
      comparisonWindow: 'month',
    });

    expect(aggregate.rowCount).toBe(3);
    expect(aggregate.requests).toBe(27);
    expect(aggregate.outputTokens).toBe(10_200);
    expect(aggregate.models.map(({ model, requests, outputTokens }) => ({
      model,
      requests,
      outputTokens,
    }))).toEqual([
      { model: 'gpt-5.5', requests: 15, outputTokens: 6_000 },
      { model: 'claude-sonnet-4-6', requests: 8, outputTokens: 3_200 },
      { model: 'gemini-3.5-flash', requests: 4, outputTokens: 1_000 },
    ]);
    expect(result.energyWh.central).toBeCloseTo(1_537.857, 6);
    expect(result.aiEmbodiedCarbonGrams.central).toBeCloseTo(41.04, 6);
    expect(result.aiCarbonKgCo2e.central).toBeCloseTo(0.62542566, 8);
    expect(result.lifestyle.total.kgCo2e).toBeCloseTo((16_100 / 365) * 30, 8);
  });
});
