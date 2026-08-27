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
- Shared-clock physics evidence: `artifacts/design-qa/burger-works-physics-typical-a.png`, `artifacts/design-qa/burger-works-physics-typical-b.png`, and `artifacts/design-qa/burger-works-physics-big-big.png` (1660 × 1094 px), plus `artifacts/design-qa/burger-works-physics-mobile.png` (390 × 844 px).
- Cross-browser physics evidence: `artifacts/design-qa/burger-works-physics-chrome.png` (1200 × 1032 CSS px at device pixel ratio 2).
- Rate-and-perspective evidence: `artifacts/design-qa/burger-works-rate-physics.png` (1280 × 720 px) and `artifacts/design-qa/burger-works-rate-physics-mobile.png` (390 × 844 px), showing the typical 718× state with one sparse AI burger and a populated lifestyle line.
- Browser viewports: 1280 × 900 for the original layout pass, 1660 × 1094 for the motion pass, and 390 × 844 for compact QA; captures resolve to one screenshot pixel per CSS pixel.
- Stage CSS bounds: 1203.2 × 515.7 px, locked to the source 2128:912 aspect ratio.
- State: typical 30-day synthetic scenario, AI usage on the left, lifestyle total on the right, continuous line running after steady-state prefill.

## Full-view comparison

- Pass — the implementation uses the supplied empty-conveyor image directly, preserving the source perspective, yellow rails, stainless housings, warm restaurant palette, and centered vanishing point without recreated CSS or vector artwork.
- Pass — both burger paths follow the straight belt centerlines from the vanishing point to the foreground. Burger scale growth matches the source perspective and the foreground crops naturally at the stage edge.
- Pass — the intentional product-state difference from the filled source is clear: identical burgers remain sparse on the AI line and dense on the lifestyle line, so throughput rather than decoration becomes the comparison.
- Pass — every burger advances linearly in lane time, then one fractional-linear planar projection derives its angled screen x, contact y, apparent scale, and depth order. Distant screen motion is slower and the same belt velocity accelerates visibly toward the camera.
- Pass — one selected comparison window maps to one playback minute. Exact output sets launch cadence; each belt remains at the 60-second base traversal while density is available, then accelerates only enough to preserve physical headway. In the typical 718× state, the AI lane takes 60 seconds to traverse while the full lifestyle lane takes about 1.07 seconds.
- Pass — tracked lifestyle motion increased from about 593 px/s in the distance to 972 px/s during the foreground exit. Every one of 58 samples remained at opacity 1; the final tracked bounding box began at y=636 px, fully below the 535 px stage bottom, before removal.
- Pass — the user-supplied white-line reference calibrated the straight lane centers: 46.8%/53.2% at the vanishing point, 16.8%/83.2% at the foreground edge, with a collinear continuation until the sprites clear the bottom.
- Pass — burger bottoms, rather than sprite centers, are anchored to the plane. The populated desktop line carries five to six active burgers, with a measured minimum full-bounding-box clearance of 26.7 px; compact capacity drops to three and retained at least 25.0 px.
- Pass — pace labels sit outside both motion paths. Exact burger-equivalent totals and the one-minute density-first explanation sit below the stage, keeping belt exits unobstructed.
- Pass — the 1280 × 900 page maintains the existing Burger Works hierarchy: exact carbon values first, moving production second, compact controls third.

## Required fidelity surfaces

