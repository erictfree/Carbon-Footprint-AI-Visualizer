import type { LifestyleProfile, UsageAggregate } from '../types';

const STORAGE_KEY = 'promptmiles:snapshot:v1';

interface PersistedAggregate extends Omit<UsageAggregate, 'start' | 'end'> {
  start: string;
  end: string;
}

interface PersistedSnapshot {
  version: 1;
  savedAt: string;
  profile: LifestyleProfile;
  aggregate: PersistedAggregate | null;
}

export interface RestoredSnapshot {
  profile: LifestyleProfile;
  aggregate: UsageAggregate | null;
}

export function serializeSnapshot(profile: LifestyleProfile, aggregate: UsageAggregate | null): string {
  const snapshot: PersistedSnapshot = {
    version: 1,
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
    if (parsed.version !== 1 || !parsed.profile) return null;
    if (
      typeof parsed.profile.model3Efficiency !== 'number' ||
      typeof parsed.profile.diet !== 'string' ||
      typeof parsed.profile.region !== 'string'
    ) {
      return null;
    }

    if (!parsed.aggregate) return { profile: parsed.profile, aggregate: null };
    const start = new Date(parsed.aggregate.start);
    const end = new Date(parsed.aggregate.end);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || !Array.isArray(parsed.aggregate.models)) {
      return null;
    }

    return {
      profile: parsed.profile,
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
