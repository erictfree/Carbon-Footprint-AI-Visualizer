import './styles.css';
import { calculateComparison, formatDistance, formatEnergy } from './calc/engine';
import {
  COMPARISON_WINDOWS,
  DEFAULT_PROFILE,
  DIETS,
  FLIGHT_KG_CO2E,
  HOME_ENERGY,
  MASLEY_SOURCE,
  REGIONS,
} from './factors/masley';
import {
  SYNTHETIC_SCENARIOS,
  type SyntheticScenarioId,
} from './fixtures/synthetic';
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
if (!app) throw new Error('PromptMiles could not find its app root.');

const CAR_ASSET_SOURCE = {
  label: '2024 Tesla Model 3 by RBLXSupercars, shared by brandonleong28',
  url: 'https://sketchfab.com/3d-models/tesla-model-3-2024-36c52f3f89f6439c90310f14e8ff33f2',
  licenseUrl: 'https://creativecommons.org/licenses/by/4.0/',
} as const;

const MAP_SOURCES = {
  world: 'https://github.com/topojson/world-atlas',
  us: 'https://github.com/topojson/us-atlas',
} as const;

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
  <main class="app-shell">
    <section class="scene-panel" aria-label="Model 3 distance comparison visualization">
      <div class="scene-sky"></div>
      <div class="scene-canvas" id="scene-canvas"></div>
      <div class="scene-vignette"></div>
      <div class="scene-origin">
        <span>Starting from</span>
        <strong id="scene-origin">Austin, TX</strong>
      </div>
      <div class="scene-stage">
        <span>Distance staging</span>
        <strong id="scene-stage">Regional scale</strong>
        <small id="scene-stage-note">Regional distance field</small>
      </div>
      <div class="scene-label scene-label--ai">
        <span class="scene-label__dot"></span>
        <span>AI path</span>
        <strong id="scene-ai-distance">—</strong>
      </div>
      <div class="scene-label scene-label--life" id="scene-life-label-card">
        <span class="scene-label__dot"></span>
        <span id="scene-life-label">Lifestyle total</span>
        <strong id="scene-life-distance">—</strong>
      </div>
      <div class="scene-cinematic-status" aria-live="polite">
        <span></span>
        <strong>Translating energy into road</strong>
      </div>
      <p class="scene-hint">Drag to orbit · R replay · H HUD · F fullscreen</p>
    </section>

    <header class="topbar">
      <a class="brand" href="/" aria-label="PromptMiles home">
        <span class="brand__mark" aria-hidden="true"></span>
        <span>PromptMiles</span>
      </a>
      <p class="topbar__dek">AI energy, translated into road.</p>
      <div class="topbar__actions">
        <button class="text-button" id="replay-cinematic" type="button"><span id="replay-label">Replay</span> <kbd>R</kbd></button>
        <button class="text-button" id="methodology-open" type="button">Methodology</button>
      </div>
    </header>

    <aside class="hud" aria-label="PromptMiles controls and results">
      <div class="hud__eyebrow">
        <span class="status-dot"></span>
        <span id="dataset-status">Loading synthetic demo</span>
      </div>
      <div class="hud__lead">
        <p>On this estimated energy, a 2024 Model 3 could travel</p>
        <strong id="ai-distance">—</strong>
        <span id="energy-readout">—</span>
      </div>

      <button class="ratio-card is-active" data-comparison="total" type="button" aria-pressed="true">
        <span class="ratio-card__swatch"></span>
        <div>
          <span id="comparison-name">Lifestyle total · same window</span>
          <strong id="life-distance">—</strong>
          <small id="comparison-carbon">—</small>
        </div>
        <p id="ratio-readout">—</p>
      </button>

      <div class="impact-grid" aria-label="Choose a lifestyle path to compare">
        <button class="impact-card impact-card--diet" data-comparison="diet" type="button" aria-pressed="false">
          <span>Diet</span><strong id="diet-distance">—</strong><small id="diet-carbon">—</small>
        </button>
        <button class="impact-card impact-card--driving" data-comparison="driving" type="button" aria-pressed="false">
          <span>Driving</span><strong id="driving-distance">—</strong><small id="driving-carbon">—</small>
        </button>
        <button class="impact-card impact-card--flights" data-comparison="flights" type="button" aria-pressed="false">
          <span>Flights</span><strong id="flights-distance">—</strong><small id="flights-carbon">—</small>
        </button>
        <button class="impact-card impact-card--home" data-comparison="home" type="button" aria-pressed="false">
          <span>Home energy</span><strong id="home-distance">—</strong><small id="home-carbon">—</small>
        </button>
      </div>
      <p class="impact-help">Select any card to put that path next to AI.</p>

      <section class="profile-section" aria-labelledby="profile-heading">
        <div class="section-heading">
          <div><span id="profile-heading">Your lifestyle</span><small id="window-summary">Matched to the CSV</small></div>
          <button class="text-button text-button--muted" id="reset-profile" type="button">Reset</button>
        </div>

        <div class="controls-grid">
          <label>
            <span>Diet</span>
            <select id="diet-select">
              ${Object.entries(DIETS).map(([id, diet]) => `<option value="${id}">${diet.label}</option>`).join('')}
            </select>
          </label>
          <label>
            <span>Home energy</span>
            <select id="home-select">
              ${Object.entries(HOME_ENERGY).map(([id, home]) => `<option value="${id}">${home.label}</option>`).join('')}
            </select>
          </label>
        </div>

        <label class="range-control range-control--driving">
          <span>
            <span>Weekly gasoline driving</span>
            <span class="number-with-unit"><input id="driving-number" type="number" min="0" max="600" step="5" inputmode="numeric" aria-label="Weekly driving miles" /><em>mi</em></span>
          </span>
          <input id="driving-range" type="range" min="0" max="600" step="5" value="230" />
        </label>

        <fieldset class="flight-control">
          <legend>Round-trip flights per year</legend>
          <div>
            ${Object.entries(FLIGHT_KG_CO2E).map(([id, flight]) => `
              <label><span>${flight.label}</span><small>${flight.kgCo2ePerRoundTrip.toLocaleString('en-US')} kg</small><input id="flight-${id}" type="number" min="0" max="20" step="1" value="0" inputmode="numeric" /></label>
            `).join('')}
          </div>
        </fieldset>

        <div class="controls-grid controls-grid--secondary">
          <label>
            <span>Grid region</span>
            <select id="region-select">
              ${Object.entries(REGIONS).map(([id, region]) => `<option value="${id}">${region.label}</option>`).join('')}
            </select>
          </label>
          <label>
            <span>Comparison window</span>
            <select id="window-select">
              ${Object.entries(COMPARISON_WINDOWS).map(([id, window]) => `<option value="${id}">${window.label}</option>`).join('')}
            </select>
          </label>
        </div>

        <label class="text-control">
          <span>Start city</span>
          <input id="start-city" type="text" maxlength="80" placeholder="Austin, TX" />
        </label>

        <label class="range-control">
          <span><span>Model 3 efficiency</span><output id="efficiency-value">4.0 mi/kWh</output></span>
          <input id="efficiency-range" type="range" min="3" max="4.6" step="0.1" value="4" />
        </label>
      </section>

      <label class="scenario-control">
        <span>Development scenario</span>
        <select id="scenario-select">
          ${Object.values(SYNTHETIC_SCENARIOS).map((scenario) => `<option value="${scenario.id}">${scenario.label}</option>`).join('')}
        </select>
        <small id="scenario-description">${SYNTHETIC_SCENARIOS.typical.description}</small>
      </label>

      <div class="dataset-card">
        <div>
          <span id="source-name">Synthetic demo</span>
          <span id="source-meta">—</span>
        </div>
        <button class="secondary-button" id="replace-csv" type="button">Replace CSV</button>
      </div>
      <input id="csv-input" type="file" accept=".csv,text/csv" hidden />

      <div class="hud__actions">
        <button class="primary-button" id="load-synthetic" type="button">Load scenario</button>
        <button class="text-button text-button--muted" id="download-synthetic" type="button">Download its CSV</button>
      </div>

      <details class="breakdown" id="breakdown">
        <summary>Calculation breakdown</summary>
        <div class="breakdown__body">
          <p class="breakdown__formula" id="breakdown-formula">—</p>
          <p class="breakdown__note" id="input-token-note">—</p>
          <div class="breakdown__models" id="breakdown-models"></div>
          <p class="fallback-warning" id="fallback-warning" hidden></p>
        </div>
      </details>

      <p class="honesty-note">
        <span>Estimate</span> Wide uncertainty applies. Raw CSV rows stay in this browser and are discarded after aggregation.
      </p>
      <p class="error-message" id="error-message" role="alert" hidden></p>
    </aside>
  </main>

  <dialog class="methodology" id="methodology-dialog">
    <form method="dialog">
      <button class="dialog-close" value="close" aria-label="Close methodology">×</button>
      <p class="dialog-eyebrow">Methodology · M2</p>
      <h2>Estimates, not measurements.</h2>
      <p>
        PromptMiles interpolates output-token scenarios from Andy Masley’s EcoLogits v0.10 snapshot,
        retaining each model’s central estimate and 95% range. Every lifestyle component is converted
        from CO₂e to grid-equivalent energy, then into the same Model 3 miles as AI.
      </p>
      <dl>
        <div><dt>AI energy</dt><dd>Average output tokens per request → ${MASLEY_SOURCE.modelCount} model curves → requests → Wh range.</dd></div>
        <div><dt>Diet</dt><dd>1.05–3.2 t CO₂e/year across vegan through heavy-meat profiles.</dd></div>
        <div><dt>Driving</dt><dd>Weekly miles × 0.40 kg CO₂e per gasoline vehicle-mile.</dd></div>
        <div><dt>Flights</dt><dd>250 / 1,000 / 1,600 kg CO₂e per short / medium / long round trip.</dd></div>
        <div><dt>Home</dt><dd>1.5 / 3.5 / 7 t CO₂e/year for a small apartment through a large house.</dd></div>
        <div><dt>Window</dt><dd>AI and lifestyle values are both normalized to the CSV span, 7 days, or 30 days.</dd></div>
        <div><dt>Conversion</dt><dd>kg CO₂e → selected grid-equivalent kWh → selected Model 3 mi/kWh.</dd></div>
        <div><dt>3D asset</dt><dd>${CAR_ASSET_SOURCE.label}; rescaled and material-tuned for PromptMiles under CC BY 4.0.</dd></div>
        <div><dt>Map staging</dt><dd>Natural Earth 1:110m world boundaries and US Census state boundaries, projected locally for offline display. This checkpoint is anchored to the default Austin origin; arbitrary-city geocoding follows. Range rings are distance-scaled; eastbound routes are illustrative.</dd></div>
        <div><dt>Excluded</dt><dd>Water, regional goods/services baseline, training, image generation, and retries.</dd></div>
      </dl>
      <div class="methodology__links">
        <a href="${MASLEY_SOURCE.url}" target="_blank" rel="noreferrer">Masley factor source</a>
        <a href="https://ecologits.ai/latest/methodology/llm_inference/" target="_blank" rel="noreferrer">EcoLogits methodology</a>
        <a href="${CAR_ASSET_SOURCE.url}" target="_blank" rel="noreferrer">Model 3 asset</a>
        <a href="${CAR_ASSET_SOURCE.licenseUrl}" target="_blank" rel="noreferrer">CC BY 4.0 license</a>
        <a href="${MAP_SOURCES.world}" target="_blank" rel="noreferrer">Natural Earth world map</a>
        <a href="${MAP_SOURCES.us}" target="_blank" rel="noreferrer">US Census map</a>
      </div>
      <p class="dialog-source">${MASLEY_SOURCE.version} · Updated ${MASLEY_SOURCE.updated}</p>
    </form>
  </dialog>

  <dialog class="mapping-dialog" id="mapping-dialog">
    <form id="mapping-form">
      <button class="dialog-close" id="mapping-close" type="button" aria-label="Cancel CSV mapping">×</button>
      <p class="dialog-eyebrow">CSV column mapping</p>
      <h2>Tell us which columns to use.</h2>
      <p>PromptMiles did not recognize this export automatically. Nothing leaves your browser.</p>
      <div class="mapping-grid">
        <label><span>Date or timestamp</span><select id="map-timestamp" required></select></label>
        <label><span>Model</span><select id="map-model" required></select></label>
        <label><span>Input tokens <em>optional</em></span><select id="map-input"></select></label>
        <label><span>Output tokens</span><select id="map-output"></select></label>
        <label><span>Requests <em>optional</em></span><select id="map-requests"></select></label>
      </div>
      <p class="mapping-error" id="mapping-error" hidden></p>
      <div class="mapping-actions">
        <button class="text-button" id="mapping-cancel" type="button">Cancel</button>
        <button class="primary-button" type="submit">Import locally</button>
      </div>
    </form>
  </dialog>
