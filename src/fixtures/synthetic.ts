interface SyntheticRow {
  timestamp: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  requests: number;
}

function seededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state * 1_664_525 + 1_013_904_223) >>> 0;
    return state / 4_294_967_296;
  };
}

export function createSyntheticUsageCsv(seed = 42): string {
  const random = seededRandom(seed);
  const rows: SyntheticRow[] = [];

  for (let day = 1; day <= 30; day += 1) {
    const date = `2026-07-${String(day).padStart(2, '0')}T12:00:00Z`;
    const miniRequests = 8 + Math.floor(random() * 11);
    const standardRequests = 2 + Math.floor(random() * 5);

    rows.push({
      timestamp: date,
      model: 'gpt-5.4-mini',
      inputTokens: Math.round(miniRequests * (650 + random() * 650)),
      outputTokens: Math.round(miniRequests * (180 + random() * 380)),
      requests: miniRequests,
    });
    rows.push({
      timestamp: date,
      model: 'gpt-5.5',
      inputTokens: Math.round(standardRequests * (1_200 + random() * 1_800)),
      outputTokens: Math.round(standardRequests * (350 + random() * 850)),
      requests: standardRequests,
    });

    if (day % 6 === 0) {
      rows.push({
        timestamp: date,
        model: 'gpt-5.5',
        inputTokens: Math.round(80_000 + random() * 60_000),
        outputTokens: Math.round(45_000 + random() * 55_000),
        requests: 1,
      });
    }
  }

  const header = 'timestamp,model,input_tokens,output_tokens,requests';
  return [
    header,
    ...rows.map((row) =>
      [row.timestamp, row.model, row.inputTokens, row.outputTokens, row.requests].join(','),
    ),
  ].join('\n');
}

export const SYNTHETIC_USAGE_CSV = createSyntheticUsageCsv();
