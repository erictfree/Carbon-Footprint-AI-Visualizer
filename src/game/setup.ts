import type { UsageAggregate } from '../types';

export interface GameUsageRowInputs {
  model: string;
  outputTokens: number;
  promptsPerDay: number;
}

export interface GameSetupInputs extends GameUsageRowInputs {
  prompt: string;
  additionalRows?: GameUsageRowInputs[];
}

export const DEFAULT_GAME_SETUP: GameSetupInputs = {
  prompt: 'Explain how AI energy use compares with everyday carbon emissions.',
  model: 'gpt-5.5',
  outputTokens: 400,
  promptsPerDay: 15,
  additionalRows: [
    { model: 'claude-sonnet-4-6', outputTokens: 400, promptsPerDay: 8 },
    { model: 'gemini-3.5-flash', outputTokens: 250, promptsPerDay: 4 },
  ],
};

export function estimatePromptInputTokens(prompt: string): number {
  const normalized = prompt.trim().replace(/\s+/g, ' ');
  return Math.max(1, Math.ceil(normalized.length / 4));
}

export function createGameUsageAggregate(
  inputs: GameSetupInputs,
  date = new Date(),
): UsageAggregate {
  const inputTokensPerRequest = estimatePromptInputTokens(inputs.prompt);
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
    inputTokens: inputTokensPerRequest * row.promptsPerDay,
    outputTokens: row.outputTokens * row.promptsPerDay,
    requests: row.promptsPerDay,
  }));
  const requests = models.reduce((total, row) => total + row.requests, 0);
  const inputTokens = models.reduce((total, row) => total + row.inputTokens, 0);
  const outputTokens = models.reduce((total, row) => total + row.outputTokens, 0);

  return {
    sourceName: 'Burger Works round setup',
    synthetic: true,
    rowCount: models.length,
    start: new Date(date),
    end: new Date(date),
    inputTokens,
    outputTokens,
    requests,
    models,
    warnings: [],
  };
}
