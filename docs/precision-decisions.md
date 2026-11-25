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

### H2e: constraint IDs — **stop; the H2 family ends here**

Pre-registered at `62b5533` and `24d40a1` as the last H2 iteration. The sources
were frozen at `2f5b486` (19 repositories, `"C-001"` query) together with the
synthetic twins, both before the candidate (`d98ba50`, engine 0.1.7).

| Gate | Result |
|---|---|
| 1. The known `C-`/`CON-` constraint lines are admitted (H2d set) | holds (8 of 8) |
| 2. Newly admitted lines relative to H2d are requirements (fresh set, all 56) | **fails** |
| 3. Sample of lines no longer admitted relative to 0.1.4 | not reviewed, because gate 2 failed |
| 4. Historical (716 unchanged), synthetic (0 regressions against 0.1.4, H2b and H2d), evidence (0 invalid) | holds |

**Gate 2.** The 56 lines come from 3 repositories and 15 lineages. `C-` is not a
constraint prefix by convention. Besides real constraints (`C-001：本模块仅为
magicscript 语言服务，不得通用化…`), it labels:
- clarification questions (10 lines end in a question mark);
- observed risks and caveats (`C-004：…可能产生冲突`);
- change-log entries (`C-129 补全了…`).

On the H2d set, all 137 newly admitted lines are `C-` lines, and none are `CON-`.

**Decision.** Stop, and the candidate is reverted. Under the stop rule, there is no
H2f. The harness change that probes `C-`/`CON-` as candidate lines (a superset)
stays.

**Best candidate: H2d** (`38a1c09`, engine 0.1.6), with these known limits:
- requirements whose only ID is a constraint or success-criterion prefix (`C-`,
  `SC-`) and that have no modal are not admitted;
- future-tense requirements without a recognized ID are not admitted (a limit
  since before H2);
- quoted binding rules and modal-less ("can") requirements, carried over from H2b.

H2d goes to independent adjudication under
[precision adjudication](precision-adjudication.md). The owner fixes the threshold
before labeling and decides on the product change.

### H2d adjudication — **fails; the ID-anchoring rule is rejected**

Labels (2026-11-21) were assigned under the threshold fixed beforehand.
- Two blind agent reviewers and an agent adjudicator labeled 300 sampled lines. The
  reviewers saw only the lines, their context and a label guide.
- Agreement: Cohen's kappa 0.81 (271 of 300). The adjudicator resolved 29 lines.
- The labels and scoring script are held locally.

| Changes (H2d vs 0.1.4) | Lineages | With an error | Upper 95% bound | Threshold ≤ 5% |
|---|---:|---:|---:|---|
| Excluded, all packets | 93 | 42 | 54.2% | **fails** |
| Excluded, fresh set | 43 | 30 | 81.1% | **fails** |
| Excluded, development set | 47 | 12 | 38.1% | **fails** |
| Admitted, all packets | 61 | 1 | 7.5% | **fails** (sample size) |

**What H2d wrongly stops admitting.** Requirements that cite an ID without
starting with one:
- edge-case bullets (`- **Oversized batch**: … are rejected … (FR-013)`);
- numbered `Given/When/Then` acceptance scenarios that cite an FR;
- success criteria (`SC-…`);
- IDs with a project prefix (`AV-REQ-016`, `WS-REQ-010.AC-02`);
- table rows and domain rules in Portuguese.

**The provisional reviews were wrong.** This session's own sampled review had read
these lines as references, and so passed H2d gate 3. The independent labels
contradict it.

**Caveat.** The label guide counts acceptance scenarios and success criteria as
requirements, but the engine deliberately excludes plain `GIVEN`/`WHEN`/`THEN`
lines. Part of the measured error therefore comes from that difference in
definitions, not only from the rule.

**Decision.** H2d is not merged, and the defining-position rule is rejected.
- In practice, a line that contains an ID is a better admission signal than its
  position.
- The H2c problem (cross-references admitted) is real but smaller than the cost of
  anchoring.
- H2b's mention rule has not itself been adjudicated with independent labels.
  The remaining candidate for #51 is H2b alone, which needs its own packets.

### H2b adjudication — **fails; no H2 candidate passes**

Labels (2026-11-21) were assigned with the same method and threshold as H2d.
- Two blind agent reviewers labeled all 291 distinct lines that H2b stops
  admitting: 47 from the 18-repository set, 161 from the first Spanish set and 83
  from the second.
- Reviewer A omitted one item. Cohen's kappa was 0.70.

The adjudicator was not run. Lines that **both** reviewers labeled `requirement`
already give a lower bound on the errors, and adjudication could only add more.

| Set | Lineages | Errors (agreed only) | Upper 95% bound (at least) |
|---|---:|---:|---:|
| 18 repositories | 26 | 4 | 31.8% |
| First Spanish set | 149 | 17 | 16.6% |
| Second Spanish set | 40 | 9 | 36.0% |
| All | 215 | 30 | 18.4% |

**What H2b wrongly stops admitting.** The lines state their own rule without a
recognized modal, and their only modal is quoted:
- imperative task and constraint bullets (`- Reuse … exactly -- no second …
  implementation`);