`;

function byId<T extends HTMLElement>(id: string): T {
  const element = document.getElementById(id);
  if (!element) throw new Error(`Missing required element #${id}`);
  return element as T;
}

function formatCarbon(kgCo2e: number): string {
  if (kgCo2e >= 1_000) return `${(kgCo2e / 1_000).toFixed(2)} t CO₂e`;
  if (kgCo2e >= 100) return `${Math.round(kgCo2e).toLocaleString('en-US')} kg CO₂e`;
  if (kgCo2e >= 10) return `${kgCo2e.toFixed(1)} kg CO₂e`;
  return `${kgCo2e.toFixed(2)} kg CO₂e`;
}

function clampNumber(value: number, minimum: number, maximum: number): number {
  if (!Number.isFinite(value)) return minimum;
  return Math.min(maximum, Math.max(minimum, value));
}

const IMPACT_COLORS: Record<LifestyleMetricId, number> = {
  total: 0xffa856,
  diet: 0xffa856,
  driving: 0xff6f61,
  flights: 0xb894ff,
  home: 0xffcf5b,
};

const { PromptMilesScene } = await import('./scene/PromptMilesScene');
const appShell = document.querySelector<HTMLElement>('.app-shell');
if (!appShell) throw new Error('PromptMiles could not find its application shell.');
const sceneCanvas = byId('scene-canvas');
const scene = new PromptMilesScene(sceneCanvas);
const replayButton = byId<HTMLButtonElement>('replay-cinematic');
const csvInput = byId<HTMLInputElement>('csv-input');
const dietSelect = byId<HTMLSelectElement>('diet-select');
const homeSelect = byId<HTMLSelectElement>('home-select');
const regionSelect = byId<HTMLSelectElement>('region-select');
const windowSelect = byId<HTMLSelectElement>('window-select');
const drivingRange = byId<HTMLInputElement>('driving-range');
const drivingNumber = byId<HTMLInputElement>('driving-number');
const startCityInput = byId<HTMLInputElement>('start-city');
const efficiencyRange = byId<HTMLInputElement>('efficiency-range');
const scenarioSelect = byId<HTMLSelectElement>('scenario-select');
const methodology = byId<HTMLDialogElement>('methodology-dialog');
const mappingDialog = byId<HTMLDialogElement>('mapping-dialog');
const mappingForm = byId<HTMLFormElement>('mapping-form');
const flightInputs: Record<FlightLengthId, HTMLInputElement> = {
  short: byId('flight-short'),
  medium: byId('flight-medium'),
  long: byId('flight-long'),
};
let pendingFile: File | null = null;
let activeComparison: LifestyleMetricId = 'total';

