# E1.2 clarification actionability: calibration run 3

Status: **draft, not frozen.** This document pre-registers a third, separately identified calibration run for the rehearsal in [clarification actionability](clarification-actionability.md), under issue [#65](https://github.com/jayanez/spec-torque/issues/65). It is frozen by the last commit of the pull request that adds it. That commit's SHA-256 values for this file and `tests/fixtures/e12/calibration-run3.json` are posted in #65 with the maintainer's confirmation before any run-3 reviewer call. After the freeze, changes need a dated amendment below.

## Why a third run

Run 2 ended in **no decision** ([run 2](clarification-actionability-run2.md) and its record in #57). R1 passed every gate in calibration and reserve. R2 (`gpt-6-luna`, effort `medium`) failed instability in both: 0.125 and 0.27 in calibration, and 0.29 and 0.125 in the reserve, for EN and ES, against a 0.10 gate. In 18 of the 29 unstable items, R2's majority label still matched R1's. The failure is read as R2's sampling variance at that effort, not as an ambiguous rule. Runs 1 and 2 stand unchanged, and #57 is closed.

Run 3 asks whether a second reviewer with less sampling variance passes the same gates on new items. It changes the second reviewer and nothing else that bears on the labels.

## Second-reviewer selection (exploratory screening)

Two candidates were screened, both on codex-cli 0.170.0: `gpt-6-luna` at effort `high`, and `gpt-6.2-astra` at effort `medium`. The screening is exploratory and outside every gate. It labels the 48-item run-2 reserve packets (`reserve-run2/R2-run1…3`) three times per candidate, with the run-2 revised prompt, in the screening image. Those items have already been labelled by both run-2 reviewers, so screening results are never pooled with any gated run.

On its first run, each candidate matched the keys and R1's labels on every item in both languages, where `gpt-6-luna` at `medium` reached 0.93 and 0.95. Instability needs all three runs and is not yet known.

**Selection rule.** Fixed before screening runs 2 and 3 exist:

1. A candidate is **eligible** if, in both languages, its screening instability is ≤ 0.10. Its accuracy against the keys must also be ≥ 0.90 for every label. Both are measured exactly as the calibration gates measure them, on unrounded values.
2. Among eligible candidates, the one with the lower maximum instability over the two languages is chosen. If that ties, the lower mean instability decides. If that ties too, `gpt-6-luna` at `high` is chosen, because it changes only the effort of the run-2 reviewer.
3. If neither candidate is eligible, run 3 is not started, and #65 records **no decision** for this pilot.

The chosen candidate is R2 for run 3. The runner refuses run-3 R2 calls until it is pinned (`RUN3_R2` in `scripts/precision/calibration/run-reviewer.mjs`), and it is pinned only at the freeze. Neither candidate is ever a coordinator, code reviewer or key reviewer for this work.

## What is unchanged

Everything in the protocol as amended through 2026-11-24, and in run 2 as amended, applies to run 3 except what the next section changes:

- R1: `claude-sonnet-5-5` on Claude Code 2.1.311, at effort `medium`, isolated as amended.
- The reviewer prompt: run 2's revised prompt, unchanged. It is also the live prompt, with SHA-256 `c5a28aecbf6fc09ce8b9d50279cd9a23b746cdb3054e6618e167f9a340ed7464`.
- The rules for judging answers: labels and labelling rules, the quoted-span rule, malformed outputs and transport retries, the majority of three runs, combining, κ, key accuracy and instability.
- The calibration gates: κ ≥ 0.80 per label, accuracy ≥ 90% per reviewer and label, and instability ≤ 10% per reviewer, all per language. Values are compared unrounded, with a float tolerance of 10⁻⁹ only.
- The treatment of `unknown` and `not_applicable`, and the undefined-κ exception.
- The live phase: consent, endpoints, decision rule and live gates.
- Presentation IDs and live seeds. They keep deriving from the frozen protocol SHA-256 `16659f6e…`.

## What changes

**R2.** R2 is the candidate chosen by the selection rule, on codex-cli 0.170.0. It runs isolated as amended, in the screening image built from `scripts/precision/calibration/screen-image/`. The model and effort are passed in, and the runner checks them against the `codex exec` header on every call. The image's `Dockerfile` and `reviewer-config.toml` are pinned by SHA-256 at freeze.

**Calibration items.** `tests/fixtures/e12/calibration-run3.json` holds 144 new constructed responses: two per case and variant, over the same 24 cases. Calibration uses 96 items, 48 per language: each variant's first response for every case, plus one second response per case, rotating across variants. The reserve holds the other 48 items, 24 per language.

No response repeats one shown to the reviewers on the same case in runs 1 or 2, and a test checks this. Keys follow the labelling rules as clarified before run 2. They are reviewed before the freeze by `gpt-6.2-sol`, which is neither R1 nor a candidate for R2. Any key it disputes is rewritten or re-keyed before the freeze. No key changes after any reviewer output exists.

**Seeds.** Run-3 calibration and reserve packets are ordered with seeds derived from this file's frozen SHA-256, using phase `calibration-run3` or `reserve-run3`, by the same rule as before. Item IDs in packets are opaque.

**Retry.** Only a failure caused by answer format allows a retry. Here that means a gate failed because outputs were malformed or quoted spans did not verify. The prompt may then be revised once under a dated amendment, and only in its instructions about evidence format and answer format, as in runs 1 and 2. Both reviewers then label the run-3 reserve against the same gates.

Any other failure means **no decision**, with no retry. That covers instability, κ, or accuracy on well-formed, verified answers, because a second draw with nothing changed would only resample the same variance. A reserve failure also means **no decision**. No fourth calibration run is planned in this pilot.

**What a pass authorizes.** A run-3 pass, on calibration or on the reserve after a format revision, authorizes the live phase with R1 and the chosen R2, recorded as a dated amendment to the protocol. If the reserve was used, the live prompt is the revised one. A pass authorizes nothing else.

**Timing.** The live window starts on 2026-12-01. If run 3 has not passed by then, the rehearsal does not run in this pilot, and its data are not collected.

**Execution and scoring.** The runner, scorer and shared protocol checks are the files in `scripts/precision/calibration/` at the freeze commit, pinned by SHA-256 there. Packets are built by `scripts/precision/rehearsal-packets.ts` at the freeze commit, with phases `calibration-run3` and `reserve-run3`.

**Results.** Run-3 results are reported in #65, separately from runs 1 and 2, and are never pooled with them or with the screening.

## Known limitations

- **The items' author has seen earlier disagreements.** The contributor who wrote the new items after runs 1 and 2 has seen where the reviewers disagreed. The independent key review reduces this risk but cannot remove it.
- **Selection may overstate R2's reliability.** R2 is chosen on screening results, so its expected performance is biased upward. That is why the gated run uses new items, and why the screening is never pooled with it.
- **Effort is confounded with variance.** If `gpt-6-luna` at `high` is chosen, any gain cannot be separated from the extra reasoning budget. If `gpt-6.2-astra` is chosen, R2 changes model as well as configuration.
- **The cases repeat.** They are the same 24 as in runs 1 and 2, so the reviewers have seen every scenario before, with different responses.
- **Some variants vary little.** `breaks` items rely on modal weakening (CAN, "is encouraged to", «Conviene que», «Se recomienda que», PROCURARÁ) or on leaving a decision unrecorded. No `breaks` item deletes one side of a conflict.
- **Agreement is not validation.** A pass shows that the reviewers agree with each other and with constructed keys on these responses. It does not validate them on participant text.

## Amendments

None.