- negative constraints (`- No schema/model change …`);
- `THEN` steps that quote a UI message but also require behaviour (`… y no se
  encola nada`);
- table rows describing required build failures;
- capability-worded requirements (`FR1b`).

The previous decision on 0.1.4 was not correct for these lines either. It
admitted them and counted the quoted modal as normative usage. H2b turns that
false E1.4 positive into a false negative on admission.

**Decision for #51.** No H2 candidate meets the threshold.
- Recognizing mentions is necessary but not sufficient. Admission also needs to
  recognize modal-less requirement wording: imperatives, negative constraints and
  the future tense.
- That is a different and larger problem, a requirement-sentence classifier,
  beyond one bounded deterministic rule.
- The engine stays at 0.1.4 behaviour on `develop`. Every candidate stays
  unmerged, and #51 should be closed or re-scoped by the owner.

**Process lesson.** This session's provisional reviews (the rule author's) passed
H2b condition 3 with one borderline line and H2d gate 3. Independent labels found
error rates far above 5% for both. In the future, provisional reviews by the
rule's author should not count towards any gate.

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

## 5. Requirement-line classification (#52) — baseline measured

Definition, gate and splits are in [requirement classification](requirement-classification.md).
Labels come from two blind agent reviewers and an agent adjudicator; the rule's author did not
label. Public sources only; packets and labels stay local.

| Set | Items | Lineages | Kappa | Admitted lines wrong (precision) | Missed requirements (recall) |
|---|---|---|---|---|---|
| DEV | 300 | 128 | 0.77 | 5 of 37 lineages, upper bound 26.3% | 24 of 54, upper bound 56.5% |
| T1 | 879 | 331 | 0.89 | 12 of 70 lineages, upper bound 26.3% | 62 of 110, upper bound 64.4% |

Engine 0.1.4 on the adjudicated labels (limits 5% and 5%): it admits too many non-requirements
and misses about half of the requirement lines. The acceptance bound has no population because
0.1.4 never tags `acceptance`. The labels are 32% requirement, 18% acceptance and 50% other on
T1. The samples are almost entirely English (the lines with a Spanish modal are under 2%), so
these results do not speak for Spanish.

Two corrections were made before any candidate existed, both recorded here:
- **Label guide.** The first blind pass disagreed mostly on scenario lines that contain a modal
  (kappa 0.77 on DEV). The owner decided they are `requirement`; the guide was clarified and the
  50 affected DEV items and the disputed T1 items were adjudicated under the clarified rule.
- **T1 sampling.** The first T1 sample (600 lines, capped per repository) had 79 lineages with a
  requirement, below the 100-lineage minimum, so even a perfect classifier could not pass. T1
  was widened with 279 further lines, one per lineage, to 879 items over 331 of the 332 lineages
  in the T1 sources. T2 has only 189 lineages in total, so its bounds may not reach 100
  requirement lineages; that is recorded before Phase B is run.

<a id="h3-dev"></a>
### H3 (deterministic line grammar) on DEV

Counts only; the labeled lines stay local. DEV has 54 lineages with a requirement, below the
100-lineage minimum, so these bounds are for iteration and cannot pass.

| Arm | Admitted lines wrong (precision) | Missed requirements (recall) | Acceptance tags wrong |
|---|---|---|---|
| 0.1.4 | 5 of 37 lineages, upper bound 26.3% | 24 of 54, upper bound 56.5% | no population |
| H3 round 0 | 8 of 46, upper bound 29.2% | 20 of 54, upper bound 49.1% | 4 of 39, upper bound 22.0% |
| H3 round 1 (frozen) | 2 of 39, upper bound 15.3% | 21 of 54, upper bound 51.0% | 3 of 38, upper bound 19.2% |

Round 1 only narrowed rules (innermost requirements heading, quoted subjects, bare step openers). Of
the 31 requirement lines the grammar still misses, most are outside what a line grammar with
English and Spanish rules can reach: Portuguese modals, wrapped continuation lines, table rows and
noun-phrase bullets under a requirement heading. Lowercase prose modals account for the remaining
admission errors. Synthetic replay against `d06c023`: 0 regressions, and every constructed
`requirement-wording`, `section-context`, `acceptance` and `non-requirement` target reads as
expected. Historical controls: 0 of 716 predictions changed.

### H3 — **fail** (T1, scored once)

Engine at freeze commit `585a4a5` (engine sources as in `dbdb24c`), T1 packet of 879 lines over 331
lineages, scored after the freeze commit. The labeled lines were not read for error analysis.

| Bound | Lineages | Errors | Upper 95% | Limit | Baseline 0.1.4 |
|---|---|---|---|---|---|
| Precision | 76 | 15 | 28.8% | 5% | 26.3% |
| Recall | 110 | 59 | 61.8% | 5% | 64.4% |
| Acceptance | 88 | 15 | 25.0% | 10% | no population |