function selectedScenario() {
  return SYNTHETIC_SCENARIOS[scenarioSelect.value as SyntheticScenarioId] ?? SYNTHETIC_SCENARIOS.typical;
}

function loadSynthetic(id: SyntheticScenarioId = scenarioSelect.value as SyntheticScenarioId): void {
  const scenario = SYNTHETIC_SCENARIOS[id] ?? SYNTHETIC_SCENARIOS.typical;
  try {
    const aggregate = parseUsageCsvText(scenario.csv, {
      sourceName: scenario.filename,
      synthetic: true,
    });
    store.setState({
      aggregate,
      result: calculateComparison(aggregate, store.getState().profile),
      status: 'ready',
      error: null,
    });
  } catch (error) {
    store.setState({
      status: 'error',
      error: error instanceof Error ? error.message : 'Could not load the synthetic demo.',
    });
  }
}

function populateMapping(headers: string[]): void {
  const selectIds = ['map-timestamp', 'map-model', 'map-input', 'map-output', 'map-requests'];
  selectIds.forEach((id) => {
    const select = byId<HTMLSelectElement>(id);
    select.replaceChildren(new Option('Choose a column…', ''));
    headers.forEach((header) => select.add(new Option(header, header)));
  });
  byId('mapping-error').hidden = true;
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
      if (!mappingDialog.open) mappingDialog.showModal();
      return;
    }
    store.setState({
      status: 'error',
      error: error instanceof Error ? error.message : 'Could not parse that CSV.',
    });
  } finally {
    csvInput.value = '';
  }
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
      [length]: clampNumber(Math.round(count), 0, 20),
    },
  });
}

