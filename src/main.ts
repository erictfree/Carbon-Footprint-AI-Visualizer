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
import {
  CsvSchemaError,
  parseUsageCsvText,
  parseUsageFile,
  type UsageColumnMapping,
} from './ingest/parseUsageCsv';
import { createStore } from './state/store';
import { loadSnapshot, saveSnapshot } from './storage/persistence';
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
const RATE_LOOP_DURATION_MS = 14_000;

const restored = loadSnapshot(window.localStorage);
const initialProfile = restored?.profile ?? DEFAULT_PROFILE;
const initialAggregate = restored?.aggregate ?? null;

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

      <figure class="factory-stage" id="factory-stage" aria-label="Two burger factories replaying carbon impact side by side">
        <img class="factory-stage__art" src="${ASSET_BASE}/factory-stage.png" alt="Miniature cyan and amber burger factories connected to a central balance scale" />
        <div class="factory-stage__shade"></div>
        <div class="factory-label factory-label--left">
          <span id="left-factory-name">AI factory</span>
          <strong id="left-pace">—</strong>
        </div>
        <div class="factory-label factory-label--right">
          <span id="right-factory-name">Lifestyle factory</span>
          <strong id="right-pace">—</strong>
        </div>
        <div class="flow-layer" id="flow-layer" aria-hidden="true"></div>
        <div class="load-frame load-frame--left" id="left-load-frame" aria-hidden="true">
          <img id="left-load" src="${ASSET_BASE}/burger.png" alt="" />
        </div>
        <div class="load-frame load-frame--right" id="right-load-frame" aria-hidden="true">
          <img id="right-load" src="${ASSET_BASE}/burger.png" alt="" />
        </div>
        <div class="unit-chip unit-chip--left"><strong id="left-unit-count">—</strong><span id="left-unit-name">burger equivalent</span></div>
        <div class="unit-chip unit-chip--right"><strong id="right-unit-count">—</strong><span id="right-unit-name">burger equivalent</span></div>
        <div class="stage-status" id="stage-status" aria-live="polite">Total balance · rate loop ready</div>
        <figcaption>
          Moving burgers track their ramps; <strong>speed and spacing rise with relative CO₂ rate</strong>. The center scale separately holds the packed totals; one burger represents about 3 kg CO₂e.
        </figcaption>
      </figure>

      <section class="replay-strip" aria-label="Factory replay controls">
        <div class="replay-copy">
          <span class="live-dot"></span>
          <div><strong id="replay-window">30-day rate · continuous loop</strong><span id="source-status">Synthetic demonstration</span></div>
        </div>
        <div class="timeline" aria-hidden="true"><span id="timeline-fill"></span></div>
        <button class="replay-button" id="replay-button" type="button">Restart rate loop</button>
      </section>

      <section class="packing-legend" aria-label="Burger packing scale">
        <div class="packing-legend__intro"><span>How scale changes</span><strong>Same object, smarter packing</strong></div>
        <div class="packing-step"><img class="packing-step__partial" src="${ASSET_BASE}/burger.png" alt="" /><span><strong>&lt;1</strong> tiny burger</span></div>
        <div class="packing-step"><img src="${ASSET_BASE}/burger.png" alt="" /><span><strong>1</strong> burger</span></div>
        <div class="packing-step"><img src="${ASSET_BASE}/tray.png" alt="" /><span><strong>10</strong> tray</span></div>
        <div class="packing-step"><img src="${ASSET_BASE}/crate.png" alt="" /><span><strong>100</strong> crate</span></div>
        <div class="packing-step"><img src="${ASSET_BASE}/pallet.png" alt="" /><span><strong>1K</strong> pallet</span></div>
        <div class="packing-step"><img src="${ASSET_BASE}/truck.png" alt="" /><span><strong>10K</strong> truck</span></div>
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
      <div><dt>Visual scale</dt><dd>Animation speed is capped. Larger values pack into trays, crates, pallets, and trucks while exact numbers remain visible.</dd></div>
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

interface PackingTier {
  asset: string;
  label: string;
  plural: string;
  scale: number;
  fractional: boolean;
}

const PACKING_TIERS: PackingTier[] = [
  { asset: 'burger.png', label: 'burger', plural: 'burgers', scale: 1, fractional: false },
  { asset: 'tray.png', label: 'tray', plural: 'trays', scale: 10, fractional: false },
  { asset: 'crate.png', label: 'crate', plural: 'crates', scale: 100, fractional: false },
  { asset: 'pallet.png', label: 'pallet', plural: 'pallets', scale: 1_000, fractional: false },
  { asset: 'truck.png', label: 'truck', plural: 'trucks', scale: 10_000, fractional: false },
];

function tierFor(burgers: number): PackingTier {
  if (burgers < 1) return { ...PACKING_TIERS[0]!, fractional: true, label: 'partial burger', plural: 'partial burgers' };
  if (burgers < 10) return PACKING_TIERS[0]!;
  if (burgers < 100) return PACKING_TIERS[1]!;
  if (burgers < 1_000) return PACKING_TIERS[2]!;
  if (burgers < 10_000) return PACKING_TIERS[3]!;
  return PACKING_TIERS[4]!;
}

