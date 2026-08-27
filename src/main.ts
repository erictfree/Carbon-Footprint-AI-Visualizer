import './styles.css';
import { calculateComparison, formatEnergy } from './calc/engine';
import {
  COMPARISON_WINDOWS,
  DEFAULT_PROFILE,
  DIETS,
  FLIGHT_KG_CO2E,
  HOME_ENERGY,
  MASLEY_SOURCE,
  REGIONS,
} from './factors/masley';
import { SYNTHETIC_SCENARIOS, type SyntheticScenarioId } from './fixtures/synthetic';
import { laneMotionTiming, projectBeltPose, type BeltSide } from './scene/conveyorPhysics';
import {
  CsvSchemaError,
  parseUsageCsvText,
  parseUsageFile,
  type UsageColumnMapping,
} from './ingest/parseUsageCsv';
import { createStore } from './state/store';
import { getResumableSnapshot, loadSnapshot, saveSnapshot } from './storage/persistence';
import type {
  AppState,
  ComparisonWindowId,
  DietId,
  FlightLengthId,
  HomeEnergyId,
  LifestyleImpact,
  LifestyleMetricId,
  LifestyleProfile,
  RegionId,
} from './types';

const app = document.querySelector<HTMLDivElement>('#app');
if (!app) throw new Error('Burger Works could not find its app root.');

const ASSET_BASE = '/assets/burger-works';
const BURGER_KG_CO2E = 3;
const RATE_LOOP_DURATION_MS = 60_000;
const MAX_BURGERS_ON_LANE = 8;

const restored = loadSnapshot(window.localStorage);
// Synthetic demonstrations should open identically in every browser. Only a
// real, locally imported aggregate resumes after refresh; demo profile tweaks
// remain intentionally session-scoped.
const resumableSnapshot = getResumableSnapshot(restored);
const initialProfile = resumableSnapshot?.profile ?? DEFAULT_PROFILE;
const initialAggregate = resumableSnapshot?.aggregate ?? null;

const store = createStore<AppState>({
  aggregate: initialAggregate,
  profile: initialProfile,
  result: initialAggregate ? calculateComparison(initialAggregate, initialProfile) : null,
  status: initialAggregate ? 'ready' : 'booting',
  error: null,
});