function impactFor(state: AppState, id: LifestyleMetricId): LifestyleImpact | null {
  if (!state.result) return null;
  return id === 'total' ? state.result.lifestyle.total : state.result.lifestyle.components[id];
}

function renderSelectedComparison(state: AppState): void {
  const impact = impactFor(state, activeComparison);
  if (!impact || !state.result) return;
  const distance = formatDistance(impact.miles);
  byId('comparison-name').textContent = `${impact.label} · same window`;
  byId('comparison-carbon').textContent = formatCarbon(impact.kgCo2e);
  byId('life-distance').textContent = distance;
  byId('scene-life-label').textContent = impact.label;
  byId('scene-life-distance').textContent = distance;
  byId<HTMLElement>('scene-life-label-card').style.setProperty('--path-color', `#${IMPACT_COLORS[activeComparison].toString(16).padStart(6, '0')}`);
  const ratio = state.result.aiMiles.central > 0
    ? impact.miles / state.result.aiMiles.central
    : Number.POSITIVE_INFINITY;
  byId('ratio-readout').textContent = Number.isFinite(ratio)
    ? `${Math.round(ratio).toLocaleString('en-US')}× AI`
    : 'Comparison unavailable';

  document.querySelectorAll<HTMLButtonElement>('[data-comparison]').forEach((button) => {
    const selected = button.dataset.comparison === activeComparison;
    button.classList.toggle('is-active', selected);
    button.setAttribute('aria-pressed', String(selected));
  });
  scene.setDistances(state.result.aiMiles.central, impact.miles, IMPACT_COLORS[activeComparison]);
  byId('scene-stage').textContent = scene.distanceStageLabel;
  byId('scene-stage-note').textContent = scene.distanceStageNote;
}

