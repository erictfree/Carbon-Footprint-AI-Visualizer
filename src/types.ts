export interface RangeValue {
  low: number;
  central: number;
  high: number;
}

export interface UsageRow {
  timestamp: Date;
  model: string;
  inputTokens: number;
  outputTokens: number;
  requests: number;
}

export interface ModelUsageAggregate {
  model: string;
  inputTokens: number;
  outputTokens: number;
  requests: number;
}

export interface UsageAggregate {
  sourceName: string;
  synthetic: boolean;
  rowCount: number;
  start: Date;
  end: Date;
  inputTokens: number;
  outputTokens: number;
  requests: number;
  models: ModelUsageAggregate[];
  warnings: string[];
}

export type DietId = 'heavy' | 'avg' | 'light' | 'pesc' | 'veg' | 'vegan';
export type RegionId = 'us' | 'eu' | 'uk' | 'cn' | 'in' | 'world';

export interface LifestyleProfile {
  diet: DietId;
  region: RegionId;
  model3Efficiency: number;
}

export interface ComparisonResult {
  energyWh: RangeValue;
  aiMiles: RangeValue;
  lifestyleMiles: number;
  ratio: number;
  comparisonDays: number;
  unknownModels: string[];
}

export interface AppState {
  aggregate: UsageAggregate | null;
  profile: LifestyleProfile;
  result: ComparisonResult | null;
  status: 'booting' | 'ready' | 'parsing' | 'error';
  error: string | null;
}
