# Burger Works linear conveyor design QA

## Visual truth and evidence

- Source state A: `inspiration/grok-image-0c6b0798-8a3c-4e55-bd8b-e881d39a4e79.jpg` (2128 × 912 px, empty twin conveyor).
- Source state B: `inspiration/grok-image-e9595d59-82b5-4a93-9d10-cb70c235c261.jpg` (2128 × 912 px, populated twin conveyor).
- Selected production source: `assets/burgerbelt2.jpg` (2128 × 912 px), with the longer vanishing-point run and built-in black machinery displays. The checked-in runtime copy is `public/assets/burger-works/burgerbelt2.jpg`.
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
- State: typical 30-day synthetic scenario, AI usage on the left, lifestyle total on the right, single empty-to-complete production batch.

## Full-view comparison

- Pass — the implementation uses Burger Belt 2 directly, preserving its longer perspective, yellow rails, stainless housings, warm restaurant palette, centered vanishing point, and photographed display recesses without recreated CSS or vector artwork.
- Pass — both burger paths follow the straight belt centerlines from the vanishing point to the foreground. Burger scale growth matches the source perspective and the foreground crops naturally at the stage edge.
- Pass — the intentional product-state difference from the filled source is clear: identical burgers remain sparse on the AI line and dense on the lifestyle line, so throughput rather than decoration becomes the comparison.
- Pass — every burger advances linearly in lane time, then one fractional-linear planar projection derives its angled screen x, contact y, apparent scale, and depth order. Distant screen motion is slower and the same belt velocity accelerates visibly toward the camera.
- Pass — one selected comparison window fits the 48.8-second Burger Blitz soundtrack. Both belts begin empty; exact output sets launch cadence, each belt fills aligned rows across its width before accelerating, and both final rows clear with the end of the music. In the typical state, the fractional AI marker traverses for 48.8 seconds while the denser three-wide lifestyle rows traverse in about 4.44 seconds.
- Pass — the calibrated projection now governs the photographed belt and its below-frame continuation without an exit-speed discontinuity. A tracked row increased from about 86 px/s in the distance to 518 px/s at the visible foreground; all samples remained at opacity 1 and continued well below the 535 px stage bottom before removal.
- Pass — the sparse and packed paths were recalibrated to Burger Belt 2's asymmetric rail geometry. Linear fits through the photographed surface centers run from 48.4% to 21.6% on the left and 55.8% to 83.3% on the right. Only packed three-wide rows receive the separate 0.5% outward rail-clearance nudge at the back.
- Pass — burger bottoms, rather than sprite centers, are anchored to the plane. The populated desktop line carries ten aligned rows of three; 24 burgers intersected the visible stage with measured row clearances widening from 11.9 px in the distance to 35.8 px in the foreground and zero intersections. Compact rows run two-wide with zero intersections.
- Pass — same-row spacing is derived from each sprite's rendered width plus a rail-safe gap that opens with the photographed belt. Desktop horizontal gaps grow from about 5 px at the distant row to 11–12 px at the foreground; compact gaps widen proportionally. Packed rows receive a small inward-only rear offset so neither outer burger rides the converging rail. The distant scale remains 0.14 so the first burgers are readable without changing the established foreground size.
- Pass — live compact CO₂ totals and production pace are centered inside the photographed black machinery displays, outside both motion paths. At the 1203.2 × 515.7 px desktop stage the overlays measure 113.5 × 44.7 px and 112.3 × 44.7 px; at the 366 × 156.9 px compact stage they remain visible at about 34 × 13.5 px. Exact burger-equivalent totals and the soundtrack-length density-first explanation remain below the stage.
- Pass — the 1280 × 900 page maintains the existing Burger Works hierarchy: exact carbon values first, moving production second, compact controls third.

## Required fidelity surfaces