function renderImpactCards(state: AppState): void {
  if (!state.result) return;
  for (const [id, impact] of Object.entries(state.result.lifestyle.components)) {
    byId(`${id}-distance`).textContent = formatDistance(impact.miles);
    byId(`${id}-carbon`).textContent = formatCarbon(impact.kgCo2e);
  }
}

function renderModelBreakdown(state: AppState): void {
  const container = byId('breakdown-models');
  container.replaceChildren();
  if (!state.aggregate || !state.result) return;

  for (const model of state.result.modelBreakdown) {
    const row = document.createElement('div');
    row.className = 'breakdown-row';
    const identity = document.createElement('div');
    const name = document.createElement('strong');
    name.textContent = model.model;
    const detail = document.createElement('span');
    detail.textContent = `${model.requests.toLocaleString('en-US', { maximumFractionDigits: 1 })} requests · ${Math.round(model.averageOutputTokens).toLocaleString('en-US')} avg output tokens`;
    identity.append(name, detail);
    const value = document.createElement('span');
    value.className = 'breakdown-row__value';
    value.textContent = formatEnergy(model.energyWh.central);
    if (model.fallback) {
      const badge = document.createElement('em');
      badge.textContent = `uses ${model.factorModel}`;
      identity.append(badge);
    }
    row.append(identity, value);
    container.append(row);
  }
}

