# Burger Works linear conveyor design QA

## Visual truth and evidence

- Source state A: `inspiration/grok-image-0c6b0798-8a3c-4e55-bd8b-e881d39a4e79.jpg` (2128 × 912 px, empty twin conveyor).
- Source state B: `inspiration/grok-image-e9595d59-82b5-4a93-9d10-cb70c235c261.jpg` (2128 × 912 px, populated twin conveyor).
- Density-normalized sources: `artifacts/design-qa/linear-reference-empty-1203x516.jpg` and `artifacts/design-qa/linear-reference-filled-1203x516.jpg`.
- Stage implementation: `artifacts/design-qa/burger-works-linear-stage-final.png` (1203 × 516 px).
- Full-page implementation: `artifacts/design-qa/burger-works-linear-page-final.png` (1280 × 900 px).
- Motion issue reference: `artifacts/design-qa/burger-works-motion-reference.png` (1660 × 1062 px), supplied browser capture showing foreground bunching.
- Corrected motion evidence: `artifacts/design-qa/burger-works-motion-pass-a.png`, `artifacts/design-qa/burger-works-motion-pass-b.png`, and `artifacts/design-qa/burger-works-motion-final.png` (1660 × 1094 px).
- Compact implementation: `artifacts/design-qa/burger-works-motion-mobile.png` (390 × 844 px).
- Browser viewports: 1280 × 900 for the original layout pass, 1660 × 1094 for the motion pass, and 390 × 844 for compact QA; captures resolve to one screenshot pixel per CSS pixel.
- Stage CSS bounds: 1203.2 × 515.7 px, locked to the source 2128:912 aspect ratio.
- State: typical 30-day synthetic scenario, AI usage on the left, lifestyle total on the right, continuous line running after steady-state prefill.

## Full-view comparison

- Pass — the implementation uses the supplied empty-conveyor image directly, preserving the source perspective, yellow rails, stainless housings, warm restaurant palette, and centered vanishing point without recreated CSS or vector artwork.
- Pass — both burger paths follow the straight belt centerlines from the vanishing point to the foreground. Burger scale growth matches the source perspective and the foreground crops naturally at the stage edge.
- Pass — the intentional product-state difference from the filled source is clear: identical burgers remain sparse on the AI line and dense on the lifestyle line, so throughput rather than decoration becomes the comparison.
- Pass — both lanes now share one fixed 18-second travel time. Calibrated keyframe offsets counter the source image's perspective acceleration as burgers approach the viewer; production rate changes launch cadence only.
- Pass — a capacity interval limits the desktop lane to four burgers and the compact lane to three. The two timed 1660 px captures preserve visible center-to-center separation through the foreground instead of allowing larger burgers to stack.
- Pass — pace labels sit outside both motion paths. Exact burger-equivalent totals and the log-compression explanation sit below the stage, keeping belt exits unobstructed.
- Pass — the 1280 × 900 page maintains the existing Burger Works hierarchy: exact carbon values first, moving production second, compact controls third.

## Required fidelity surfaces

- Fonts and typography: passed. Existing Burger Works display/body hierarchy remains intact; pace labels, 718× comparison, kg CO₂e values, and small methodology copy remain readable without awkward wrapping or truncation.
- Spacing and layout rhythm: passed. The 2128:912 stage ratio matches both sources; labels clear the lanes; the new output strip aligns to the stage and the replay controls remain visually secondary.
- Colors and visual tokens: passed. The source's warm yellow/red industrial palette remains visible while the existing cyan/amber semantic accents identify AI and lifestyle without recoloring the supplied image.
- Image quality and asset fidelity: passed. The source background is used at its native composition; the existing transparent burger asset is sharp, halo-free, and perspective-scaled. No placeholder, CSS-drawn, SVG-drawn, or emoji assets are present.
- Copy and content: passed. “Belt speed stays fixed; production cadence shows the relative CO₂ rate” now describes the actual motion model; literal paces and exact output totals prevent the compressed cadence from implying false absolute speed.
- Icons and controls: passed. Existing supplied brand image and established text controls are retained; disabled Energy and Water modes remain clearly marked “soon.”
- Accessibility: passed for this iteration. Semantic buttons/dialogs/labels remain keyboard reachable, alt text describes the conveyor image, reduced-motion rules remain present, and text contrast remains legible over dark panels.

## Responsive and interaction QA

- 390 × 844: passed with document `scrollWidth` equal to 390 px. The stage remains on the source aspect ratio; pace labels and moving burgers stay on their lanes; compact capacity drops to three burgers so the enlarged foreground assets remain separated; exact outputs reflow into a two-card row with the explanation below.
- Swap: passed; entity labels, colors, values, and production rates exchange lanes.
- Methodology open/close: passed.
- Synthetic scenario change: passed; light and typical states update values and restart the lines.
- Lifestyle component selection: passed; diet changes the right value and pace, then total restores the full comparison.
- Profile input change/reset: passed; driving changes the right pace immediately and restart logic uses the new rate.
- Restart lines: passed; the typical state immediately seeds one sparse AI burger and up to four separated lifestyle burgers on desktop (three on compact screens) before continuous cadence resumes.
- Console warnings/errors: none.

## Comparison history

- First normalized pass: no actionable P0/P1/P2 mismatch. The source and implementation were compared together at 1203 × 516 px. The unequal burger density and UI labels are intentional product behavior, not fidelity drift.
- Motion correction pass — P1 resolved. The supplied 1660 px reference showed rate-dependent belt timing and foreground burger overlap. The implementation now uses one fixed travel duration, a perspective-compensated screen path, a lower sparse-rate floor, and responsive capacity spacing. Two timed post-fix captures at 1660 × 1094 show the burgers progressing without bunching; the 390 × 844 capture confirms the compact cap.
- Focused-region comparison used the full conveyor stage at 1660 px wide because motion path, apparent speed, size growth, and center-to-center spacing are all readable there. The full-page capture separately verifies surrounding typography and layout.

## Follow-up polish

- P3 — a future iteration could add a subtle physical belt-motion texture if a real animated asset becomes available; current moving burgers already communicate throughput without fabricating visual art.

final result: passed