- Fonts and typography: passed. Existing Burger Works display/body hierarchy remains intact; pace labels, 718× comparison, kg CO₂e values, and small methodology copy remain readable without awkward wrapping or truncation.
- Spacing and layout rhythm: passed. The 2128:912 stage ratio matches both sources; labels clear the lanes; the new output strip aligns to the stage and the replay controls remain visually secondary.
- Colors and visual tokens: passed. The source's warm yellow/red industrial palette remains visible while the existing cyan/amber semantic accents identify AI and lifestyle without recoloring the supplied image.
- Image quality and asset fidelity: passed. The source background is used at its native composition; the existing transparent burger asset is sharp, halo-free, and perspective-scaled. No placeholder, CSS-drawn, SVG-drawn, or emoji assets are present.
- Copy and content: passed. The typical state states “30 days become one 49-second track,” preserves the exact output ratio, explains that the busier lane fills up to three-wide before belt speed rises, and identifies the persistent slow marker. Numeric totals remain authoritative. Near-zero totals use “Below visual threshold.”
- Icons and controls: passed. Existing supplied brand image and established text controls are retained; disabled Energy and Water modes remain clearly marked “soon.”
- Accessibility: passed for this iteration. Semantic buttons/dialogs/labels remain keyboard reachable, alt text describes the conveyor image, reduced-motion rules remain present, and text contrast remains legible over dark panels.

## Responsive and interaction QA

- 390 × 844: passed with document `scrollWidth` equal to 390 px. The compact line carries up to three aligned rows of two; 1.8 seconds of timed sampling retained 2.4 px of full-bounding-box clearance with zero intersections while four to six burgers remained visibly in frame.
- Live desktop-to-compact resize: passed without reload. The `ResizeObserver` changed the populated-line capacity from thirty three-wide burgers to six two-wide burgers, then restored the desktop arrangement.
- Big/big stress state: passed at 816 kg versus 887 kg CO₂e. Mirrored lanes use the same projective path; their close rates produce correspondingly close cadences and belt velocities.
- Small/idle threshold state: passed at effectively 0 g versus 0 g. Both lanes remain empty, the comparison reads “Both totals are below the visual threshold,” and no phantom burger is seeded.
- Swap: passed; entity labels, colors, values, and production rates exchange lanes.
- Methodology open/close: passed.
- Synthetic scenario change: passed; light and typical states update values and restart the lines.
- Lifestyle component selection: passed; diet changes the right value and pace, then total restores the full comparison.
- Profile input change/reset: passed; driving changes the right pace immediately and restart logic uses the new rate.
- Replay batch: passed; the initial stage waits empty for a user start, both LED panels flash during a 900 ms systems check, burgers enter only from the back, the LED totals rise from zero during the 48.8-second run, and the final state holds after the last burgers fall beyond the foreground.
- Soundtrack: passed structural and media validation. The 48.8-second Burger Blitz MP3 is queued by default and silently primed on the Start batch gesture so browser media policy is satisfied; after the 900 ms LED flash it resets to zero and becomes audible on the same frame as belt motion. Replay batch repeats that sequence, and the track does not loop. The Music control arms or disarms the next round without starting it independently. At 390 px, Music and Replay remain visible without overlap or horizontal overflow.
- Swap: passed; populated and sparse lane cadence, speed, labels, and values exchange sides while each lane retains its independently fitted projective path.
- Chrome parity: passed after replacing the fixed 88 px/62 px sprite widths with an 11% stage-relative width. At equal belt depth, burger-to-stage proportions now remain constant across Chrome window sizes while the intentional desktop/compact column breakpoint remains discrete; the larger calibration keeps both browser views legible without returning to fixed pixel sizing.
- Console warnings/errors: none.

## Comparison history