store.subscribe((state) => {
  const { aggregate, result } = state;
  const errorMessage = byId<HTMLParagraphElement>('error-message');
  errorMessage.hidden = !state.error;
  errorMessage.textContent = state.error ?? '';
  byId('dataset-status').textContent = state.status === 'parsing'
    ? 'Parsing locally…'
    : state.status === 'mapping'
      ? 'Waiting for column mapping'
      : aggregate?.synthetic
        ? 'Synthetic demonstration'
        : aggregate
          ? 'Personal CSV · local only'
          : 'Waiting for usage data';

  dietSelect.value = state.profile.diet;
  homeSelect.value = state.profile.homeEnergy;
  regionSelect.value = state.profile.region;
  windowSelect.value = state.profile.comparisonWindow;
  drivingRange.value = String(state.profile.weeklyDrivingMiles);
  drivingNumber.value = String(state.profile.weeklyDrivingMiles);
  startCityInput.value = state.profile.startCity;
  byId('scene-origin').textContent = state.profile.startCity || 'Unspecified';
  efficiencyRange.value = String(state.profile.model3Efficiency);
  byId<HTMLOutputElement>('efficiency-value').value = `${state.profile.model3Efficiency.toFixed(1)} mi/kWh`;
  for (const [length, input] of Object.entries(flightInputs)) {
    input.value = String(state.profile.flightsPerYear[length as FlightLengthId]);
  }

  try {
    saveSnapshot(window.localStorage, state.profile, state.aggregate);
  } catch {
    // Persistence is optional; the active session remains fully functional.
  }

  if (!aggregate || !result) return;
  const aiDistance = formatDistance(result.aiMiles.central);
  const scaledOutputTokens = aggregate.outputTokens * result.windowScale;
  const scaledInputTokens = aggregate.inputTokens * result.windowScale;
  byId('ai-distance').textContent = aiDistance;
  byId('scene-ai-distance').textContent = aiDistance;
  byId('energy-readout').textContent = `${formatEnergy(result.energyWh.central)} · ${formatDistance(result.aiMiles.low)}–${formatDistance(result.aiMiles.high)} · ${result.comparisonDays} days`;
  byId('window-summary').textContent = state.profile.comparisonWindow === 'csv'
    ? `Matched to ${result.sourceDays}-day CSV`
    : `${result.comparisonDays}-day normalized view`;
  byId('source-name').textContent = aggregate.sourceName;
  byId('source-meta').textContent = `${aggregate.rowCount} rows · ${aggregate.requests.toLocaleString('en-US')} requests · ${result.sourceDays}-day source`;
  byId('breakdown-formula').textContent = `${Math.round(scaledOutputTokens).toLocaleString('en-US')} output tokens → ${formatEnergy(result.energyWh.central)} → ${aiDistance} at ${state.profile.model3Efficiency.toFixed(1)} mi/kWh.`;
  const normalizationNote = result.windowScale === 1
    ? ''
    : ` Source usage was normalized by ${result.windowScale.toFixed(3)}×.`;
  byId('input-token-note').textContent = `${Math.round(scaledInputTokens).toLocaleString('en-US')} input tokens are shown but not modeled by EcoLogits.${normalizationNote}`;
  const fallbackWarning = byId<HTMLParagraphElement>('fallback-warning');
  fallbackWarning.hidden = result.unknownModels.length === 0;
  fallbackWarning.textContent = result.unknownModels.length
    ? `Fallback estimate used for: ${result.unknownModels.join(', ')}.`
    : '';
  renderImpactCards(state);
  renderModelBreakdown(state);
  renderSelectedComparison(state);
});

