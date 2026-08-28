# Burger Works

Burger Works is a one-round carbon comparison game. A cartoon setup board collects a prompt, model, answer length, daily prompt rate, and Masley lifestyle defaults; then two burger-production lines turn the computed 30-day footprints into a synchronized 48.8-second factory run.

## Run locally

```bash
npm install
npm run dev -- --host 127.0.0.1 --port 5174
```

Open `http://127.0.0.1:5174/`.

## What works

- First-run setup dialog styled from the supplied bright burger-game reference, with live 30-day CO₂ previews and functional light-chat, coding-day, and agent-marathon presets
- Main factory board styled from `interfaceinspiration.jpg`: red arcade cabinet, outlined score typography, yellow output counters, green batch-status panel, and oversized music/start controls
- Prompt context plus a three-row model, typical-output, and prompts-per-day AI mix; Masley’s default GPT-5.5, Claude Sonnet 4.6, and Gemini 3.5 Flash rows are preloaded
- Location/grid, home, driving, diet, categorical flying, regional baseline, and footprint-spotlight inputs
- Masley / EcoLogits energy and embodied-hardware model-curve interpolation with central and 95% range estimates
- Regional baseline, diet, driving, flying, and home-energy lifestyle comparisons over a fixed 30-day game window
- Straight, perspective-matched twin conveyors with identical burgers and live accumulating CO₂ displays embedded in the photographed machinery; each run starts empty, admits one comparison window from the back, and clears the final burgers as the 48.8-second soundtrack ends
- Responsive physical headway: burger geometry scales directly with the photographed stage, with up to ten three-wide rows on desktop and three two-wide rows on compact screens, size-aware column spacing, and full opacity until sprites run beyond the bottom edge
- A persistent slow-lane marker keeps sub-one-burger output visible without changing the authoritative numeric total
- Empty-to-complete batch staging plus exact burger-equivalent output for the selected window
- Done · start round computes both footprints, primes the soundtrack, flashes both LED panels, then launches the music and empty-to-full production run together
- After the last burger clears, the completed totals hold briefly and the setup dialog returns with the prior choices preserved
- Batch replay, side swap, methodology, live setup previews, and responsive desktop/mobile layouts

## Round flow

1. Enter a prompt or choose an AI-use preset.
2. Adjust the default lifestyle inputs and choose whether to spotlight your total, regional baseline, diet, driving, flying, or home footprint.
3. Press **Done · start round**.
4. Watch both 30-day footprints run through the factory.
5. When production finishes, the setup board returns for the next round.

CSV ingestion and mapping utilities remain tested in `src/ingest/`, but data import is intentionally deferred from the game UI for a later iteration.

## Methodology

The AI estimate uses the model curves transcribed from [Andy Masley’s public calculator source](https://andymasley.com/visuals/ai-prompt-footprint-source.txt), based on EcoLogits v0.10. Output-token scenarios are interpolated per model and request. Prompt text and its estimated input-token count are displayed only as context because Masley’s interface selects a typical output scenario rather than accepting an input-token count.

AI carbon is `(energy Wh ÷ 1,000 × regional grid g CO₂e/kWh) + embodied-hardware g CO₂e`, then converted to kilograms. Lifestyle carbon is Masley’s location baseline plus home, driving, diet, and flying annual factors, normalized to the same time window. Burger production is a visual metaphor using `1 burger ≈ 3 kg CO₂e`; the displayed kg CO₂e values and AI uncertainty range are authoritative.

Prompt input tokens are estimated for context at roughly four characters per token and are not added to the AI result.

The original car/globe exploration remains in `src/scene/` and `models/` as legacy prototype material but is no longer loaded by the application.