app.innerHTML = `
  <main class="works-shell" id="works-shell">
    <header class="topbar">
      <a class="brand" href="/" aria-label="Burger Works home">
        <span class="brand__mark" aria-hidden="true"><img src="${ASSET_BASE}/burger.png" alt="" /></span>
        <span class="brand__name">Burger Works</span>
        <span class="brand__dek">AI impact, made visible.</span>
      </a>
      <nav class="mode-switch" aria-label="Impact metric">
        <button class="mode-switch__button" type="button" disabled title="Energy objects are coming next">Energy <small>soon</small></button>
        <button class="mode-switch__button is-active" type="button" aria-current="page">Carbon</button>
        <button class="mode-switch__button" type="button" disabled title="Water factors are not yet in the model">Water <small>soon</small></button>
      </nav>
      <div class="topbar__actions">
        <button class="quiet-button" id="swap-sides" type="button">Swap</button>
        <button class="quiet-button" id="methodology-open" type="button">Methodology</button>
        <button class="data-button" id="data-open" type="button"><span class="data-button__long">Data &amp; profile</span><span class="data-button__short">Data</span></button>
      </div>
    </header>

    <section class="comparison" aria-labelledby="comparison-title">
      <h1 id="comparison-title" class="sr-only">AI and lifestyle carbon comparison</h1>
      <div class="comparison__readouts">
        <article class="readout readout--left">
          <div class="readout__identity"><span class="entity-dot"></span><span id="left-label">AI usage</span></div>
          <strong id="left-value">—</strong>
          <span id="left-range">—</span>
        </article>
        <div class="ratio-lockup">
          <span id="window-label">Same comparison window</span>
          <strong id="ratio-value">—</strong>
          <p id="ratio-description">Loading comparison…</p>
        </div>
        <article class="readout readout--right">
          <div class="readout__identity"><span class="entity-dot"></span><span id="right-label">Lifestyle total</span></div>
          <strong id="right-value">—</strong>
          <span id="right-range">—</span>
        </article>
      </div>

      <figure class="factory-stage" id="factory-stage" aria-label="Two straight burger conveyor belts comparing carbon production rates">
        <img class="factory-stage__art" src="${ASSET_BASE}/linear-conveyor.jpg" alt="Twin industrial conveyor belts running in parallel toward the viewer" />
        <div class="factory-stage__shade"></div>
        <div class="factory-label factory-label--left">
          <span id="left-factory-name">AI line</span>
          <strong id="left-pace">—</strong>
        </div>
        <div class="factory-label factory-label--right">
          <span id="right-factory-name">Lifestyle line</span>
          <strong id="right-pace">—</strong>
        </div>
        <div class="flow-layer" id="flow-layer" aria-hidden="true"></div>
      </figure>

      <section class="output-strip" aria-label="Production totals and visual explanation">
        <article class="output-card output-card--left"><span>Window output</span><strong id="left-unit-count">—</strong><small id="left-unit-name">burger equivalent</small></article>
        <div class="output-story"><strong id="stage-status" aria-live="polite">Live production · rate loop ready</strong><p id="motion-note">One comparison window plays in one minute. Output fills rows across each belt before increasing its speed.</p></div>
        <article class="output-card output-card--right"><span>Window output</span><strong id="right-unit-count">—</strong><small id="right-unit-name">burger equivalent</small></article>
      </section>

      <section class="replay-strip" aria-label="Factory replay controls">
        <div class="replay-copy">
          <span class="live-dot"></span>
          <div><strong id="replay-window">30-day production · continuous loop</strong><span id="source-status">Synthetic demonstration</span></div>
        </div>
        <div class="timeline" aria-hidden="true"><span id="timeline-fill"></span></div>
        <button class="replay-button" id="replay-button" type="button">Restart lines</button>
      </section>
    </section>
  </main>

  <dialog class="settings-dialog" id="data-dialog">
    <div class="dialog-head">
      <div><p>Data &amp; profile</p><h2>Choose what the factories compare.</h2></div>
      <button class="dialog-close" id="data-close" type="button">Close</button>
    </div>
    <section class="settings-section">
      <div class="settings-heading"><span>Lifestyle comparison</span><small>Uses the same time window as AI</small></div>
      <div class="impact-picker">
        <button class="impact-choice is-active" data-comparison="total" type="button" aria-pressed="true">Total <strong id="impact-total">—</strong></button>
        <button class="impact-choice" data-comparison="diet" type="button" aria-pressed="false">Diet <strong id="impact-diet">—</strong></button>
        <button class="impact-choice" data-comparison="driving" type="button" aria-pressed="false">Driving <strong id="impact-driving">—</strong></button>
        <button class="impact-choice" data-comparison="flights" type="button" aria-pressed="false">Flights <strong id="impact-flights">—</strong></button>
        <button class="impact-choice" data-comparison="home" type="button" aria-pressed="false">Home <strong id="impact-home">—</strong></button>
      </div>
    </section>
    <section class="settings-section">
      <div class="settings-heading"><span>Lifestyle inputs</span><button class="link-button" id="reset-profile" type="button">Reset</button></div>
      <div class="control-grid">
        <label><span>Diet</span><select id="diet-select">${Object.entries(DIETS).map(([id, item]) => `<option value="${id}">${item.label}</option>`).join('')}</select></label>
        <label><span>Home energy</span><select id="home-select">${Object.entries(HOME_ENERGY).map(([id, item]) => `<option value="${id}">${item.label}</option>`).join('')}</select></label>
        <label><span>Grid region</span><select id="region-select">${Object.entries(REGIONS).map(([id, item]) => `<option value="${id}">${item.label}</option>`).join('')}</select></label>
        <label><span>Comparison window</span><select id="window-select">${Object.entries(COMPARISON_WINDOWS).map(([id, item]) => `<option value="${id}">${item.label}</option>`).join('')}</select></label>
      </div>
      <label class="range-row">
        <span><span>Weekly gasoline driving</span><output id="driving-output">230 mi</output></span>
        <input id="driving-range" type="range" min="0" max="600" step="5" />
      </label>
      <fieldset class="flight-row">
        <legend>Round-trip flights per year</legend>
        ${Object.entries(FLIGHT_KG_CO2E).map(([id, item]) => `<label><span>${item.label}<small>${item.kgCo2ePerRoundTrip.toLocaleString('en-US')} kg</small></span><input id="flight-${id}" type="number" min="0" max="20" step="1" inputmode="numeric" /></label>`).join('')}
      </fieldset>
    </section>
    <section class="settings-section">
      <div class="settings-heading"><span>AI usage</span><small id="ai-source-meta">Local browser only</small></div>
      <label class="scenario-row"><span>Development scenario</span><select id="scenario-select">${Object.values(SYNTHETIC_SCENARIOS).map((scenario) => `<option value="${scenario.id}">${scenario.label}</option>`).join('')}</select><small id="scenario-description">${SYNTHETIC_SCENARIOS.typical.description}</small></label>
      <div class="data-actions">
        <button class="primary-button" id="load-synthetic" type="button">Load scenario</button>
        <button class="secondary-button" id="replace-csv" type="button">Import usage CSV</button>
        <button class="link-button" id="download-synthetic" type="button">Download sample</button>
      </div>
      <input id="csv-input" type="file" accept=".csv,text/csv" hidden />
      <p class="local-note">Raw CSV rows stay in this browser and are discarded after aggregation.</p>
      <p class="error-message" id="error-message" role="alert" hidden></p>
    </section>
  </dialog>

  <dialog class="methodology-dialog" id="methodology-dialog">
    <div class="dialog-head">
      <div><p>Methodology · M3</p><h2>Exact estimates behind the metaphor.</h2></div>
      <button class="dialog-close" id="methodology-close" type="button">Close</button>
    </div>
    <p>Burger Works turns both sides into carbon first, then uses burger production only as a visual yardstick. The numeric kg CO₂e values and uncertainty range are authoritative.</p>
    <dl>
      <div><dt>AI energy</dt><dd>Average output tokens per request → ${MASLEY_SOURCE.modelCount} EcoLogits model curves → requests → Wh range.</dd></div>
      <div><dt>AI carbon</dt><dd>Estimated Wh × selected grid carbon intensity. Input tokens are displayed but not modeled by the source data.</dd></div>
      <div><dt>Lifestyle</dt><dd>Diet, gasoline driving, flights, and home energy are normalized to the same comparison window.</dd></div>
      <div><dt>Burger unit</dt><dd>1 burger ≈ ${BURGER_KG_CO2E} kg CO₂e. This is a communication equivalence, not a claim that every burger is identical.</dd></div>
      <div><dt>Visual scale</dt><dd>One comparison window plays in one minute. Exact output fills perspective-aware rows—up to three burgers across on desktop—before belt speed rises. A persistent slow marker keeps sub-one-burger output visible; numeric totals remain authoritative. A planar projective transform makes distant motion slower and foreground motion faster.</dd></div>
      <div><dt>Excluded</dt><dd>Water, training, image generation, retries, and regional goods/services baselines.</dd></div>
    </dl>
    <a class="source-link" href="${MASLEY_SOURCE.url}" target="_blank" rel="noreferrer">Open Masley factor source</a>
    <p class="methodology-version">${MASLEY_SOURCE.version} · Updated ${MASLEY_SOURCE.updated}</p>
  </dialog>

  <dialog class="mapping-dialog" id="mapping-dialog">
    <div class="dialog-head">
      <div><p>CSV column mapping</p><h2>Tell us which columns to use.</h2></div>
      <button class="dialog-close" id="mapping-close" type="button">Cancel</button>
    </div>
    <form id="mapping-form">
      <div class="control-grid">
        <label><span>Date or timestamp</span><select id="map-timestamp" required></select></label>
        <label><span>Model</span><select id="map-model" required></select></label>
        <label><span>Input tokens <em>optional</em></span><select id="map-input"></select></label>
        <label><span>Output tokens</span><select id="map-output"></select></label>
        <label><span>Requests <em>optional</em></span><select id="map-requests"></select></label>
      </div>
      <p class="error-message" id="mapping-error" hidden></p>
      <button class="primary-button" type="submit">Import locally</button>
    </form>
  </dialog>
`;

