import './styles.css';
import { calculateComparison, formatDistance, formatEnergy } from './calc/engine';
import { DIETS, MASLEY_SOURCE, REGIONS } from './factors/masley';
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
import type { AppState, DietId, LifestyleProfile, RegionId } from './types';

const app = document.querySelector<HTMLDivElement>('#app');
if (!app) throw new Error('PromptMiles could not find its app root.');

const defaultProfile: LifestyleProfile = {
  diet: 'avg',
  region: 'us',
  model3Efficiency: 4,
};

const restored = loadSnapshot(window.localStorage);
const initialProfile = restored?.profile ?? defaultProfile;
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
      <div class="scene-label scene-label--ai">
        <span class="scene-label__dot"></span>
        <span>AI path</span>
        <strong id="scene-ai-distance">—</strong>
      </div>
      <div class="scene-label scene-label--life">
        <span class="scene-label__dot"></span>
        <span>Diet path</span>
        <strong id="scene-life-distance">—</strong>
      </div>
      <p class="scene-hint">Drag to orbit · scroll to zoom</p>
    </section>

    <header class="topbar">
      <a class="brand" href="/" aria-label="PromptMiles home">
        <span class="brand__mark" aria-hidden="true"></span>
        <span>PromptMiles</span>
      </a>
      <p class="topbar__dek">AI energy, translated into road.</p>
      <button class="text-button" id="methodology-open" type="button">Methodology</button>
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

      <div class="ratio-card">
        <div>
          <span>Same-window diet equivalent</span>
          <strong id="life-distance">—</strong>
        </div>
        <p id="ratio-readout">—</p>
      </div>

      <div class="controls-grid">
        <label>
          <span>Diet</span>
          <select id="diet-select">
            ${Object.entries(DIETS).map(([id, diet]) => `<option value="${id}">${diet.label}</option>`).join('')}
          </select>
        </label>
        <label>
          <span>Grid region</span>
          <select id="region-select">
            ${Object.entries(REGIONS).map(([id, region]) => `<option value="${id}">${region.label}</option>`).join('')}
          </select>
        </label>
      </div>

      <label class="range-control">
        <span><span>Model 3 efficiency</span><output id="efficiency-value">4.0 mi/kWh</output></span>
        <input id="efficiency-range" type="range" min="3" max="4.6" step="0.1" value="4" />
      </label>

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
      <p class="dialog-eyebrow">Methodology · M1</p>
      <h2>Estimates, not measurements.</h2>
      <p>
        PromptMiles interpolates output-token scenarios from Andy Masley’s EcoLogits v0.10 snapshot,
        retaining each model’s central estimate and 95% range. EcoLogits models decoding from output
        tokens; imported input tokens are shown for transparency but are not included in the estimate.
      </p>
      <dl>
        <div><dt>Factors</dt><dd>${MASLEY_SOURCE.modelCount} model curves, versioned to ${MASLEY_SOURCE.updated}.</dd></div>
        <div><dt>AI energy</dt><dd>Average output tokens per request → model curve → requests → Wh range.</dd></div>
        <div><dt>EV conversion</dt><dd>Estimated watt-hours ÷ 1,000 × selected Model 3 mi/kWh.</dd></div>
        <div><dt>Lifestyle</dt><dd>Diet kg CO₂e → grid-equivalent kWh → the same Model 3 miles.</dd></div>
        <div><dt>Excluded</dt><dd>Input-token processing, training, image generation, and retries.</dd></div>
      </dl>
      <div class="methodology__links">
        <a href="${MASLEY_SOURCE.url}" target="_blank" rel="noreferrer">Masley factor source</a>
        <a href="https://ecologits.ai/latest/methodology/llm_inference/" target="_blank" rel="noreferrer">EcoLogits methodology</a>
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

const { PromptMilesScene } = await import('./scene/PromptMilesScene');
const scene = new PromptMilesScene(byId('scene-canvas'));
const csvInput = byId<HTMLInputElement>('csv-input');
const dietSelect = byId<HTMLSelectElement>('diet-select');
const regionSelect = byId<HTMLSelectElement>('region-select');
const efficiencyRange = byId<HTMLInputElement>('efficiency-range');
const scenarioSelect = byId<HTMLSelectElement>('scenario-select');
const methodology = byId<HTMLDialogElement>('methodology-dialog');
const mappingDialog = byId<HTMLDialogElement>('mapping-dialog');
const mappingForm = byId<HTMLFormElement>('mapping-form');
let pendingFile: File | null = null;

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
    detail.textContent = `${model.requests.toLocaleString('en-US')} requests · ${Math.round(model.averageOutputTokens).toLocaleString('en-US')} avg output tokens`;
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
  regionSelect.value = state.profile.region;
  efficiencyRange.value = String(state.profile.model3Efficiency);
  byId<HTMLOutputElement>('efficiency-value').value = `${state.profile.model3Efficiency.toFixed(1)} mi/kWh`;

  try {
    saveSnapshot(window.localStorage, state.profile, state.aggregate);
  } catch {
    // Persistence is optional; the active session remains fully functional.
  }

  if (!aggregate || !result) return;
  const aiDistance = formatDistance(result.aiMiles.central);
  const lifestyleDistance = formatDistance(result.lifestyleMiles);
  byId('ai-distance').textContent = aiDistance;
  byId('life-distance').textContent = lifestyleDistance;
  byId('scene-ai-distance').textContent = aiDistance;
  byId('scene-life-distance').textContent = lifestyleDistance;
  byId('energy-readout').textContent = `${formatEnergy(result.energyWh.central)} · ${formatDistance(result.aiMiles.low)}–${formatDistance(result.aiMiles.high)}`;
  byId('ratio-readout').textContent = Number.isFinite(result.ratio)
    ? `${Math.round(result.ratio).toLocaleString('en-US')}× farther`
    : 'Comparison unavailable';
  byId('source-name').textContent = aggregate.sourceName;
  byId('source-meta').textContent = `${aggregate.rowCount} rows · ${aggregate.requests.toLocaleString('en-US')} requests · ${result.comparisonDays} days`;
  byId('breakdown-formula').textContent = `${aggregate.outputTokens.toLocaleString('en-US')} output tokens → ${formatEnergy(result.energyWh.central)} → ${aiDistance} at ${state.profile.model3Efficiency.toFixed(1)} mi/kWh.`;
  byId('input-token-note').textContent = `${aggregate.inputTokens.toLocaleString('en-US')} input tokens were observed but are not modeled by EcoLogits.`;
  const fallbackWarning = byId<HTMLParagraphElement>('fallback-warning');
  fallbackWarning.hidden = result.unknownModels.length === 0;
  fallbackWarning.textContent = result.unknownModels.length
    ? `Fallback estimate used for: ${result.unknownModels.join(', ')}.`
    : '';
  renderModelBreakdown(state);
  scene.setDistances(result.aiMiles.central, result.lifestyleMiles);
});

dietSelect.addEventListener('change', () => updateProfile({ diet: dietSelect.value as DietId }));
regionSelect.addEventListener('change', () => updateProfile({ region: regionSelect.value as RegionId }));
efficiencyRange.addEventListener('input', () => updateProfile({ model3Efficiency: Number(efficiencyRange.value) }));
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
byId('methodology-open').addEventListener('click', () => methodology.showModal());

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
