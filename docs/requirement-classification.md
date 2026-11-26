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

## H3 pre-registration: deterministic line grammar (2026-11-22, before any H3 code)

H3 is Phase A. It is a pure function of the line, its heading chain and its fence and comment
state. It uses no model, no network and no data other than the artifact. It is frozen by this
section and by the stop rules below. The ordered rules are the only feature families; DEV rounds
may adjust the patterns inside a family but may not add a family without a dated amendment here.

### Scope

- Spec-role artifacts only. Every other role keeps the 0.1.4 rule (an ID or a normative modal,
  outside fences, headings, quotes and scenario steps), so plans and tasks are unchanged.
- Engine `ENGINE_VERSION` stays `0.1.4` until Phase C. The candidate is identified by its commit.
- `Line.kind` is `requirement`, `acceptance` or `other`. `Line.requirement` is
  `kind === 'requirement'`. `acceptance` lines are measured and exposed but feed no practice.

### Rules (first match wins)

1. **Structure, other.** Inside a fence (the 0.1.4 toggle), a heading, a blockquote, a blank line,
   or an HTML comment line (including the lines of a multi-line comment).
2. **Change-log section, other.** The heading chain contains a heading matching
   `change ?log|history|revision|historial|cambios` (case-insensitive).
3. **Question, other.** The line, after removing a list marker and a leading ID prefix, ends in
   `?` (optionally followed by closing markup) or starts with `¿`.
4. **Modal obligation, requirement.** The line has a normative modal as in 0.1.4
   (`hasNormativeModal`, including the calendar-May and month-enumeration exclusions) and at
   least one modal is not inside a mention. Mentions are keyword-only code spans, straight
   double quotes bounded by non-word characters, curly double quotes and guillemets. This
   includes scenario and criterion lines, per the 2026-11-22 owner decision.
5. **Acceptance.** A scenario step (`GIVEN|WHEN|THEN|AND|BUT|DADO|CUANDO|ENTONCES|Y` at the start
   of the line, after an optional list marker and bold markup), a `SC-<n>` line, or a bullet or
   numbered item under a heading matching
   `acceptance criteria|success criteria|scenario|criterios de (aceptación|éxito)|escenario`.
6. **Defining-position ID, requirement.** One of `FR|NFR|RF|RNF|REQ|R` followed by `-<n>` in the
   defining position of H2d: after optional whitespace, an optional list marker, an optional task
   checkbox, an optional opening `|` of a table row, and optional bold or code markup. A
   mid-sentence ID alone is a cross-reference and stays `other`.
7. **Requirements section, requirement.** The heading chain contains a heading matching
   `requirements?|requisitos?|constraints|restricciones|functional|funcionales|non-functional|no funcionales`,
   or the line is under an OpenSpec `### Requirement:` heading, and the line is a bullet or
   numbered item that either
   - starts with `No|Never|Sin|Nunca|Ningún|Ninguna` (a negative constraint), or
   - starts with an imperative or infinitive verb: its first word, after an optional ID prefix and
     bold markup, has at least 2 letters, is not in the closed stop list below, does not end in a
     nominal suffix (`-ing`, `-tion`, `-sion`, `-ment`, `-ness`, `-ity`, `-ción`, `-sión`, `-miento`,
     `-idad`, `-mente`) and, for Spanish, ends in `-ar|-er|-ir|-ar(?:se)?` when it starts with a
     lowercase letter or is a sentence-case infinitive. English base verbs are recognised only by
     exclusion, so the stop list is the whole lexicon.
8. **System subject, requirement.** Anywhere in a spec, the subject
   `(the |el |la |los |las )?(system|sistema|app|application|aplicación|api|service|servicio|platform|plataforma|server|servidor)`
   followed by `will|shall|can|is able to|es capaz de|permite|permitirá|podrá|guardará` or any
   `-rá|-rán` future form of a verb.
9. **Otherwise, other.**

