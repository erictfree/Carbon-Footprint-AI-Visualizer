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
const PRODUCTION_WINDOW_DURATION_MS = 60_000;
const MAX_BURGERS_ON_LANE = 10;

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
        <img class="factory-stage__art" src="${ASSET_BASE}/burgerbelt2.jpg" alt="Twin industrial conveyor belts running from a distant vanishing point toward the viewer" />
        <div class="factory-stage__shade"></div>
        <div class="belt-readout belt-readout--left">
          <strong id="left-belt-carbon">—</strong>
          <strong id="left-pace">—</strong>
        </div>
        <div class="belt-readout belt-readout--right">
          <strong id="right-belt-carbon">—</strong>
          <strong id="right-pace">—</strong>
        </div>
        <div class="flow-layer" id="flow-layer" aria-hidden="true"></div>
      </figure>

      <section class="output-strip" aria-label="Production totals and visual explanation">
        <article class="output-card output-card--left"><span>Window output</span><strong id="left-unit-count">—</strong><small id="left-unit-name">burger equivalent</small></article>
        <div class="output-story"><strong id="stage-status" aria-live="polite">Production batch ready</strong><p id="motion-note">One comparison window enters from the back over one minute, then the run stops after the final burgers clear the foreground.</p></div>
        <article class="output-card output-card--right"><span>Window output</span><strong id="right-unit-count">—</strong><small id="right-unit-name">burger equivalent</small></article>
      </section>

      <section class="replay-strip" aria-label="Factory replay controls">
        <div class="replay-copy">
          <span class="live-dot"></span>
          <div><strong id="replay-window">30-day production · single batch</strong><span id="source-status">Synthetic demonstration</span></div>
        </div>
        <div class="timeline" aria-hidden="true"><span id="timeline-fill"></span></div>
        <div class="replay-actions">
          <button class="sound-button" id="sound-toggle" type="button" aria-pressed="false" title="Play the Burger Blitz soundtrack">♫ Music</button>
          <button class="replay-button" id="replay-button" type="button">Start batch</button>
        </div>
      </section>
    </section>
  </main>

  <audio id="soundtrack" src="${ASSET_BASE}/burger-blitz.mp3" preload="metadata"></audio>

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
      <div><dt>Visual scale</dt><dd>One comparison window enters from the back over one minute. Exact output fills perspective-aware rows—up to three burgers across on desktop—before belt speed rises. A slow marker carries sub-one-burger output; the LED counters accumulate to the authoritative totals. The run ends after the final burgers clear the foreground.</dd></div>
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

function formatBeltCarbon(kgCo2e: number): string {
  if (!Number.isFinite(kgCo2e)) return '—';
  if (kgCo2e >= 1_000_000) return `${(kgCo2e / 1_000_000).toFixed(1)} Mt`;
  if (kgCo2e >= 1_000) return `${(kgCo2e / 1_000).toFixed(1)} t`;
  if (kgCo2e >= 100) return `${Math.round(kgCo2e).toLocaleString('en-US')} kg`;
  if (kgCo2e >= 10) return `${kgCo2e.toFixed(1)} kg`;
  if (kgCo2e >= 0.1) return `${kgCo2e.toFixed(2)} kg`;
  return `${Math.round(kgCo2e * 1_000).toLocaleString('en-US')} g`;
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
  if (perDay < 0.05) return `1 burger / ${Math.round(1 / perDay)}d`;
  if (perDay < 1) return `${perDay.toFixed(2)} / day`;
  if (perDay < 100) return `${perDay.toFixed(1)} / day`;
  if (perDay < 100_000) return `${Math.round(perDay).toLocaleString('en-US')} / day`;
  return `${(perDay / 1_000_000).toFixed(1)}M / day`;
}

