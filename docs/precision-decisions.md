# Precision decisions (#39, 2026-11-21)

Tracking: [#39](https://github.com/jayanez/spec-torque/issues/39). Method and
pre-registration: [precision replay](precision-replay.md). The comparator is
engine 0.1.4 at `865af59`, which was also live `develop` when the work started.

All counts below are measurements, from runs on this branch. The text says
explicitly where something is a hypothesis or a provisional judgment. Agent review
here means a single provisional reviewer (this session), not independent labels.
Restricted roots (personal and corporate) were scanned with the owner's
authorization. Their aggregates are held locally pending release approval, so this
page reports only whether each gate condition held for them.

## 1. Detector rule

### H1: fence pairing — **stop**

| Measure | 0.1.4 | H1 candidate |
|---|---:|---:|
| Synthetic E1.4 FP, fence-mismatch, EN / ES | 5 / 4 | 0 / 0 |
| Synthetic regressions | — | 0 |
| Historical predictions changed (716) | — | 0 |
| Natural lines admitted inside an oracle fence (18 roots, 344 documents) | 0 | 0 |

The failure did not occur in any natural root, so gate condition 1 failed. The
candidate (`d3afc42`) was reverted (`63e2f8d`). The synthetic suite still
documents the failure.

### H2 / H2a: mentioned modal words — **iterate**

H2 was pre-registered after the H1 scans showed quoted-only modal admissions in
several repositories. An independent code review then found an inch-mark false
negative before any decision, and H2a amended the policy (`78b9643`) before it was
re-measured. The candidate is at `src/core/analyze.ts` (`mentioned`), engine
0.1.5.

**Synthetic results** (constructed references, 90 targets):

| Language | E1.4 TP | E1.4 FP | Regressions |
|---|---|---|---|
| EN | 23 → 23 | 14 → 8 | 0 |
| ES | 19 → 19 | 13 → 6 | 0 |

**Historical controls:** all 716 predictions are unchanged. The three
supplemental controls contain no quotes or backticks.

**Development scan** (the three public roots seen before H2):
- 22 lines changed, all quoted-only.
- No finding changed on any other line, and no evidence became invalid.

**Confirmation scan** (12 MIT repositories from the external inventory, not used
to design H2):
- Population: 1,750 target documents and 1,102 lineages, across OpenSpec, Spec
  Kit, Spec Kitty, Kiro, BMAD, ZeeSpec and generic PRD.
- 130 E1.4 changes (95 distinct lines). Every change is quoted-only under the
  independent scanner, and every finding change is on those lines: 258 distinct
  findings removed and none added. The raw sum of 2,014 counts inherited
  instruction files once per feature.

A provisional agent review of the 95 distinct lines found:
- **Correct:** most are keyword mentions, EARS templates, quoted user input, error
  messages, ✅/❌ examples, or accounting terms (`Debe`/`Haber`) inside code.
- **False negatives (at least 3):**
  - Two requirements written inside a code span, of the form
    `` `saldoInicialBob DEBE ser "0.00"` ``.
  - One Spanish requirement whose code span opens on the previous line, so the
    line starts with a stray backtick and the span is paired wrongly.
- **Ambiguous (a few):** quoted invariants that the spec itself calls binding.

**Restricted roots** (license-limited public, personal and corporate): every
change was quoted-only, with no findings on other lines and no invalid evidence.

**Decision.** Gate conditions 1, 2 and 4 hold. Condition 3 does not hold strictly:
some confirmed changes are requirements, not mentions. H2a removes roughly 40–55%
of the synthetic E1.4 false positives without measured true-positive loss. On
natural sources, however, it trades many correct exclusions for a small number of
false negatives.

The decision is not to merge. The next iteration is H2b, pre-registered and
evaluated on a fresh, untouched set. Its candidate policies are:
- skip code-span pairing on lines with an odd number of backticks;
- count a code span as a mention only when its content is one or more bare modal
  keywords (for example `` `SHALL` ``/`` `MUST` ``), and keep sentence-length code
  spans as possible requirements.

H2a also changes one earlier contract: guillemets (`«…»`) now mark a mention
(`tests/normative.test.ts`). It stays on this branch only.

### H2b: keyword-only code spans — **iterate; a product issue is warranted**

H2b and its confirmation sources were frozen before the candidate existed:
- `a6bf858`: policy and the stricter condition 3;
- `bab658b`: 18 MIT or Apache-2.0 repositories, from owners not used before, chosen
  by path and license only;
- `bb8e185`: the candidate.

| Measure | 0.1.4 | H2b |
|---|---:|---:|
| Synthetic E1.4 FP, EN / ES (98 targets) | 16 / 15 | 9 / 7 |
| Synthetic E1.4 TP, EN / ES | 25 / 21 | 25 / 21 |
| Synthetic regressions | — | 0 |
| Historical predictions changed (716) | — | 0 |

**Confirmation set.**
- Population: 1,716 target documents and 855 lineages in six families: OpenSpec,
  Spec Kit, Spec Kitty, Kiro, BMAD and generic PRD. No qualifying ZeeSpec
  repository was found, and the set contains no Spanish modal lines.
- One feature was over the engine's analysis limit and was excluded from the
  feature-level diff.
- 95 admission and E1.4 changes, all quoted-only. No finding changed on other
  lines (115 distinct findings removed), and no evidence became invalid.

A provisional agent review of the 47 distinct changed lines found:
- **Mentions:** keyword mentions, the BCP 14 boilerplate, quotations of rules
  defined elsewhere, ✅/❌ examples, template questions and quoted UI or CLI
  messages.
- **One borderline case** violates the strict condition 3: `**FR1b:** System can
  detect …`. It is a requirement worded with "can", which is not a recognized modal,
  and its only modal sits inside a quoted example message. The E1.4 change is
  correct (the old decision was a false positive). However, the line is no longer
  admitted for the other requirement-based checks.

**Development sets** (public and external MIT):
- Three changes were reported outside the scanner's scope. All are quotations
  inside code spans, such as `` `warning("…coherence may be degraded")` ``, and
  all are mentions.
- The earlier H2a false negatives (code-span requirements and stray backticks) no
  longer change.

**Restricted roots:**
- Personal and corporate: every change was quoted-only, with no findings on other
  lines and no invalid evidence.
- License-limited public roots: fewer than five changes were outside the scanner's
  scope. They cannot be inspected without storing text, so they remain unverified.

**Decision.** Conditions 1, 2 and 4 hold. Condition 3 fails strictly on one
borderline line. The remaining gap is a separate, pre-existing limit: modal-less
requirement wording ("can", "puede" used as capability) is not admitted.

H2b is the first candidate that warrants a separate product issue, filed as a
provisional engineering change with these limits:
- no independent labels yet;
- Spanish evidence comes only from the development sets.

It is not merged. The owner approved the issue, filed as
[#51](https://github.com/jayanez/spec-torque/issues/51). The 18-repository set is now
development data, because the ablation was measured on it: the quotation part alone
excludes 46 of the 47 distinct lines, the code-span part alone 4, and 1 line needs
both.

**Downstream status (18-repository set, re-run with status transitions).** E1.2
moves from `partial` to `missing` in 8 features. No other practice changes status.

### H2b: Spanish confirmation — **criterion not met**

The sources were frozen at `bcc8536` before any file was read: 20 MIT or
Apache-2.0 repositories found by code search for `"DEBE"` by family path, with
every owner used earlier excluded. ZeeSpec again had no qualifying repository.

| Measure | Count |
|---|---:|
| Target documents / lineages | 2,227 / 2,089 |
| Candidate lines EN / ES / undetermined | 5,774 / 1,649 / 5,359 |
| Lines no longer admitted (none newly admitted) | 202 |
| Distinct changed lines, EN / ES | 148 / 13 |
| Changes outside the scanner's scope | 3 |
| Findings removed (none added) | 246 |
| Invalid evidence | 0 |

- **Spanish target missed.** Only 13 distinct Spanish lines changed, against the
  20 required, and 10 of them come from one repository. The Spanish criterion of
  #51 stays open.
- **Provisional review of the 13 Spanish lines** (this session, not independent):
  - 12 are mentions: quoted user descriptions in Spec Kit inputs, quoted UI
    messages in `THEN` steps, and a quoted NFR used as an example.
  - 1 is borderline under limit 2: a quoted "guiding principle" that the document
    states as its own rule.
- **Outside the scanner's scope.** All 3 are quotations inside code spans
  (exception text, CLI messages, a quoted contract), as in the earlier
  development sets. They are mentions.
- **Concentration.** 135 of the 161 distinct lines come from one English
  repository, so the English part of this set is dominated by one author.
- **Downstream status transitions.** E1.4 moves `partial→missing` in 21 features
  and `supported→unknown` in 10. E2.1 moves `partial→supported` in 11. I1.2 and
  I2.2 move `missing→unknown` in 10. None of these were adjudicated.

### H2b: second Spanish set — **fails on Spanish requirement IDs**

The first set fell short, so a second one was frozen at `6d325a6` before any file
was read: 16 MIT or Apache-2.0 repositories found by searching for `"DEBERÁ"`, with
every earlier repository and owner excluded.

| Measure | Count |
|---|---:|
| Target documents / lineages | 265 / 238 |
| Candidate lines EN / ES | 680 / 2,581 |
| Lines no longer admitted (none newly admitted) | 83 |
| Distinct changed lines, EN / ES | 3 / 80 |
| Spanish repositories / lineages with changes | 6 / 40 |
| Changes outside the scanner's scope | 1 |
| Findings removed (none added) | 100 |
| Invalid evidence | 0 |

Across both sets, 93 distinct Spanish lines changed, so the count requirement is
met. However, 67 of the 80 lines in this set come from one repository.

**Provisional review** (this session, not independent):
- **18 requirements wrongly excluded** (1 repository, 4 lineages). They have the form
  `- RF-58: EL SISTEMA no dejará … Usuario (fecha): «no debe haber …»`.
  - The requirement itself is worded in the future tense, which is not a
    recognized modal.
  - Its only recognized modal sits in a quoted user order.
  - `RF-` (the Spanish *requisito funcional*) is not a recognized requirement ID;
    only `FR`, `NFR` and `REQ` are.
- **Most of the rest are mentions:** quoted user orders cited as the origin of a
  decision, quoted UI messages, and Spanish text quoted in English scenarios.
- **The one change outside the scanner's scope** is a quoted banner inside a code
  span, which is a mention.

**Decision.** Condition 3 fails, and so does a zero-tolerance threshold. The gap
is not new: like limit 1 (modal-less wording), it comes from admission depending on
a modal or an English ID. H2b exposes it whenever the only modal is quoted.

A candidate fix is to recognize Spanish requirement IDs (`RF-`, `RNF-`). It needs
its own pre-registration (H2c) and must be measured on a set that has not been
seen. H2b stays unmerged.

### H2c: Spanish requirement IDs — **stop**

Pre-registered at `9e8d5d9`. The sources were frozen at `507b1c3` (17 repositories
found with `"RF-" "EL SISTEMA"`) and the synthetic twins at `7c79b6c`, both before
the candidate (`c309b98`, engine 0.1.6).

**Harness fix.** The probe's candidate-line tokens did not include `RF-`/`RNF-`. As
a result, isolation left those lines in place and they leaked into other lines'
predictions. The fix (`d371534`) makes the tokens a superset of both arms. It was committed before any
natural-source measurement.

| Gate | Result |
|---|---|
| 1. The 18 known false negatives are admitted again | holds (18 of 18) |
| 2. Every line newly admitted relative to H2b is a requirement (fresh set) | **fails** |
| 3. No H2b mention is re-admitted without an ID | holds (0 lines excluded, 0 quoted-only changes) |
| 4. No regressions in the historical predictions (716 unchanged), the synthetic suite (0 regressions; ES admission errors 13 → 11) or evidence (0 invalid) | holds |

The supplemental controls were not re-run, because they contain no `RF-`/`RNF-`
IDs.

**Fresh set.** 181 documents and 160 lineages. H2c newly admits 975 lines in 65
lineages.
- About 479 are requirement definitions, such as `| RF-01 | El sistema permite …`
  or `- **RNF-1 — Sin telemetría…**`.
- About 496 are cross-references to IDs:
  - task checkboxes (`… (RF-006)`);
  - traceability tables (`| 016-CHK-13 | 016-RF-11 | …`);
  - prose that cites a requirement (`Ver RF-99`, `(RF-183, RF-184)`).

A first-pass pattern did this split; it was not reviewed line by line. Downstream,
E1.4 moves `supported→partial` in 60 features, and I1.2 and I2.2 move
`missing→partial` in 57.

The development sets show the same split. The second Spanish set gains about
3,800 definitions and about 1,800 references.

**Decision.** Stop. The candidate is reverted. The cause is the existing admission
policy, not the Spanish IDs: any line that *contains* a requirement ID is admitted.
H2c makes this visible because Spanish specs cite `RF-` IDs densely. English `FR-`
references are admitted the same way today.

The next candidate, if pursued, would anchor admission to the ID's *defining
position*: line start, list item, bold label, or the first table cell. That
changes the contract for every ID, so it needs its own pre-registration and the
historical controls.

### H2d: ID admission anchored to the defining position — **iterate**

Pre-registered at `9f55152`. The sources were frozen at `6fd768e` (34 repositories,
`"FR-"` and `"RF-"` queries) and the synthetic twins at `3535208`, both before the
candidate (`38a1c09`, engine 0.1.6). The engine also recognizes `RF-`/`RNF-` IDs, as
in H2c.

| Gate | Result |
|---|---|
| 1. The 18 known false negatives are admitted | holds (18 of 18). The second Spanish set gains 3,975 lines, against 5,605 under H2c. |
| 2. Newly admitted lines are requirements (fresh set, all 30) | holds. All 30 are `RF-`/`RNF-` definitions, which happen to be in Portuguese. |
| 3. No requirement among the lines H2d stops admitting (100 of 238, seed 42039) | **fails strictly** |
| 4. Historical predictions (716 unchanged), synthetic suite (0 regressions), evidence (0 invalid) | holds |

On the synthetic suite, admission errors fall relative to H2b, from 15 to 12 in
EN and from 16 to 11 in ES.

**Fresh set.** 2,327 documents and 1,168 lineages, with no Spanish modal lines;
the `"RF-"` query mostly found non-Spanish projects. Relative to H2b, 30 lines are
newly admitted and 227 stop being admitted, and no evidence becomes invalid.

**Gate 3.** Most stopped lines only cite IDs: notes, review logs, traceability
lines, quoted user descriptions and "Touches FR-15" lists. However, 15 of the 238
lines (2 Spec Kitty repositories) are rows whose own ID is not recognized:
- constraints (`| C-003 | No credential appears in argv … |`);
- success criteria (`- **SC-002**: …`).

Before H2d they were admitted only because they cite an `FR-` ID later in the line.
At least the constraints are requirements.

**Decision.** Iterate. H2d removes the cross-reference false admissions that
stopped H2c, without measured loss on the historical controls. The remaining gap is
ID vocabulary. A next candidate (H2e) would add constraint and success-criterion
IDs (`C-`, `CON-`, `SC-`) in the defining position only. It would be
pre-registered and measured on a fresh set. The candidate stays on this branch,
unmerged.

The adjudication packets for all three sets (`scripts/precision/adjudication-packet.ts`,
protocol in [precision adjudication](precision-adjudication.md)) are built and
held locally. They await two independent reviewers and the owner's threshold.

## 2. Feedback workflow (F1) — **keep, unchanged**

No new evidence was gathered on feedback in this session.
- Feedback stays opt-in, local, inspectable, deletable and replayable.
- A user accepting a suggestion is not a correctness label.
- The replay harness here adds what F1 needs to compare revisions: case IDs,
  input, policy and engine hashes, and per-arm decisions.

## 3. Optional linguistic assistance (F2) — **iterate, stays gated**

**Design.** Candidate-span classification replaces free generation:
- The engine proposes the modal spans, each with exact offsets.
- The model only picks a class from a closed enum.
- Evidence is the span the engine proposed.

**Setup.**
- 48 balanced synthetic probes, frozen first (`03f46d5`).
- Local Ollama 0.40.16 on loopback; `qwen3.5:9b` with digest `d63f830f28d5`,
  quantized NVFP4 on MLX; three seeds; temperature 0.
- This runner has no grammar support. The fallback validates the enum and the
  candidate IDs locally, and any other answer counts as unresolved.
- The first fallback run was invalid because the model echoed the schema, so the
  prompt now shows an answer shape (`4f88efe`).

**Strict correctness** (positives need exact evidence; unknown references need an
abstention):

| Arm | Positive | Negative | Unknown | All |
|---|---:|---:|---:|---:|
| D: deterministic, H2a | 16/16 | 7/16 | 0/16 | 23/48 (47.9%) |
| M: local model | 15/16 | 13/16 | 0/16 | 28/48 (58.3%) |

**Findings.**
- M classified every response validly and all three seeds agreed every time. At
  temperature 0, extra seeds add nothing.
- M never abstained: on unknown probes it chose permission or possibility.
- Its errors are Spanish:
  - `PUEDEN` permission read as possibility;
  - quoted error text read as an obligation;
  - `debe de` conjecture read as an obligation.

**Sampled self-consistency.** The second run used 5 samples at temperature 0.7
(`seeds 42039–42043`); M abstains when the samples disagree. D is now the H2b engine.

| Arm | Positive | Negative | Unknown | All |
|---|---:|---:|---:|---:|
| D: deterministic, H2b | 16/16 | 5/16 | 0/16 | 21/48 (43.8%) |
| M: sampled, k = 5 | 13/16 | 13/16 | 7/16 | 33/48 (68.8%) |

Samples disagreed on 12 of 48 probes. Disagreement produced 7 of the 16 correct
abstentions, but also cost 3 positives. The two runs used different D arms
(H2a, then H2b), so compare each M row with its own D row.

**Decision.** M meets the nominal +3 pp gate, with no loss on unknowns. Deterministic sampling at temperature 0 failed the design aim of abstention; sampled
self-consistency recovers part of it (7/16) at a cost to positives (13/16), and the evidence is synthetic only (n = 48).
It is not enabled.

**Next steps.**
- Calibrate abstention with sampled self-consistency at temperature above 0.
- Add a second local model with an explicit download approval.

Restricted-data inference stays local, and its model policy is the operator's
decision.

## 4. Document clarification — **not run**

Clarification quality remains a separate experiment. No clarification output was
produced or evaluated here.

## Tooling assessment

[NVIDIA Model Optimizer](https://github.com/NVIDIA/Model-Optimizer) quantizes,
prunes, distills and sparsifies models, and adds speculative decoding, for
deployment through TensorRT-LLM, vLLM or SGLang on NVIDIA GPUs (CUDA, Linux).

It does not address the bottlenecks measured here:
- missing abstention;
- reference quality;
- deterministic mention rules.

Distillation is model training, which V1 excludes. The current workstation runs
MLX, not CUDA. It could matter later, for example to serve a quantized local model
on NVIDIA hardware for restricted data, once F2 shows a stable advantage.

## Reproduce

```sh
node --import tsx scripts/precision/replay.ts synthetic --baseline 865af59 --candidate HEAD
npm run corpus:report -- --baseline 865af59 --labels fixtures/calibration/agent-reviews.json
node --import tsx scripts/precision/replay.ts scan --baseline 865af59 --candidate HEAD --roots <roots.json> [--out <dir>]
node --import tsx scripts/precision/assist-trial.ts --model <local model> --seeds 3 [--no-format]
node --import tsx scripts/precision/audit-denominators.ts --fixture <f.jsonl> --results <r.jsonl>
```

The public roots file lists repositories and pinned SHAs. The external inventory's
non-MIT and unconfirmed-license sources were scanned only as restricted, so none of
their text was stored. None of their text is copied into the corpus.
