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

A line that states a rule of its own and also quotes an example is a `requirement`. Use
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
