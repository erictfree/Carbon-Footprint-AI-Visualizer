# Burger Works

Burger Works is a one-round carbon comparison game. A cartoon setup board collects a prompt, model, answer length, daily prompt rate, and Masley lifestyle defaults; then two burger-production lines turn the computed 30-day footprints into a synchronized one-minute factory run.

## Run locally

```bash
npm install
npm run dev -- --host 127.0.0.1 --port 5174
```

Open `http://127.0.0.1:5174/`.

## What works

- First-run setup dialog styled from the supplied bright burger-game reference, with live 30-day CO₂ previews and functional light-chat, coding-day, and agent-marathon presets
- Prompt, model, answer-length, prompts-per-day, grid, diet, home, driving, flight, and comparison-opponent inputs
- Masley / EcoLogits model-curve interpolation with central and 95% range estimates
- Diet, driving, flights, and home-energy lifestyle comparisons over a fixed 30-day game window
- Straight, perspective-matched twin conveyors with identical burgers and live accumulating CO₂ displays embedded in the photographed machinery; each run starts empty, admits one comparison window from the back over one minute, and stops after the final burgers fall beyond the foreground
- Responsive physical headway: burger geometry scales directly with the photographed stage, with up to ten three-wide rows on desktop and three two-wide rows on compact screens, size-aware column spacing, and full opacity until sprites run beyond the bottom edge
- A persistent slow-lane marker keeps sub-one-burger output visible without changing the authoritative numeric total
- Empty-to-complete batch staging plus exact burger-equivalent output for the selected window
- Done · start round computes both footprints, primes the soundtrack, flashes both LED panels, then launches the music and empty-to-full production run together
- After the last burger clears, the completed totals hold briefly and the setup dialog returns with the prior choices preserved
- Batch replay, side swap, methodology, live setup previews, and responsive desktop/mobile layouts

## Round flow

1. Enter a prompt or choose an AI-use preset.
2. Adjust the default lifestyle inputs and choose total, diet, driving, flights, or home as the opponent.
3. Press **Done · start round**.
4. Watch both 30-day footprints run through the factory.
5. When production finishes, the setup board returns for the next round.

CSV ingestion and mapping utilities remain tested in `src/ingest/`, but data import is intentionally deferred from the game UI for a later iteration.

## Methodology

The AI estimate uses the model curves transcribed from [Andy Masley’s public-domain calculator source](https://andymasley.com/visuals/ai-prompt-footprint-source.txt), based on EcoLogits v0.10. Output-token scenarios are interpolated per model and request; imported input-token totals are displayed but excluded because the source methodology does not currently model input-token processing.

AI energy is converted to carbon using the selected grid intensity. Lifestyle factors are normalized to the same time window. Burger production is a visual metaphor using `1 burger ≈ 3 kg CO₂e`; the displayed kg CO₂e values and AI uncertainty range are authoritative.

Prompt input tokens are estimated for context at roughly four characters per token. The source methodology currently models energy from output tokens, so the estimate is not added to the AI energy result.

The original car/globe exploration remains in `src/scene/` and `models/` as legacy prototype material but is no longer loaded by the application.
