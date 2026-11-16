# Corrective gates before further workflow development

Tracking: [#11](https://github.com/jayanez/spec-torque/issues/11). Behavior fixes belong to [#10](https://github.com/jayanez/spec-torque/pull/10); the behavior-preserving CLI readability change is isolated in [#12](https://github.com/jayanez/spec-torque/pull/12).

| Gate | Required evidence | Disposition |
|---|---|---|
| G0 — reproductions | Original separator/polarity tests and pending-write browser case fail before corrections. | Reproduced locally; no semantic-certification claim. |
| G1 — UI concurrency | Immediate exclusion, delayed workspace response during apply, double activation, blocked edits, failed pending undo, late provider response. | Regression tests pass locally; independent Luna UI review found no outstanding defect in inspected routes. |
| G2 — proposal boundary | Reject CR/LF/U+2028/U+2029 on creation and application, including external HTTP proposals; retain the exact identifier multiset. | Regressions pass. Case-insensitive identifier detection also prevents lowercase IDs disguising removed quantities; Luna verified the final case. |
| G3 — explicit contradictions | Bounded EN/ES negatives, both orders, modality, feature scoping, quoted examples and compatible obligations. | Tests pass; MUST/SHALL and supported DEBE forms retain mandatory force. SHOULD is not silently equated with MUST. |
| G4 — HTTP and simplification | Oversized body yields JSON 413, malformed JSON remains 400, no source write; separate CLI change preserves exit behavior. | HTTP regression passes. Independent CLI branch passed its 27-test baseline/build/packaging. |
| G5 — integration and final review | Core/build/package/audit, browser matrix, real Codex + installed VSIX + Restricted Mode, mutation checks and completed final independent review. | Technical results are recorded in the PR/issue for each exact revision. Final Luna review was interrupted by its usage limit; do not mark G5 complete or merge on the basis of earlier partial reviews. |

## Behavior and compatibility

Application, undo and save share one immediately acquired operation promise. UI controls block mutations while it is pending; asynchronous loaders also check the lock. Results are bound to their starting artifact-set identity. Stale results do not replace active documents; a disk operation whose context changed requires an explicit reload. Read-only history and report views remain usable.

Provider responses are ignored when the source document, revision or finding changes. No provider is contacted by concurrency tests: delayed responses are intercepted locally.

A `PatchProposal` replaces one physical line. All four supported line separators are rejected at the shared preservation boundary, both when creating and applying. Added, removed or duplicated formal identifiers are rejected, including lowercase identifiers; unchanged identifier spelling is preserved. This tightens existing validation without changing the public wire shape. It cannot identify every invented fact or establish semantic equivalence.

Contradiction detection normalizes only declared mandatory forms and explicit `NOT`/`never`, `NO`/`nunca`. It compares matching normalized behavior within one feature. It does not infer general negation from `unless`, `sin` or exclusions; unknown states and dimension scoring rules remain unchanged.

The HTTP size limit remains 6 MB; only the error status changes to 413. Malformed JSON and other invalid inputs retain 400 and the existing `{error}` response shape.

## Verification boundaries

The new single-line, polarity, HTTP status, operation-exclusion and stale-provider protections were deliberately mutated in isolation. The relevant regressions failed; original files were restored. Mutation checks demonstrate those specific tests, not a project-wide mutation score.

The complete browser matrix now contains 54 cases. Local Chromium/WebKit checks cover 36 cases. Firefox on this macOS environment remains blocked at startup; its cases must pass in Linux CI, never be marked skipped to improve results. Native acceptance on other systems, conversational Codex, human accessibility and four-host acceptance remain separate gates.

No general state framework, GoF hierarchy, telemetry or automatic model calls were added. Further features that depend on refinement/state mutation must wait for G5 closure. Reversible implementation decisions do not require an ADR or additional approval flow.