const shell = byId('works-shell');
const stage = byId('factory-stage');
const flowLayer = byId('flow-layer');
const replayButton = byId<HTMLButtonElement>('replay-button');
const soundButton = byId<HTMLButtonElement>('sound-toggle');
const soundtrack = byId<HTMLAudioElement>('soundtrack');
soundtrack.volume = 0.55;
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
let replayFrame: number | null = null;
let preRollTimer: number | null = null;
let replayStartedAt = 0;
let soundtrackEnabled = true;
let soundtrackLoopTimer: number | null = null;
let soundtrackGeneration = 0;
let replayTotals = { left: 0, right: 0 };

interface ConveyorBurger {
  columnOffset: number;
  element: HTMLImageElement;
  farCenterOffsetPct: number;
  side: BeltSide;
  bornAt: number;
  spriteWidthPct: number;
  travelDurationMs: number;
}

interface ConveyorLane {
  side: BeltSide;
  accent: 'ai' | 'life';
  columnCount: number;
  intervalMs: number;
  travelDurationMs: number;
  capacity: number;
  nextSpawnAt: number;
  remainingToSpawn: number;
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

function railCenterOffsetForLane(side: BeltSide, columnCount: number): number {
  if (columnCount < 3) return 0;
  return side === 'left' ? 0.35 : -0.35;
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
  byId('left-belt-carbon').textContent = formatBeltCarbon(sides.left.kgCo2e);
  byId('right-belt-carbon').textContent = formatBeltCarbon(sides.right.kgCo2e);

  const low = Math.min(sides.left.kgCo2e, sides.right.kgCo2e);
  const high = Math.max(sides.left.kgCo2e, sides.right.kgCo2e);
  const ratio = low > 0 ? high / low : Number.POSITIVE_INFINITY;
  const larger = sides.left.kgCo2e >= sides.right.kgCo2e ? sides.left.label : sides.right.label;
  const visualThresholdKg = BURGER_KG_CO2E * 0.005;
  if (high < visualThresholdKg) {
    byId('ratio-value').textContent = '≈';
    byId('ratio-description').textContent = 'Both totals are below the visual threshold';
    byId('stage-status').textContent = 'Single batch · both lines below threshold';
  } else if (low < visualThresholdKg) {
    byId('ratio-value').textContent = '≫';
    byId('ratio-description').textContent = `${larger} is measurably larger in this window`;
    byId('stage-status').textContent = 'Single batch · one line below threshold';
  } else {
    byId('ratio-value').textContent = formatRatio(ratio);
    byId('ratio-description').textContent = `${larger} is larger in this window`;
    byId('stage-status').textContent = `Single batch · totals differ by ${formatRatio(ratio)}`;
  }
  const laneCapacity = laneCapacityForStage();
  const maxColumns = maxColumnsForStage();
  const leftTiming = laneMotionTiming(sides.left.kgCo2e / BURGER_KG_CO2E, laneCapacity, maxColumns);
  const rightTiming = laneMotionTiming(sides.right.kgCo2e / BURGER_KG_CO2E, laneCapacity, maxColumns);
  if (leftTiming && rightTiming && Number.isFinite(ratio)) {
    const busyTiming = sides.left.kgCo2e >= sides.right.kgCo2e ? leftTiming : rightTiming;
    const markerNote = leftTiming.continuousMarker || rightTiming.continuousMarker
      ? ' A single slow marker carries the fractional output.'
      : '';
    byId('motion-note').textContent = `${state.result.comparisonDays} days enter over 1 minute. The ${formatRatio(ratio)} gap uses ${busyTiming.columnCount}-wide rows; the LEDs count upward, then the run stops after the final row clears.${markerNote}`;
  } else {
    byId('motion-note').textContent = `${state.result.comparisonDays} days enter over 1 minute. The LEDs count upward, then the run stops after the last burgers clear.`;
  }
  byId('window-label').textContent = `${state.result.comparisonDays}-day carbon comparison`;
  byId('replay-window').textContent = `${state.result.comparisonDays}-day production · single batch`;
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
  if (preRollTimer !== null) window.clearTimeout(preRollTimer);
  preRollTimer = null;
  if (replayFrame !== null) window.cancelAnimationFrame(replayFrame);
  replayFrame = null;
  conveyorBurgers = [];
  conveyorLanes = [];
  flowLayer.replaceChildren();
  stage.classList.remove('is-playing', 'is-packing', 'is-complete', 'is-preroll');
  replayButton.textContent = 'Restart batch';
  timelineFill.style.transform = 'scaleX(0)';
}

function prepareBatch(): void {
  const state = store.getState();
  const sides = currentSides(state);
  if (!sides) return;
  clearReplay();
  stopSoundtrack();
  replayTotals = { left: sides.left.kgCo2e, right: sides.right.kgCo2e };
  updateBeltCounters(0);
  replayButton.textContent = 'Start batch';
  byId('stage-status').textContent = 'Production batch ready · music queued with start';
}

function renderSoundtrackControl(): void {
  soundButton.setAttribute('aria-pressed', String(soundtrackEnabled));
  soundButton.textContent = soundtrackEnabled ? '♫ Music queued' : '♫ Music off';
  soundButton.title = soundtrackEnabled
    ? 'Do not play Burger Blitz with the next batch'
    : 'Queue Burger Blitz with the next batch';
}

function stopSoundtrack(reset = true): void {
  soundtrackGeneration += 1;
  if (soundtrackLoopTimer !== null) window.clearTimeout(soundtrackLoopTimer);
  soundtrackLoopTimer = null;
  soundtrack.pause();
  soundtrack.volume = 1;
  if (reset) soundtrack.currentTime = 0;
}

function primeSoundtrack(): void {
  if (!soundtrackEnabled) return;
  if (soundtrackLoopTimer !== null) window.clearTimeout(soundtrackLoopTimer);
  const generation = ++soundtrackGeneration;
  soundtrack.pause();
  soundtrack.currentTime = 0;
  soundtrack.volume = 0;
  void soundtrack.play().catch(() => {
    if (generation !== soundtrackGeneration) return;
    soundtrackEnabled = false;
    stopSoundtrack();
    renderSoundtrackControl();
  });
  soundtrackLoopTimer = null;
}

function releaseSoundtrack(): void {
  if (!soundtrackEnabled) return;
  soundtrack.currentTime = 0;
  soundtrack.volume = 1;
  void soundtrack.play().catch(() => {
    soundtrackEnabled = false;
    stopSoundtrack();
    renderSoundtrackControl();
  });
}

function updateBeltCounters(progress: number): void {
  const elapsedShare = clamp(progress, 0, 1);
  byId('left-belt-carbon').textContent = formatBeltCarbon(replayTotals.left * elapsedShare);
  byId('right-belt-carbon').textContent = formatBeltCarbon(replayTotals.right * elapsedShare);
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
  const burger = {
    columnOffset,
    element: item,
    farCenterOffsetPct: railCenterOffsetForLane(side, columnCount),
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
    while (lane.remainingToSpawn > 0 && now >= lane.nextSpawnAt && catchUp < lane.capacity) {
      const rowBurgerCount = Math.min(lane.columnCount, lane.remainingToSpawn);
      const activeOnLane = conveyorBurgers.filter((burger) => burger.side === lane.side).length;
      if (activeOnLane > lane.capacity - rowBurgerCount) break;
      for (let column = 0; column < rowBurgerCount; column += 1) {
        createBurger(
          lane.side,
          lane.accent,
          lane.nextSpawnAt,
          lane.travelDurationMs,
          columnOffsetForIndex(column, rowBurgerCount),
          rowBurgerCount,
        );
      }
      lane.remainingToSpawn -= rowBurgerCount;
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
    );
    burger.element.style.left = `${pose.leftPct}%`;
    burger.element.style.top = `${pose.topPct}%`;
    burger.element.style.opacity = String(pose.opacity);
    burger.element.style.transform = `translate(-50%, -92%) scale(${pose.scale})`;
    burger.element.style.zIndex = String(8 + Math.round(pose.depth * 20));
    active.push(burger);
  }
  conveyorBurgers = active;

  const runProgress = clamp(
    (now - replayStartedAt) / PRODUCTION_WINDOW_DURATION_MS,
    0,
    1,
  );
  timelineFill.style.transform = `scaleX(${runProgress})`;
  updateBeltCounters(runProgress);

  const allSpawned = conveyorLanes.every((lane) => lane.remainingToSpawn === 0);
  if (allSpawned && conveyorBurgers.length === 0) {
    timelineFill.style.transform = 'scaleX(1)';
    updateBeltCounters(1);
    stage.classList.remove('is-playing', 'is-packing');
    stage.classList.add('is-complete');
    replayButton.textContent = 'Replay batch';
    byId('stage-status').textContent = 'Batch complete · final totals reached';
    stopSoundtrack(false);
    replayFrame = null;
    return;
  }
  if (keepRunning) replayFrame = window.requestAnimationFrame((time) => renderConveyor(time));
}

function beginBatch(): void {
  const state = store.getState();
  const sides = currentSides(state);
  if (!sides || !state.result) return;
  clearReplay();
  stage.classList.add('is-playing');
  replayButton.disabled = false;
  replayButton.textContent = 'Restart batch';
  timelineFill.style.transform = 'scaleX(0)';
  const now = performance.now();
  replayStartedAt = now;
  replayTotals = { left: sides.left.kgCo2e, right: sides.right.kgCo2e };
  updateBeltCounters(0);
  byId('stage-status').textContent = 'Batch running · counters show current output';

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
      ? PRODUCTION_WINDOW_DURATION_MS
      : timing.intervalMs * timing.columnCount;
    const totalCapacity = timing.continuousMarker ? 1 : timing.totalCapacity;
    const burgerOutput = data.kgCo2e / BURGER_KG_CO2E;
    const visibleBurgerCount = timing.continuousMarker ? 1 : Math.max(1, Math.ceil(burgerOutput));
    conveyorLanes.push({
      side,
      accent: data.className,
      columnCount: timing.columnCount,
      intervalMs: interval,
      travelDurationMs: duration,
      capacity: totalCapacity,
      nextSpawnAt: now,
      remainingToSpawn: visibleBurgerCount,
    });
  };
  schedule('left', sides.left);
  schedule('right', sides.right);
  releaseSoundtrack();
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  renderConveyor(now, !reducedMotion);
}

