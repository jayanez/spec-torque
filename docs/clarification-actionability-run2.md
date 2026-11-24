# E1.2 clarification actionability: calibration run 2

Status: **frozen.** This document pre-registers a second, separately identified calibration run for the rehearsal in [clarification actionability](clarification-actionability.md) (issue [#57](https://github.com/jayanez/spec-torque/issues/57)). It is frozen by the last commit of the pull request that adds it. That commit's SHA-256 values for this file and `tests/fixtures/e12/calibration-run2.json` are posted in #57 with the maintainer's confirmation before any run-2 reviewer call. After the freeze, changes need a dated amendment below.

## Why a second run

Run 1 ended in **no decision** (amendment of 2026-11-24 and its record in #57). The first calibration failed every gate, mostly because reviewers appended explanations to their evidence. After the single permitted prompt revision, the reserve retry passed every κ and accuracy gate in both languages, with κ from 0.80 to 1.00 and accuracy from 0.92 to 1.00. It failed only on R2's instability: 2 of 12 items per language (0.17), where one label changed in one of three runs, against a 0.10 gate. With 12 items per language the gate admits a single unstable item, so it had little resolution. Run 1's result stands unchanged.

Run 2 asks the same question with enough calibration items for the instability gate to have resolution, using items no reviewer has seen.

## What is unchanged

Everything in the protocol as amended through 2026-11-24 applies to run 2, except what the next section changes:

- reviewers, clients, effort and execution (R1 `claude-sonnet-5-5` on Claude Code 2.1.311; R2 `gpt-6-luna` on codex-cli 0.170.0; both isolated as amended);
- the reviewer prompt as clarified before this run (protocol amendment *Prompt clarification before calibration run 2*), SHA-256 `2ac88d84b776f336bbfd16f69badea2598663d4717b79c6687369ad81bf97a50`. It is run 1's revised prompt plus two rules found ambiguous in run 1's outputs: deleting or weakening one of two conflicting clauses is an invented decision, and vague wording is neither an invented decision nor a filled slot. Run 1's results are not comparable label-for-label with run 2's;
- labels, labelling rules (as clarified), quoted-span rule, malformed output and transport retries, majority of three runs, combining, κ, key accuracy, instability, and the calibration gates (κ ≥ 0.80 per label, accuracy ≥ 90% per reviewer and label, instability ≤ 10% per reviewer, all per language);
- instability, measured exactly as before: the share of items whose three runs are not unanimous over all three labels, after label validation (invalid, unverified or contextually invalid values become `unknown` first), with every calibration item of that language in the denominator;
- the treatment of `unknown` and `not_applicable`: `unknown` is a κ category; `fills_slot` κ and accuracy use question items only; the undefined-κ exception applies as written;
- thresholds compared on unrounded values (a float tolerance of 10⁻⁹ only), so for example 5 unstable items of 48 (10.4%) fail;
- live phase, consent, endpoints, decision rule and live gates;
- presentation IDs and live seeds, which keep deriving from the frozen protocol SHA-256 `16659f6e…`.

## What changes

**Calibration items.** `tests/fixtures/e12/calibration-run2.json` holds 144 new constructed responses: two per case and variant over the same 24 cases. Calibration uses 96 items, 48 per language: each variant's first response for every case, plus one second response per case, rotating across variants. The reserve has 48 items, 24 per language, and is used only for the retry. No response repeats one shown to the reviewers on the same case in run 1. Keys follow the labelling rules of the protocol as amended on 2026-11-24.

**Seeds.** Run-2 calibration and reserve packets are ordered with seeds derived from this file's frozen SHA-256, with phase `calibration-run2` or `reserve-run2`, by the same rule as before. Item IDs in packets are opaque.

**Retry.** If a gate fails, the first run-2 result is kept and reported, and the prompt may be revised once under a dated amendment to this file. The revision may change only the prompt's instructions about evidence format and answer format. It may not change any label's meaning, the labelling rules, the keys, the scorer, the gates or the decision rule. Both reviewers then label the run-2 reserve against the same gates. A reserve pass means calibration passes for run 2; a reserve failure means **no decision**, and no further calibration run is planned under #57. The coordinator and the maintainer see the first run-2 result before the revision; the reviewers never see results, keys or other runs.

**Execution and scoring.** The runner and scorer used for run 2 are pinned by SHA-256 at freeze: `run-reviewer.mjs` `d68c594e73e4383f86d2df95a79645812639337155d4f5d3e3254e443ffd3444`, `score-calibration.mjs` `9cd8683fd56560ef9e8420c204b62c7916930ec8dbead88b4bbcc156139c49e5`; R2's image is built from a `Dockerfile` `6ae0ebbd9ac176f7d6827a9aef03a0fa6110311f4bcaa6f6d6ad279a4ec5dab8` and `reviewer-config.toml` `31baa7007895968cc847e720d718db3bfc88d7994525c39e1e825449ce689a9c`. The shared packet and seed checks (`protocol.mjs`) pin this file's frozen SHA-256 after the freeze, so their own hash is recorded with the results, not here. They are published with the results. Packets are built by `scripts/precision/rehearsal-packets.ts` at the freeze commit with phases `calibration-run2` and `reserve-run2`.

**Results.** Run-2 results are reported separately from run 1 and never pooled with it.

## Known limitations

- The new items were written after run 1 by the same contributor, who has seen where the reviewers disagreed. That knowledge could make the items easier or harder than run 1's. The mitigation is an independent model review of every key before the freeze, by `gpt-6.2-sol`, which is neither reviewer. It matched 143 of 144 keys. The one mismatch and 12 items it judged ambiguous were rewritten before the freeze, and no key is changed after any reviewer output exists. This cannot remove the risk entirely.
- An independent review of the clarified prompt suggested also specifying what a note must contain to record or route a decision, and that an agreed value in a role brief governs unless the brief delegates discretion. These were not added; the keys of this item set do not depend on them, but live responses might.
- Many `breaks` items weaken a modal verb (MUST to SHOULD or MAY, DEBE to DEBERÍA or PUEDE), which keeps their keys unambiguous but makes that variant less varied than run 1's.
- The cases are the same 24 as in run 1. Reviewers have seen every scenario before, with different responses.
- A pass shows the reviewers agree with each other and with constructed keys on these responses. It does not validate them on participant text.

## Amendments

**2026-11-24. First run-2 result and the single prompt revision.** Made before the run-2 reserve run or any participant data.

- *First run-2 result, kept.* 96 items, both reviewers, three runs each; no malformed outputs or transport failures; results sealed before keys were read. R1 passed every gate in both languages, with key accuracy 0.96–1.00 and instability 0.00 (EN) and 0.02 (ES). R2 failed instability, 0.125 (6 of 48, EN) and 0.27 (13 of 48, ES), and in ES also `acceptable` κ (0.76) and its own `acceptable` accuracy (0.875). Every other κ and accuracy gate passed. Calibration therefore failed.
- *Cause.* R2's labels changed between runs on identical inputs, mostly `acceptable` on judgement calls about whether a note records or routes a decision and whether a filled slot is acceptable. R1 was stable on the same items and prompt, so this is read as R2 sampling variance rather than an ambiguous rule.
- *Revision, within the permitted scope.* The prompt asks for a short "checks" line per applicable rule before the labels (protocol amendment *Run-2 prompt revision*). No label meaning, rule, key, scorer behaviour or gate changes. Prompt SHA-256 → `c5a28aecbf6fc09ce8b9d50279cd9a23b746cdb3054e6618e167f9a340ed7464`.
- *Seeds.* Run-2 packet seeds keep deriving from this file's frozen SHA-256 `847ed2750fd7aaf71290e9a9d1ae04dd764082cbfbd63b8b3e7fcfbd152a5724`, not from the amended file.
- *Retry.* Both reviewers label the 48-item run-2 reserve three times with the revised prompt, against the same gates. A failure means **no decision**, with no further calibration run under #57.
