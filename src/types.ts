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
export type HomeEnergyId = 'apt' | 'med' | 'big';
export type ComparisonWindowId = 'csv' | 'week' | 'month';
export type FlightLengthId = 'short' | 'medium' | 'long';
export type LifestyleComponentId = 'diet' | 'driving' | 'flights' | 'home';
export type LifestyleMetricId = LifestyleComponentId | 'total';

export type FlightCounts = Record<FlightLengthId, number>;

export interface LifestyleProfile {
  diet: DietId;
  region: RegionId;
  homeEnergy: HomeEnergyId;
  weeklyDrivingMiles: number;
  flightsPerYear: FlightCounts;
  comparisonWindow: ComparisonWindowId;
  startCity: string;
  model3Efficiency: number;
}

export interface LifestyleImpact {
  id: LifestyleMetricId;
  label: string;
  kgCo2e: number;
  equivalentKwh: number;
  miles: number;
}

export interface LifestyleComparison {
  total: LifestyleImpact;
  components: Record<LifestyleComponentId, LifestyleImpact>;
}

export interface ModelEnergyBreakdown {
  model: string;
  factorModel: string;
  fallback: boolean;
  requests: number;
  inputTokens: number;
  outputTokens: number;
  averageOutputTokens: number;
  energyWh: RangeValue;
}

export interface ComparisonResult {
  energyWh: RangeValue;
  aiCarbonKgCo2e: RangeValue;
  aiMiles: RangeValue;
  lifestyle: LifestyleComparison;
  ratio: number;
  sourceDays: number;
  comparisonDays: number;
  windowScale: number;
  unknownModels: string[];
  modelBreakdown: ModelEnergyBreakdown[];
}

export interface AppState {
  aggregate: UsageAggregate | null;
  profile: LifestyleProfile;
  result: ComparisonResult | null;
  status: 'booting' | 'ready' | 'parsing' | 'mapping' | 'error';
  error: string | null;
}