function startReplay(): void {
  const state = store.getState();
  const sides = currentSides(state);
  if (!sides || !state.result) return;
  clearReplay();
  stopSoundtrack();
  replayTotals = { left: sides.left.kgCo2e, right: sides.right.kgCo2e };
  updateBeltCounters(0);
  stage.classList.add('is-preroll');
  replayButton.disabled = true;
  replayButton.textContent = 'Starting…';
  byId('stage-status').textContent = 'Systems check · production starts after the flash';
  primeSoundtrack();
  preRollTimer = window.setTimeout(() => {
    preRollTimer = null;
    stage.classList.remove('is-preroll');
    beginBatch();
  }, 900);
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
    prepareBatch();
  }
});

document.querySelectorAll<HTMLButtonElement>('[data-comparison]').forEach((button) => {
  button.addEventListener('click', () => {
    activeComparison = button.dataset.comparison as LifestyleMetricId;
    renderComparison(store.getState());
    prepareBatch();
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
soundButton.addEventListener('click', () => {
  if (soundtrackEnabled) {
    soundtrackEnabled = false;
    stopSoundtrack();
    renderSoundtrackControl();
    return;
  }
  soundtrackEnabled = true;
  renderSoundtrackControl();
});
byId('swap-sides').addEventListener('click', () => {
  swapped = !swapped;
  renderComparison(store.getState());
  prepareBatch();
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
  prepareBatch();
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

renderSoundtrackControl();
if (!initialAggregate) loadSynthetic('typical');
