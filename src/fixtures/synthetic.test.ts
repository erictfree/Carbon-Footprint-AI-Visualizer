import { describe, expect, it } from 'vitest';
import { calculateComparison } from '../calc/engine';
import { DEFAULT_PROFILE } from '../factors/masley';
import { parseUsageCsvText } from '../ingest/parseUsageCsv';
import { SYNTHETIC_SCENARIOS } from './synthetic';

const profile = DEFAULT_PROFILE;

describe('synthetic development scenarios', () => {
  it('covers light, typical, agent-heavy, billion-token, and fallback outcomes', () => {
    const results = Object.values(SYNTHETIC_SCENARIOS).map((scenario) => {
      const aggregate = parseUsageCsvText(scenario.csv, { synthetic: true });
      return { id: scenario.id, result: calculateComparison(aggregate, profile) };
    });
    const light = results.find((entry) => entry.id === 'light')!.result;
    const typical = results.find((entry) => entry.id === 'typical')!.result;
    const agent = results.find((entry) => entry.id === 'agent')!.result;
    const billion = results.find((entry) => entry.id === 'billion')!.result;
    const unknown = results.find((entry) => entry.id === 'unknown')!.result;
    const billionAggregate = parseUsageCsvText(SYNTHETIC_SCENARIOS.billion.csv, { synthetic: true });

    expect(light.aiMiles.central).toBeLessThan(typical.aiMiles.central);
    expect(agent.aiMiles.central).toBeGreaterThan(typical.aiMiles.central);
    expect(billion.aiMiles.central).toBeGreaterThan(agent.aiMiles.central);
    expect(billionAggregate.inputTokens + billionAggregate.outputTokens).toBe(1_000_000_000);
    expect(unknown.unknownModels).toEqual(['gpt-future-unmapped']);
  });
});