- Fonts and typography: passed. Existing Burger Works display/body hierarchy remains intact; pace labels, 718× comparison, kg CO₂e values, and small methodology copy remain readable without awkward wrapping or truncation.
- Spacing and layout rhythm: passed. The 2128:912 stage ratio matches both sources; labels clear the lanes; the new output strip aligns to the stage and the replay controls remain visually secondary.
- Colors and visual tokens: passed. The source's warm yellow/red industrial palette remains visible while the existing cyan/amber semantic accents identify AI and lifestyle without recoloring the supplied image.
- Image quality and asset fidelity: passed. The source background is used at its native composition; the existing transparent burger asset is sharp, halo-free, and perspective-scaled. No placeholder, CSS-drawn, SVG-drawn, or emoji assets are present.
- Copy and content: passed. The typical state states “30 days = 1 minute,” preserves the exact 718× output cadence, and explains that the busier lane fills its available density before belt speed rises. Near-zero totals use “Below visual threshold” instead of fabricating an implausibly long production interval.
- Icons and controls: passed. Existing supplied brand image and established text controls are retained; disabled Energy and Water modes remain clearly marked “soon.”
- Accessibility: passed for this iteration. Semantic buttons/dialogs/labels remain keyboard reachable, alt text describes the conveyor image, reduced-motion rules remain present, and text contrast remains legible over dark panels.

## Responsive and interaction QA

- 390 × 844: passed with document `scrollWidth` equal to 390 px. The compact line caps at three burgers; 1.1 seconds of timed sampling retained 25.0 px of full-bounding-box clearance while two to three burgers remained visibly in frame.
- Live desktop-to-compact resize: passed without reload. The `ResizeObserver` changed the populated-line capacity from six to three, then restored six at desktop width.
- Big/big stress state: passed at 816 kg versus 887 kg CO₂e. Mirrored lanes use the same projective path; their close rates produce correspondingly close cadences and belt velocities.
- Small/idle threshold state: passed at effectively 0 g versus 0 g. Both lanes remain empty, the comparison reads “Both totals are below the visual threshold,” and no phantom burger is seeded.
- Swap: passed; entity labels, colors, values, and production rates exchange lanes.
- Methodology open/close: passed.
- Synthetic scenario change: passed; light and typical states update values and restart the lines.
- Lifestyle component selection: passed; diet changes the right value and pace, then total restores the full comparison.
- Profile input change/reset: passed; driving changes the right pace immediately and restart logic uses the new rate.
- Restart lines: passed; the typical state immediately seeds one sparse AI burger and up to six separated lifestyle burgers on desktop (three on compact screens) before continuous cadence resumes.
- Swap: passed; populated and sparse lane cadence, speed, labels, and values exchange sides while the projective path remains mirrored.
- Chrome parity: pending refresh after the exact-rate and white-line path pass.
- Console warnings/errors: none.

## Comparison history

- First normalized pass: no actionable P0/P1/P2 mismatch. The source and implementation were compared together at 1203 × 516 px. The unequal burger density and UI labels are intentional product behavior, not fidelity drift.
- Motion correction pass — P1 resolved. The supplied 1660 px reference showed rate-dependent belt timing and foreground burger overlap. The implementation now uses one fixed travel duration, a perspective-compensated screen path, a lower sparse-rate floor, and responsive capacity spacing. Two timed post-fix captures at 1660 × 1094 show the burgers progressing without bunching; the 390 × 844 capture confirms the compact cap.
- Shared-clock physics pass — P1 resolved. Independent Web Animations could not guarantee a single physical belt or frame-rate-independent headway. They were replaced by one requestAnimationFrame simulation with absolute birth times, fixed world speed, projective camera mapping, perceptual velocity compensation, bottom-contact anchoring, responsive lane capacity, and deterministic catch-up. Typical, big/big, compact, and below-threshold browser states all passed with no console warnings or errors.
- Rate-and-velocity pass — P1 resolved. Density-only compression reduced the typical 718× comparison to roughly four visible positions and flattened perspective velocity. The current model maps the full window to one minute, preserves exact launch cadence, fills safe density first, accelerates only the saturated lane, follows the user-marked straight centerlines with an uncompensated projective path, and retains full opacity through off-screen exit.
- Focused-region comparison used the full conveyor stage at 1660 px wide because motion path, apparent speed, size growth, and center-to-center spacing are all readable there. The full-page capture separately verifies surrounding typography and layout.

## Follow-up polish

- P3 — a future iteration could add a subtle physical belt-motion texture if a real animated asset becomes available; current moving burgers already communicate throughput without fabricating visual art.

final result: passed
