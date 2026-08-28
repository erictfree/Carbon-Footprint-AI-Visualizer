import type { UsageAggregate } from '../types';

export interface GameUsageRowInputs {
  model: string;
  outputTokens: number;
  promptsPerDay: number;
}

export interface GameSetupInputs extends GameUsageRowInputs {
  additionalRows?: GameUsageRowInputs[];
}

export const DEFAULT_GAME_SETUP: GameSetupInputs = {
  model: 'gpt-5.5',
  outputTokens: 400,
  promptsPerDay: 15,
  additionalRows: [
    { model: 'claude-sonnet-4-6', outputTokens: 400, promptsPerDay: 8 },
    { model: 'gemini-3.5-flash', outputTokens: 250, promptsPerDay: 4 },
  ],
};

export function createGameUsageAggregate(
  inputs: GameSetupInputs,
  date = new Date(),
): UsageAggregate {
  const rows = [
    {
      model: inputs.model,
      outputTokens: inputs.outputTokens,
      promptsPerDay: inputs.promptsPerDay,
    },
    ...(inputs.additionalRows ?? []),
  ].map((row) => ({
    model: row.model,
    outputTokens: Math.max(1, Math.round(row.outputTokens)),
    promptsPerDay: Math.max(0, Math.round(row.promptsPerDay)),
  })).filter((row) => row.promptsPerDay > 0);

  const models = rows.map((row) => ({
    model: row.model,
    inputTokens: 0,
    outputTokens: row.outputTokens * row.promptsPerDay,
    requests: row.promptsPerDay,
  }));
  const requests = models.reduce((total, row) => total + row.requests, 0);
  const outputTokens = models.reduce((total, row) => total + row.outputTokens, 0);

  return {
    sourceName: 'Burger Works round setup',
    synthetic: true,
    rowCount: models.length,
    start: new Date(date),
    end: new Date(date),
    inputTokens: 0,
    outputTokens,
    requests,
    models,
    warnings: [],
  };
}
