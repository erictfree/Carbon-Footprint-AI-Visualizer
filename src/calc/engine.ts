import {
  COMPARISON_WINDOWS,
  DIETS,
  DRIVING,
  estimateRequestEmbodiedCarbon,
  estimateRequestEnergy,
  FLYING,
  HOME_ENERGY,
  REGIONS,
  resolveModelCurve,
} from '../factors/masley';
import type {
  ComparisonResult,
  LifestyleComponentId,
  LifestyleImpact,
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

function energyForModel(usage: ModelUsageAggregate, scale = 1): ModelEnergyBreakdown {
  const { curve, fallback } = resolveModelCurve(usage.model);
  const sourceRequests = Math.max(Number.EPSILON, usage.requests);
  const averageOutputTokens = usage.outputTokens / sourceRequests;
  const requests = sourceRequests * scale;
  return {
    model: usage.model,
    factorModel: curve.name,
    fallback,
    requests,
    inputTokens: usage.inputTokens * scale,
    outputTokens: usage.outputTokens * scale,
    averageOutputTokens,
    energyWh: scaleRange(estimateRequestEnergy(curve, averageOutputTokens), requests),
    embodiedCarbonGrams: scaleRange(
      estimateRequestEmbodiedCarbon(curve, averageOutputTokens),
      requests,
    ),
  };
}

export function comparisonDays(aggregate: UsageAggregate): number {
  const span = aggregate.end.getTime() - aggregate.start.getTime();
  return Math.max(1, Math.floor(span / MILLISECONDS_PER_DAY) + 1);
}

function carbonToImpact(
  id: LifestyleImpact['id'],
  label: string,
  kgCo2e: number,
  profile: LifestyleProfile,
): LifestyleImpact {
  const equivalentKwh = (kgCo2e * 1_000) / REGIONS[profile.region].gridGramsCo2ePerKwh;
  return {
    id,
    label,
    kgCo2e,
    equivalentKwh,
    miles: equivalentKwh * profile.model3Efficiency,
  };
}

function calculateLifestyle(days: number, profile: LifestyleProfile): ComparisonResult['lifestyle'] {
  const annualScale = days / 365;
  const baseline = carbonToImpact(
    'baseline',
    'Regional baseline',
    REGIONS[profile.region].annualBaselineKgCo2e * annualScale,
    profile,
  );
  const diet = carbonToImpact(
    'diet',
    'Diet',
    DIETS[profile.diet].annualKgCo2e * annualScale,
    profile,
  );
  const driving = carbonToImpact(
    'driving',
    'Driving',
    DRIVING[profile.driving].annualKgCo2e * annualScale,
    profile,
  );
  const flights = carbonToImpact(
    'flights',
    'Flying',
    FLYING[profile.flyingFrequency].annualKgCo2e * annualScale,
    profile,
  );
  const home = carbonToImpact(
    'home',
    'Home energy',
    HOME_ENERGY[profile.homeEnergy].annualKgCo2e * annualScale,
    profile,
  );
  const components: Record<LifestyleComponentId, LifestyleImpact> = {
    baseline,
    diet,
    driving,
    flights,
    home,
  };
  const kgCo2e = Object.values(components).reduce((total, component) => total + component.kgCo2e, 0);

  return {
    components,
    total: carbonToImpact('total', 'Lifestyle total', kgCo2e, profile),
  };
}

export function calculateComparison(
  aggregate: UsageAggregate,
  profile: LifestyleProfile,
): ComparisonResult {
  let energyWh: RangeValue = { low: 0, central: 0, high: 0 };
  let aiEmbodiedCarbonGrams: RangeValue = { low: 0, central: 0, high: 0 };
  const unknownModels: string[] = [];
  const modelBreakdown: ModelEnergyBreakdown[] = [];
  const sourceDays = comparisonDays(aggregate);
  const comparisonWindowDays = COMPARISON_WINDOWS[profile.comparisonWindow].days;
  const days = comparisonWindowDays ?? sourceDays;
  const windowScale = days / sourceDays;

  for (const modelUsage of aggregate.models) {
    const estimate = energyForModel(modelUsage, windowScale);
    energyWh = sumRange(energyWh, estimate.energyWh);
    aiEmbodiedCarbonGrams = sumRange(aiEmbodiedCarbonGrams, estimate.embodiedCarbonGrams);
    modelBreakdown.push(estimate);
    if (estimate.fallback) unknownModels.push(modelUsage.model);
  }

  const aiMiles = scaleRange(energyWh, profile.model3Efficiency / 1_000);
  const aiElectricityCarbonGrams = scaleRange(
    energyWh,
    REGIONS[profile.region].gridGramsCo2ePerKwh / 1_000,
  );
  const aiCarbonKgCo2e = scaleRange(
    sumRange(aiElectricityCarbonGrams, aiEmbodiedCarbonGrams),
    1 / 1_000,
  );
  const lifestyle = calculateLifestyle(days, profile);
  const ratio = aiCarbonKgCo2e.central > 0
    ? lifestyle.total.kgCo2e / aiCarbonKgCo2e.central
    : Number.POSITIVE_INFINITY;

  return {
    energyWh,
    aiEmbodiedCarbonGrams,
    aiCarbonKgCo2e,
    aiMiles,
    lifestyle,
    ratio,
    sourceDays,
    comparisonDays: days,
    windowScale,
    unknownModels: [...new Set(unknownModels)],
    modelBreakdown: modelBreakdown.sort((a, b) => b.energyWh.central - a.energyWh.central),
  };
}

export function formatDistance(miles: number): string {
  if (!Number.isFinite(miles)) return '—';
  const absolute = Math.abs(miles);
  if (absolute === 0) return '0 in';
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
