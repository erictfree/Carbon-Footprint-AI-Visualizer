import './styles.css';
import { calculateComparison, formatEnergy } from './calc/engine';
import {
  COUNTRY_DIET,
  DEFAULT_PROFILE,
  DIETS,
  DRIVING,
  FLYING,
  HOME_ENERGY,
  MASLEY_SOURCE,
  MODEL_CURVES,
  REGIONS,
} from './factors/masley';
import {
  createGameUsageAggregate,
  DEFAULT_GAME_SETUP,
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
  DrivingId,
  FlyingFrequencyId,
  HomeEnergyId,
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
const RIGHT_LANE_LEFT_SHIFT_PX = 10;

const initialProfile: LifestyleProfile = {
  ...DEFAULT_PROFILE,
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

const OUTPUT_TOKEN_SCENARIOS = [
  [50, 'Tweet · 50 tokens'],
  [170, 'Short email · 170'],
  [250, 'Article summary · 250'],
  [400, 'Chatbot reply · 400'],
  [5_000, '5-page report · 5,000'],
  [15_000, 'Long document · 15,000'],
  [100_000, 'Coding / agent · 100,000'],
  [500_000, 'Novel-scale · 500,000'],
] as const;

function modelOptions(selected: string): string {
  return Object.values(MODEL_CURVES)
    .map((model) => `<option value="${model.id}"${model.id === selected ? ' selected' : ''}>${model.name}</option>`)
    .join('');
}

function outputTokenOptions(selected: number): string {
  return OUTPUT_TOKEN_SCENARIOS
    .map(([tokens, label]) => `<option value="${tokens}"${tokens === selected ? ' selected' : ''}>${label}</option>`)
    .join('');
}

const defaultAdditionalRows = DEFAULT_GAME_SETUP.additionalRows ?? [];

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
          <p>New 30-day comparison</p>
          <h2>Build your burger battle.</h2>
          <span>Set your lifestyle and AI use, then send both carbon footprints down the belts.</span>
        </div>
        <button class="dialog-close" id="data-close" type="button">Back to factory</button>
      </div>

      <div class="game-setup-grid">
        <section class="settings-section game-panel game-panel--life" aria-labelledby="lifestyle-panel-title">
          <img class="game-panel__mascot game-panel__mascot--life" src="${ASSET_BASE}/burger.png" alt="" />
          <div class="game-panel__hero">
            <div class="settings-heading game-panel__title-row">
              <span id="lifestyle-panel-title">Your footprint</span>
              <button class="link-button" id="reset-profile" type="button">Masley defaults</button>
            </div>
            <div class="game-panel__score game-panel__score--life" aria-label="Lifestyle 30-day preview">
              <strong id="setup-life-preview">—</strong>
              <span>kg CO₂e / 30 days</span>
              <small id="setup-life-caption">Regional baseline, home, driving, diet &amp; flying</small>
            </div>
          </div>
          <div class="control-grid game-control-grid">
            <label><span>Where you live / AI grid</span><select id="region-select">${Object.entries(REGIONS).map(([id, item]) => `<option value="${id}">${item.label}</option>`).join('')}</select></label>
            <label><span>Diet</span><select id="diet-select">${Object.entries(DIETS).map(([id, item]) => `<option value="${id}">${item.label}</option>`).join('')}</select></label>
            <label><span>Home energy</span><select id="home-select">${Object.entries(HOME_ENERGY).map(([id, item]) => `<option value="${id}">${item.label}</option>`).join('')}</select></label>
            <label><span>Driving</span><select id="driving-select">${Object.entries(DRIVING).map(([id, item]) => `<option value="${id}">${item.label}</option>`).join('')}</select></label>
            <label><span>Flying</span><select id="flying-select">${Object.entries(FLYING).map(([id, item]) => `<option value="${id}">${item.label}</option>`).join('')}</select></label>
          </div>
          <div class="footprint-breakdown" aria-label="Values included in your total footprint">
            <span class="footprint-breakdown__heading">Included in your total</span>
            <div><span>Regional baseline</span><strong id="setup-impact-baseline">—</strong></div>
            <div><span>Food</span><strong id="setup-impact-diet">—</strong></div>
            <div><span>Driving</span><strong id="setup-impact-driving">—</strong></div>
            <div><span>Flights</span><strong id="setup-impact-flights">—</strong></div>
            <div><span>Home energy</span><strong id="setup-impact-home">—</strong></div>
          </div>
        </section>

        <section class="settings-section game-panel game-panel--ai" aria-labelledby="ai-panel-title">
          <img class="game-panel__mascot game-panel__mascot--ai" src="${ASSET_BASE}/burger.png" alt="" />
          <div class="game-panel__hero">
            <div class="settings-heading game-panel__title-row">
              <span id="ai-panel-title">Your AI use</span>
              <small id="ai-source-meta">Masley defaults loaded</small>
            </div>
            <div class="game-panel__score game-panel__score--ai" aria-label="AI 30-day preview">
              <strong id="setup-ai-preview">—</strong>
              <span>kg CO₂e / 30 days</span>
              <small id="setup-ai-caption">Masley / EcoLogits estimate</small>
            </div>
          </div>
          <div class="setup-presets" aria-label="AI usage presets">
            <span>Quick presets</span>
            <button class="setup-preset setup-preset--yellow" type="button" data-game-preset="default">Masley default</button>
            <button class="setup-preset setup-preset--cyan" type="button" data-game-preset="light">Light chat</button>
            <button class="setup-preset setup-preset--orange" type="button" data-game-preset="coding">Coding day</button>
            <button class="setup-preset setup-preset--pink" type="button" data-game-preset="agent">Agent marathon</button>
          </div>
          <div class="ai-usage-rows" aria-label="Daily AI usage mix">
            <div class="ai-usage-row ai-usage-row--head" aria-hidden="true"><span>Model</span><span>Typical output</span><span>Prompts / day</span></div>
            <div class="ai-usage-row">
              <label><span class="sr-only">First model</span><select id="model-select">${modelOptions(DEFAULT_GAME_SETUP.model)}</select></label>
              <label><span class="sr-only">First typical output</span><select id="output-tokens-select">${outputTokenOptions(DEFAULT_GAME_SETUP.outputTokens)}</select></label>
              <label><span class="sr-only">First prompts per day</span><input id="prompts-per-day" type="number" min="0" max="100000" step="1" value="${DEFAULT_GAME_SETUP.promptsPerDay}" required /></label>
            </div>
            <div class="ai-usage-row">
              <label><span class="sr-only">Second model</span><select id="model-select-2">${modelOptions(defaultAdditionalRows[0]?.model ?? 'claude-sonnet-4-6')}</select></label>
              <label><span class="sr-only">Second typical output</span><select id="output-tokens-select-2">${outputTokenOptions(defaultAdditionalRows[0]?.outputTokens ?? 400)}</select></label>
              <label><span class="sr-only">Second prompts per day</span><input id="prompts-per-day-2" type="number" min="0" max="100000" step="1" value="${defaultAdditionalRows[0]?.promptsPerDay ?? 0}" required /></label>
            </div>
            <div class="ai-usage-row">
              <label><span class="sr-only">Third model</span><select id="model-select-3">${modelOptions(defaultAdditionalRows[1]?.model ?? 'gemini-3.5-flash')}</select></label>
              <label><span class="sr-only">Third typical output</span><select id="output-tokens-select-3">${outputTokenOptions(defaultAdditionalRows[1]?.outputTokens ?? 250)}</select></label>
              <label><span class="sr-only">Third prompts per day</span><input id="prompts-per-day-3" type="number" min="0" max="100000" step="1" value="${defaultAdditionalRows[1]?.promptsPerDay ?? 0}" required /></label>
            </div>
          </div>
          <div class="ai-mix-summary" aria-label="Thirty-day AI model mix">
            <span class="ai-mix-summary__heading">What drives this total</span>
            <div data-ai-mix-summary><span>Model</span><strong>—</strong></div>
            <div data-ai-mix-summary><span>Model</span><strong>—</strong></div>
            <div data-ai-mix-summary><span>Model</span><strong>—</strong></div>
          </div>
          <p class="game-note">Masley estimates each row from its model, typical output scenario, and prompts per day.</p>
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
      <div><dt>AI carbon</dt><dd>Estimated Wh × selected grid carbon intensity, plus EcoLogits embodied-hardware carbon for the same model and output scenario.</dd></div>
      <div><dt>Lifestyle</dt><dd>Masley’s regional goods, services, and shared-infrastructure baseline plus diet, gasoline driving, flying, and home energy, all normalized to the same comparison window.</dd></div>
      <div><dt>Burger unit</dt><dd>1 burger ≈ ${BURGER_KG_CO2E} kg CO₂e. This is a communication equivalence, not a claim that every burger is identical.</dd></div>
      <div><dt>Visual scale</dt><dd>One comparison window enters and clears during the 48.8-second soundtrack. Exact output fills perspective-aware rows—up to three burgers across on desktop—before belt speed rises. A slow marker carries sub-one-burger output; the LED counters accumulate to the authoritative totals.</dd></div>
      <div><dt>Excluded</dt><dd>Water, training, image generation, video generation, retries, and non-text AI activity.</dd></div>
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
const modelSelect = byId<HTMLSelectElement>('model-select');
const outputTokensSelect = byId<HTMLSelectElement>('output-tokens-select');
const promptsPerDayInput = byId<HTMLInputElement>('prompts-per-day');
const additionalUsageControls = [2, 3].map((index) => ({
  model: byId<HTMLSelectElement>(`model-select-${index}`),
  outputTokens: byId<HTMLSelectElement>(`output-tokens-select-${index}`),
  promptsPerDay: byId<HTMLInputElement>(`prompts-per-day-${index}`),
}));
const dietSelect = byId<HTMLSelectElement>('diet-select');
const homeSelect = byId<HTMLSelectElement>('home-select');
const regionSelect = byId<HTMLSelectElement>('region-select');
const drivingSelect = byId<HTMLSelectElement>('driving-select');
const flyingSelect = byId<HTMLSelectElement>('flying-select');

const GAME_PRESETS: Record<string, Parameters<typeof createGameUsageAggregate>[0]> = {
  default: {
    model: DEFAULT_GAME_SETUP.model,
    outputTokens: DEFAULT_GAME_SETUP.outputTokens,
    promptsPerDay: DEFAULT_GAME_SETUP.promptsPerDay,
    additionalRows: DEFAULT_GAME_SETUP.additionalRows,
  },
  light: { model: 'gpt-5.4-mini', outputTokens: 170, promptsPerDay: 3 },
  coding: { model: 'claude-sonnet-4-6', outputTokens: 5_000, promptsPerDay: 18 },
  agent: { model: 'gpt-5.5-pro', outputTokens: 100_000, promptsPerDay: 24 },
};

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

function profileFromSetup(): LifestyleProfile {
  return {
    ...store.getState().profile,
    diet: dietSelect.value as DietId,
    homeEnergy: homeSelect.value as HomeEnergyId,
    region: regionSelect.value as RegionId,
    driving: drivingSelect.value as DrivingId,
    flyingFrequency: flyingSelect.value as FlyingFrequencyId,
    comparisonWindow: 'month',
  };
}

function setupAggregateFromControls() {
  return createGameUsageAggregate({
    model: modelSelect.value,
    outputTokens: Number(outputTokensSelect.value),
    promptsPerDay: Number(promptsPerDayInput.value),
    additionalRows: additionalUsageControls.map((row) => ({
      model: row.model.value,
      outputTokens: Number(row.outputTokens.value),
      promptsPerDay: Number(row.promptsPerDay.value),
    })),
  });
}

function syncLifestylePreview(): void {
  const diet = DIETS[dietSelect.value as DietId]?.label ?? 'Lifestyle';
  const region = REGIONS[regionSelect.value as RegionId]?.label ?? 'US';
  byId('setup-life-caption').textContent = `${diet} · ${region}`;
  syncRoundPreview();
}

function syncRoundPreview(): void {
  const aggregate = setupAggregateFromControls();
  const result = calculateComparison(aggregate, profileFromSetup());
  byId('setup-ai-preview').textContent = formatCarbon(result.aiCarbonKgCo2e.central);
  byId('setup-ai-caption').textContent = `${aggregate.requests.toLocaleString('en-US')} prompts / day · ${formatEnergy(result.energyWh.central)}`;
  byId('setup-life-preview').textContent = formatCarbon(result.lifestyle.total.kgCo2e);
  for (const [id, component] of Object.entries(result.lifestyle.components)) {
    byId(`setup-impact-${id}`).textContent = formatCarbon(component.kgCo2e);
  }
  document.querySelectorAll<HTMLElement>('[data-ai-mix-summary]').forEach((element, index) => {
    const breakdown = result.modelBreakdown[index];
    element.hidden = !breakdown;
    if (!breakdown) return;
    element.querySelector('span')!.textContent = breakdown.factorModel;
    element.querySelector('strong')!.textContent = `${breakdown.requests.toLocaleString('en-US')} requests · ${formatEnergy(breakdown.energyWh.central)}`;
  });
}

function resetSetupControls(): void {
  modelSelect.value = DEFAULT_GAME_SETUP.model;
  outputTokensSelect.value = String(DEFAULT_GAME_SETUP.outputTokens);
  promptsPerDayInput.value = String(DEFAULT_GAME_SETUP.promptsPerDay);
  additionalUsageControls.forEach((controls, index) => {
    const row = defaultAdditionalRows[index];
    controls.model.value = row?.model ?? MODEL_CURVES['gpt-5.5']!.id;
    controls.outputTokens.value = String(row?.outputTokens ?? 400);
    controls.promptsPerDay.value = String(row?.promptsPerDay ?? 0);
  });
  dietSelect.value = DEFAULT_PROFILE.diet;
  homeSelect.value = DEFAULT_PROFILE.homeEnergy;
  regionSelect.value = DEFAULT_PROFILE.region;
  drivingSelect.value = DEFAULT_PROFILE.driving;
  flyingSelect.value = DEFAULT_PROFILE.flyingFrequency;
  syncRoundPreview();
  syncLifestylePreview();
}

function applyGamePreset(id: string): void {
  const preset = GAME_PRESETS[id];
  if (!preset) return;
  modelSelect.value = preset.model;
  outputTokensSelect.value = String(preset.outputTokens);
  promptsPerDayInput.value = String(preset.promptsPerDay);
  additionalUsageControls.forEach((controls, index) => {
    const row = preset.additionalRows?.[index];
    if (row) {
      controls.model.value = row.model;
      controls.outputTokens.value = String(row.outputTokens);
    }
    controls.promptsPerDay.value = String(row?.promptsPerDay ?? 0);
  });
  syncRoundPreview();
}

interface SideData {
  label: string;
  factoryName: string;
  kgCo2e: number;
  range?: string;
  className: 'ai' | 'life';
}

function currentSides(state: AppState): { left: SideData; right: SideData } | null {
  if (!state.result) return null;
  const impact = state.result.lifestyle.total;
  const ai: SideData = {
    label: 'AI usage',
    factoryName: 'AI line',
    kgCo2e: state.result.aiCarbonKgCo2e.central,
    range: `${formatCarbon(state.result.aiCarbonKgCo2e.low)}–${formatCarbon(state.result.aiCarbonKgCo2e.high)}`,
    className: 'ai',
  };
  const life: SideData = {
    label: 'Your lifestyle',
    factoryName: 'Your lifestyle line',
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
  if (!sides) return;

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
  syncRoundPreview();
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
    burger.element.style.left = burger.side === 'right'
      ? `calc(${pose.leftPct}% - ${RIGHT_LANE_LEFT_SHIFT_PX}px)`
      : `${pose.leftPct}%`;
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
  drivingSelect.value = state.profile.driving;
  flyingSelect.value = state.profile.flyingFrequency;

  if (state.aggregate && state.result) {
    byId('ai-source-meta').textContent = `${state.aggregate.requests.toLocaleString('en-US')} requests · ${Math.round(state.aggregate.outputTokens * state.result.windowScale).toLocaleString('en-US')} output tokens · ${formatEnergy(state.result.energyWh.central)}`;
    renderComparison(state);
    prepareBatch();
  }
});

promptsPerDayInput.addEventListener('input', syncRoundPreview);
modelSelect.addEventListener('change', syncRoundPreview);
outputTokensSelect.addEventListener('change', syncRoundPreview);
additionalUsageControls.forEach((controls) => {
  controls.promptsPerDay.addEventListener('input', syncRoundPreview);
  controls.model.addEventListener('change', syncRoundPreview);
  controls.outputTokens.addEventListener('change', syncRoundPreview);
});
document.querySelectorAll<HTMLButtonElement>('[data-game-preset]').forEach((button) => {
  button.addEventListener('click', () => applyGamePreset(button.dataset.gamePreset ?? ''));
});
dietSelect.addEventListener('change', syncLifestylePreview);
homeSelect.addEventListener('change', syncRoundPreview);
regionSelect.addEventListener('change', () => {
  dietSelect.value = COUNTRY_DIET[regionSelect.value as RegionId];
  syncLifestylePreview();
});
drivingSelect.addEventListener('change', syncRoundPreview);
flyingSelect.addEventListener('change', syncRoundPreview);
byId('reset-profile').addEventListener('click', resetSetupControls);

setupForm.addEventListener('submit', (event) => {
  event.preventDefault();
  if (!setupForm.reportValidity()) return;

  const aggregate = setupAggregateFromControls();
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
