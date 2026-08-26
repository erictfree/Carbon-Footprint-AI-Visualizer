import type { DietId, RangeValue, RegionId } from '../types';

export const MASLEY_SOURCE = {
  label: 'Andy Masley AI Prompt Footprint / EcoLogits v0.10',
  url: 'https://andymasley.com/visuals/ai-prompt-footprint-source.txt',
  version: 'EcoLogits v0.10 snapshot',
  updated: '2026-06-10',
  note: 'Provisional: output-token scenario interpolation; input-token energy is not yet modeled.',
} as const;

interface EnergyCheckpoint {
  outputTokens: number;
  energyWh: RangeValue;
}

interface ModelCurve {
  id: string;
  name: string;
  checkpoints: EnergyCheckpoint[];
}

const tokenCheckpoints = [50, 170, 250, 400, 5_000, 15_000, 100_000, 500_000];

function curve(
  id: string,
  name: string,
  central: number[],
  low: number[],
  high: number[],
): ModelCurve {
  return {
    id,
    name,
    checkpoints: tokenCheckpoints.map((outputTokens, index) => ({
      outputTokens,
      energyWh: {
        central: central[index] ?? 0,
        low: low[index] ?? 0,
        high: high[index] ?? 0,
      },
    })),
  };
}

export const MODEL_CURVES: Record<string, ModelCurve> = {
  'gpt-5.5': curve(
    'gpt-5.5',
    'GPT-5.5',
    [0.4064, 1.1791, 1.6942, 2.6601, 32.279, 96.6681, 644.1723, 3219.5382],
    [0.2917, 0.7888, 1.1203, 1.7417, 20.7997, 62.23, 414.5847, 2071.5998],
    [0.5212, 1.5694, 2.2682, 3.5784, 43.7584, 131.1063, 873.76, 4367.4766],
  ),
  'gpt-5.5-pro': curve(
    'gpt-5.5-pro',
    'GPT-5.5 Pro',
    [20.758, 48.4781, 66.9581, 101.6082, 1164.2105, 3474.2155, 23130.7433, 115509.4586],
    [15.2479, 29.7437, 39.4076, 57.5274, 613.2001, 1821.1842, 12110.535, 60408.4155],
    [26.2681, 67.2124, 94.5086, 145.689, 1715.2209, 5127.2468, 34150.952, 170610.5016],
  ),
  'gpt-5.4-mini': curve(
    'gpt-5.4-mini',
    'GPT-5.4 mini',
    [0.041, 0.133, 0.1943, 0.3093, 3.8366, 11.5045, 76.688, 383.3997],
    [0.0108, 0.0342, 0.0498, 0.0791, 0.9771, 2.9291, 19.524, 97.6029],
    [0.0711, 0.2317, 0.3388, 0.5395, 6.6961, 20.08, 133.8523, 669.1964],
  ),
};

export const FALLBACK_MODEL_ID = 'gpt-5.5';

export const DIETS: Record<DietId, { label: string; annualKgCo2e: number }> = {
  heavy: { label: 'Heavy meat', annualKgCo2e: 3_200 },
  avg: { label: 'Average omnivore', annualKgCo2e: 2_500 },
  light: { label: 'Low meat', annualKgCo2e: 2_000 },
  pesc: { label: 'Pescatarian', annualKgCo2e: 1_700 },
  veg: { label: 'Vegetarian', annualKgCo2e: 1_500 },
  vegan: { label: 'Vegan', annualKgCo2e: 1_050 },
};

export const REGIONS: Record<RegionId, { label: string; gridGramsCo2ePerKwh: number }> = {
  us: { label: 'United States', gridGramsCo2ePerKwh: 380 },
  eu: { label: 'European Union', gridGramsCo2ePerKwh: 215 },
  uk: { label: 'United Kingdom', gridGramsCo2ePerKwh: 125 },
  cn: { label: 'China', gridGramsCo2ePerKwh: 580 },
  in: { label: 'India', gridGramsCo2ePerKwh: 700 },
  world: { label: 'World average', gridGramsCo2ePerKwh: 480 },
};

export function resolveModelCurve(modelName: string): { curve: ModelCurve; fallback: boolean } {
  const normalized = modelName.trim().toLowerCase();
  const direct = MODEL_CURVES[normalized];
  if (direct) return { curve: direct, fallback: false };

  const prefix = Object.keys(MODEL_CURVES).find((id) => normalized.startsWith(`${id}-`));
  if (prefix) return { curve: MODEL_CURVES[prefix]!, fallback: false };

  return { curve: MODEL_CURVES[FALLBACK_MODEL_ID]!, fallback: true };
}

function lerp(a: number, b: number, progress: number): number {
  return a + (b - a) * progress;
}

function interpolateRange(a: EnergyCheckpoint, b: EnergyCheckpoint, outputTokens: number): RangeValue {
  const progress = (outputTokens - a.outputTokens) / (b.outputTokens - a.outputTokens);
  return {
    low: lerp(a.energyWh.low, b.energyWh.low, progress),
    central: lerp(a.energyWh.central, b.energyWh.central, progress),
    high: lerp(a.energyWh.high, b.energyWh.high, progress),
  };
}

export function estimateRequestEnergy(curveData: ModelCurve, outputTokens: number): RangeValue {
  const checkpoints = curveData.checkpoints;
  const first = checkpoints[0]!;
  const last = checkpoints[checkpoints.length - 1]!;
  const tokens = Math.max(0, outputTokens);

  if (tokens <= first.outputTokens) {
    const scale = tokens / first.outputTokens;
    return {
      low: first.energyWh.low * scale,
      central: first.energyWh.central * scale,
      high: first.energyWh.high * scale,
    };
  }

  for (let index = 1; index < checkpoints.length; index += 1) {
    const upper = checkpoints[index]!;
    if (tokens <= upper.outputTokens) {
      return interpolateRange(checkpoints[index - 1]!, upper, tokens);
    }
  }

  const scale = tokens / last.outputTokens;
  return {
    low: last.energyWh.low * scale,
    central: last.energyWh.central * scale,
    high: last.energyWh.high * scale,
  };
}