function formatPackedUnits(burgers: number, tier: PackingTier): string {
  if (tier.fractional) return `${burgers.toFixed(2)} burger`;
  const units = burgers / tier.scale;
  const formatted = units >= 100 ? Math.round(units).toLocaleString('en-US') : units.toFixed(units < 10 ? 1 : 0);
  return `${formatted} ${Math.abs(units - 1) < 0.001 ? tier.label : tier.plural}`;
}

function productionPace(burgers: number, days: number): string {
  if (burgers <= 0) return 'Line idle';
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
let replayAnimations: Animation[] = [];
let hasPlayedInitialReplay = false;

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
    factoryName: 'AI factory',
    kgCo2e: state.result.aiCarbonKgCo2e.central,
    range: `${formatCarbon(state.result.aiCarbonKgCo2e.low)}–${formatCarbon(state.result.aiCarbonKgCo2e.high)}`,
    className: 'ai',
  };
  const life: SideData = {
    label: impact.label,
    factoryName: `${impact.label} factory`,
    kgCo2e: impact.kgCo2e,
    range: 'Lifestyle factor estimate',
    className: 'life',
  };
  return swapped ? { left: life, right: ai } : { left: ai, right: life };
}

function applyLoad(side: 'left' | 'right', data: SideData, days: number): void {
  const burgers = data.kgCo2e / BURGER_KG_CO2E;
  const tier = tierFor(burgers);
  const frame = byId(`${side}-load-frame`);
  const image = byId<HTMLImageElement>(`${side}-load`);
  frame.classList.toggle('is-fractional', tier.fractional);
  frame.classList.toggle('is-truck', tier.label === 'truck');
  frame.style.setProperty('--fraction-scale', String(clamp(Math.sqrt(Math.max(0, burgers)), 0.18, 0.82)));
  frame.dataset.entity = data.className;
  image.src = `${ASSET_BASE}/${tier.asset}`;
  byId(`${side}-unit-count`).textContent = formatPackedUnits(burgers, tier);
  byId(`${side}-unit-name`).textContent = tier.fractional ? 'a visible fraction' : `packed as ${tier.plural}`;
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
  byId('ratio-value').textContent = formatRatio(ratio);
  byId('ratio-description').textContent = `${larger} is larger in this window`;
  byId('stage-status').textContent = `Total balance · ${larger} ${formatRatio(ratio)} heavier`;
  byId('window-label').textContent = `${state.result.comparisonDays}-day carbon comparison`;
  byId('replay-window').textContent = `${state.result.comparisonDays}-day rate · continuous loop`;
  byId('source-status').textContent = state.aggregate.synthetic ? 'Synthetic demonstration' : `${state.aggregate.sourceName} · local only`;

  applyLoad('left', sides.left, state.result.comparisonDays);
  applyLoad('right', sides.right, state.result.comparisonDays);
  const tilt = clamp(Math.log10(Math.max(1, ratio)) * 7, 0, 24);
  const leftHeavy = sides.left.kgCo2e > sides.right.kgCo2e;
  stage.style.setProperty('--left-drop', `${leftHeavy ? tilt : -tilt}px`);
  stage.style.setProperty('--right-drop', `${leftHeavy ? -tilt : tilt}px`);

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
  replayAnimations.forEach((animation) => animation.cancel());
  replayAnimations = [];
  flowLayer.replaceChildren();
  stage.classList.remove('is-playing', 'is-packing');
  replayButton.textContent = 'Restart rate loop';
  timelineFill.style.transform = 'scaleX(0)';
}