Precision and acceptance also have fewer than 100 lineages. The grammar admits 76 requirement
lineages against 70 for 0.1.4, so it changes recall by 2.6 points and does not improve precision.
Score output SHA-256 `21bb5c08e4e5810da21571674f3f2b85796af5df49142879ab6bc2d99df9c80b`,
predictions `9ae947f5ed74a438198dd279e9dae6a1c4884437ee7b8483bf32074852fbcd13`. Per the stop
rules, T1 is not retried. Phase B (local-model classifier, H4) needs its own plan approval; the
engine stays at 0.1.4.

### H4 (local-model line classifier) on DEV — **fails the early stop; T2 and T2b not opened**

Model `qwen3.5:9b` (Ollama 0.40.16, digest `d63f830f28d5`), loopback, 5 samples at temperature 0.7,
seeds 42039–42043, at least 4 of 5 must agree, otherwise `unknown` (scored as `other`). This runner
returns "structured output is unavailable", so the closed enum is requested in the prompt and
validated locally. The structure pre-filter settled 4 of the 300 DEV lines, so 296 lines were
asked per round (1,480 calls); every call produced a valid or `unknown` answer with 0 server errors.
About 1.4 to 1.6 s per line asked, so about 7 minutes per round. Counts only.

| Round | Prompt change | Admitted wrong (lineages of 34 to 40) | Missed requirements (of 54) | Acceptance tags wrong | Abstentions |
|---|---|---|---|---|---|
| 1 | guide v2 plus its examples (prompt at `3c21071`) | 2, upper 17.4% | 30, upper 67.1% | 11 of 39 | 40 |
| 2 | modal rule first | 3, upper 19.2% | 23, upper 54.7% | 6 of 45 | 11 |
| 3 | items under requirement headings | 7, upper 30.4% | 21, upper 51.0% | 9 of 47 | 11 |

All three rounds ran after the pre-registration commit `94fe6fd` and count toward the 3-round cap;
round 1 used the prompt as committed in `3c21071`, and rounds 2 and 3 are commits `d4a3577` and
`c6293ad`. The pre-registered early stop needs at most 2 admitted-wrong and at most 3 missed lineages after the
last round; round 3 has 7 and 21, and the best round has 3 and 23. H4 therefore fails on DEV and
the engine stays at 0.1.4. Compare H3 on the same DEV set: 2 and 21.

What the model gets wrong: it labels `WHEN … THEN … SHALL` steps as `acceptance` although the guide
makes them requirements (17 of 96 requirement lines in round 1, 2 after the modal rule was moved
first), and it reads table rows, noun-phrase bullets, wrapped lines and Portuguese modals as `other`
(22 in round 2). Widening the rule for items under requirement headings (round 3) traded precision for
recall and did not help.

Status of T2 and T2b: T2 (189 lineages) and T2b (716 lineages, 28 repositories, frozen in
`fixtures/precision/r52-t2b-sources.json` before any H4 code) were never scored. A blind prose packet
of 900 lines over 655 lineages was built and labeled by two Sonnet reviewers; it was not adjudicated
and stays local and unopened. No second model is installed locally (only `qwen3.5:9b`), so no M2 arm
was run; none was downloaded.

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

### H3: requirement definitions in defining positions — **iterate (owner decision)**