document.querySelectorAll<HTMLButtonElement>('[data-comparison]').forEach((button) => {
  button.addEventListener('click', () => {
    activeComparison = button.dataset.comparison as LifestyleMetricId;
    renderSelectedComparison(store.getState());
  });
});
dietSelect.addEventListener('change', () => updateProfile({ diet: dietSelect.value as DietId }));
homeSelect.addEventListener('change', () => updateProfile({ homeEnergy: homeSelect.value as HomeEnergyId }));
regionSelect.addEventListener('change', () => updateProfile({ region: regionSelect.value as RegionId }));
windowSelect.addEventListener('change', () => updateProfile({ comparisonWindow: windowSelect.value as ComparisonWindowId }));
drivingRange.addEventListener('input', () => updateProfile({ weeklyDrivingMiles: Number(drivingRange.value) }));
drivingNumber.addEventListener('input', () => updateProfile({
  weeklyDrivingMiles: clampNumber(Number(drivingNumber.value), 0, 600),
}));
for (const [length, input] of Object.entries(flightInputs)) {
  input.addEventListener('input', () => updateFlight(length as FlightLengthId, Number(input.value)));
}
startCityInput.addEventListener('input', () => updateProfile({ startCity: startCityInput.value.trim() }));
efficiencyRange.addEventListener('input', () => updateProfile({ model3Efficiency: Number(efficiencyRange.value) }));
byId('reset-profile').addEventListener('click', () => updateProfile({
  ...DEFAULT_PROFILE,
  flightsPerYear: { ...DEFAULT_PROFILE.flightsPerYear },
}));
scenarioSelect.addEventListener('change', () => {
  byId('scenario-description').textContent = selectedScenario().description;
});
byId('replace-csv').addEventListener('click', () => csvInput.click());
csvInput.addEventListener('change', () => {
  const file = csvInput.files?.[0];
  if (file) void loadFile(file);
});
byId('load-synthetic').addEventListener('click', () => loadSynthetic());
byId('download-synthetic').addEventListener('click', () => {
  const scenario = selectedScenario();
  const url = URL.createObjectURL(new Blob([scenario.csv], { type: 'text/csv' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = scenario.filename;
  link.click();
  URL.revokeObjectURL(url);
});
replayButton.addEventListener('click', () => scene.replay());
sceneCanvas.addEventListener('promptmiles:cinematicstart', () => {
  appShell.classList.add('is-cinematic');
  appShell.classList.remove('is-cinematic-revealing');
  replayButton.disabled = true;
  byId('replay-label').textContent = 'Replaying';
});
sceneCanvas.addEventListener('promptmiles:cinematicreveal', () => {
  appShell.classList.add('is-cinematic-revealing');
});
sceneCanvas.addEventListener('promptmiles:cinematicend', () => {
  appShell.classList.remove('is-cinematic', 'is-cinematic-revealing');
  replayButton.disabled = false;
  byId('replay-label').textContent = 'Replay';
});
byId('methodology-open').addEventListener('click', () => methodology.showModal());

window.addEventListener('keydown', (event) => {
  const target = event.target;
  const isEditing = target instanceof HTMLElement
    && target.matches('input, select, textarea, [contenteditable="true"]');
  if (isEditing || event.metaKey || event.ctrlKey || event.altKey) return;

  switch (event.key.toLowerCase()) {
    case 'h':
      appShell.classList.toggle('hud-hidden');
      break;
    case 'r':
      scene.replay();
      break;
    case 'f': {
      const fullscreen = document.fullscreenElement
        ? document.exitFullscreen()
        : appShell.requestFullscreen();
      void fullscreen.catch(() => undefined);
      break;
    }
    default:
      return;
  }
  event.preventDefault();
});

function closeMapping(): void {
  pendingFile = null;
  mappingDialog.close();
  store.setState({ status: store.getState().aggregate ? 'ready' : 'error' });
}

byId('mapping-close').addEventListener('click', closeMapping);
byId('mapping-cancel').addEventListener('click', closeMapping);
mappingDialog.addEventListener('cancel', (event) => {
  event.preventDefault();
  closeMapping();
});
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

window.addEventListener('beforeunload', () => scene.dispose());
if (!initialAggregate) loadSynthetic('typical');