- First normalized pass: no actionable P0/P1/P2 mismatch. The source and implementation were compared together at 1203 × 516 px. The unequal burger density and UI labels are intentional product behavior, not fidelity drift.
- Motion correction pass — P1 resolved. The supplied 1660 px reference showed rate-dependent belt timing and foreground burger overlap. The implementation now uses one fixed travel duration, a perspective-compensated screen path, a lower sparse-rate floor, and responsive capacity spacing. Two timed post-fix captures at 1660 × 1094 show the burgers progressing without bunching; the 390 × 844 capture confirms the compact cap.
- Shared-clock physics pass — P1 resolved. Independent Web Animations could not guarantee a single physical belt or frame-rate-independent headway. They were replaced by one requestAnimationFrame simulation with absolute birth times, fixed world speed, projective camera mapping, perceptual velocity compensation, bottom-contact anchoring, responsive lane capacity, and deterministic catch-up. Typical, big/big, compact, and below-threshold browser states all passed with no console warnings or errors.
- Rate-and-velocity pass — P1 resolved. Density-only compression reduced the typical comparison to roughly four visible positions and flattened perspective velocity. The current model maps the full window to the soundtrack, fills synchronized two- or three-wide rows before accelerating the saturated lane, keeps one slow marker visible, follows the user-marked perspective paths, retains full opacity through off-screen exit, and solves each lane's final row for the same 48.8-second completion.
- Perspective-headway pass — P1 resolved. Sprite scale previously used much stronger perspective than forward position, so rear burgers appeared to consume the gap even though their centers never passed. Position, column spread, and the below-frame exit now share one continuous belt-plane projection; sprite growth is gently eased from that same depth coordinate to preserve its visible silhouette headway. Every tracked following-distance sequence increased frame by frame; desktop and compact stress sampling retained zero intersections.
- Dense-balance pass — P1 resolved. The six-row desktop cap left avoidable foreground space on the high-output line. The cap is now ten synchronized rows of three: exact cadence remains 4.93 burgers per second while belt travel slows to about 5.96 seconds before any further rate increase is represented as velocity.
- Full-range layout pass — P1 resolved. The timing model treats the belt as a finite 10 × 3 surface rather than selecting columns only when a single file overflows. One burger per month takes the full soundtrack to traverse; rising output progressively occupies one, two, then three columns and then shortens travel just enough for the final row to clear on time. At 300 burgers per month, the packed lane traverses in about 4.4 seconds while its last row still exits at 48.8 seconds.
- Size-aware row-fan pass — P1 resolved. Fixed column coordinates allowed sprite growth to consume horizontal gaps near the camera, while the first distant burgers were too small. Column centers now use the measured CSS sprite width at runtime plus a visual gap that expands from 0.5% to 1% of stage width. The distant three-wide footprint narrowed from about 70 px to 56 px and cleared the converging center rail; timed desktop and compact sampling retained widening gaps, one persistent slow marker, and zero intersections.
- Burger Belt 2 integration pass — P1 resolved. The extended source changed both rail angles and machinery-panel positions. Each belt now has its own least-squares centerline rather than a mirrored path: 48.4% → 21.6% on the left and 55.8% → 83.3% on the right; the 30 populated sprites retained zero intersections. Live readouts were measured into the photographed black windows, with the right value centered by the panel's actual 6.7% inset rather than by mirroring the left housing, then lowered 0.85% to sit optically centered in both recesses.
- Focused-region comparison used the full conveyor stage at 1660 px wide because motion path, apparent speed, size growth, and center-to-center spacing are all readable there. The full-page capture separately verifies surrounding typography and layout.

## Follow-up polish

- P3 — a future iteration could add a subtle physical belt-motion texture if a real animated asset becomes available; current moving burgers already communicate throughput without fabricating visual art.

## Game setup and playful visual-system pass

- Source reference: `assets/dialog.jpg` (1904 × 1040 px), supplied as the explicit setup-dialog visual target. It was compared side by side with the prototype at the same 1280 × 720 normalized frame.
- Runtime setup evidence: `artifacts/design-qa/burger-works-game-dialog-final.png` (1280 × 720 px).
- Runtime round evidence: `artifacts/design-qa/burger-works-game-stage-final.png` (1280 × 720 px).
- Main-stage source: `public/assets/burger-works/background.jpg` (2128 × 912 px), the supplied burger-and-fries game-show conveyor with exact line geometry and black LED recesses.
- Pass — the setup no longer uses the former dark data-settings sheet. It adopts the reference's saturated red environment, rounded cartoon display type, cream controls, thick cyan/yellow outlines, hard toy-like shadows, multicolor preset chips, bright score panels, and real burger artwork.
- Pass — the source's dominant footprint-number hierarchy is adapted to the product's two-number premise: both 30-day CO₂ estimates update live above the form while the center burger keeps the face-off legible.
- Pass — all core controls work: prompt, model, answer length, daily volume, grid region, lifestyle defaults, driving, flights, opponent choice, and four AI presets. Done computes with the Masley curves and starts the established LED-flash/music/belt sequence.
- Pass — the round begins from empty belts, completes with the 48.8135-second MP3, and returns to the setup dialog after the final sprites clear, with the previous choices retained and the last-round comparison exposed.
- Pass — a full browser-timed run returned to setup after 52.0 seconds from the Done gesture, matching the intended 0.9-second LED pre-roll + 48.814-second song/batch + 1.8-second final-score hold within frame/timer tolerance.
- Pass — the initial modal cannot be dismissed without starting a round; subsequent setup visits include Back to factory. Reopening always resets modal scroll to the scoreboard.
- Pass — at 390 × 844 the form becomes one column, the score panels remain visible with wrapped values, the sticky start action remains reachable, and no horizontal clipping appears.
- Pass — the reference and implementation use actual raster assets rather than fabricated SVG, emoji, placeholder, or CSS-drawn illustration.
- Pass — all 41 unit tests and the production build complete; current browser logs contain no warnings or errors.

