# Burger Works

Burger Works compares estimated AI carbon with lifestyle carbon through two straight burger-production lines. One selected comparison window plays in one minute: exact output fills each belt to safe density first, then drives belt velocity, while the authoritative totals remain visible below.

## Run locally

```bash
npm install
npm run dev -- --host 127.0.0.1 --port 5174
```

Open `http://127.0.0.1:5174/`.

## What works

- Synthetic light, typical, agent-heavy, billion-token, and unknown-model scenarios
- Local CSV import with automatic or manual column mapping
- Masley / EcoLogits model-curve interpolation with central and 95% range estimates
- Diet, driving, flights, and home-energy lifestyle comparisons over matched time windows
- Straight, perspective-matched twin conveyors with identical burgers and live accumulating CO₂ displays embedded in the photographed machinery; each run starts empty, admits one comparison window from the back over one minute, and stops after the final burgers fall beyond the foreground
- Responsive physical headway: burger geometry scales directly with the photographed stage, with up to ten three-wide rows on desktop and three two-wide rows on compact screens, size-aware column spacing, and full opacity until sprites run beyond the bottom edge
- A persistent slow-lane marker keeps sub-one-burger output visible without changing the authoritative numeric total
- Empty-to-complete batch staging plus exact burger-equivalent output for the selected window
- Batch replay, side swap, methodology, profile controls, and local persistence for real CSV imports; synthetic demos reset consistently in every browser
- Burger Blitz is queued by default; Start batch primes the soundtrack, flashes both LED panels for a short systems check, then launches the music and empty-to-full production run together
- Responsive desktop and mobile layouts

## Data format

CSV imports need a date, model, and at least one token column. Common aliases are recognized automatically.

```csv
timestamp,model,input_tokens,output_tokens,requests
2026-07-01T12:00:00Z,gpt-5.5,1200,420,1
```

Raw CSV rows remain in the browser and are discarded after aggregation.

## Methodology

The AI estimate uses the model curves transcribed from [Andy Masley’s public-domain calculator source](https://andymasley.com/visuals/ai-prompt-footprint-source.txt), based on EcoLogits v0.10. Output-token scenarios are interpolated per model and request; imported input-token totals are displayed but excluded because the source methodology does not currently model input-token processing.

AI energy is converted to carbon using the selected grid intensity. Lifestyle factors are normalized to the same time window. Burger production is a visual metaphor using `1 burger ≈ 3 kg CO₂e`; the displayed kg CO₂e values and AI uncertainty range are authoritative.

The original car/globe exploration remains in `src/scene/` and `models/` as legacy prototype material but is no longer loaded by the application.
