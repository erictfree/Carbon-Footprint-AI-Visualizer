# PromptMiles

PromptMiles translates estimated AI energy into the distance a 2024 Tesla Model 3 could travel, then puts that distance beside lifestyle comparisons expressed in the same unit.

This repository currently contains the M2 profile-and-HUD checkpoint:

- Vite + vanilla TypeScript application shell
- Licensed 2024 Model 3 GLB with a procedural fallback and dual-path Three.js scene
- Browser-local CSV ingestion and aggregation with PapaParse
- Four seeded synthetic scenarios spanning light chat, typical use, agent-heavy use, and unknown-model fallback
- Complete nine-model Masley / EcoLogits v0.10 factor snapshot with uncertainty ranges
- Inspectable per-model calculation breakdown and explicit input-token limitation
- Automatic CSV header detection plus an in-browser manual column mapper
- Versioned local persistence with migration from the original diet-only profile
- Separate diet, gasoline driving, short/medium/long flight, and home-energy calculations
- CSV-span, week, and month normalization applied to both AI and lifestyle values
- Selectable lifestyle paths, a combined total, start city, grid region, and live EV-efficiency controls
- Installable, offline-capable PWA shell
- Unit tests for factors, parsing, and conversions

## Run locally

```bash
npm install
npm run dev
```

Run the regression tests and production build:

```bash
npm test
npm run build
```

Node.js `^20.19.0` or `>=22.12.0` is required by the current Vite release.

## Architecture

```text
CSV adapter -> normalized aggregates -> factor engine -> result vectors
                                                     -> Three.js scene
Profile controls -> typed store --------------------> HUD + scene
```

The calculation modules do not depend on the renderer. A future real OpenAI export adapter can therefore replace or supplement the synthetic schema without changing the scene.

## Methodology status

The current factor snapshot comes from [Andy Masley’s public-domain calculator source](https://andymasley.com/visuals/ai-prompt-footprint-source.txt), which uses EcoLogits v0.10 central and 95% interval estimates. PromptMiles interpolates those output-token scenarios per model and request. The published [EcoLogits LLM inference methodology](https://ecologits.ai/latest/methodology/llm_inference/) does not currently model input-token processing, so PromptMiles displays imported input-token totals but excludes them from the estimate. Results remain estimates rather than measurements.

Raw CSV rows are parsed locally and discarded after aggregation. PromptMiles does not upload usage files.

## 3D asset attribution

The production car asset is “2024 Tesla Model 3,” credited in its embedded metadata to
[RBLXSupercars](https://sketchfab.com/RBLXSupercars) and shared on Sketchfab by
[brandonleong28](https://sketchfab.com/3d-models/tesla-model-3-2024-36c52f3f89f6439c90310f14e8ff33f2).
It is used under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) and is rescaled,
reoriented when needed, shadow-enabled, and material-tuned at runtime for PromptMiles.

See [`PromptMiles_PRD_v0.1.docx`](./PromptMiles_PRD_v0.1.docx) for the complete product requirements.
