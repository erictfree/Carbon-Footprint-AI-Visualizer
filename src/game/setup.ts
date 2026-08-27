import type { UsageAggregate } from '../types';

export interface GameSetupInputs {
  prompt: string;
  model: string;
  outputTokens: number;
  promptsPerDay: number;
}

export const DEFAULT_GAME_SETUP: GameSetupInputs = {
  prompt: 'Explain how AI energy use compares with everyday carbon emissions.',
  model: 'gpt-5.5',
  outputTokens: 400,
  promptsPerDay: 10,
};

export function estimatePromptInputTokens(prompt: string): number {
  const normalized = prompt.trim().replace(/\s+/g, ' ');
  return Math.max(1, Math.ceil(normalized.length / 4));
}

export function createGameUsageAggregate(
  inputs: GameSetupInputs,
  date = new Date(),
): UsageAggregate {
  const requests = Math.max(1, Math.round(inputs.promptsPerDay));
  const outputTokensPerRequest = Math.max(1, Math.round(inputs.outputTokens));
  const inputTokensPerRequest = estimatePromptInputTokens(inputs.prompt);

  return {
    sourceName: 'Burger Works round setup',
    synthetic: true,
    rowCount: 1,
    start: new Date(date),
    end: new Date(date),
    inputTokens: inputTokensPerRequest * requests,
    outputTokens: outputTokensPerRequest * requests,
    requests,
    models: [{
      model: inputs.model,
      inputTokens: inputTokensPerRequest * requests,
      outputTokens: outputTokensPerRequest * requests,
      requests,
    }],
    warnings: [],
  };
}