function launchItem(side: 'left' | 'right', accent: 'ai' | 'life', sizeScale: number, duration: number): void {
  const item = document.createElement('img');
  item.className = `stream-item stream-item--${side}`;
  item.dataset.entity = accent;
  item.src = `${ASSET_BASE}/burger.png`;
  item.alt = '';
  flowLayer.append(item);
  const path = side === 'left'
    ? [
        { left: '14.6%', top: '54%', opacity: 1, transform: `translate(-50%, -50%) scale(${0.3 * sizeScale})` },
        { left: '16.1%', top: '58.5%', opacity: 1, offset: 0.1, transform: `translate(-50%, -50%) scale(${0.36 * sizeScale})` },
        { left: '17.8%', top: '63%', opacity: 1, offset: 0.2, transform: `translate(-50%, -50%) scale(${0.41 * sizeScale})` },
        { left: '19.4%', top: '67.2%', opacity: 1, offset: 0.3, transform: `translate(-50%, -50%) scale(${0.46 * sizeScale})` },
        { left: '20.8%', top: '71.2%', opacity: 1, offset: 0.4, transform: `translate(-50%, -50%) scale(${0.5 * sizeScale})` },
        { left: '22%', top: '74%', opacity: 1, offset: 0.48, transform: `translate(-50%, -50%) scale(${0.52 * sizeScale})` },
        { left: '20.6%', top: '78%', opacity: 1, offset: 0.56, transform: `translate(-50%, -50%) scale(${0.54 * sizeScale})` },
        { left: '17.2%', top: '83%', opacity: 1, offset: 0.67, transform: `translate(-50%, -50%) scale(${0.56 * sizeScale})` },
        { left: '13.5%', top: '87.5%', opacity: 1, offset: 0.77, transform: `translate(-50%, -50%) scale(${0.57 * sizeScale})` },
        { left: '8.5%', top: '94.5%', opacity: 1, offset: 0.87, transform: `translate(-50%, -50%) scale(${0.58 * sizeScale})` },
        { left: '-1%', top: '102%', opacity: 1, offset: 0.95, transform: `translate(-50%, -50%) scale(${0.58 * sizeScale})` },
        { left: '-10%', top: '110%', opacity: 0, transform: `translate(-50%, -50%) scale(${0.58 * sizeScale})` },
      ]
    : [
        { left: '92.1%', top: '51.5%', opacity: 1, transform: `translate(-50%, -50%) scale(${0.3 * sizeScale})` },
        { left: '90.2%', top: '56.5%', opacity: 1, offset: 0.1, transform: `translate(-50%, -50%) scale(${0.36 * sizeScale})` },
        { left: '88.4%', top: '61.2%', opacity: 1, offset: 0.2, transform: `translate(-50%, -50%) scale(${0.41 * sizeScale})` },
        { left: '86.8%', top: '65.5%', opacity: 1, offset: 0.29, transform: `translate(-50%, -50%) scale(${0.45 * sizeScale})` },
        { left: '85.3%', top: '68.5%', opacity: 1, offset: 0.38, transform: `translate(-50%, -50%) scale(${0.49 * sizeScale})` },
        { left: '84.5%', top: '72.5%', opacity: 1, offset: 0.47, transform: `translate(-50%, -50%) scale(${0.52 * sizeScale})` },
        { left: '85.2%', top: '77%', opacity: 1, offset: 0.58, transform: `translate(-50%, -50%) scale(${0.54 * sizeScale})` },
        { left: '87.3%', top: '81.5%', opacity: 1, offset: 0.68, transform: `translate(-50%, -50%) scale(${0.56 * sizeScale})` },
        { left: '89.2%', top: '86%', opacity: 1, offset: 0.77, transform: `translate(-50%, -50%) scale(${0.57 * sizeScale})` },
        { left: '90.7%', top: '92%', opacity: 1, offset: 0.86, transform: `translate(-50%, -50%) scale(${0.58 * sizeScale})` },
        { left: '95%', top: '96.5%', opacity: 1, offset: 0.95, transform: `translate(-50%, -50%) scale(${0.58 * sizeScale})` },
        { left: '102%', top: '99.5%', opacity: 0, transform: `translate(-50%, -50%) scale(${0.58 * sizeScale})` },
      ];
  const animation = item.animate(path, { duration, easing: 'linear', fill: 'forwards' });
  replayAnimations.push(animation);
  void animation.finished.catch(() => undefined).finally(() => {
    item.remove();
    replayAnimations = replayAnimations.filter((candidate) => candidate !== animation);
  });
}

function visualRate(kgCo2e: number): number {
  const burgers = kgCo2e / BURGER_KG_CO2E;
  if (burgers <= 0) return 0;
  return clamp(0.05 + Math.log10(burgers + 1) * 0.24, 0.05, 0.75);
}

function rollingDuration(kgCo2e: number): number {
  const burgers = kgCo2e / BURGER_KG_CO2E;
  return clamp(15_000 - Math.log10(burgers + 1) * 2_000, 9_500, 15_000);
}

function startReplay(): void {
  const state = store.getState();
  const sides = currentSides(state);
  if (!sides || !state.result) return;
  clearReplay();
  stage.classList.add('is-playing');
  replayButton.disabled = false;
  replayButton.textContent = 'Restart rate loop';
  timelineFill.style.transform = 'scaleX(0)';
  replayAnimations.push(timelineFill.animate(
    [{ transform: 'scaleX(0)' }, { transform: 'scaleX(1)' }],
    { duration: RATE_LOOP_DURATION_MS, easing: 'linear', iterations: Number.POSITIVE_INFINITY },
  ));

  const schedule = (side: 'left' | 'right', data: SideData) => {
    const rate = visualRate(data.kgCo2e);
    if (rate <= 0) return;
    const duration = rollingDuration(data.kgCo2e);
    const sizeScale = rate > 0.45 ? 0.82 : 1;
    launchItem(side, data.className, sizeScale, duration);
    const timer = window.setInterval(() => launchItem(side, data.className, sizeScale, duration), Math.round(1_000 / rate));
    replayTimers.push(timer);
  };
  schedule('left', sides.left);
  schedule('right', sides.right);
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
