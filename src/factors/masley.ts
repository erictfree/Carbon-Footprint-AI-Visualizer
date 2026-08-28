import type {
  ComparisonWindowId,
  DietId,
  DrivingId,
  FlyingFrequencyId,
  HomeEnergyId,
  LifestyleProfile,
  RangeValue,
  RegionId,
} from '../types';

export const MASLEY_SOURCE = {
  label: 'Andy Masley AI Prompt Footprint / EcoLogits v0.10',
  url: 'https://andymasley.com/visuals/ai-prompt-footprint-source.txt',
  version: 'EcoLogits v0.10 snapshot',
  updated: '2026-06-10',
  modelCount: 9,
  note: 'Output-token scenario interpolation with regional grid electricity and EcoLogits embodied-hardware carbon.',
} as const;

interface ImpactCheckpoint {
  outputTokens: number;
  energyWh: RangeValue;
  embodiedCarbonGrams: RangeValue;
}

export interface ModelCurve {
  id: string;
  name: string;
  checkpoints: ImpactCheckpoint[];
}

const tokenCheckpoints = [50, 170, 250, 400, 5_000, 15_000, 100_000, 500_000];

function curve(
  id: string,
  name: string,
  central: number[],
  low: number[],
  high: number[],
  embodiedCentral: number[],
  embodiedLow: number[],
  embodiedHigh: number[],
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
      embodiedCarbonGrams: {
        central: embodiedCentral[index] ?? 0,
        low: embodiedLow[index] ?? 0,
        high: embodiedHigh[index] ?? 0,
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
    [0.0241, 0.0395, 0.0498, 0.0692, 0.6622, 1.9514, 12.9507, 64.4772],
    [0.0241, 0.0395, 0.0498, 0.0692, 0.6622, 1.9514, 12.9507, 64.4772],
    [0.0241, 0.0395, 0.0498, 0.0692, 0.6622, 1.9514, 12.9507, 64.4772],
  ),
  'gpt-5.5-pro': curve(
    'gpt-5.5-pro',
    'GPT-5.5 Pro',
    [20.758, 48.4781, 66.9581, 101.6082, 1164.2105, 3474.2155, 23130.7433, 115509.4586],
    [15.2479, 29.7437, 39.4076, 57.5274, 613.2001, 1821.1842, 12110.535, 60408.4155],
    [26.2681, 67.2124, 94.5086, 145.689, 1715.2209, 5127.2468, 34150.952, 170610.5016],
    [2.063, 2.4102, 2.6417, 3.0757, 16.3859, 45.3211, 295.7463, 1448.6776],
    [2.063, 2.4102, 2.6417, 3.0757, 16.3859, 45.3211, 295.7463, 1448.6776],
    [2.063, 2.4102, 2.6417, 3.0757, 16.3859, 45.3211, 295.7463, 1448.6776],
  ),
  'gpt-5.4-mini': curve(
    'gpt-5.4-mini',
    'GPT-5.4 mini',
    [0.041, 0.133, 0.1943, 0.3093, 3.8366, 11.5045, 76.688, 383.3997],
    [0.0108, 0.0342, 0.0498, 0.0791, 0.9771, 2.9291, 19.524, 97.6029],
    [0.0711, 0.2317, 0.3388, 0.5395, 6.6961, 20.08, 133.8523, 669.1964],
    [0.0011, 0.0024, 0.0033, 0.005, 0.0563, 0.1678, 1.1167, 5.5745],
    [0.0004, 0.001, 0.0013, 0.002, 0.0225, 0.0671, 0.4467, 2.2298],
    [0.0018, 0.0039, 0.0053, 0.008, 0.0901, 0.2684, 1.7867, 8.9193],
  ),
  'claude-opus-4-8': curve(
    'claude-opus-4-8',
    'Claude Opus 4.8',
    [0.2673, 0.818, 1.1852, 1.8735, 22.9837, 68.8752, 459.042, 2_294.617],
    [0.1938, 0.5701, 0.821, 1.2914, 15.7164, 47.0752, 313.7117, 1_567.9779],
    [0.3408, 1.0659, 1.5493, 2.4557, 30.2509, 90.6752, 604.3727, 3_021.256],
    [0.013, 0.0238, 0.0309, 0.0444, 0.4575, 1.3555, 9.0083, 44.9079],
    [0.013, 0.0238, 0.0309, 0.0444, 0.4575, 1.3555, 9.0083, 44.9079],
    [0.013, 0.0238, 0.0309, 0.0444, 0.4575, 1.3555, 9.0083, 44.9079],
  ),
  'claude-sonnet-4-6': curve(
    'claude-sonnet-4-6',
    'Claude Sonnet 4.6',
    [0.1135, 0.3424, 0.495, 0.7811, 9.5558, 28.6313, 190.8147, 953.79],
    [0.0886, 0.2588, 0.3722, 0.5849, 7.1079, 21.2882, 141.8623, 709.0334],
    [0.1384, 0.426, 0.6178, 0.9773, 12.0038, 35.9744, 239.7673, 1_198.5467],
    [0.0072, 0.0148, 0.0198, 0.0292, 0.3186, 0.9476, 6.3037, 31.4554],
    [0.0072, 0.0148, 0.0198, 0.0292, 0.3186, 0.9476, 6.3037, 31.4554],
    [0.0072, 0.0148, 0.0198, 0.0292, 0.3186, 0.9476, 6.3037, 31.4554],
  ),
  'claude-haiku-4-5-20251001': curve(
    'claude-haiku-4-5-20251001',
    'Claude Haiku 4.5',
    [0.0062, 0.0194, 0.0281, 0.0446, 0.5485, 1.6439, 10.9567, 54.7726],
    [0.0035, 0.0107, 0.0156, 0.0246, 0.3023, 0.9059, 6.038, 30.1826],
    [0.0089, 0.028, 0.0407, 0.0645, 0.7946, 2.3818, 15.8757, 79.3626],
    [0.0003, 0.0007, 0.001, 0.0015, 0.0173, 0.0517, 0.344, 1.717],
    [0.0002, 0.0005, 0.0007, 0.001, 0.0116, 0.0344, 0.2293, 1.1447],
    [0.0004, 0.001, 0.0014, 0.002, 0.0231, 0.0689, 0.4587, 2.2894],
  ),
  'gemini-3.1-pro-preview': curve(
    'gemini-3.1-pro-preview',
    'Gemini 3.1 Pro',
    [0.8453, 2.4033, 3.4419, 5.3893, 65.1103, 194.9386, 1_298.9363, 6_491.6081],
    [0.607, 1.5929, 2.2502, 3.4827, 41.2769, 123.4384, 822.2687, 4_108.2694],
    [1.0837, 3.2136, 4.6336, 7.296, 88.9437, 266.4387, 1_775.604, 8_874.9469],
    [0.0521, 0.0693, 0.0807, 0.1021, 0.7585, 2.1854, 14.4193, 71.392],
    [0.0521, 0.0693, 0.0807, 0.1021, 0.7585, 2.1854, 14.4193, 71.392],
    [0.0521, 0.0693, 0.0807, 0.1021, 0.7585, 2.1854, 14.4193, 71.392],
  ),
  'gemini-3.5-flash': curve(
    'gemini-3.5-flash',
    'Gemini 3.5 Flash',
    [0.305, 0.8888, 1.2779, 2.0076, 24.3849, 73.0312, 486.6687, 2_432.3763],
    [0.2305, 0.6355, 0.9055, 1.4118, 16.937, 50.6874, 337.71, 1_687.583],
    [0.3795, 1.142, 1.6503, 2.6035, 31.8328, 95.375, 635.6273, 3_177.1697],
    [0.0162, 0.0209, 0.0241, 0.0301, 0.2136, 0.6124, 4.0353, 19.9542],
    [0.0162, 0.0209, 0.0241, 0.0301, 0.2136, 0.6124, 4.0353, 19.9542],
    [0.0162, 0.0209, 0.0241, 0.0301, 0.2136, 0.6124, 4.0353, 19.9542],
  ),
  'gemini-3.1-flash-lite': curve(
    'gemini-3.1-flash-lite',
    'Gemini 3.1 Flash-Lite',
    [0.0159, 0.0478, 0.069, 0.1088, 1.3299, 3.9846, 26.5553, 132.7348],
    [0.0045, 0.0128, 0.0183, 0.0286, 0.3458, 1.0352, 6.898, 34.4741],
    [0.0273, 0.0827, 0.1197, 0.189, 2.3141, 6.9339, 46.2123, 230.9956],
    [0.0008, 0.0012, 0.0015, 0.002, 0.0182, 0.0535, 0.3547, 1.7636],
    [0.0003, 0.0005, 0.0006, 0.0008, 0.0073, 0.0214, 0.142, 0.7054],
    [0.0012, 0.0019, 0.0024, 0.0032, 0.0292, 0.0856, 0.5673, 2.8218],
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

export const HOME_ENERGY: Record<HomeEnergyId, { label: string; annualKgCo2e: number }> = {
  apt: { label: 'Small apartment', annualKgCo2e: 1_500 },
  med: { label: 'Average house', annualKgCo2e: 3_500 },
  big: { label: 'Large house', annualKgCo2e: 7_000 },
};

export const DRIVING: Record<DrivingId, { label: string; annualKgCo2e: number }> = {
  d0: { label: 'Not at all', annualKgCo2e: 0 },
  dlo: { label: 'A little', annualKgCo2e: 1_200 },
  davg: { label: 'An average amount', annualKgCo2e: 4_800 },
  dhi: { label: 'A lot', annualKgCo2e: 10_000 },
};

export const FLYING: Record<FlyingFrequencyId, { label: string; annualKgCo2e: number }> = {
  never: { label: 'Never', annualKgCo2e: 0 },
  rare: { label: 'Rarely', annualKgCo2e: 560 },
  some: { label: 'Sometimes', annualKgCo2e: 2_300 },
  often: { label: 'Often', annualKgCo2e: 8_000 },
};

export const COMPARISON_WINDOWS: Record<ComparisonWindowId, { label: string; days: number | null }> = {
  csv: { label: 'Match CSV span', days: null },
  week: { label: 'Typical week', days: 7 },
  month: { label: 'Typical month', days: 30 },
};

export const REGIONS: Record<RegionId, {
  label: string;
  gridGramsCo2ePerKwh: number;
  annualBaselineKgCo2e: number;
}> = {
  us: { label: 'United States', gridGramsCo2ePerKwh: 380, annualBaselineKgCo2e: 3_000 },
  eu: { label: 'European Union', gridGramsCo2ePerKwh: 215, annualBaselineKgCo2e: 1_800 },
  uk: { label: 'United Kingdom', gridGramsCo2ePerKwh: 125, annualBaselineKgCo2e: 1_700 },
  cn: { label: 'China', gridGramsCo2ePerKwh: 580, annualBaselineKgCo2e: 2_500 },
  in: { label: 'India', gridGramsCo2ePerKwh: 700, annualBaselineKgCo2e: 900 },
  world: { label: 'World average', gridGramsCo2ePerKwh: 480, annualBaselineKgCo2e: 1_800 },
};

export const COUNTRY_DIET: Record<RegionId, DietId> = {
  us: 'avg',
  eu: 'light',
  uk: 'avg',
  cn: 'light',
  in: 'light',
  world: 'light',
};

export const DEFAULT_PROFILE: LifestyleProfile = {
  diet: 'avg',
  region: 'us',
  homeEnergy: 'med',
  driving: 'davg',
  flyingFrequency: 'some',
  comparisonWindow: 'csv',
  startCity: 'Austin, TX',
  model3Efficiency: 4,
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

function interpolateRange(
  a: ImpactCheckpoint,
  b: ImpactCheckpoint,
  outputTokens: number,
  key: 'energyWh' | 'embodiedCarbonGrams',
): RangeValue {
  const progress = (outputTokens - a.outputTokens) / (b.outputTokens - a.outputTokens);
  return {
    low: lerp(a[key].low, b[key].low, progress),
    central: lerp(a[key].central, b[key].central, progress),
    high: lerp(a[key].high, b[key].high, progress),
  };
}

function estimateRequestRange(
  curveData: ModelCurve,
  outputTokens: number,
  key: 'energyWh' | 'embodiedCarbonGrams',
): RangeValue {
  const checkpoints = curveData.checkpoints;
  const first = checkpoints[0]!;
  const last = checkpoints[checkpoints.length - 1]!;
  const tokens = Math.max(0, outputTokens);

  if (tokens <= first.outputTokens) {
    const scale = tokens / first.outputTokens;
    return {
      low: first[key].low * scale,
      central: first[key].central * scale,
      high: first[key].high * scale,
    };
  }

  for (let index = 1; index < checkpoints.length; index += 1) {
    const upper = checkpoints[index]!;
    if (tokens <= upper.outputTokens) {
      return interpolateRange(checkpoints[index - 1]!, upper, tokens, key);
    }
  }

  const scale = tokens / last.outputTokens;
  return {
    low: last[key].low * scale,
    central: last[key].central * scale,
    high: last[key].high * scale,
  };
}

export function estimateRequestEnergy(curveData: ModelCurve, outputTokens: number): RangeValue {
  return estimateRequestRange(curveData, outputTokens, 'energyWh');
}

export function estimateRequestEmbodiedCarbon(
  curveData: ModelCurve,
  outputTokens: number,
): RangeValue {
  return estimateRequestRange(curveData, outputTokens, 'embodiedCarbonGrams');
}
