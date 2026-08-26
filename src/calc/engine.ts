import {
  DIETS,
  estimateRequestEnergy,
  REGIONS,
  resolveModelCurve,
} from '../factors/masley';
import type {
  ComparisonResult,
  LifestyleProfile,
  ModelEnergyBreakdown,
  ModelUsageAggregate,
  RangeValue,
  UsageAggregate,
} from '../types';

const MILLISECONDS_PER_DAY = 86_400_000;

function sumRange(a: RangeValue, b: RangeValue): RangeValue {
  return {
    low: a.low + b.low,
    central: a.central + b.central,
    high: a.high + b.high,
  };
}

function scaleRange(value: RangeValue, scale: number): RangeValue {
  return {
    low: value.low * scale,
    central: value.central * scale,
    high: value.high * scale,
  };
}

function energyForModel(usage: ModelUsageAggregate): ModelEnergyBreakdown {
  const { curve, fallback } = resolveModelCurve(usage.model);
  const requests = Math.max(1, usage.requests);
  const averageOutputTokens = usage.outputTokens / requests;
  return {
    model: usage.model,
    factorModel: curve.name,
    fallback,
    requests,
    inputTokens: usage.inputTokens,
    outputTokens: usage.outputTokens,
    averageOutputTokens,
    energyWh: scaleRange(estimateRequestEnergy(curve, averageOutputTokens), requests),
  };
}

export function comparisonDays(aggregate: UsageAggregate): number {
  const span = aggregate.end.getTime() - aggregate.start.getTime();
  return Math.max(1, Math.floor(span / MILLISECONDS_PER_DAY) + 1);
}

export function calculateComparison(
  aggregate: UsageAggregate,
  profile: LifestyleProfile,
): ComparisonResult {
  let energyWh: RangeValue = { low: 0, central: 0, high: 0 };
  const unknownModels: string[] = [];
  const modelBreakdown: ModelEnergyBreakdown[] = [];

  for (const modelUsage of aggregate.models) {
    const estimate = energyForModel(modelUsage);
    energyWh = sumRange(energyWh, estimate.energyWh);
    modelBreakdown.push(estimate);
    if (estimate.fallback) unknownModels.push(modelUsage.model);
  }

  const aiMiles = scaleRange(energyWh, profile.model3Efficiency / 1_000);
  const days = comparisonDays(aggregate);
  const dietKgCo2e = (DIETS[profile.diet].annualKgCo2e / 365) * days;
  const equivalentKwh = (dietKgCo2e * 1_000) / REGIONS[profile.region].gridGramsCo2ePerKwh;
  const lifestyleMiles = equivalentKwh * profile.model3Efficiency;
  const ratio = aiMiles.central > 0 ? lifestyleMiles / aiMiles.central : Number.POSITIVE_INFINITY;

  return {
    energyWh,
    aiMiles,
    lifestyleMiles,
    ratio,
    comparisonDays: days,
    unknownModels: [...new Set(unknownModels)],
    modelBreakdown: modelBreakdown.sort((a, b) => b.energyWh.central - a.energyWh.central),
  };
}

export function formatDistance(miles: number): string {
  if (!Number.isFinite(miles)) return '—';
  const absolute = Math.abs(miles);
  const inches = absolute * 63_360;
  const feet = absolute * 5_280;

  if (inches < 12) return `${inches.toFixed(inches < 1 ? 2 : 1)} in`;
  if (feet < 528) return `${feet.toFixed(feet < 10 ? 1 : 0)} ft`;
  if (absolute < 10) return `${absolute.toFixed(2)} mi`;
  return `${Math.round(absolute).toLocaleString('en-US')} mi`;
}

export function formatEnergy(wh: number): string {
  if (wh >= 1_000) return `${(wh / 1_000).toFixed(2)} kWh`;
  if (wh >= 10) return `${wh.toFixed(1)} Wh`;
  return `${wh.toFixed(2)} Wh`;
}
