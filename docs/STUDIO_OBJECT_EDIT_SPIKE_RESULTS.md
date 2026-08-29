# Studio Object-Edit Spike Results

## Status

This report records the product-owner-reviewed object-edit spike evidence through 2026-08-28. It is an internal technical-spike report, not a customer-facing feature claim and not an automatic release decision.

Task 11 is **closed for the current product-direction review under an approved scope variance**. It is not a claim that the original full required matrix or formal evidence-gate requirements were completed:

- **Remove:** the product owner has documented a `go` for future Remove implementation using approach C (canonical plus spatial enrichment), based on the nine reviewed Remove/NB2 cases and the separate approved Remove/NB Pro enquiry. A and B are not selected because their results were inconsistent. This is an implementation-direction decision, not production-release authorization.
- **Move:** the executed NB2 evidence covers cases 01–09; the original case 10 A/B/C group was deliberately not run. Move requires further research and must not be built out as a feature until that research is completed.
- **Add:** one separate, isolated NB2 composition exploration was run outside the protected two-reference production object-edit scope. It showed proportion and preservation defects, so Add remains deferred for proper future investigation.

The approved MVP Remove/NB2 evidence set contains nine reviewed fixture cases. A tenth frozen Remove fixture remains available for follow-up testing. This report and the task plan document a product-owner `go` for Remove using approach C and a current-delivery Move `no_go`; these are implementation-direction decisions, not production/customer-availability controls. Move remains excluded pending further research, while any later Remove implementation must still pass its applicable implementation, verification, and release checkpoints.

## Comparison setup

Every A/B/C group uses the same clean source image, deterministic annotated reference image, accepted selection, operation, model class, configured model identifier, and normalized coordinates.

- **A — annotation only:** Remove instruction plus clean/annotated image pair; no canonical or spatial enrichment.
- **B — canonical enrichment:** A plus the current image's canonical scene, canvas, and food-component state.
- **C — canonical plus spatial enrichment:** B plus current, unambiguous, image-bound spatial inventory for the selected element.

The only intended A/B/C difference is this enrichment. Each provider output is retained in protected internal storage and the local review copies are SHA-256 verified against the frozen batch records.

## Product-owner reviewed Remove/NB2 results

| Case | A | B | C |
| --- | --- | --- | --- |
| 01 — cheeseburger side salad | Fail | Fail | Pass |
| 02 — chicken-burger foreground bread roll | Pass | Pass | Pass |
| 03 — rogan-josh front-left fork | Fail | Pass | Pass |
| 04 — fish-tacos beer glass/bottle | Pass | Pass | Pass |
| 05 — Hainanese utensils | Fail | Fail | Pass |
| 06 — beef-and-mash second dish | Fail | Fail | Pass |
| 07 — pizza-board holder | Fail | Fail | Pass |
| 08 — roast-beef blue napkin | Fail | Fail | Pass |
| 09 — salmon meal milk glass | Fail | Fail | Pass |

## Observed pattern

The product owner observed that A and B can succeed when the target is clear, distinct, or separate from surrounding content. C passed each of the nine reviewed cases and is notably more robust for ambiguous, overlapping, or context-dependent targets.

This supports the future Remove direction of using C enrichment. It does **not** establish a deterministic quality guarantee, does not substitute for the required audited human decision and spatial-usefulness finding, and does not authorize customer availability by itself.

## NB Pro Hainanese enquiry (completed)

The separately approved `remove-05-hainanese-utensils` Remove/NB Pro A/B/C enquiry ran on 2026-08-28 with requested model class `nb_pro` and configured model identifier `gemini-3-pro-image`.

| Variant | Outcome | Retained evidence |
| --- | --- | --- |
| A | Provider error (`IMAGE_RECITATION`) | No generated or failure artifact returned; explicit absence retained. |
| B | Generated | Protected output artifact and SHA-256-verified local review copy retained. |
| C | Generated | Protected output artifact and SHA-256-verified local review copy retained. |

The provider-reported model identity is absent in the immutable run records for all three requests. The runtime logger showed an unexpected Flash model-version value for the generated responses, but this was not retained as provider identity and is not treated as proof of which model served the response. The report therefore records only the requested/configured Pro model and the provider-identity absence.

This incomplete comparison is separate from NB2 evidence and does not alter the Remove direction or create an automatic decision. The product-owner review found B to be a failure and C to be a pass, with the qualification that C erroneously removed cucumber slices beneath the cutlery. This makes the NB2 C result slightly better for this specific fixture. These findings remain evidence only; no operation decision or spatial-usefulness finding was recorded.

## Product-owner reviewed Move/NB2 results

| Case | A | B | C |
| --- | --- | --- | --- |
| 01 — cheeseburger tomatoes | Fail | Fail | Fail |
| 02 — chicken-burger pickles | Fail | Fail | Fail |
| 03 — rogan-josh chilli | Pass | Pass | Pass |
| 04 — fish-tacos lime wedges | Partial pass | Partial pass | Partial pass |
| 05 — Hainanese utensils | Void (transport error; no artifact) | Partial pass | Partial pass |
| 06 — beef-and-mash Brussels sprouts | Partial pass | Partial pass | Fail |
| 07 — pizza basil | Fail | Partial pass | Partial pass |
| 08 — roast-beef knife | Fail | Void (transport error; no artifact) | Partial pass |
| 09 — salmon meal milk glass | Pass | Pass | Pass |