function byId<T extends HTMLElement = HTMLElement>(id: string): T {
  const element = document.getElementById(id);
  if (!element) throw new Error(`Missing required element #${id}`);
  return element as T;
}

function clamp(value: number, minimum: number, maximum: number): number {
  if (!Number.isFinite(value)) return minimum;
  return Math.min(maximum, Math.max(minimum, value));
}

function formatCarbon(kgCo2e: number): string {
  if (!Number.isFinite(kgCo2e)) return '—';
  if (kgCo2e >= 1_000_000) return `${(kgCo2e / 1_000_000).toFixed(2)} Mt CO₂e`;
  if (kgCo2e >= 1_000) return `${(kgCo2e / 1_000).toFixed(2)} t CO₂e`;
  if (kgCo2e >= 100) return `${Math.round(kgCo2e).toLocaleString('en-US')} kg CO₂e`;
  if (kgCo2e >= 10) return `${kgCo2e.toFixed(1)} kg CO₂e`;
  if (kgCo2e >= 0.1) return `${kgCo2e.toFixed(2)} kg CO₂e`;
  return `${Math.round(kgCo2e * 1_000).toLocaleString('en-US')} g CO₂e`;
}

function formatRatio(value: number): string {
  if (!Number.isFinite(value)) return '—';
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M×`;
  if (value >= 10_000) return `${Math.round(value / 1_000).toLocaleString('en-US')}K×`;
  if (value >= 100) return `${Math.round(value).toLocaleString('en-US')}×`;
  if (value >= 10) return `${value.toFixed(1)}×`;
  return `${value.toFixed(2)}×`;
}

function formatBurgerOutput(burgers: number): string {
  if (burgers < 1) return `${burgers.toFixed(2)} burger`;
  if (burgers < 100) return `${burgers.toFixed(burgers < 10 ? 1 : 0)} burgers`;
  if (burgers < 1_000_000) return `${Math.round(burgers).toLocaleString('en-US')} burgers`;
  return `${(burgers / 1_000_000).toFixed(1)}M burgers`;
}

function productionPace(burgers: number, days: number): string {
  if (burgers <= 0) return 'Line idle';
  if (burgers < 0.005) return 'Below visual threshold';
  const perDay = burgers / Math.max(1, days);
  if (perDay < 0.05) return `About 1 burger every ${Math.round(1 / perDay)} days`;
  if (perDay < 1) return `${perDay.toFixed(2)} burger per day`;
  if (perDay < 100) return `${perDay.toFixed(1)} burgers per day`;
  if (perDay < 100_000) return `${Math.round(perDay).toLocaleString('en-US')} burgers per day`;
  return `${(perDay / 1_000_000).toFixed(1)}M burgers per day`;
}

const shell = byId('works-shell');
const stage = byId('factory-stage');
const flowLayer = byId('flow-layer');
const replayButton = byId<HTMLButtonElement>('replay-button');
const timelineFill = byId('timeline-fill');
const dataDialog = byId<HTMLDialogElement>('data-dialog');
const methodologyDialog = byId<HTMLDialogElement>('methodology-dialog');
const mappingDialog = byId<HTMLDialogElement>('mapping-dialog');
const mappingForm = byId<HTMLFormElement>('mapping-form');
const csvInput = byId<HTMLInputElement>('csv-input');
const dietSelect = byId<HTMLSelectElement>('diet-select');
const homeSelect = byId<HTMLSelectElement>('home-select');
const regionSelect = byId<HTMLSelectElement>('region-select');
const windowSelect = byId<HTMLSelectElement>('window-select');
const drivingRange = byId<HTMLInputElement>('driving-range');
const scenarioSelect = byId<HTMLSelectElement>('scenario-select');
const flightInputs: Record<FlightLengthId, HTMLInputElement> = {
  short: byId('flight-short'),
  medium: byId('flight-medium'),
  long: byId('flight-long'),
};

let activeComparison: LifestyleMetricId = 'total';
let swapped = false;
let pendingFile: File | null = null;
let replayTimers: number[] = [];
let replayFrame: number | null = null;
let replayStartedAt = 0;
let hasPlayedInitialReplay = false;

interface ConveyorBurger {
  columnOffset: number;
  element: HTMLImageElement;
  farCenterOffsetPct: number;
  nearCenterOffsetPct: number;
  side: BeltSide;
  bornAt: number;
  spriteWidthPct: number;
  travelDurationMs: number;
}

interface ConveyorLane {
  side: BeltSide;
  accent: 'ai' | 'life';
  columnCount: number;
  continuousMarker: boolean;
  intervalMs: number;
  travelDurationMs: number;
  capacity: number;
  nextSpawnAt: number;
}

let conveyorBurgers: ConveyorBurger[] = [];
let conveyorLanes: ConveyorLane[] = [];
let burgerSequence = 0;

function laneCapacityForStage(): number {
  return stage.clientWidth <= 760 ? 3 : MAX_BURGERS_ON_LANE;
}

function maxColumnsForStage(): number {
  return stage.clientWidth <= 760 ? 2 : 3;
}

function columnOffsetForIndex(index: number, columnCount: number): number {
  if (columnCount <= 1) return 0;
  if (columnCount === 2) return index % 2 === 0 ? -0.5 : 0.5;
  return [-1, 0, 1][index % 3] ?? 0;
}

function centerOffsetsForLane(
  side: BeltSide,
  columnCount: number,
): { far: number; near: number } {
  if (columnCount === 1) {
    return side === 'left'
      ? { far: -3.4, near: 5.5 }
      : { far: 3.4, near: -5.5 };
  }
  if (columnCount >= 3) {
    return side === 'left'
      ? { far: -0.5, near: 0 }
      : { far: 0.5, near: 0 };
  }
  return { far: 0, near: 0 };
}

function selectedScenario() {
  return SYNTHETIC_SCENARIOS[scenarioSelect.value as SyntheticScenarioId] ?? SYNTHETIC_SCENARIOS.typical;
}

function impactFor(state: AppState, id: LifestyleMetricId): LifestyleImpact | null {
  if (!state.result) return null;
  return id === 'total' ? state.result.lifestyle.total : state.result.lifestyle.components[id];
}

function updateProfile(patch: Partial<LifestyleProfile>): void {
  store.setState((state) => {
    const profile = { ...state.profile, ...patch };
    return { profile, result: state.aggregate ? calculateComparison(state.aggregate, profile) : null };
  });
  window.setTimeout(() => startReplay(), 0);
}

function updateFlight(length: FlightLengthId, count: number): void {
  updateProfile({
    flightsPerYear: {
      ...store.getState().profile.flightsPerYear,
      [length]: clamp(Math.round(count), 0, 20),
    },
  });
}

function loadSynthetic(id: SyntheticScenarioId = scenarioSelect.value as SyntheticScenarioId): void {
  const scenario = SYNTHETIC_SCENARIOS[id] ?? SYNTHETIC_SCENARIOS.typical;
  try {
    const aggregate = parseUsageCsvText(scenario.csv, { sourceName: scenario.filename, synthetic: true });
    store.setState({
      aggregate,
      result: calculateComparison(aggregate, store.getState().profile),
      status: 'ready',
      error: null,
    });
  } catch (error) {
    store.setState({ status: 'error', error: error instanceof Error ? error.message : 'Could not load the synthetic scenario.' });
  }
}

function populateMapping(headers: string[]): void {
  for (const id of ['map-timestamp', 'map-model', 'map-input', 'map-output', 'map-requests']) {
    const select = byId<HTMLSelectElement>(id);
    select.replaceChildren(new Option('Choose a column…', ''));
    headers.forEach((header) => select.add(new Option(header, header)));
  }
  byId<HTMLParagraphElement>('mapping-error').hidden = true;
}

async function loadFile(file: File, mapping?: UsageColumnMapping): Promise<void> {
  store.setState({ status: 'parsing', error: null });
  try {
    const aggregate = await parseUsageFile(file, { mapping });
    pendingFile = null;
    store.setState({
      aggregate,
      result: calculateComparison(aggregate, store.getState().profile),
      status: 'ready',
      error: null,
    });
  } catch (error) {
    if (error instanceof CsvSchemaError) {
      pendingFile = file;
      populateMapping(error.headers);
      store.setState({ status: 'mapping', error: null });
      mappingDialog.showModal();
      return;
    }
    store.setState({ status: 'error', error: error instanceof Error ? error.message : 'Could not parse that CSV.' });
  } finally {
    csvInput.value = '';
  }
}

interface SideData {
  label: string;
  factoryName: string;
  kgCo2e: number;
  range?: string;
  className: 'ai' | 'life';
}

function currentSides(state: AppState): { left: SideData; right: SideData } | null {
  const impact = impactFor(state, activeComparison);
  if (!impact || !state.result) return null;
  const ai: SideData = {
    label: 'AI usage',
    factoryName: 'AI line',
    kgCo2e: state.result.aiCarbonKgCo2e.central,
    range: `${formatCarbon(state.result.aiCarbonKgCo2e.low)}–${formatCarbon(state.result.aiCarbonKgCo2e.high)}`,
    className: 'ai',
  };
  const life: SideData = {
    label: impact.label,
    factoryName: `${impact.label} line`,
    kgCo2e: impact.kgCo2e,
    range: 'Lifestyle factor estimate',
    className: 'life',
  };
  return swapped ? { left: life, right: ai } : { left: ai, right: life };
}

function applyLoad(side: 'left' | 'right', data: SideData, days: number): void {
  const burgers = data.kgCo2e / BURGER_KG_CO2E;
  byId(`${side}-unit-count`).textContent = formatBurgerOutput(burgers);
  byId(`${side}-unit-name`).textContent = `in ${days} days at 1 burger ≈ ${BURGER_KG_CO2E} kg CO₂e`;
  byId(`${side}-pace`).textContent = productionPace(burgers, days);
}

function renderComparison(state: AppState): void {
  if (!state.aggregate || !state.result) return;
  const sides = currentSides(state);
  const impact = impactFor(state, activeComparison);
  if (!sides || !impact) return;

  shell.classList.toggle('is-swapped', swapped);
  byId('left-label').textContent = sides.left.label;
  byId('left-value').textContent = formatCarbon(sides.left.kgCo2e);
  byId('left-range').textContent = sides.left.range ?? '';
  byId('right-label').textContent = sides.right.label;
  byId('right-value').textContent = formatCarbon(sides.right.kgCo2e);
  byId('right-range').textContent = sides.right.range ?? '';
  byId('left-factory-name').textContent = sides.left.factoryName;
  byId('right-factory-name').textContent = sides.right.factoryName;

  const low = Math.min(sides.left.kgCo2e, sides.right.kgCo2e);
  const high = Math.max(sides.left.kgCo2e, sides.right.kgCo2e);
  const ratio = low > 0 ? high / low : Number.POSITIVE_INFINITY;
  const larger = sides.left.kgCo2e >= sides.right.kgCo2e ? sides.left.label : sides.right.label;
  const visualThresholdKg = BURGER_KG_CO2E * 0.005;
  if (high < visualThresholdKg) {
    byId('ratio-value').textContent = '≈';
    byId('ratio-description').textContent = 'Both totals are below the visual threshold';
    byId('stage-status').textContent = 'Live throughput · both lines below threshold';
  } else if (low < visualThresholdKg) {
    byId('ratio-value').textContent = '≫';
    byId('ratio-description').textContent = `${larger} is measurably larger in this window`;
    byId('stage-status').textContent = 'Live throughput · one line below threshold';
  } else {
    byId('ratio-value').textContent = formatRatio(ratio);
    byId('ratio-description').textContent = `${larger} is larger in this window`;
    byId('stage-status').textContent = `Live throughput · totals differ by ${formatRatio(ratio)}`;
  }
  const laneCapacity = laneCapacityForStage();
  const maxColumns = maxColumnsForStage();
  const leftTiming = laneMotionTiming(sides.left.kgCo2e / BURGER_KG_CO2E, laneCapacity, maxColumns);
  const rightTiming = laneMotionTiming(sides.right.kgCo2e / BURGER_KG_CO2E, laneCapacity, maxColumns);
  if (leftTiming && rightTiming && Number.isFinite(ratio)) {
    const busyTiming = sides.left.kgCo2e >= sides.right.kgCo2e ? leftTiming : rightTiming;
    const markerNote = leftTiming.continuousMarker || rightTiming.continuousMarker
      ? ' One slow marker remains visible.'
      : '';
    byId('motion-note').textContent = `${state.result.comparisonDays} days = 1 minute. The exact ${formatRatio(ratio)} gap fills the busier belt up to ${busyTiming.columnCount} wide before increasing its speed.${markerNote}`;
  } else {
    byId('motion-note').textContent = `${state.result.comparisonDays} days = 1 minute. Output fills rows across each belt before increasing its speed.`;
  }
  byId('window-label').textContent = `${state.result.comparisonDays}-day carbon comparison`;
  byId('replay-window').textContent = `${state.result.comparisonDays}-day production · continuous loop`;
  byId('source-status').textContent = state.aggregate.synthetic ? 'Synthetic demonstration' : `${state.aggregate.sourceName} · local only`;

  applyLoad('left', sides.left, state.result.comparisonDays);
  applyLoad('right', sides.right, state.result.comparisonDays);
  byId('impact-total').textContent = formatCarbon(state.result.lifestyle.total.kgCo2e);
  for (const [id, component] of Object.entries(state.result.lifestyle.components)) {
    byId(`impact-${id}`).textContent = formatCarbon(component.kgCo2e);
  }
  document.querySelectorAll<HTMLButtonElement>('[data-comparison]').forEach((button) => {
    const selected = button.dataset.comparison === activeComparison;
    button.classList.toggle('is-active', selected);
    button.setAttribute('aria-pressed', String(selected));
  });
}

function clearReplay(): void {
  replayTimers.forEach((timer) => window.clearTimeout(timer));
  replayTimers = [];
  if (replayFrame !== null) window.cancelAnimationFrame(replayFrame);
  replayFrame = null;
  conveyorBurgers = [];
  conveyorLanes = [];
  flowLayer.replaceChildren();
  stage.classList.remove('is-playing', 'is-packing');
  replayButton.textContent = 'Restart lines';
  timelineFill.style.transform = 'scaleX(0)';
}

function createBurger(
  side: BeltSide,
  accent: 'ai' | 'life',
  bornAt: number,
  travelDurationMs: number,
  columnOffset: number,
  columnCount: number,
): ConveyorBurger {
  const item = document.createElement('img');
  item.className = `stream-item stream-item--${side}`;
  item.dataset.entity = accent;
  item.dataset.burgerId = String(++burgerSequence);
  item.src = `${ASSET_BASE}/burger.png`;
  item.alt = '';
  flowLayer.append(item);
  const spriteWidthPct = stage.clientWidth > 0
    ? item.offsetWidth / stage.clientWidth * 100
    : 8.5;
  const centerOffsets = centerOffsetsForLane(side, columnCount);
  const burger = {
    columnOffset,
    element: item,
    farCenterOffsetPct: centerOffsets.far,
    nearCenterOffsetPct: centerOffsets.near,
    side,
    bornAt,
    spriteWidthPct,
    travelDurationMs,
  };
  conveyorBurgers.push(burger);
  return burger;
}

function renderConveyor(now: number, keepRunning = true): void {
  for (const lane of conveyorLanes) {
    let catchUp = 0;
    while (now >= lane.nextSpawnAt && catchUp < lane.capacity) {
      const activeOnLane = conveyorBurgers.filter((burger) => burger.side === lane.side).length;
      if (activeOnLane <= lane.capacity - lane.columnCount) {
        for (let column = 0; column < lane.columnCount; column += 1) {
          createBurger(
            lane.side,
            lane.accent,
            lane.nextSpawnAt,
            lane.travelDurationMs,
            columnOffsetForIndex(column, lane.columnCount),
            lane.columnCount,
          );
        }
      }
      lane.nextSpawnAt += lane.intervalMs;
      catchUp += 1;
    }
  }

  const active: ConveyorBurger[] = [];
  for (const burger of conveyorBurgers) {
    const worldProgress = (now - burger.bornAt) / burger.travelDurationMs;
    if (worldProgress >= 1) {
      burger.element.remove();
      continue;
    }
    const pose = projectBeltPose(
      worldProgress,
      burger.side,
      burger.columnOffset,
      burger.spriteWidthPct,
      burger.farCenterOffsetPct,
      burger.nearCenterOffsetPct,
    );
    burger.element.style.left = `${pose.leftPct}%`;
    burger.element.style.top = `${pose.topPct}%`;
    burger.element.style.opacity = String(pose.opacity);
    burger.element.style.transform = `translate(-50%, -92%) scale(${pose.scale})`;
    burger.element.style.zIndex = String(8 + Math.round(pose.depth * 20));
    active.push(burger);
  }
  conveyorBurgers = active;

  for (const lane of conveyorLanes) {
    if (lane.continuousMarker && !conveyorBurgers.some((burger) => burger.side === lane.side)) {
      createBurger(lane.side, lane.accent, now, lane.travelDurationMs, 0, 1);
    }
  }

  const loopProgress = ((now - replayStartedAt) % RATE_LOOP_DURATION_MS) / RATE_LOOP_DURATION_MS;
  timelineFill.style.transform = `scaleX(${loopProgress})`;
  if (keepRunning) replayFrame = window.requestAnimationFrame((time) => renderConveyor(time));
}

function startReplay(): void {
  const state = store.getState();
  const sides = currentSides(state);
  if (!sides || !state.result) return;
  clearReplay();
  stage.classList.add('is-playing');
  replayButton.disabled = false;
  replayButton.textContent = 'Restart lines';
  timelineFill.style.transform = 'scaleX(0)';
  const now = performance.now();
  replayStartedAt = now;

  const schedule = (side: 'left' | 'right', data: SideData) => {
    const laneCapacity = laneCapacityForStage();
    const timing = laneMotionTiming(
      data.kgCo2e / BURGER_KG_CO2E,
      laneCapacity,
      maxColumnsForStage(),
    );
    if (!timing) return;
    const duration = timing.travelDurationMs;
    const interval = timing.continuousMarker
      ? duration
      : timing.intervalMs * timing.columnCount;
    const totalCapacity = timing.continuousMarker ? 1 : timing.totalCapacity;
    const visibleRows = timing.continuousMarker
      ? 1
      : clamp(Math.ceil(duration / interval), 1, laneCapacity);
    const seedOffset = Math.min(interval * 0.2, duration * 0.45);
    for (let row = 0; row < visibleRows; row += 1) {
      const age = seedOffset + row * interval;
      if (age >= duration) break;
      for (let column = 0; column < timing.columnCount; column += 1) {
        createBurger(
          side,
          data.className,
          now - age,
          duration,
          columnOffsetForIndex(column, timing.columnCount),
          timing.columnCount,
        );
      }
    }
    conveyorLanes.push({
      side,
      accent: data.className,
      columnCount: timing.columnCount,
      continuousMarker: timing.continuousMarker,
      intervalMs: interval,
      travelDurationMs: duration,
      capacity: totalCapacity,
      nextSpawnAt: timing.continuousMarker
        ? Number.POSITIVE_INFINITY
        : now + Math.max(16, interval - seedOffset),
    });
  };
  schedule('left', sides.left);
  schedule('right', sides.right);
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  renderConveyor(now, !reducedMotion);
}

store.subscribe((state) => {
  const errorMessage = byId<HTMLParagraphElement>('error-message');
  errorMessage.hidden = !state.error;
  errorMessage.textContent = state.error ?? '';
  dietSelect.value = state.profile.diet;
  homeSelect.value = state.profile.homeEnergy;
  regionSelect.value = state.profile.region;
  windowSelect.value = state.profile.comparisonWindow;
  drivingRange.value = String(state.profile.weeklyDrivingMiles);
  byId<HTMLOutputElement>('driving-output').value = `${state.profile.weeklyDrivingMiles} mi`;
  for (const [length, input] of Object.entries(flightInputs)) {
    input.value = String(state.profile.flightsPerYear[length as FlightLengthId]);
  }

  try {
    saveSnapshot(window.localStorage, state.profile, state.aggregate);
  } catch {
    // Persistence is optional; the current session remains functional.
  }

  if (state.aggregate && state.result) {
    byId('ai-source-meta').textContent = `${state.aggregate.requests.toLocaleString('en-US')} requests · ${Math.round(state.aggregate.outputTokens * state.result.windowScale).toLocaleString('en-US')} output tokens · ${formatEnergy(state.result.energyWh.central)}`;
    renderComparison(state);
    if (!hasPlayedInitialReplay) {
      hasPlayedInitialReplay = true;
      replayTimers.push(window.setTimeout(() => startReplay(), 450));
    }
  }
});

document.querySelectorAll<HTMLButtonElement>('[data-comparison]').forEach((button) => {
  button.addEventListener('click', () => {
    activeComparison = button.dataset.comparison as LifestyleMetricId;
    renderComparison(store.getState());
    startReplay();
  });
});

dietSelect.addEventListener('change', () => updateProfile({ diet: dietSelect.value as DietId }));
homeSelect.addEventListener('change', () => updateProfile({ homeEnergy: homeSelect.value as HomeEnergyId }));
regionSelect.addEventListener('change', () => updateProfile({ region: regionSelect.value as RegionId }));
windowSelect.addEventListener('change', () => updateProfile({ comparisonWindow: windowSelect.value as ComparisonWindowId }));
drivingRange.addEventListener('input', () => updateProfile({ weeklyDrivingMiles: Number(drivingRange.value) }));
for (const [length, input] of Object.entries(flightInputs)) {
  input.addEventListener('input', () => updateFlight(length as FlightLengthId, Number(input.value)));
}

scenarioSelect.addEventListener('change', () => {
  byId('scenario-description').textContent = selectedScenario().description;
});
byId('load-synthetic').addEventListener('click', () => {
  loadSynthetic();
  dataDialog.close();
  window.setTimeout(() => startReplay(), 100);
});
byId('download-synthetic').addEventListener('click', () => {
  const scenario = selectedScenario();
  const url = URL.createObjectURL(new Blob([scenario.csv], { type: 'text/csv' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = scenario.filename;
  link.click();
  URL.revokeObjectURL(url);
});
byId('replace-csv').addEventListener('click', () => csvInput.click());
csvInput.addEventListener('change', () => {
  const file = csvInput.files?.[0];
  if (file) void loadFile(file);
});
byId('reset-profile').addEventListener('click', () => updateProfile({
  ...DEFAULT_PROFILE,
  flightsPerYear: { ...DEFAULT_PROFILE.flightsPerYear },
}));

replayButton.addEventListener('click', startReplay);
byId('swap-sides').addEventListener('click', () => {
  swapped = !swapped;
  renderComparison(store.getState());
  startReplay();
});
byId('data-open').addEventListener('click', () => dataDialog.showModal());
byId('data-close').addEventListener('click', () => dataDialog.close());
byId('methodology-open').addEventListener('click', () => methodologyDialog.showModal());
byId('methodology-close').addEventListener('click', () => methodologyDialog.close());

let observedLaneCapacity = laneCapacityForStage();
new ResizeObserver(() => {
  const nextCapacity = laneCapacityForStage();
  if (nextCapacity === observedLaneCapacity) return;
  observedLaneCapacity = nextCapacity;
  startReplay();
}).observe(stage);

window.addEventListener('keydown', (event) => {
  const target = event.target;
  const editing = target instanceof HTMLElement && target.matches('input, select, textarea, [contenteditable="true"]');
  if (editing || event.metaKey || event.ctrlKey || event.altKey) return;
  if (event.key.toLowerCase() === 'r') {
    startReplay();
    event.preventDefault();
  }
});

function closeMapping(): void {
  pendingFile = null;
  mappingDialog.close();
  store.setState({ status: store.getState().aggregate ? 'ready' : 'error' });
}

byId('mapping-close').addEventListener('click', closeMapping);
mappingForm.addEventListener('submit', (event) => {
  event.preventDefault();
  if (!pendingFile) return;
  const mapping: UsageColumnMapping = {
    timestamp: byId<HTMLSelectElement>('map-timestamp').value,
    model: byId<HTMLSelectElement>('map-model').value,
    inputTokens: byId<HTMLSelectElement>('map-input').value || undefined,
    outputTokens: byId<HTMLSelectElement>('map-output').value || undefined,
    requests: byId<HTMLSelectElement>('map-requests').value || undefined,
  };
  const mappingError = byId<HTMLParagraphElement>('mapping-error');
  if (!mapping.timestamp || !mapping.model || (!mapping.inputTokens && !mapping.outputTokens)) {
    mappingError.textContent = 'Choose a date, model, and at least one token column.';
    mappingError.hidden = false;
    return;
  }
  const file = pendingFile;
  mappingDialog.close();
  void loadFile(file, mapping);
});

if (!initialAggregate) loadSynthetic('typical');
