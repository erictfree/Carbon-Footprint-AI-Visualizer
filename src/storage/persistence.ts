import type { LifestyleProfile, UsageAggregate } from '../types';
import {
  COMPARISON_WINDOWS,
  DEFAULT_PROFILE,
  DIETS,
  HOME_ENERGY,
  REGIONS,
} from '../factors/masley';

const STORAGE_KEY = 'promptmiles:snapshot:v1';

interface PersistedAggregate extends Omit<UsageAggregate, 'start' | 'end'> {
  start: string;
  end: string;
}

interface PersistedSnapshot {
  version: 1 | 2;
  savedAt: string;
  profile: Partial<LifestyleProfile>;
  aggregate: PersistedAggregate | null;
}

export interface RestoredSnapshot {
  profile: LifestyleProfile;
  aggregate: UsageAggregate | null;
}

export function getResumableSnapshot(snapshot: RestoredSnapshot | null): RestoredSnapshot | null {
  return snapshot?.aggregate && !snapshot.aggregate.synthetic ? snapshot : null;
}

function bounded(value: unknown, fallback: number, minimum: number, maximum: number): number {
  return typeof value === 'number' && Number.isFinite(value)
    ? Math.min(maximum, Math.max(minimum, value))
    : fallback;
}

function knownKey<T extends object>(record: T, value: unknown, fallback: keyof T): keyof T {
  return typeof value === 'string' && value in record ? value as keyof T : fallback;
}

function restoreProfile(profile: Partial<LifestyleProfile>): LifestyleProfile {
  return {
    diet: knownKey(DIETS, profile.diet, DEFAULT_PROFILE.diet),
    region: knownKey(REGIONS, profile.region, DEFAULT_PROFILE.region),
    homeEnergy: knownKey(HOME_ENERGY, profile.homeEnergy, DEFAULT_PROFILE.homeEnergy),
    weeklyDrivingMiles: bounded(profile.weeklyDrivingMiles, DEFAULT_PROFILE.weeklyDrivingMiles, 0, 600),
    flightsPerYear: {
      short: bounded(profile.flightsPerYear?.short, 0, 0, 20),
      medium: bounded(profile.flightsPerYear?.medium, 0, 0, 20),
      long: bounded(profile.flightsPerYear?.long, 0, 0, 20),
    },
    comparisonWindow: knownKey(
      COMPARISON_WINDOWS,
      profile.comparisonWindow,
      DEFAULT_PROFILE.comparisonWindow,
    ),
    startCity: typeof profile.startCity === 'string'
      ? profile.startCity.slice(0, 80)
      : DEFAULT_PROFILE.startCity,
    model3Efficiency: bounded(profile.model3Efficiency, DEFAULT_PROFILE.model3Efficiency, 3, 4.6),
  };
}

export function serializeSnapshot(profile: LifestyleProfile, aggregate: UsageAggregate | null): string {
  const snapshot: PersistedSnapshot = {
    version: 2,
    savedAt: new Date().toISOString(),
    profile,
    aggregate: aggregate
      ? {
          ...aggregate,
          start: aggregate.start.toISOString(),
          end: aggregate.end.toISOString(),
        }
      : null,
  };
  return JSON.stringify(snapshot);
}

export function deserializeSnapshot(raw: string): RestoredSnapshot | null {
  try {
    const parsed = JSON.parse(raw) as Partial<PersistedSnapshot>;
    if ((parsed.version !== 1 && parsed.version !== 2) || !parsed.profile) return null;
    if (
      typeof parsed.profile.model3Efficiency !== 'number' ||
      typeof parsed.profile.diet !== 'string' ||
      typeof parsed.profile.region !== 'string'
    ) {
      return null;
    }

    const profile = restoreProfile(parsed.profile);

    if (!parsed.aggregate) return { profile, aggregate: null };
    const start = new Date(parsed.aggregate.start);
    const end = new Date(parsed.aggregate.end);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || !Array.isArray(parsed.aggregate.models)) {
      return null;
    }

    return {
      profile,
      aggregate: { ...parsed.aggregate, start, end },
    };
  } catch {
    return null;
  }
}

export function loadSnapshot(storage: Storage): RestoredSnapshot | null {
  const raw = storage.getItem(STORAGE_KEY);
  return raw ? deserializeSnapshot(raw) : null;
}

export function saveSnapshot(
  storage: Storage,
  profile: LifestyleProfile,
  aggregate: UsageAggregate | null,
): void {
  storage.setItem(STORAGE_KEY, serializeSnapshot(profile, aggregate));
}
