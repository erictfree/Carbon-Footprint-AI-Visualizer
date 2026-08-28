# Dialog design QA

## Evidence

- Source visual truth: `/Users/ericfreeman/Documents/Codex/Masley 3D/assets/dialog.jpg`
- Final implementation: `/Users/ericfreeman/Documents/Codex/Masley 3D/artifacts/audit/dialog-implementation-1904x1040.png`
- Full-view comparison: `/Users/ericfreeman/Documents/Codex/Masley 3D/artifacts/audit/dialog-reference-vs-implementation.png`
- Focused lifestyle-panel comparison: `/Users/ericfreeman/Documents/Codex/Masley 3D/artifacts/audit/dialog-left-reference-vs-implementation.png`
- Responsive implementation: `/Users/ericfreeman/Documents/Codex/Masley 3D/artifacts/audit/dialog-responsive-default.png`
- Source pixels: 1904 × 1040.
- Implementation pixels: 1904 × 1040.
- CSS viewport: 1904 × 1040 with a 1:1 screenshot density; no density normalization was needed.
- Responsive check: the in-app browser's default 870 × 1133 viewport.
- State: setup dialog open with Masley defaults.

## Full-view comparison

The implementation now uses the source's dominant composition: a nearly edge-to-edge red arcade board, a larger lifestyle panel on the left, an AI control panel on the right, oversized live carbon totals, cream controls with colored frames, multicolor summary bars, yellow action controls, and supplied burger artwork. The live product content intentionally replaces the source's static “Personal cuts” content.

## Focused comparison

The lifestyle-panel crop confirms that the headline, score, green period badge, tabbed cream inputs, colored category rows, rounded borders, and heavy shadows follow the source at readable scale. A focused crop was necessary because these control and typography details were too small in the full-width side-by-side image.

## Required fidelity surfaces

- Fonts and typography: rounded heavy system typography, outlined white headlines, tabular oversized scores, compact uppercase labels, and strong numeric hierarchy match the source's cartoon treatment. The source's exact hand-lettered font is embedded in the raster reference and unavailable as an isolated asset; the rounded system face is an acceptable P3 approximation.
- Spacing and layout rhythm: the final viewport is edge-to-edge, both panels share aligned top and bottom edges, the lifestyle panel is slightly wider, and control groups use consistent compact spacing. The responsive version stacks panels without shrinking desktop controls.
- Colors and visual tokens: saturated arcade red, cream control surfaces, gold borders, cyan AI accents, green period badge, and multicolor contribution bars closely match the reference palette and contrast.
- Image quality and asset fidelity: the implementation reuses the supplied high-resolution burger and Burger Works background assets. The reference's baked-in car and fry illustrations are not replaced with code drawings; they are omitted because they are not available as isolated assets and do not represent this product's inputs.
- Copy and content: product-specific copy remains accurate: lifestyle versus AI, 30-day totals, Masley defaults, live component totals, per-model energy, and the working batch CTA. Reference-only “Personal cuts” actions were intentionally not copied.

## Comparison history

### Iteration 1

- Evidence: `/Users/ericfreeman/Documents/Codex/Masley 3D/artifacts/audit/dialog-iteration-1-1904x1040.png`
- Finding [P1]: the board was constrained to a centered 1540 px modal, leaving large dark margins and weakening the reference's full-screen arcade composition.
- Fix: expanded the setup board to the full viewport, reduced the conventional header, widened the footprint side, and increased the score scale.

### Iteration 2

- Evidence: `/Users/ericfreeman/Documents/Codex/Masley 3D/artifacts/audit/dialog-iteration-2-1904x1040.png`
- Finding [P2]: both panels had large unused lower regions because the real product has fewer form fields than the reference mockup.
- Fix: added non-interactive, live Masley component rows to the footprint panel and live per-model request/energy rows to the AI panel. These explain existing totals without reintroducing the removed footprint selector.

### Post-fix

- Evidence: `/Users/ericfreeman/Documents/Codex/Masley 3D/artifacts/audit/dialog-reference-vs-implementation.png`
- Result: no actionable P0, P1, or P2 mismatch remains. The remaining illustration and exact-font differences are acceptable P3 consequences of using the supplied isolated assets and accurate product content.

## Interaction and implementation checks

- Light-chat preset changed the AI preview from `0.63 kg CO₂e` to `5 g CO₂e`; Masley default restored it.
- Region change updated the lifestyle preview from `1.32 t CO₂e` to `1.22 t CO₂e`; Masley defaults restored it.
- “Done · start round” closed the dialog and placed the factory in pre-roll.
- “New round” reopened the setup board.
- Browser console errors: none.
- Automated tests: 46 passed.
- Production build: passed.

## Follow-up polish

- P3: if isolated fry or vehicle artwork becomes available, it can replace the second burger mascot without changing the layout.

final result: passed
