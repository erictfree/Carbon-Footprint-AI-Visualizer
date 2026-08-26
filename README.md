# PromptMiles

PromptMiles translates estimated AI energy into the distance a 2024 Tesla Model 3 could travel, then puts that distance beside lifestyle comparisons expressed in the same unit.

This repository currently contains the first runnable M0/M1-foundation checkpoint:

- Vite + vanilla TypeScript application shell
- Procedural Three.js car placeholder and dual-path scene
- Browser-local CSV ingestion and aggregation with PapaParse
- Seeded synthetic usage data for development and demonstrations
- Provisional Masley / EcoLogits v0.10 energy curves with uncertainty ranges
- Diet and grid-region controls with live recalculation
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

The current factor snapshot comes from [Andy Masley’s public-domain calculator source](https://andymasley.com/visuals/ai-prompt-footprint-source.txt), which uses EcoLogits v0.10 central and 95% interval estimates. PromptMiles currently interpolates the source’s output-token scenarios. Input-token energy is not yet modeled, so the displayed results are provisional estimates and must not be presented as measurements.

Raw CSV rows are parsed locally and discarded after aggregation. PromptMiles does not upload usage files.

See [`PromptMiles_PRD_v0.1.docx`](./PromptMiles_PRD_v0.1.docx) for the complete product requirements.
