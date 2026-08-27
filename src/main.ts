import './styles.css';
import { calculateComparison, formatEnergy } from './calc/engine';
import {
  DEFAULT_PROFILE,
  DIETS,
  FLIGHT_KG_CO2E,
  HOME_ENERGY,
  MASLEY_SOURCE,
  MODEL_CURVES,
  REGIONS,
} from './factors/masley';
import {
  createGameUsageAggregate,
  DEFAULT_GAME_SETUP,
  estimatePromptInputTokens,
} from './game/setup';
import {
  columnOffsetForIndex,
  laneMotionTiming,
  packedColumnSpreadScale,
  packedRailCenterOffset,
  projectBeltPose,
  ROUND_PLAYBACK_DURATION_MS,
  type BeltSide,
} from './scene/conveyorPhysics';
import { createStore } from './state/store';
import type {
  AppState,
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
const MAX_BURGERS_ON_LANE = 10;
const MAX_VISIBLE_BURGERS_PER_LANE = 3_000;
const SETUP_RETURN_DELAY_MS = 1_800;

const initialProfile: LifestyleProfile = {
  ...DEFAULT_PROFILE,
  flightsPerYear: { ...DEFAULT_PROFILE.flightsPerYear },
  comparisonWindow: 'month',
};
const initialAggregate = createGameUsageAggregate(DEFAULT_GAME_SETUP);

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
        <button class="data-button" id="data-open" type="button"><span class="data-button__long">New round</span><span class="data-button__short">Play</span></button>
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
        <img class="factory-stage__art" src="${ASSET_BASE}/background.jpg" alt="Twin industrial conveyor belts running through a bright burger game-show factory" />
        <div class="factory-stage__shade"></div>
        <div class="belt-readout belt-readout--left">
          <strong id="left-belt-carbon">—</strong>
        </div>
        <div class="belt-readout belt-readout--right">
          <strong id="right-belt-carbon">—</strong>
        </div>
        <div class="flow-layer" id="flow-layer" aria-hidden="true"></div>
      </figure>

      <section class="output-strip" aria-label="Production totals and visual explanation">
        <article class="output-card output-card--left"><span>Window output</span><strong id="left-unit-count">—</strong><small id="left-unit-name">burger equivalent</small></article>
        <div class="output-story"><strong id="stage-status" aria-live="polite">Production batch ready</strong><p id="motion-note">One comparison window enters from the back and clears with the 48.8-second soundtrack.</p></div>
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

  <dialog class="settings-dialog game-dialog" id="data-dialog">
    <form id="setup-form">
      <div class="dialog-head game-dialog__head">
        <div>
          <p>New comparison</p>
          <h2>Build your carbon face-off.</h2>
          <span>Choose the two inputs, then watch a full 30-day batch run to the music.</span>
        </div>
        <button class="dialog-close" id="data-close" type="button">Back to factory</button>
      </div>

      <div class="game-scoreboard" aria-label="Round preview">
        <div class="game-scoreboard__side game-scoreboard__side--ai">
          <span>AI · 30-day preview</span><strong id="setup-ai-preview">—</strong><small id="setup-ai-caption">Masley / EcoLogits estimate</small>
        </div>
        <img src="${ASSET_BASE}/burger.png" alt="" />
        <div class="game-scoreboard__side game-scoreboard__side--life">
          <span>Lifestyle · 30-day preview</span><strong id="setup-life-preview">—</strong><small id="setup-life-caption">Diet, home, driving &amp; flights</small>
        </div>
      </div>

      <div class="game-setup-grid">
        <section class="settings-section game-panel game-panel--ai">
          <div class="settings-heading"><span>1 · Your AI use</span><small id="ai-source-meta">Masley defaults loaded</small></div>
          <div class="setup-presets" aria-label="AI usage presets">
            <span>Quick presets</span>
            <button class="setup-preset setup-preset--yellow" type="button" data-game-preset="default">Masley default</button>
            <button class="setup-preset setup-preset--cyan" type="button" data-game-preset="light">Light chat</button>
            <button class="setup-preset setup-preset--orange" type="button" data-game-preset="coding">Coding day</button>
            <button class="setup-preset setup-preset--pink" type="button" data-game-preset="agent">Agent marathon</button>
          </div>
          <label class="prompt-field">
            <span>Your prompt</span>
            <textarea id="prompt-input" rows="4" required>${DEFAULT_GAME_SETUP.prompt}</textarea>
            <small id="prompt-token-estimate">About ${estimatePromptInputTokens(DEFAULT_GAME_SETUP.prompt)} input tokens · shown for context</small>
          </label>
          <div class="control-grid game-control-grid">
            <label><span>Model</span><select id="model-select">${Object.values(MODEL_CURVES).map((model) => `<option value="${model.id}"${model.id === DEFAULT_GAME_SETUP.model ? ' selected' : ''}>${model.name}</option>`).join('')}</select></label>
            <label><span>Answer length</span><select id="output-tokens-select">
              <option value="50">Quick · 50 tokens</option>
              <option value="170">Short · 170 tokens</option>
              <option value="250">Medium · 250 tokens</option>
              <option value="400" selected>Detailed · 400 tokens</option>
              <option value="5000">Long · 5,000 tokens</option>
              <option value="15000">Deep work · 15,000 tokens</option>
              <option value="100000">Agent run · 100,000 tokens</option>
              <option value="500000">Max run · 500,000 tokens</option>
            </select></label>
            <label class="prompts-field"><span>Prompts per day</span><input id="prompts-per-day" type="number" min="1" max="100000" step="1" value="${DEFAULT_GAME_SETUP.promptsPerDay}" required /></label>
            <label><span>Grid region</span><select id="region-select">${Object.entries(REGIONS).map(([id, item]) => `<option value="${id}">${item.label}</option>`).join('')}</select></label>
          </div>
          <p class="game-note">Input tokens are counted, but the current Masley source models energy from output tokens.</p>
        </section>

        <section class="settings-section game-panel game-panel--life">
          <div class="settings-heading"><span>2 · Your lifestyle</span><button class="link-button" id="reset-profile" type="button">Masley defaults</button></div>
          <div class="control-grid game-control-grid">
            <label><span>Diet</span><select id="diet-select">${Object.entries(DIETS).map(([id, item]) => `<option value="${id}">${item.label}</option>`).join('')}</select></label>
            <label><span>Home energy</span><select id="home-select">${Object.entries(HOME_ENERGY).map(([id, item]) => `<option value="${id}">${item.label}</option>`).join('')}</select></label>
          </div>
          <label class="range-row">
            <span><span>Weekly gasoline driving</span><output id="driving-output">230 mi</output></span>
            <input id="driving-range" type="range" min="0" max="600" step="5" value="230" />
          </label>
          <fieldset class="flight-row">
            <legend>Round-trip flights per year</legend>
            ${Object.entries(FLIGHT_KG_CO2E).map(([id, item]) => `<label><span>${item.label}<small>${item.kgCo2ePerRoundTrip.toLocaleString('en-US')} kg</small></span><input id="flight-${id}" type="number" min="0" max="20" step="1" value="0" inputmode="numeric" /></label>`).join('')}
          </fieldset>
          <div class="settings-heading opponent-heading"><span>Compare AI against</span><small>Pick the opponent</small></div>
          <div class="impact-picker">
            <button class="impact-choice is-active" data-comparison="total" type="button" aria-pressed="true">Total <strong id="impact-total">—</strong></button>
            <button class="impact-choice" data-comparison="diet" type="button" aria-pressed="false">Diet <strong id="impact-diet">—</strong></button>
            <button class="impact-choice" data-comparison="driving" type="button" aria-pressed="false">Driving <strong id="impact-driving">—</strong></button>
            <button class="impact-choice" data-comparison="flights" type="button" aria-pressed="false">Flights <strong id="impact-flights">—</strong></button>
            <button class="impact-choice" data-comparison="home" type="button" aria-pressed="false">Home <strong id="impact-home">—</strong></button>
          </div>
        </section>
      </div>

      <footer class="game-dialog__footer">
        <div class="last-round" id="last-round" hidden><span>Last round</span><strong id="last-round-summary">—</strong></div>
        <div class="round-promise"><strong>30 days become one 49-second track</strong><span>LEDs flash, music starts, and both lines finish with the song.</span></div>
        <button class="primary-button game-start-button" type="submit">Done · start round</button>
      </footer>
      <p class="error-message game-error" id="error-message" role="alert" hidden></p>
    </form>
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
      <div><dt>Visual scale</dt><dd>One comparison window enters and clears during the 48.8-second soundtrack. Exact output fills perspective-aware rows—up to three burgers across on desktop—before belt speed rises. A slow marker carries sub-one-burger output; the LED counters accumulate to the authoritative totals.</dd></div>
      <div><dt>Excluded</dt><dd>Water, training, image generation, retries, and regional goods/services baselines.</dd></div>
    </dl>
    <a class="source-link" href="${MASLEY_SOURCE.url}" target="_blank" rel="noreferrer">Open Masley factor source</a>
    <p class="methodology-version">${MASLEY_SOURCE.version} · Updated ${MASLEY_SOURCE.updated}</p>
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

function fitBeltCounter(element: HTMLElement, force = false): void {
  const text = element.textContent ?? '—';
  // Digits have different rendered widths in the display font even when the
  // formatted strings have the same character count. Refit for the actual
  // value so a transition such as `60.6 kg` -> `177 kg` cannot reuse a stale
  // measurement and crowd the edge of the photographed LED recess.
  if (!force && element.dataset.fitText === text) return;
  const container = element.parentElement;
  if (!container || container.clientWidth <= 0 || container.clientHeight <= 0) return;
  const containerStyle = getComputedStyle(container);
  const availableWidth = container.clientWidth
    - Number.parseFloat(containerStyle.paddingLeft)
    - Number.parseFloat(containerStyle.paddingRight);
  const availableHeight = container.clientHeight
    - Number.parseFloat(containerStyle.paddingTop)
    - Number.parseFloat(containerStyle.paddingBottom);

  element.style.maxWidth = 'none';
  element.style.overflow = 'visible';
  element.style.flex = '0 0 auto';
  element.style.width = 'max-content';
  element.style.fontSize = '100px';
  const probe = element.getBoundingClientRect();
  const fittedSize = Math.min(
    34,
    probe.width > 0 ? 100 * availableWidth / probe.width : 34,
    probe.height > 0 ? 100 * availableHeight / probe.height : 34,
  ) * 0.91;
  element.style.maxWidth = '';
  element.style.overflow = '';
  element.style.flex = '';
  element.style.width = '';
  element.style.fontSize = `${Math.max(5, fittedSize).toFixed(1)}px`;
  element.dataset.fitText = text;
}

function renderBeltCounter(id: 'left-belt-carbon' | 'right-belt-carbon', kgCo2e: number): void {
  const element = byId(id);
  element.textContent = formatBeltCarbon(kgCo2e);
  fitBeltCounter(element);
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

const shell = byId('works-shell');
const stage = byId('factory-stage');
const flowLayer = byId('flow-layer');
const replayButton = byId<HTMLButtonElement>('replay-button');
const soundButton = byId<HTMLButtonElement>('sound-toggle');
const soundtrack = byId<HTMLAudioElement>('soundtrack');
soundtrack.volume = 0.55;
const timelineFill = byId('timeline-fill');
const dataDialog = byId<HTMLDialogElement>('data-dialog');
const setupForm = byId<HTMLFormElement>('setup-form');
const methodologyDialog = byId<HTMLDialogElement>('methodology-dialog');
const promptInput = byId<HTMLTextAreaElement>('prompt-input');
const modelSelect = byId<HTMLSelectElement>('model-select');
const outputTokensSelect = byId<HTMLSelectElement>('output-tokens-select');
const promptsPerDayInput = byId<HTMLInputElement>('prompts-per-day');
const dietSelect = byId<HTMLSelectElement>('diet-select');
const homeSelect = byId<HTMLSelectElement>('home-select');
const regionSelect = byId<HTMLSelectElement>('region-select');
const drivingRange = byId<HTMLInputElement>('driving-range');
const flightInputs: Record<FlightLengthId, HTMLInputElement> = {
  short: byId('flight-short'),
  medium: byId('flight-medium'),
  long: byId('flight-long'),
};

const GAME_PRESETS: Record<string, { model: string; outputTokens: number; promptsPerDay: number }> = {
  default: { model: 'gpt-5.5', outputTokens: 400, promptsPerDay: 10 },
  light: { model: 'gpt-5.4-mini', outputTokens: 170, promptsPerDay: 3 },
  coding: { model: 'claude-sonnet-4-6', outputTokens: 5_000, promptsPerDay: 18 },
  agent: { model: 'gpt-5.5-pro', outputTokens: 100_000, promptsPerDay: 24 },
};

let activeComparison: LifestyleMetricId = 'total';
let swapped = false;
let replayFrame: number | null = null;
let preRollTimer: number | null = null;
let returnToSetupTimer: number | null = null;
let replayStartedAt = 0;
let hasStartedRound = false;
let soundtrackEnabled = true;
let soundtrackLoopTimer: number | null = null;
let soundtrackGeneration = 0;
let replayTotals = { left: 0, right: 0 };

interface ConveyorBurger {
  columnOffset: number;
  element: HTMLImageElement;
  farColumnSpreadScale: number;
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

function impactFor(state: AppState, id: LifestyleMetricId): LifestyleImpact | null {
  if (!state.result) return null;
  return id === 'total' ? state.result.lifestyle.total : state.result.lifestyle.components[id];
}

function profileFromSetup(): LifestyleProfile {
  return {
    ...store.getState().profile,
    diet: dietSelect.value as DietId,
    homeEnergy: homeSelect.value as HomeEnergyId,
    region: regionSelect.value as RegionId,
    weeklyDrivingMiles: clamp(Math.round(Number(drivingRange.value)), 0, 600),
    flightsPerYear: {
      short: clamp(Math.round(Number(flightInputs.short.value)), 0, 20),
      medium: clamp(Math.round(Number(flightInputs.medium.value)), 0, 20),
      long: clamp(Math.round(Number(flightInputs.long.value)), 0, 20),
    },
    comparisonWindow: 'month',
  };
}

function syncPromptEstimate(): void {
  const tokens = estimatePromptInputTokens(promptInput.value);
  byId('prompt-token-estimate').textContent = `About ${tokens.toLocaleString('en-US')} input tokens · shown for context`;
  syncRoundPreview();
}

function syncLifestylePreview(): void {
  const diet = DIETS[dietSelect.value as DietId]?.label ?? 'Lifestyle';
  const region = REGIONS[regionSelect.value as RegionId]?.label ?? 'US';
  byId('setup-life-caption').textContent = `${diet} · ${region}`;
  syncRoundPreview();
}

function syncRoundPreview(): void {
  const aggregate = createGameUsageAggregate({
    prompt: promptInput.value,
    model: modelSelect.value,
    outputTokens: Number(outputTokensSelect.value),
    promptsPerDay: Number(promptsPerDayInput.value),
  });
  const result = calculateComparison(aggregate, profileFromSetup());
  const lifestyle = activeComparison === 'total'
    ? result.lifestyle.total
    : result.lifestyle.components[activeComparison];
  byId('setup-ai-preview').textContent = formatCarbon(result.aiCarbonKgCo2e.central);
  byId('setup-ai-caption').textContent = `${aggregate.requests.toLocaleString('en-US')} prompts / day · ${formatEnergy(result.energyWh.central)}`;
  byId('setup-life-preview').textContent = formatCarbon(lifestyle.kgCo2e);
}

function resetSetupControls(): void {
  promptInput.value = DEFAULT_GAME_SETUP.prompt;
  modelSelect.value = DEFAULT_GAME_SETUP.model;
  outputTokensSelect.value = String(DEFAULT_GAME_SETUP.outputTokens);
  promptsPerDayInput.value = String(DEFAULT_GAME_SETUP.promptsPerDay);
  dietSelect.value = DEFAULT_PROFILE.diet;
  homeSelect.value = DEFAULT_PROFILE.homeEnergy;
  regionSelect.value = DEFAULT_PROFILE.region;
  drivingRange.value = String(DEFAULT_PROFILE.weeklyDrivingMiles);
  byId<HTMLOutputElement>('driving-output').value = `${DEFAULT_PROFILE.weeklyDrivingMiles} mi`;
  for (const length of Object.keys(flightInputs) as FlightLengthId[]) {
    flightInputs[length].value = String(DEFAULT_PROFILE.flightsPerYear[length]);
  }
  syncPromptEstimate();
  syncLifestylePreview();
}

function applyGamePreset(id: string): void {
  const preset = GAME_PRESETS[id];
  if (!preset) return;
  modelSelect.value = preset.model;
  outputTokensSelect.value = String(preset.outputTokens);
  promptsPerDayInput.value = String(preset.promptsPerDay);
  syncPromptEstimate();
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
  renderBeltCounter('left-belt-carbon', sides.left.kgCo2e);
  renderBeltCounter('right-belt-carbon', sides.right.kgCo2e);

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
    byId('motion-note').textContent = `${state.result.comparisonDays} days clear in one 49-second track. The ${formatRatio(ratio)} gap uses ${busyTiming.columnCount}-wide rows; the LEDs count upward, then the final row exits with the music.${markerNote}`;
  } else {
    byId('motion-note').textContent = `${state.result.comparisonDays} days clear in one 49-second track. The LEDs count upward until the last burgers exit.`;
  }
  byId('window-label').textContent = `${state.result.comparisonDays}-day carbon comparison`;
  byId('replay-window').textContent = `${state.result.comparisonDays}-day production · single batch`;
  byId('source-status').textContent = state.aggregate.synthetic ? 'Interactive Masley estimate' : `${state.aggregate.sourceName} · local only`;

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
  if (returnToSetupTimer !== null) window.clearTimeout(returnToSetupTimer);
  returnToSetupTimer = null;
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

function openSetupDialog(showLastRound = false): void {
  const closeButton = byId<HTMLButtonElement>('data-close');
  closeButton.hidden = !hasStartedRound;
  const lastRound = byId('last-round');
  lastRound.hidden = !showLastRound;
  if (showLastRound) {
    const sides = currentSides(store.getState());
    if (sides) {
      byId('last-round-summary').textContent = `${formatCarbon(sides.left.kgCo2e)} vs ${formatCarbon(sides.right.kgCo2e)}`;
    }
  }
  syncPromptEstimate();
  syncLifestylePreview();
  if (!dataDialog.open) dataDialog.showModal();
  dataDialog.scrollTop = 0;
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
  renderBeltCounter('left-belt-carbon', replayTotals.left * elapsedShare);
  renderBeltCounter('right-belt-carbon', replayTotals.right * elapsedShare);
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
    farColumnSpreadScale: packedColumnSpreadScale(side, columnCount),
    farCenterOffsetPct: packedRailCenterOffset(side, columnCount),
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
          columnOffsetForIndex(column, rowBurgerCount, lane.side),
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
      burger.farColumnSpreadScale,
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
    (now - replayStartedAt) / ROUND_PLAYBACK_DURATION_MS,
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
    returnToSetupTimer = window.setTimeout(() => {
      returnToSetupTimer = null;
      openSetupDialog(true);
    }, SETUP_RETURN_DELAY_MS);
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
    const burgerOutput = data.kgCo2e / BURGER_KG_CO2E;
    const visibleBurgerCount = burgerOutput < 1
      ? 1
      : Math.min(MAX_VISIBLE_BURGERS_PER_LANE, Math.max(1, Math.ceil(burgerOutput)));
    const timing = laneMotionTiming(
      burgerOutput < 1 ? burgerOutput : visibleBurgerCount,
      laneCapacity,
      maxColumnsForStage(),
    );
    if (!timing) return;
    const duration = timing.travelDurationMs;
    const interval = timing.continuousMarker
      ? ROUND_PLAYBACK_DURATION_MS
      : timing.intervalMs * timing.columnCount;
    const totalCapacity = timing.continuousMarker ? 1 : timing.totalCapacity;
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
  drivingRange.value = String(state.profile.weeklyDrivingMiles);
  byId<HTMLOutputElement>('driving-output').value = `${state.profile.weeklyDrivingMiles} mi`;
  for (const [length, input] of Object.entries(flightInputs)) {
    input.value = String(state.profile.flightsPerYear[length as FlightLengthId]);
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
    syncRoundPreview();
  });
});

promptInput.addEventListener('input', syncPromptEstimate);
promptsPerDayInput.addEventListener('input', syncPromptEstimate);
modelSelect.addEventListener('change', syncRoundPreview);
outputTokensSelect.addEventListener('change', syncRoundPreview);
document.querySelectorAll<HTMLButtonElement>('[data-game-preset]').forEach((button) => {
  button.addEventListener('click', () => applyGamePreset(button.dataset.gamePreset ?? ''));
});
dietSelect.addEventListener('change', syncLifestylePreview);
homeSelect.addEventListener('change', syncRoundPreview);
regionSelect.addEventListener('change', syncLifestylePreview);
drivingRange.addEventListener('input', () => {
  byId<HTMLOutputElement>('driving-output').value = `${drivingRange.value} mi`;
  syncRoundPreview();
});
for (const input of Object.values(flightInputs)) input.addEventListener('input', syncRoundPreview);
byId('reset-profile').addEventListener('click', resetSetupControls);

setupForm.addEventListener('submit', (event) => {
  event.preventDefault();
  if (!setupForm.reportValidity()) return;

  const aggregate = createGameUsageAggregate({
    prompt: promptInput.value,
    model: modelSelect.value,
    outputTokens: Number(outputTokensSelect.value),
    promptsPerDay: Number(promptsPerDayInput.value),
  });
  const profile = profileFromSetup();
  store.setState({
    aggregate,
    profile,
    result: calculateComparison(aggregate, profile),
    status: 'ready',
    error: null,
  });
  hasStartedRound = true;
  dataDialog.close();
  startReplay();
});

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
byId('data-open').addEventListener('click', () => {
  prepareBatch();
  openSetupDialog(false);
});
byId('data-close').addEventListener('click', () => dataDialog.close());
dataDialog.addEventListener('cancel', (event) => {
  if (!hasStartedRound) event.preventDefault();
});
byId('methodology-open').addEventListener('click', () => methodologyDialog.showModal());
byId('methodology-close').addEventListener('click', () => methodologyDialog.close());

let observedLaneCapacity = laneCapacityForStage();
new ResizeObserver(() => {
  fitBeltCounter(byId('left-belt-carbon'), true);
  fitBeltCounter(byId('right-belt-carbon'), true);
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

resetSetupControls();
renderSoundtrackControl();
openSetupDialog(false);