## Main arcade-interface pass

- Source reference: `assets/interfaceinspiration.jpg` (1904 × 1040 px), supplied as the explicit main-interface target.
- Ready-state evidence: `artifacts/design-qa/burger-works-arcade-interface-final.png` (1440 × 1100 px).
- Running-state evidence: `artifacts/design-qa/burger-works-arcade-interface-motion.png` (1440 × 1100 px).
- Pass — the former dark analytical shell is now a cohesive burger-arcade cabinet: glossy red header/footer chrome, cream rounded display lettering with warm outline, yellow score cards, green batch-status panel, cyan start control, red music control, and toy-like hard shadows.
- Pass — the supplied conveyor artwork remains uncropped at its authored aspect ratio and the dynamic LED readouts, projective burger paths, music synchronization, and empty-to-complete batch behavior remain unchanged.
- Pass — exact kg CO₂e values, uncertainty, ratio, burger-equivalent totals, live accumulated LEDs, and batch state remain visible and authoritative inside the playful treatment.
- Pass — at 390 × 844 the scoreboard stacks the shared comparison beneath the two competitors, output cards stay side by side, the green status panel becomes full width, and the two primary controls remain large and reachable without horizontal overflow.
- Pass — maximized Chrome at 2056 × 1080 uses a height-aware stage cap: the complete header, scoreboard, conveyor, output panels, and replay controls fit in exactly 1080 px with document `scrollHeight` equal to `innerHeight` and no horizontal overflow.
- Pass — Start batch advances the soundtrack, timeline, LED totals, stage status, and three-wide production rows together. The browser console contains only Vite development messages and no warnings or errors.
- Pass — the source and implementation were reviewed together in one normalized comparison; the retained utility bar and live numeric scores are intentional functional additions to the supplied reference rather than fidelity drift.
- Arcade-background calibration evidence: `artifacts/design-qa/burger-works-arcade-rail-led-final.png` (1440 × 1100 px), captured with both lines running packed three-wide rows.
- Pass — the new background's horizon divider and lifestyle-belt fan differ from Burger Belt 2. Packed left rows retain their −2.4% rear center correction. Packed right rows keep the accepted 55.2% → 80.8% centerline and compress their distant column spread to 74%. Column spread interpolates through the same projective depth as center position and contact height, so each burger follows a straight photographed belt ray. On the asymmetric lifestyle belt, the left ray remains the visual anchor and both following gaps use the same 0.88 spacing factor; the middle burger therefore remains exactly halfway between its neighbors as the row advances.
- Pass — burger scale runs from 0.14 at the horizon to 1.1 at the photographed foreground edge. This preserves continuous perspective growth while avoiding the oversized foreground ballooning produced by the earlier 1.34 endpoint; column spacing derives from the same endpoints and remains proportional to the smaller physical silhouettes.
- Pass — the LED overlays were remeasured against the new photographed recesses: both use 9.2% stage width, with the cyan counter lowered to 42.65% stage height and the amber counter retained at 41.8%; the left inset is 13.35% and right inset 12.85%. Each recess is a single padded CO₂ counter—pace/day captions are removed, and each value refits from its exact rendered text rather than character count, leaving safe black-window padding as digits change.

final result: passed