Tracking: [#83](https://github.com/jayanez/spec-torque/issues/83).
- Pre-registered at `7eeefa0`.
- The sources (8 repositories, `"### REQ-001"` and `"**REQ-001"` queries) and the
  synthetic twins were frozen at `31f16af`.
- The twin for mentions was amended at `57f87ac`, before the candidate existed,
  because it contradicted the frozen policy.
- Candidate: `6a33bee`, engine 0.1.8.

| Gate | Result |
|---|---|
| 1. Synthetic twins (14 EN/ES) and existing minimal pairs | holds: 14 of 14 (0.1.4 meets 8), and no admission, E1.4 or E1.2 change in the minimal pairs |
| 2. 716 historical predictions | holds: 0 changed |
| 3. Fresh set review | **fails on added findings** |
| 4. Evidence | holds: no evidence changes in the minimal pairs |

**Fresh set.** The candidate was compared with 0.1.4 across 1,369 Spec Kit features
in 8 roots, 4 of which contribute changes. It:
- removes 2,227 I1.2/I2.3 findings: 1,086 missing identifiers, 994 duplicates and
  147 unresolved references;
- adds 431 duplicates.

**Gate 3, added findings.** Provisional review of 100 added findings, seed 42039:
- 75 are traceability table rows whose first cell restates an ID already defined
  by a heading (`| REQ-005 | T4 | S6 | INV-005 |`);
- 10 are dotted sub-requirements (`- REQ-2.1: …`) read as their parent `REQ-2`;
- 15 are other cases: prose lines that begin with a cited ID, and a few real
  restatements.

Most added findings are therefore false. **Removed findings**, provisional review
of 100: they are predominantly mentions that were counted as duplicates and body
lines under a defining heading. No lost true problem was identified, but the full
labelled review was not completed because gate 3 had already failed.

**Decision.** The candidate stays on its branch, unmerged. The failing
constructions are first-cell table IDs and dotted sub-IDs. The owner decides
between:
- **H3a**: exclude table cells from defining positions, and stop an ID at a
  following `.digit`. Pre-register it, freeze new twins and select a fresh set
  before the candidate.
- stopping H3.

### H3a: no table-cell definitions, dotted IDs end before `.digit` — **stop; best candidate to adjudication (owner decision)**

- Pre-registered at `0903db2`.
- The sources (8 repositories, `"### FR-001"` and `"| REQ-001 |"` queries) and 20
  twins were frozen at `5244317`.
- Candidate: `7a476d1`, engine 0.1.9.

| Gate | Result |
|---|---|
| 1. Twins (20 EN/ES) and existing minimal pairs | holds: 20 of 20 (0.1.4 meets 8, H3 meets 14), and no admission, E1.4 or E1.2 change |
| 2. 716 historical predictions | holds: 0 changed |
| 3. Fresh set and H3 development set | **fails on added findings** |
| 4. Evidence | holds |

**Fresh set.** 192 features in 8 roots: 204 findings are removed and 12 added.
- Removed: 192 duplicates, 10 missing identifiers and 2 unresolved references.
  Provisional review of a sample of 100 (seed 42039): the removed duplicates are
  mid-line mentions, checklist citations and repeated mentions of an ID already
  defined in a list or table. No lost true problem was identified.
- Added: all 12 duplicates are restatements, not real duplicates. There are two
  kinds:
  - a hard-wrapped continuation line that starts with the ID (`   FR-010.`);
  - a list item that restates the ID in another spec-role document of the
    feature (`requirements.md` traceability lists, `spec-compact.md`, PR
    descriptions classified as spec).

**H3 development set.** 1,369 features: 2,487 findings removed and 81 added, down
from 431 added under H3. The added findings fall into the same two kinds.

**Pilot repository (development data, all 83 features).** 975 of 1,269 I1.2/I2.3
findings are removed: 777 unresolved references, 141 duplicates and 57 missing
identifiers. 10 duplicates are added.

**Decision.** Stop under the H3a stop rule. There is no H3b. H3a is the best
candidate. It goes to independent adjudication under
[precision adjudication](precision-adjudication.md), with these known limits:
- an ID restated as the first token of a list item, or of a wrapped line, in
  another spec-role document or later in the same one is counted as a second
  definition;
- spec-role classification of summary documents (compact specs, validation
  reports, PR descriptions) is unchanged and outside H3.

The owner decides on the product change after adjudication.

### H3a adjudication — **holds; proposed for merge with known limits**

The owner fixed the threshold on 2026-11-25 (`caba058`), before labeling: at most
2 of 100 sampled removed findings may be agreed true problems.

The packet was built at `156e895` from the H3a fresh-set scan: 100 removed
findings (seed 42039) and all 12 added ones, shuffled. Two independent agent
sessions labeled it separately. Neither saw engine output, the key, the code or
the other's labels.

| Direction | Agreed negative | Agreed positive | Disputed | Unknown |
|---|---|---|---|---|
| Removed (100) | 100 | 0 | 0 | 0 |
| Added (12) | 12 | 0 | 0 | 0 |

- **Removed:** 0 of 100 are true problems, within the threshold. Reviewers
  described the removed duplicates as the only definition of the ID, or as lines
  that cite, restate or trace it: wrapped continuations, checklist ranges,
  traceability cells, assumptions, plan steps and test descriptions. The 4
  missing-identifier items sit under an enclosing ID heading; one of them rests
  on an inference beyond the context window. The single unresolved reference has
  a visible heading definition.
- **Added:** all 12 are false duplicates, which confirms the known limit.

**Limits of this adjudication.**
- Both reviewers are sessions of the same model family; calibrating an
  alternative second reviewer is tracked in #65.
- The packet shows three lines of context and at most 8 same-ID occurrences.

**Decision.** Propose H3a (engine 0.1.9) for merge. The known limits are recorded
in the H3a entry above. The owner decides at review.

### H5: hard-wrapped continuations join their item or paragraph — **holds; proposed for merge pending adjudication**

Tracking: [#78](https://github.com/jayanez/spec-torque/issues/78).
- Pre-registered at `62afcea`.
- The sources (8 repositories, `"- **FR-001"` and `"- REQ-001"` queries) and 16
  EN/ES twins were frozen at `7a4eb6e`.
- Candidate: `9336e2b`, engine 0.1.10. Comparator: 0.1.9 (`c3f79b0`).

| Gate | Result |
|---|---|
| 1. Twins (16 EN/ES), H3a twins and existing minimal pairs | holds: 16 of 16 (0.1.9 meets 10, failing exactly the 6 target cases); H3a twins 20 of 20; no admission, E1.4 or E1.2 change in the minimal pairs |
| 2. 716 historical predictions | holds: 0 changed, as predicted; artifact sets and unknown practices identical in all 36 cases |
| 3. Fresh set review | holds provisionally: 0 added; 37 of 38 removed findings are not true problems, 1 uncertain |
| 4. Evidence | holds: no evidence changes in the minimal pairs |

**Fresh set.** 167 Spec Kit features in 8 roots; changes in 13 features of 2 roots.
The candidate removes 38 I1.2 findings (36 missing identifiers, 2 duplicates) and
adds none. I2.3 findings do not change. One feature changes I1.2/I2.2 status.

**Gate 3, provisional review of all 38 removed findings** (this session, not
independent labels):
- 24 are wrapped continuation lines of a list item or paragraph that defines an ID
  (`- **FR-003**: … MUST be bounded, and` / `  the bound MUST be configurable …`),
  including one Spanish item.
- 2 duplicates are continuation lines that start by citing an ID
  (`  FR-015 holds in eight of ten discovery paths.`).
- 10 are wrapped lines of notes, open questions, clarifications or "Never" lists that
  cite the governing ID (`(FR-009)`, `(NFR-001)`), and 1 is a design note that "mechanically satisfies
  FR-006". They restate or explain a requirement; none states a new one.
- 1 is uncertain: a two-line paragraph whose first line states a rule
  (`The LLM response must be a valid SKILL.md.`) and whose second line cites
  `(see FR-006)`. A single-line version is identified under 0.1.9 too, because any
  ID on a line counts.

**Pilot repository (development data, all 83 features, committed `HEAD`, counts
only).** 40 of 304 I1.2/I2.3 findings are removed: 35 missing identifiers and 5
duplicates. None is added, and 5 features change I1.2/I2.2 status. The remaining
I1.2 missing-identifier findings are, by structure: 93 continuation lines of items
or paragraphs that carry no ID anywhere, 76 lines after a blank line, 36 list items
of their own and 6 table rows. 11 duplicates remain, none on an indented line.

**Known limits.**
- An ID cited anywhere in an item or paragraph identifies all its lines, as a
  mid-line mention already identifies its own line in 0.1.9.
- An unindented line that starts with an ID is still a definition, so a wrapped
  paragraph line such as `REQ-001 episodes already written.` without indentation
  still counts as a duplicate. This keeps one-requirement-per-line paragraphs.
- Other line-local rules are unchanged: a continuation that starts with a pronoun
  (`  that …`) can still get E1.3, and E1.2/E2.1 still read one physical line.

**Decision.** Propose H5 (engine 0.1.10) for merge after independent adjudication
of the removed findings. The owner fixes the threshold before labeling; the H3a
packet builder (`scripts/precision/definitions-packet.ts`) applies unchanged to
the H5 scan.


### H5 adjudication — **fails the threshold; continued as H5a (owner decision)**

The owner fixed the threshold on 2026-11-25 (`8131ae9`), before labeling: at most 2
of the 38 removed findings may be agreed true problems. Two independent agent
sessions labeled the full packet separately, without engine output, the key, the
provisional review or each other's labels.

| Removed (38) | Agreed negative | Agreed positive | Disputed | Unknown |
|---|---|---|---|---|
| Count | 31 | 3 | 4 | 0 |

Cohen's kappa 0.55.

- **Agreed positive (3), over the threshold.** Each is a prose paragraph or item
  that states its own rule, where the only ID in the unit is a citation:
  `The LLM response must be a valid SKILL.md. … (see FR-006)`; a design paragraph
  that "satisfies FR-006"; a conditional rule beside `(NFR-001)`. H5 counts the
  unit as identified because any ID in it counts.
- **Disputed (4).** Items of "Never" lists or notes that end with a trace tag
  (`(FR-009)`, `(FR-014)`, `(FR-020)`, "per FR-005"). One reviewer read the tag as
  the item's identifier; the other read it as a cross-reference.
- The 31 agreed negatives are continuations of items or paragraphs led by a
  defining ID, and the 2 duplicates.

**Failing construction.** Unit identification by a cited ID. All 7 positive or
disputed items fall in it, and none of the 31 agreed negatives depends on it.

**Decision.** The owner chose a narrowed H5a (a unit
counts as identified only when its first line has a defining ID, so citations no
longer identify wrapped lines), pre-registered as H5a below.

### H5a: only a unit's defining first line identifies its continuations — **holds; proposed for merge**

- Pre-registered at `4eb3108`, after the H5 adjudication failed.
- The sources (4 repositories, `"**NFR-001**"` query; `"- **REQ-001**"` had no
  eligible repository) and 22 EN/ES twins were frozen at `816fcf7`.
- Candidate: `81ed209`, engine 0.1.11 (0.1.10 is H6). Comparators: 0.1.9 (`c3f79b0`)
  and H5 (`9336e2b`).
- **Version at merge.** H5a lands before H6, so it ships as engine 0.1.10 (merged with
  `develop` after #95, product 0.2.3). The rules are those of `81ed209`; only the
  version string changes.

| Gate | Result |
|---|---|
| 1. Twins (22 EN/ES), H3a twins, minimal pairs | holds: 22 of 22 (0.1.9 meets 14, H5 meets 18, failing exactly the 4 cited-ID twins); H3a 20 of 20; minimal pairs unchanged |
| 2. 716 historical predictions | holds: 0 changed |
| 3. H5 development set | holds: all 7 adjudicated positive or disputed findings are kept. Relative to H5, 12 findings come back: those 7 and 5 the H5 reviewers agreed were false (notes and open questions that cite an ID) |
| 4. Fresh set and adjudication | holds: 0 findings added; 0 of 27 removed findings agreed true problems (threshold 2) |
| 5. Evidence | holds |

**H5 development set against 0.1.9.** 167 features: 26 findings removed (24
continuations of items led by a defining ID, and 2 duplicates), none added.

**Fresh set.** 109 Spec Kit features in 4 roots. 27 I1.2 missing-identifier
findings are removed, and none is added.

**Adjudication.** The threshold (at most 2 of 27 agreed positive) was confirmed
by the owner before labeling (`106c986`). The two H5 reviewer sessions labeled the
packet separately; having labeled the H5 packet before is a limit.

| Removed (27) | Agreed negative | Agreed positive | Disputed | Unknown |
|---|---|---|---|---|
| Count | 26 | 0 | 0 | 1 |

Cohen's kappa 1.00. Both reviewers marked one item `unknown`, because the wrapped
item's first line lay outside the six-line context. In the pinned source that line
is `- **FR-018**: Any authenticated user MUST …`, seven lines above. It is not a
true problem, and the threshold holds either way.

**Pilot repository (development data, all 83 features, committed `HEAD`, counts
only).** 34 of 304 I1.2/I2.3 findings are removed: 29 missing identifiers and 5
duplicates. None is added, and 5 features change I1.2/I2.2 status. H5 removed 40;
the 6 it no longer removes are units identified only by a cited ID.

**Known limits.**
- An unindented line led by an ID still starts its own requirement, so a wrapped
  paragraph line such as `REQ-001 episodes already written.` still counts as a
  duplicate.
- A wrapped item that cites its governing ID only in a trace tag is still reported
  as lacking an identifier. That is deliberate: such items were disputed.
- Other line-local rules (E1.2, E1.3, E2.1) still read one physical line.

**Decision.** Propose H5a (engine 0.1.10 at merge) for merge.

### H6: acceptance scenarios, validation tables and Spec Kit quickstart — **holds provisionally; E3.2 unconfirmed; proposed for merge pending adjudication**

Tracking: [#88](https://github.com/jayanez/spec-torque/issues/88).
- Pre-registered at `20d9a85`.
- The sources (5 repositories: `"SC-001: Given"` in `spec.md` filled 1 of 4,
  `"python3 -m pytest"` in `quickstart.md` filled 4), 16 EN/ES twins and the replay
  (`scripts/precision/verification.ts`) were frozen at `ec1fcca`.
- Candidate: `2cda71c`, engine 0.1.10. Comparator: 0.1.9 (`develop`, `c3f79b0`).
- **Version at merge.** H5a merged first as engine 0.1.10 (#96), so H6 ships as
  engine 0.1.11 with product 0.2.4. It was measured again against `develop` with
  H5a; see the H6 adjudication entry.
- **Rebase (owner decision, 2026-11-25, after both adjudications).** H6 was first
  built on H5 (engine 0.1.11, comparator 0.1.10 at `13cfd0d`). H5 failed its
  adjudication, so H6 was rebased onto `develop` unchanged except for the engine
  version. Every measurement below was repeated against 0.1.9 and is identical to
  the run against H5: the twins, the H3a twins, the minimal pairs, the 716
  predictions, the fresh-set totals with the same changed features and E3.1
  evidence lines, and the pilot totals. The H6 rules do not interact with H5's.

The replay discovers with the work-tree rule (basename only), as local analysis
does. GitHub import already matches every Markdown file under `specs/`, so it
already read `quickstart.md`.

| Gate | Result |
|---|---|
| 1. Twins (16 EN/ES), H3a twins, minimal pairs | holds: 16 of 16 (0.1.9 meets 8, failing exactly the 8 target cases); H3a 20 of 20; minimal pairs unchanged |
| 2. 716 historical predictions | holds: 0 changed; artifact sets and unknown practices identical in all 36 cases |
| 3. Fresh set | holds provisionally: nothing goes down; every new E3.1 and E3.4 evidence line is genuine; **no E3.2 change occurs, so the E3.2 rules are not confirmed on fresh data** |
| 4. Evidence | holds: no evidence changes in the minimal pairs |

**Fresh set.** 197 Spec Kit features in 5 roots; every change falls in one root
(132 features), and 129 `quickstart.md` files are added as context artifacts.
- Status: E3.1 `missing` → `partial` in 13 features, E3.4 in 2; no status and no
  dimension score goes down; 8 dimension scores go up.
- E3.1: all 13 first evidence lines are Spec Kit `**Acceptance Scenarios**:`
  blocks with numbered Given/When/Then scenarios. E3.4: both are a
  `## Definition of done` section of a `quickstart.md`.
- E3.2: no change. The features that gained a quickstart already had E3.2 from
  other documents, and no validation table row matched.
- Added findings, all on `quickstart.md` lines: 15 E2.1, 5 E1.3 and 1 E1.2. They
  are the line-local rules running on procedure text with a modal word
  (`Both must return … and **must not** make any POST`, `This single assertion
  *is* FR-039.`), the same kind they produce on any other context document. Most
  are not useful findings.

**Pilot repository (development data, all 83 features, committed `HEAD`, counts
only).** 57 `quickstart.md` files are added. E3.1 goes `missing` → `partial` in 59
features and E3.2 in 16; nothing goes down; 37 dimension scores go up. Added
findings: 5 E2.1 and fewer than 5 E1.3. After the candidate, E3.1 is `partial` in
68 features and `missing` in 15; E3.2 is `partial` in 18 and `missing` in 65,
including 47 that have a quickstart.

**Unpredicted result.** #88 assumed that the pilot quickstarts run `python3 -m
pytest`. A token count shows 1 of 57 does; 24 run `python3 -m unittest` and 43 run
`python3 scripts/…`. Neither is in the E3.2 vocabulary, which H6 did not change, so
the quickstart change moves E3.2 in far fewer pilot features than #88 expected. The
vocabulary was not widened after the fact.

**Known limits.**
- Indexing `quickstart.md` lets line-local rules (E1.2, E1.3, E2.1) report on its
  procedure text.
- The identifier cell of the validation-table rule is case-insensitive, so a cell
  such as `| utf-8 |` counts as an identifier when the row also names a test file.
- A one-line Given/When/Then counts for E3.1 whatever its role in the text.

**Decision.** Propose H6 (engine 0.1.10) for merge after independent adjudication
of the new E3 evidence; the owner fixes the threshold before labeling. The owner
also decides whether to pre-register an H6a for further runner vocabulary
(`python3 -m unittest`, script runners), with a fresh set chosen for it.


### H6 adjudication — **holds; proposed for merge with known limits**

The owner fixed the threshold on 2026-11-25 (`e81fcec`), before labeling: at most 1
of the 15 new evidence lines may be agreed not genuine or remain unknown. Two
independent agent sessions labeled the packet separately. They saw no engine
output, key, provisional review or each other's labels. The packet was built
before the rebase; its evidence lines are identical against 0.1.9.

| New evidence (15) | Agreed positive | Agreed negative | Disputed | Unknown |
|---|---|---|---|---|
| Count | 14 | 1 | 0 | 0 |

Cohen's kappa 1.00.

- Apart from one, the 13 E3.1 lines and 2 E3.4 lines are Spec Kit acceptance
  scenario blocks and quickstart "Definition of done" sections.
- The agreed negative is a spec-quality checklist item
  (`- [x] Requirements and acceptance scenarios are testable.`) in a
  `checklists/requirements.md` classified as spec. It names acceptance scenarios
  without stating one. This is added to the H6 known limits.

**Limits of this adjudication.** Both reviewers are sessions of the same model
family (#65). E3.2 had no new evidence on the fresh set, so the validation-table and
quickstart rules are not adjudicated on fresh data.

**Decision.** Propose H6 (engine 0.1.11 at merge) for merge, within the threshold. H6a
(runner vocabulary such as `python3 -m unittest`) follows, as decided.

### H6a: quickstart as validation evidence only, plus test runners — **holds; proposed for merge**

Tracking: [#88](https://github.com/jayanez/spec-torque/issues/88).
- Pre-registered at `97da6ce` (owner decision after H6).
- The sources (8 repositories, `"python3 -m unittest"` and `"go test ./..."` in
  `quickstart.md`) and 12 EN/ES twins were frozen at `61b379f`.
- Candidate: `7d56551`, engine 0.1.12, version 0.2.5. Comparator: 0.1.11 (`develop`,
  `56d4fea`).

| Gate | Result |
|---|---|
| 1. Twins (12 EN/ES), H6, H5a and H3a twins, minimal pairs | holds: 12 of 12 (0.1.11 meets 6, failing exactly the 6 target cases); H6 16/16, H5a 22/22, H3a 20/20; minimal pairs unchanged |
| 2. 716 historical predictions | holds: 0 changed; artifact sets and unknown practices identical |
| 3. H6 fresh set | holds: 21 findings removed, all on `quickstart.md` lines and exactly those H6 had added (15 E2.1, 5 E1.3, 1 E1.2); none added; E3.4 returns to `missing` in the 2 features where a quickstart "Definition of done" was its only evidence, as predicted |
| 4. H6a fresh set | nothing goes down; 3 quickstart E2.1 findings removed; E3.2 rises in 4 features. **Low power: only 5 Spec Kit features in the 8 roots, and all 4 gains come from one line** |
| 5. Evidence | holds |

**Fresh set.** Most repositories that a quickstart search finds are not Spec Kit
projects, so the 8 roots hold only 5 Spec Kit features. The 4 E3.2 gains share one
line, which every feature inherits from the root `CLAUDE.md`: `Run cross-validation
tests with: go test -tags compare_mergo ./pkg/merge/... -run CompareMergo -v`. It is
a real test command. No gain on the fresh set comes from a quickstart.

**Pilot repository (development data, all 83 features, committed `HEAD`, counts
only).** E3.2 goes `missing` → `partial` in 32 features, and nothing goes down.
The 6 findings on quickstart lines (5 E2.1, fewer than 5 E1.3) are removed, and
none is added. After the candidate, E3.2 is `partial` in 50 features and
`missing` in 33 (16 of those have a quickstart).

**Known limits.**
- Generic script runs (`python3 scripts/…`) do not count, by design.
- The runner vocabulary is substring-based, like the existing `pytest` and
  `npm test` terms.
- The runner terms reach every document role, not only the quickstart.

**Second fresh set (amendment H6a-2).** 481 Spec Kit features in 8 roots:
- E3.2 rises in 36 features.
- 116 findings on `quickstart.md` lines are removed (111 E2.1, 4 E1.3, 1 E1.2), and
  none is added. 3 open decisions written in quickstarts are no longer counted.
- In 11 cases another practice drops to `missing` because a quickstart was its only
  evidence (E3.3 2, P1.4 4, E1.1 1, P2.5 1, I1.3 3). That direction was predicted.
  6 dimension scores go down as a result, which the pre-registration did not state
  explicitly.

**Adjudication.** The owner fixed the threshold before selection: at most 2 of up to
30 lines agreed not genuine or unknown. The packet holds all 28 distinct new E3.2
evidence lines. Two new blind agent sessions labeled it separately: 27 are agreed
genuine and 1 is disputed. The disputed line is a checked task to rewrite named
Ginkgo test files. One reviewer read it as an implementation task, the other as a
test reference. Counted against the threshold, it still passes: 1 ≤ 2.

**Decision.** Propose H6a (engine 0.1.12, version 0.2.5) for merge.

### H8: plan-local `R-n` labels are not requirement references — **holds; proposed for merge**

Tracking: [#80](https://github.com/jayanez/spec-torque/issues/80).
- Pre-registered at `ce11cce`.
- The sources (8 repositories: `"R-001" path:specs` in `plan.md` and `"R-1" path:specs`
  in `tasks.md`) and 10 EN/ES twins were frozen at `067cc80`.
- Candidate: `1a1f4a5`, engine 0.1.13, version 0.2.6. Comparator: 0.1.12 (`develop`,
  `3a888f0`).
- The H3 replay script now also compares the I2.3, C1.3 and C2.3 statuses and lists
  status-only changes in its detail file. A rerun of an earlier scan can therefore
  report more status changes than the recorded totals; its findings are unchanged.

| Gate | Result |
|---|---|
| 1. Twins (10 EN/ES), H6a, H6, H5a and H3a twins, minimal pairs | holds: 10 of 10 (0.1.12 meets the 4 controls and fails exactly the 6 target cases); H6a 12/12, H6 16/16, H5a 22/22, H3a 20/20; minimal pairs 0 changed rows |
| 2. 716 historical predictions | holds: 0 observations and 0 metric groups changed (`corpus:report -- --baseline origin/develop`) |
| 3. Fresh set | holds: 557 findings removed, all I2.3 "Reference R-n has no definition" in features whose specification has no `R-n` token; none added; 11 status changes in 4 features, all `partial` → `missing` (I2.3 3, C1.3 4, C2.3 4) |
| 4. Adjudication | holds: 0 of 100 removed findings agreed positive (threshold 2) |
| 5. Evidence | holds: no evidence is added; removed traceability edges and findings only |

**Fresh set.** 557 Spec Kit features in 8 roots. The 557 removed findings come from
6 repositories, 53 features and 476 distinct lines, on `plan.md`, `tasks.md` and
other plan- or tasks-role documents. Two repositories had none.

**Adjudication.** The owner fixed the threshold before the packet was drawn
(`1633d19`): at most 2 of 100 agreed positive, disputed items counted against it.
The packet (`45319b9`) holds 100 of the 557 removed findings (seed 42039), with six
lines of context and the label's occurrences across the feature's Markdown
documents. Two new blind agent sessions labeled it separately.

| Removed (100) | Agreed negative | Agreed positive | Disputed | Unknown |
|---|---|---|---|---|
| Count | 100 | 0 | 0 | 0 |

Raw agreement is 100/100; Cohen's kappa is undefined because neither reviewer used a
second label. The reviewers read the labels as research decisions (`R-1:` headings
in `research.md` or the plan's Phase 0), the plan's own risk and test tables, and
numbered steps. One reviewer gave templated reasons (14 distinct for 100 items);
both reviewers are agent sessions of one model family, which is a limit.

**Pilot repository (development data, 86 open features, work tree, counts only).**
10 I2.3 findings are removed, all `R-n` labels in one feature's plan and tasks, and
none is added. 10 traceability edges are removed. No practice status or dimension
score changes.

**Known limits.**
- The family test is feature-wide, not per label. A specification that numbers its
  risks or research items `R-1` makes every plan-local `R-n` label a reference
  again, so those labels stay reported.
- Any `R-n` token on a specification line counts, including fenced examples and
  HTML comments. That keeps findings rather than hiding them.
- A plan that cites an undefined `R-n` requirement while the specification uses only
  `FR-` IDs is no longer reported. The fresh-set adjudication found no such case.
- The P1.3 catalog pattern (`[A-Z]{1,8}-\d+` near a dependency word) still reads a
  plan-local `R-n` as dependency-traceability evidence. P1.3 is outside the frozen
  I2.3/C1.3/C2.3 scope.

**Decision.** Propose H8 (engine 0.1.13, version 0.2.6) for merge.
