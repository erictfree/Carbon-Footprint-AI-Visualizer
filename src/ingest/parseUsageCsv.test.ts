import { describe, expect, it } from 'vitest';
import { SYNTHETIC_USAGE_CSV } from '../fixtures/synthetic';
import { parseUsageCsvText } from './parseUsageCsv';

describe('usage CSV ingestion', () => {
  it('aggregates the seeded synthetic month deterministically', () => {
    const result = parseUsageCsvText(SYNTHETIC_USAGE_CSV, { synthetic: true });

    expect(result.synthetic).toBe(true);
    expect(result.rowCount).toBe(65);
    expect(result.models.map((model) => model.model).sort()).toEqual(['gpt-5.4-mini', 'gpt-5.5']);
    expect(result.start.toISOString()).toBe('2026-07-01T12:00:00.000Z');
    expect(result.end.toISOString()).toBe('2026-07-30T12:00:00.000Z');
    expect(result.outputTokens).toBeGreaterThan(200_000);
  });

  it('accepts known column-name variations', () => {
    const csv = [
      'bucket_start_time,model_name,prompt_tokens,completion_tokens,num_model_requests',
      '2026-08-01T00:00:00Z,gpt-5.5,1200,400,2',
    ].join('\n');

    const result = parseUsageCsvText(csv);

    expect(result.inputTokens).toBe(1_200);
    expect(result.outputTokens).toBe(400);
    expect(result.requests).toBe(2);
  });

  it('rejects a CSV without the minimum semantic fields', () => {
    expect(() => parseUsageCsvText('thing,value\nfoo,20')).toThrow(/date, model/i);
  });
});
