# Requirement-line classification (#52)

#51 showed that no single bounded rule makes admission precise. This document fixes the
definition, the measurement and the stop rules for treating admission as a classification
problem, **before** any candidate is built or any test set is labeled. Candidate
pre-registrations (H3, H4) are appended below before each phase starts.

## Unit and decision

The unit is the line, as in the engine and the evidence locators. A classifier assigns each
line of a spec artifact (outside fences and headings) one kind:

| Kind | Meaning | Feeds |
|---|---|---|
| `requirement` | The document itself imposes an obligation, constraint or rule, in any wording. | E1.4, E1.2, E2.1, I1.2 |
| `acceptance` | An acceptance scenario step or a success criterion. | Measured only; no practice consumes it yet |
| `other` | Prose, rationale, a question, a change-log entry, a cross-reference, or a mention or quote of a modal word or ID. | Nothing |

## Label guide v2

Reviewers label the line, using the heading chain and two lines of context on each side. The
closed label set is `requirement`, `acceptance`, `other` and `unknown`.

| Example | Label |
|---|---|
| `- No schema change to the events table.` | `requirement` |
| `EL SISTEMA guardará el historial de cambios.` | `requirement` |
| `The system can detect duplicate entries.` (under Requirements) | `requirement` |
| `- THEN the account is locked` | `acceptance` |
| `SC-001: 95% of users finish checkout in under 2 minutes.` | `acceptance` |
| `See FR-003 for the full rule.` | `other` |
| `C-2: ¿Aplica a invitados?` | `other` |
| `Changed MUST to SHOULD in FR-004.` (change log) | `other` |
| `The word "MUST" is reserved.` | `other` |

A line that states a rule of its own and also quotes an example is a `requirement`.

**Scenario and criterion lines with a modal (decided 2026-11-22, after the first blind labels).**
A scenario step or acceptance-criterion line that contains a normative modal and imposes an
obligation (`THEN the system SHALL lock the account`, `WHEN … THE X SHALL …`) is a
`requirement`. `acceptance` is for steps and criteria that impose no modal obligation of their
own (`THEN the account is locked`, `GIVEN a user with 4 failed attempts`, `SC-001: 95% finish
in under 2 minutes`). This follows the historical E1.4 controls, which count such lines as
requirements. The first blind pass disagreed mostly on these lines (kappa 0.77 on DEV), so
the guide was clarified before any adjudication or scoring. Use
`unknown` only when the line and its context do not settle the label.

## Gate (fixed before labeling)

All bounds are one-sided 95% Clopper-Pearson upper limits, counted by lineage: a lineage is an
error when any of its items is. Each bound needs at least 100 lineages; with fewer, the bound
fails. Adjudicated `unknown` counts as an error.

| Bound | Population | Error | Limit |
|---|---|---|---|
| Precision | Lines the arm admits as `requirement` | Adjudicated as anything else | ≤5% |
| Recall | Lines adjudicated `requirement` or `unknown` in a uniform prose sample | The arm does not admit them | ≤5% |
| Acceptance | Lines the arm tags `acceptance` | Adjudicated as anything else | ≤10% |

The gate measures admission only. The effect on E1.4, E1.2, E2.1 and I1.2 is reported as a
difference and does not block. Engine 0.1.4 is measured with the same protocol as a baseline
and is not gated. `scripts/precision/score.ts` computes the bounds.

## Splits

Each set is frozen (sources, revisions and sampling seed recorded) before the step that
uses it, and the three sets share no lineage.

| Set | Use | Opened |
|---|---|---|
| DEV | The 591 adjudicated lines from #51, re-mapped to v2, plus a uniform DEV sample from the existing frozen source sets | Freely, for iteration |
| T1 | Phase A test: new public sources; a uniform prose sample plus lines the candidate admits | Once, after the candidate is frozen |
| T2 | Phase B test: new public sources, frozen at the start of Phase B | Once |

Restricted roots run locally by the operator, report only global counts, and never take part in
a gate.

## Labelers

Two reviewers who did not write the rule label every item independently, without seeing arm
decisions or each other. An adjudicator resolves every disagreement and every `unknown`. The
owner audits a sample. The author of a rule never labels for it.

## Stop rules

- Each phase has at most 3 DEV iterations. Each test set is opened once.
- Phase A (H3, deterministic grammar) runs first. Phase B (H4, local-model classifier) runs only
  if A fails its test.
- If B also fails, stop and record the decision. The engine stays at 0.1.4.
- A test set viewed before its candidate is frozen is void. Use a fresh set or stop.

## Tooling

- `scripts/precision/adjudication-packet.ts --population prose --sample <n>` builds a seeded
  sample of distinct prose lines from the spec artifacts of public roots, with the heading
  chain and two lines of context. Items carry no arm decision and `key.json` is empty.
- `scripts/precision/predict.ts` writes an arm's per-item kinds for a packet (engine at `--ref`).
- `scripts/precision/score.ts` computes the three bounds and kappa from the labeled packet and
  the predictions.
- `scripts/precision/sources.ts` holds the root and artifact enumeration shared with the
  replay scan.

## Synthetic families

`fixtures/precision/minimal-pairs.json` gained 20 EN/ES cases whose expected `kind` is a
constructed reference, not an independent label: `requirement-wording` (imperative, negative
constraint, future tense, capability), `section-context`, `acceptance` (scenario steps and
success criteria) and `non-requirement` (question, change log, cross-reference). Each has an
opposite-outcome twin. Engine 0.1.4 admits the expected line in 8 of 16 `requirement-wording`
targets, 2 of 4 `section-context`, 8 of 8 `acceptance` (excluded, as intended) and 8 of 12
`non-requirement`. These counts are the synthetic baseline and are measured, not gated.

## Frozen sources (2026-11-22)

The three source sets were chosen mechanically, before any file content was read and before any
candidate exists: `fixtures/precision/r52-dev-sources.json` (17 repositories),
`r52-t1-sources.json` (16) and `r52-t2-sources.json` (15). The rule is recorded in each file:
GitHub code search with the neutral terms `system` and `sistema` by the family paths, results
dealt to the three sets in turn, public non-fork MIT or Apache-2.0 repositories, every
repository and owner from #39 and #51 excluded, no owner in two sets, each pinned to its
default-branch head SHA. Spec Kitty has 1 qualifying repository and BMAD 5 for `sistema`;
those gaps are recorded in `unfilled`. The sets are not changed after this commit.

## Sampling amendment (2026-11-22, before any candidate)

`adjudication-packet.ts` takes `--per-lineage` and `--per-root` to stratify prose samples. The
first T1 sample was capped per repository only and had too few lineages, so T1 was extended
with one line per lineage. The final T1 is 879 distinct lines over 331 lineages. T2 has 189
lineages; its bounds are reported with their lineage counts and cannot pass if fewer than
100 lineages carry a requirement.