**Closed stop list for rule 7** (function words and common noun-phrase openers; extension in a DEV
round is allowed only with closed-class words and is recorded in the round's commit):
`the a an this that these those it its they we you i he she there here each every all any some
one in on at for to of with by from as if when while where which who what how why and or but so
also see note e.g. i.e. el la los las un una unos unas este esta estos estas ese esa eso esto
ello se su sus en de del con por para como si cuando donde que quien y o pero también ver nota
cada todo todos toda todas algún alguna cualquier mi tu nuestro`.

### Gate, DEV and T1

- The gate is the one fixed above: three one-sided 95% Clopper-Pearson bounds, counted by
  lineage, with at least 100 lineages each. Labels come from two blind agent reviewers plus an
  agent adjudicator; the rule's author never labels.
- **DEV:** at most 3 rounds. Each round is one commit; error analysis reads DEV only.
- **T1:** scored once, after a freeze commit whose SHA is written in this document. Opening or
  scoring T1 before that commit voids T1. A failing T1 means Phase B, never a T1 retry.
- **Synthetic and historical controls:** zero regressions in the `fence-control`,
  `admission-control`, `comparator` and `encoding` families; every changed prediction among the
  716 historical lines is adjudicated by an agent that did not write the rule. An unjustified
  change counts as a regression.
- **Probe path.** The probe takes the kind from `classifyLines` on the full document when the
  engine exports it, with no line isolation, because lines without modal or ID can now be
  admitted and another line could otherwise make a practice non-`unknown`. Engines without
  `classifyLines` keep the 0.1.4 practice-based path.

## H3 freeze (2026-11-22)

H3 is frozen at engine commit `dbdb24c5026dd98ac41f2e85fc13cbae1df1e69b` (`src/core` and `scripts`
are identical to DEV round 1, `f836440`). T1 is scored once, with the engine at the freeze
commit that adds this section.

Differences between the pre-registration wording and the frozen rules, all inside the rule
families above and made before this freeze:

- **Rule 6.** The ID names also include `C` and `CON` (constraint IDs in defining position). Found
  by the synthetic `constraint-id` family before any DEV scoring.
- **Rule 7.** Task-checkbox items (`- [ ] …`) are not requirements (synthetic `id-position`
  family). Only the innermost heading is tested, not the whole chain, so a glossary under a
  requirements heading is not a requirements section (DEV round 1). A line is Spanish when it has
  more Spanish than English function words; only then is an infinitive required.
- **Rule 8.** The subject does not count when it sits inside a mention (DEV round 1).
- **Rule 5.** A scenario keyword on a bare line must be uppercase; as a list item or in bold it may
  use any case. `AND`, `And`, `BUT`, `But` and `Y` are matched in those exact cases (DEV round 1).

DEV rounds used: 1 of 3. Synthetic replay against `d06c023`: 0 regressions. Historical
controls: the 716 historical predictions are unchanged (0 changed), so no adjudication was
needed. Round 1 results are in [precision decisions](precision-decisions.md#h3-deterministic-line-grammar-on-dev).

## H4 pre-registration: local-model line classifier (2026-11-22, before any H4 code)

Phase A (H3) failed on T1, so Phase B runs (see [precision decisions](precision-decisions.md)). H4 asks
whether a local model, given what a reviewer sees, classifies lines within the gate. It is an
optional assistant: it never changes the deterministic engine, and no model call is automatic.

### Candidate

- **Unit and output.** One decision per line: `requirement`, `acceptance`, `other` or `unknown`.
  `unknown` is scored as `other` (it costs recall, never precision). A response that is not a valid
  member of the closed enum, a timeout and a server error also count as `unknown`.
- **Input.** The heading chain, two lines of context on each side and the line, as in the label
  guide. The system prompt says the text is untrusted data.
- **Pre-filter.** A line that H3 rules 1–3 settle as `other` (structure, change-log section,
  question; `admitLine` in `src/core/admission.ts` on branch `claude/h3-line-grammar-52-4fb9b0`)
  gets no model call.
- **Prompt.** The label guide v2 as instructions, with the guide's own examples as the only few-shot
  examples. No DEV or test item text enters the prompt. The prompt hash is recorded at the freeze.
- **Model and sampling.** One local model, `qwen3.5:9b` (Ollama digest `d63f830f28d5`), loopback
  endpoint only, no download. Five samples per line at temperature 0.7, seeds 42039 to 42043,
  structured output with the closed enum. The majority kind wins when at least 4 of 5 agree;
  otherwise the line is `unknown`.
- **Allowed DEV changes.** The prompt wording and its examples. The enum, the sampling, the
  pre-filter and the model are fixed.

### Sets and stop rules

- **DEV.** The 300 labeled DEV items. At most 3 rounds, one commit each.
- **Early stop.** After the last DEV round, if DEV shows more than 2 lineages of admitted
  non-requirements or more than 3 lineages of missed requirements, T2 and T2b are never opened and
  H4 is recorded as failed on DEV. Counts only.
- **T2 and T2b.** The Phase B test sets, scored together once, after a freeze commit that names the
  model digest, the prompt hash and the seeds. A look before that commit voids them. T2 alone has
  189 lineages, which at T1's rate of 33% carries about 63 requirement lineages, short of the
  100 the gate needs. T2b adds repositories before any H4 code, so that T2 and T2b together can
  reach 100.
- **T2b rule.** The T2 rule, applied after every repository used in DEV, T1 and T2: GitHub code
  search with `system` and `sistema` by the five family paths, results in search order, up to 4
  per family and query, public, non-fork, not archived, MIT or Apache-2.0, every repository and
  owner from #39, #51, DEV, T1 and T2 excluded, no owner twice, each pinned to its default-branch
  head SHA, no file content read. Shortfalls are recorded as `unfilled`.
- **Labels.** Two blind agent reviewers and an agent adjudicator, as for DEV and T1. The author
  of the candidate never labels and never reads T2 or T2b items.
- **Outcome.** If any of the three bounds fails, H4 fails: stop, record the decision, and the
  engine stays at 0.1.4. A pass means only that an opt-in local assistant may be planned.

### Amendment (2026-11-22, before DEV round 1)

The local runner (Ollama 0.40.16, MLX) answers "structured output is unavailable" for the `format`
schema. The closed enum is therefore requested in the prompt and validated locally (commit
`3c21071`); any answer outside the enum counts as `unknown`, as above. The enum, sampling,
pre-filter and model are otherwise unchanged. The change was prompted by that runner error, not by
any DEV score, and was committed before the first DEV round finished.