The product-owner’s review does not support the current Move requirement as evidence for general user cases. Only case 09 passed consistently, and its milk-glass target is visually distinct and spatially separated from the meal; this is not representative of many intended user selections. Case 03 also passed across variants, but the broader set contains failures or partial passes for overlapping, contextual, or less separable targets. The two recorded `Void` outcomes are frozen no-artifact transport failures and were deliberately not retried, to retain the approved batch boundaries.

This evidence raises material doubt about the Move requirement’s general viability with NB2. The original case 10 A/B/C group remains deliberately unexecuted under the approved scope variance. On this evidence, the product owner has documented a current-delivery Move `no_go`: Move must not be progressed into feature delivery, and any reconsideration requires separate research and a new plan. This documentation decision does not create a customer release, API request, database record, operation-control update, or spatial-usefulness finding.

## NB Pro Move confirmation (completed; product-owner reviewed)

The separately approved Move/NB Pro confirmation for `move-01-cheeseburger-tomatoes` and `move-04-fish-tacos-limes` ran on 2026-08-28. It used the unchanged frozen Move inputs, selections, destinations, and A/B/C enrichment variants, changing only the requested model class to `nb_pro` and configured model identifier to `gemini-3-pro-image`.

| Case | A | B | C | Artifact status |
| --- | --- | --- | --- | --- |
| 01 — cheeseburger tomatoes | Fail | Fail | Fail | SHA-256 verified |
| 04 — fish-tacos lime wedges | Partial pass | Partial pass | Partial pass | SHA-256 verified |

All six approved requests completed with generated artifacts. The immutable records retain no provider-reported model identity; runtime logs displayed an unexpected Flash model-version string and are not treated as proof of the serving model. The confirmation did not overturn the earlier concern: NB Pro failed every variant for the cheeseburger target and reached only partial passes for the fish-tacos target. These are product-owner technical-spike findings only; no Move release decision or spatial-usefulness finding has been recorded.

## Separate Add exploration (deferred)

The user-approved `cheeseburger-red-pepper-addition-nb2-01` experiment used a clean cheeseburger scene, a destination-guide image, and a red-pepper reference in a separate generic three-reference request. It is explicitly outside the protected production `studio_object_edit` contract, which accepts only Image A (clean source) and Image B (annotation).

The returned result visibly inserted an oversized pepper and materially reframed the scene. This is exploratory evidence of preservation and proportion defects, not a production-scope result or formal pass/fail outcome. Add remains deferred pending a dedicated research plan and evaluation criteria.

## Task 11 product-owner direction and scope variance

The product owner has directed this closeout based on the reviewed evidence:

1. Retain **Remove/C** as the selected implementation direction for later Remove work; do not select A or B because their results were inconsistent. This is a documented implementation `go`, not production-release authorization.
2. Record **Move** as a current-delivery `no_go`. The case 01–09 NB2 and limited NB Pro evidence is retained, but case 10 was intentionally not executed and no Move feature work should begin until further research is completed.
3. Defer **Add**. The red-pepper experiment is retained solely as exploratory evidence and does not alter the protected two-reference object-edit path.
4. Task 12 is complete as a documentation-level product-direction decision. No production availability, Release Control, or customer-facing implementation is enabled by this report; future Remove implementation and release work remains separately gated.

Accordingly, the report/evidence-review portion of Task 11 and the documentation-level Task 12 product-direction decision are closed. The original full-Move-matrix and formal evidence-gate completeness requirements remain explicitly waived/deferred rather than passed; Move is excluded, while Remove/C is the selected direction for any future implementation work.

## Evidence locations

- Frozen Remove/NB2 batches: `.kiro/specs/studio-object-selection-remove-move/test-images/results/remove-nb2-batch-01.json` through `remove-nb2-batch-03.json`
- Frozen Remove/NB Pro enquiry: `.kiro/specs/studio-object-selection-remove-move/test-images/results/remove-nb-pro-hainanese-01.json`
- Frozen Move/NB2 batches: `.kiro/specs/studio-object-selection-remove-move/test-images/results/move-nb2-batch-01.json` through `move-nb2-batch-03.json`
- Frozen NB Pro Move confirmation: `.kiro/specs/studio-object-selection-remove-move/test-images/results/move-nb-pro-confirmation-01.json`
- Frozen Add exploration: `.kiro/specs/studio-object-selection-remove-move/test-images/results/cheeseburger-red-pepper-addition-nb2-01.json`
- Add review artifact: `.kiro/specs/studio-object-selection-remove-move/test-images/results/cheeseburger-red-pepper-addition-nb2-01.png`
- Local SHA-256-verified review images: `.kiro/specs/studio-object-selection-remove-move/test-images/results/`
- Fixture manifest: `.kiro/specs/studio-object-selection-remove-move/test-images/nb2-spike-manifest.v1.json`

## Disposition

No further Task 11 provider requests are authorized by this closeout. If Move or Add is reconsidered, start a new, explicitly approved research plan rather than treating the deferred evidence as a delivery gate. Task 12 and all later implementation/release tasks remain pending; no production object-edit availability has been enabled.
