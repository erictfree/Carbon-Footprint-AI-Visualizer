# Burger Works design QA

## Visual target

- Reference: `artifacts/design-qa/burger-works-reference.png`
- Verified implementation: `artifacts/design-qa/burger-works-final.png`
- Matched comparison viewport: 1586 × 992
- State: typical mixed 30-day synthetic scenario, lifestyle total, AI on the left

## Comparison findings

- Pass — preserves the dark premium factory diorama, cyan/amber entity split, large exact values, centered ratio, side-by-side factories, balance, and packing hierarchy.
- Pass — intentionally separates the user’s revised concepts: continuous outward ramp flow represents relative rate; the center balance holds packed totals.
- Pass — small/large state is immediately legible: the AI line emits a sparse stream and a tiny balance load, while the lifestyle line runs rapidly and packs into crates.
- Pass — exact kg CO₂e, uncertainty range, ratio, literal daily pace, burger equivalence, and synthetic-data status remain visible.
- Pass — Burger Works naming is consistent in the page, document metadata, package metadata, PWA manifest, and README.
- Pass — no visible placeholder assets, broken image crops, horizontal overflow, console errors, or clipped desktop controls.
- Pass — 390 × 844 responsive check reports viewport-width layout with no horizontal document overflow; core data controls remain accessible through the compact Data button.

## Functional QA

- Continuous slow rate loop: passed
- Upright burgers closely track both conveyor centerlines without tumbling, then fall beyond the stage edge: passed
- Rate mapping: passed (spacing and travel speed both rise with CO₂; traversals remain capped at 9.5–15 seconds)
- Restart rate loop: passed
- Swap sides: passed
- Lifestyle component selection: passed
- Lifestyle profile controls: passed
- Synthetic scenario loading: passed
- Billion-token stress scenario: passed (816 kg CO₂e versus 887 kg CO₂e, 2.7 versus 3.0 crates)
- Local CSV import and manual mapping paths: passed by existing automated coverage
- Methodology dialog and source link: passed
- Browser console warnings/errors: none
- Production build: passed
- Automated tests: 23 passed

final result: passed
