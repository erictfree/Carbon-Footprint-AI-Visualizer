interface SyntheticRow {
  timestamp: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  requests: number;
}

export type SyntheticScenarioId = 'typical' | 'light' | 'agent' | 'unknown';

export interface SyntheticScenario {
  id: SyntheticScenarioId;
  label: string;
  description: string;
  filename: string;
  csv: string;
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

  return rowsToCsv(rows);
}

function rowsToCsv(rows: SyntheticRow[]): string {
  const header = 'timestamp,model,input_tokens,output_tokens,requests';
  return [header, ...rows.map((row) => [row.timestamp, row.model, row.inputTokens, row.outputTokens, row.requests].join(','))].join('\n');
}

function createLightWeekCsv(): string {
  const rows: SyntheticRow[] = [];
  for (let day = 1; day <= 7; day += 1) {
    rows.push({
      timestamp: `2026-07-${String(day).padStart(2, '0')}T09:00:00Z`,
      model: 'gpt-5.4-mini',
      inputTokens: 900 + day * 45,
      outputTokens: 140 + day * 12,
      requests: 2,
    });
  }
  return rowsToCsv(rows);
}

function createAgentWeekCsv(): string {
  const rows: SyntheticRow[] = [];
  for (let day = 1; day <= 7; day += 1) {
    rows.push(
      {
        timestamp: `2026-07-${String(day).padStart(2, '0')}T14:00:00Z`,
        model: 'gpt-5.5',
        inputTokens: 180_000 + day * 8_000,
        outputTokens: 90_000 + day * 3_500,
        requests: 1,
      },
      {
        timestamp: `2026-07-${String(day).padStart(2, '0')}T18:00:00Z`,
        model: 'gpt-5.4-mini',
        inputTokens: 6_000,
        outputTokens: 2_000,
        requests: 5,
      },
    );
  }
  return rowsToCsv(rows);
}

function createUnknownModelCsv(): string {
  return rowsToCsv([
    {
      timestamp: '2026-07-01T12:00:00Z',
      model: 'gpt-future-unmapped',
      inputTokens: 12_000,
      outputTokens: 2_400,
      requests: 4,
    },
    {
      timestamp: '2026-07-02T12:00:00Z',
      model: 'gpt-future-unmapped',
      inputTokens: 18_000,
      outputTokens: 4_200,
      requests: 5,
    },
  ]);
}

export const SYNTHETIC_SCENARIOS: Record<SyntheticScenarioId, SyntheticScenario> = {
  typical: {
    id: 'typical',
    label: 'Typical mixed month',
    description: 'Chat plus five coding sessions across 30 days.',
    filename: 'promptmiles-synthetic-typical-month.csv',
    csv: createSyntheticUsageCsv(),
  },
  light: {
    id: 'light',
    label: 'Light chat week',
    description: 'Two short mini-model replies per day for one week.',
    filename: 'promptmiles-synthetic-light-week.csv',
    csv: createLightWeekCsv(),
  },
  agent: {
    id: 'agent',
    label: 'Agent-heavy week',
    description: 'One long coding session per day plus smaller chat use.',
    filename: 'promptmiles-synthetic-agent-week.csv',
    csv: createAgentWeekCsv(),
  },
  unknown: {
    id: 'unknown',
    label: 'Unknown model fallback',
    description: 'Exercises the visible fallback and warning behavior.',
    filename: 'promptmiles-synthetic-unknown-model.csv',
    csv: createUnknownModelCsv(),
  },
};

export const SYNTHETIC_USAGE_CSV = SYNTHETIC_SCENARIOS.typical.csv;
