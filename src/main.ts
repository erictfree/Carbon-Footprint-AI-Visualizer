import './styles.css';
import { calculateComparison, formatDistance, formatEnergy } from './calc/engine';
import { DIETS, MASLEY_SOURCE, REGIONS } from './factors/masley';
import { SYNTHETIC_USAGE_CSV } from './fixtures/synthetic';
import { parseUsageCsvText, parseUsageFile } from './ingest/parseUsageCsv';
import { createStore } from './state/store';
import type { AppState, DietId, LifestyleProfile, RegionId } from './types';

const app = document.querySelector<HTMLDivElement>('#app');
if (!app) throw new Error('PromptMiles could not find its app root.');

const initialProfile: LifestyleProfile = {
  diet: 'avg',
  region: 'us',
  model3Efficiency: 4,
};

const store = createStore<AppState>({
  aggregate: null,
  profile: initialProfile,
  result: null,
  status: 'booting',
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

      <div class="dataset-card">
        <div>
          <span id="source-name">Synthetic demo</span>
          <span id="source-meta">—</span>
        </div>
        <button class="secondary-button" id="replace-csv" type="button">Replace CSV</button>
      </div>
      <input id="csv-input" type="file" accept=".csv,text/csv" hidden />

      <div class="hud__actions">
        <button class="primary-button" id="load-synthetic" type="button">Replay synthetic demo</button>
        <button class="text-button text-button--muted" id="download-synthetic" type="button">Download sample CSV</button>
      </div>

      <p class="honesty-note">
        <span>Estimate</span> Wide uncertainty applies. Raw CSV rows stay in this browser and are discarded after aggregation.
      </p>
      <p class="error-message" id="error-message" role="alert" hidden></p>
    </aside>
  </main>

  <dialog class="methodology" id="methodology-dialog">
    <form method="dialog">
      <button class="dialog-close" value="close" aria-label="Close methodology">×</button>
      <p class="dialog-eyebrow">Methodology · provisional M0</p>
      <h2>Estimates, not measurements.</h2>
      <p>
        PromptMiles interpolates output-token scenarios from Andy Masley’s EcoLogits v0.10 snapshot,
        including its low and high estimates. Input-token energy is not yet represented, so this first
        implementation is a visual and architectural baseline—not a final footprint claim.
      </p>
      <dl>
        <div><dt>AI energy</dt><dd>Per-model output scenarios, aggregated by request.</dd></div>
        <div><dt>EV conversion</dt><dd>Estimated watt-hours ÷ 1,000 × selected Model 3 mi/kWh.</dd></div>
        <div><dt>Lifestyle</dt><dd>Diet kg CO₂e → grid-equivalent kWh → the same Model 3 miles.</dd></div>
        <div><dt>Training</dt><dd>Excluded.</dd></div>
      </dl>
      <a href="${MASLEY_SOURCE.url}" target="_blank" rel="noreferrer">View the factor source</a>
      <p class="dialog-source">${MASLEY_SOURCE.version} · Updated ${MASLEY_SOURCE.updated}</p>
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
const methodology = byId<HTMLDialogElement>('methodology-dialog');

function loadSynthetic(): void {
  try {
    const aggregate = parseUsageCsvText(SYNTHETIC_USAGE_CSV, {
      sourceName: 'promptmiles-synthetic-july-2026.csv',
      synthetic: true,
    });
    store.setState({ aggregate, result: calculateComparison(aggregate, store.getState().profile), status: 'ready', error: null });
  } catch (error) {
    store.setState({ status: 'error', error: error instanceof Error ? error.message : 'Could not load the synthetic demo.' });
  }
}

async function loadFile(file: File): Promise<void> {
  store.setState({ status: 'parsing', error: null });
  try {
    const aggregate = await parseUsageFile(file);
    store.setState({ aggregate, result: calculateComparison(aggregate, store.getState().profile), status: 'ready' });
  } catch (error) {
    store.setState({ status: 'error', error: error instanceof Error ? error.message : 'Could not parse that CSV.' });
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

store.subscribe((state) => {
  const { aggregate, result } = state;
  const errorMessage = byId<HTMLParagraphElement>('error-message');
  errorMessage.hidden = !state.error;
  errorMessage.textContent = state.error ?? '';
  byId('dataset-status').textContent = state.status === 'parsing'
    ? 'Parsing locally…'
    : aggregate?.synthetic
      ? 'Synthetic demonstration'
      : aggregate
        ? 'Personal CSV · local only'
        : 'Waiting for usage data';

  dietSelect.value = state.profile.diet;
  regionSelect.value = state.profile.region;
  efficiencyRange.value = String(state.profile.model3Efficiency);
  byId<HTMLOutputElement>('efficiency-value').value = `${state.profile.model3Efficiency.toFixed(1)} mi/kWh`;

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
  scene.setDistances(result.aiMiles.central, result.lifestyleMiles);
});

dietSelect.addEventListener('change', () => updateProfile({ diet: dietSelect.value as DietId }));
regionSelect.addEventListener('change', () => updateProfile({ region: regionSelect.value as RegionId }));
efficiencyRange.addEventListener('input', () => updateProfile({ model3Efficiency: Number(efficiencyRange.value) }));
byId('replace-csv').addEventListener('click', () => csvInput.click());
csvInput.addEventListener('change', () => {
  const file = csvInput.files?.[0];
  if (file) void loadFile(file);
});
byId('load-synthetic').addEventListener('click', loadSynthetic);
byId('download-synthetic').addEventListener('click', () => {
  const url = URL.createObjectURL(new Blob([SYNTHETIC_USAGE_CSV], { type: 'text/csv' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = 'promptmiles-synthetic-usage.csv';
  link.click();
  URL.revokeObjectURL(url);
});
byId('methodology-open').addEventListener('click', () => methodology.showModal());

window.addEventListener('beforeunload', () => scene.dispose());
loadSynthetic();
