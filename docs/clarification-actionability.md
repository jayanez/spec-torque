# E1.2 clarification actionability protocol

Status: **draft, not frozen.** The freeze is the last commit of the pull request that adds this file. That commit sets this line to "frozen", fills the pins marked *at freeze*, and its SHA-256 values for this file, `tests/fixtures/e12/rehearsal.json` and `tests/fixtures/e12/calibration.json` are posted in [#57](https://github.com/jayanez/spec-torque/issues/57) with the maintainer's confirmation, before the first session and before the pilot SHA freeze on 2026-11-30. After the freeze, changes need a dated amendment below. An amendment made after any participant data exists governs only a separately identified new run; the original run is analysed under its original rules and its result is kept.

## Decision

When an E1.2 clarification question is shown, do authors turn the decision their role brief supplies into the requirement often enough, and without new harm, to justify clarifiers for other practices? The answer gates two follow-ups that are not planned: generalising clarification beyond E1.2, and asking about failure behavior for state-changing operations.

**What this measures and what it does not.** On question cases the role brief supplies the decision. The endpoint is therefore *uptake of a supplied decision*: whether the question leads the author to write it into the requirement. It does not show that authors make new decisions, that questions help on real specifications, or that defects fall. A question nobody acts on is an effective false positive even when it is well formed.

This protocol adds one pre-registered endpoint to the optional E1.2 rehearsal in [#8](https://github.com/jayanez/spec-torque/issues/8) and keeps its other observations (fidelity, effort, pending ambiguities). Engine 0.1.4 and the pilot functionality stay unchanged. No practice status changes, so this is not the precision process in [requirement classification](requirement-classification.md).

## Materials

- Engine and workbench: the frozen pilot SHA.
- Cases: `tests/fixtures/e12/study.json` (12 cases from #39) and `tests/fixtures/e12/fresh.json` (12 lineages from #49), with `tests/fixtures/e12/rehearsal.json`. Both case sets are authored synthetic controls whose authors saw them while writing the rules, so participants are the only independent element.
- **Live cases** (`live: true`, 18) are those where the engine emits an E1.2 finding. **Calibration-only cases** (`live: false`, 6: four injected and two silent study cases) produce no finding, so neither arm has anything to show; they are used only for reviewer calibration.
- **Arms, frozen as rendered.** `rehearsal.json` records, per live case, the engine fields each arm shows: `armA` is the finding message, its suggestion and its evidence lines; `armB` adds the clarification result (kind, question if any, localized reason) and its evidence lines. The finding message and suggestion are the engine's English text in both languages, as in the current workbench. The four hand-authored questions from #39 are not used.
- **Presentation pages.** Participants see static pages, not the workbench, because the workbench always shows the clarification and arm A must not. A page builder (pending, not started) renders one page per live case, arm and language from `rehearsal.json` and fixed UI strings: the source with the target line marked, every fixture companion with its path, the role brief, the finding with its evidence, and in arm B a clarification block with the question or reason and its evidence. Arm A has no clarification block. Out-of-scope companions (the video preview plan, the current OpenSpec specification) are shown like any other companion; only evidence lines are highlighted. Each page carries an opaque presentation ID, the first 12 hex digits of SHA-256 over `<protocol SHA-256>:<case id>:<arm>`. At freeze the engine fields are re-captured on the pilot SHA and must match byte for byte, and the SHA-256 of every page is recorded. Both arms get the same source, companions and role brief.

| Live case group | EN | ES | Use |
|---|---|---|---|
| Question cases (`outcome: ask`, engine returns a question) | 6 | 4 | Primary endpoint |
| Clear and abstention controls (`clear`, `abstain`) | 3 | 3 | Harm checks |
| Review referrals (`review`) | 0 | 2 | Harm checks |

All SHA-256 values in this protocol are computed over the file with line endings normalised to LF. SHA-256 at drafting: `study.json` `56710e687f8f1ba22212e018b7fdf39c77a797d74911e6b0ba3627c382a0a383`, `fresh.json` `d7195fd51c7b528296af76761c4ce4c5ee8121ab63530fa2059c3015d08afa73` (the value recorded for #49).

The sets are not balanced: Spanish has fewer question cases, and only Spanish has review referrals. The 10-attempt floor below takes at least 2 complete EN participants and 3 complete ES participants in each arm.

**Invariant overrides.** For three study cases `rehearsal.json` replaces one copied invariant to state what the open slot qualifies rather than the slot itself: `228ec77b3f37` and `436caf929622` (open decision → obligation qualified), `42f7f18229bc` (prohibition stays in force while its scope is confirmed). `study.json` is unchanged.

### Before freeze

| Item | State |
|---|---|
| `rehearsal.json`: role briefs, open slots, acceptable resolutions, invariants, live flags and arm renderings for all 24 cases | Drafted, revised after independent review |
| `calibration.json`: 72 keyed items plus a 24-item reserve | Drafted, revised after independent review |
| Participant information sheet with the consent text below | Pending |
| Page builder (`scripts/precision/rehearsal-pages.ts`) and packet builder (`scripts/precision/rehearsal-packets.ts`), tested in `tests/rehearsal.test.ts` | Built; maintainer review pending |
| Pins marked *at freeze* | Pending |
| Maintainer review, then the freeze commit | Pending |

Both fixture files were written by a contributor who did not write the E1.2 detector, the clarification rules or the study and fresh fixtures, and were reviewed by a third model (`gpt-6.2-sol`) that is neither reviewer below. Neither reviewer may see either file before calibration. They are constructed controls, not independent labels.

### Tooling

Both builders write only to the git-ignored `.spec-torque/rehearsal/` folder and send nothing.

- `node --import tsx scripts/precision/rehearsal-pages.ts` re-renders every case with the engine, refuses to build if any frozen arm field differs, and writes one page per live case and arm plus `manifest.json` with each page's SHA-256.
- `node --import tsx scripts/precision/rehearsal-packets.ts --phase calibration|reserve` writes six packets (R1 and R2, runs 1 to 3) ordered by the seed rule. Calibration items carry opaque IDs; the map to fixture IDs and keys stays in `operator/`.
- `node --import tsx scripts/precision/rehearsal-packets.ts --phase live --attempts <attempts.json>` applies the consent, sanitization and completion boundary, checks presentation IDs, and writes the withheld list and leakage flags to `operator/`, never into a packet.

## Enrollment and assignment

- **Window:** the pilot, 2026-12-01 to 2026-12-10. Analysis runs once, after the window closes. There are no interim looks and no early stop.
- **Population:** voluntary pilot participants who write or review specifications, who choose EN or ES and a role (author or reviewer).
- **Assignment:** within each language and role, participants alternate between cohort 1 and cohort 2 in enrollment order. Live lineages are sorted by `id`. Cohort 1 sees arm B on odd positions and arm A on even positions; cohort 2 the reverse, in reverse case order. Each person sees one arm per lineage and each live case once.
- **Unpaired cohorts** are analysed as they are; the imbalance is reported.

## Participant response

For each case the participant submits:

- `action`: `edit`, `leave` or `escalate`;
- `scope`, for `edit`: `target line` (default), `requirement` or `scenario`, when the edit replaces or removes more than the target line;
- `text`: the resulting text of what `scope` names, required for `edit`; `(removed)` when it is deleted;
- `note`: optional for `edit` and `leave`, required for `escalate` (what is open and for whom);
- in arm B only, the answer to "Did the question help you decide?": `yes`, `no`, `not useful`, `no answer`.

The workbench records case and build, elapsed time, iterations, consultations, pending ambiguities and completion status as defined in #8.

## Consent and data boundary

Model adjudication sends participant-written text to two model providers, Anthropic and OpenAI. The participant information sheet says so before the first case and asks for an explicit yes.

- Without consent, the participant's attempts are not sent anywhere. They are reported as `not adjudicated` and excluded from every endpoint, with their count.
- Only the operator starts a review run, by hand, from a local packet. Nothing is sent automatically by the workbench, the CLI or the engine.
- Packets contain the case material and the participant's `action`, `scope`, `text` and `note`. They never contain identity, session IDs, timing or the arm.
- Before sending, the operator checks every `text` and `note` for names, contact details, credentials, or details of a real system or organisation. The operator never edits participant text. An attempt with any such content is not sent and is reported as `not adjudicated (sanitization)`.
- Records stay with the operator. Only aggregates are published, as in [privacy](privacy.md).

## Endpoints

Unless stated, every rate is computed per arm and per language over **eligible attempts**: every attempt assigned on a live case to a consenting participant, whatever its completion status. A timed-out, deferred or incomplete attempt stays in the denominator.

**Primary: supplied-decision uptake.** On question cases, the share of eligible attempts labelled `acceptable: yes` **and** `fills_slot: yes`. An attempt that was not completed, or whose combined label is `unknown`, counts as not taken up, in both arms.

**Lineage balancing.** Cohort assignment gives each arm a different mix of lineages, and unequal enrollment can weight that mix further. Every rate used by the decision rule is therefore computed per lineage and averaged with equal weight per lineage. For each endpoint, a lineage enters the average only if that endpoint's denominator is at least 1 in every arm the endpoint compares; the not-useful rate is arm B only, so a lineage enters it if it has at least one answer. An endpoint with no qualifying lineage is undefined, and an undefined endpoint makes that language insufficient. Excluded lineages are reported. Attempt-pooled rates are reported alongside.

**Missing adjudication.** Attempts withheld for lack of consent or by the sanitization check are excluded from every endpoint and reported with their count. Among sent attempts, a combined `unknown` label counts as not taken up for the primary endpoint and is excluded from the adjudicated denominators of the other endpoints, which report it separately.

**Secondary.**
- *Not-useful rate:* arm B question-case attempts answered `no` or `not useful`, over arm B question-case attempts with an answer. `no answer` is reported separately.
- *Invented-decision rate:* attempts labelled `invented_decision: yes`, over adjudicated attempts on all live cases. Combined `unknown` labels are reported separately, never counted as observed inventions.
- *Control damage:* on controls and review referrals, the share of adjudicated attempts labelled `acceptable: no`.
- *Escalation fidelity:* on review referrals, the share labelled `acceptable: yes` whose `action` is `escalate` or whose note records the blocker.
- *By outcome type:* acceptable resolutions on question cases, abstention controls and review referrals are reported separately.
- *Effort:* elapsed time, iterations and consultations, with denominators.

**Reporting.** For every rate, report attempts, distinct participants and distinct lineages, and the arm difference. Attempts share participants, lineages and cohorts, so no confidence interval is computed: results are descriptive for these fixed cases. Report the primary endpoint also with leaked items excluded.

## Decision rule

Per language:

| Result | Condition |
|---|---|
| Insufficient | Fewer than **10** eligible question-case attempts in either arm; **or** fewer than **5** arm B question-case attempts with a usefulness answer; **or** fewer than **3** adjudicated control or referral attempts in either arm; **or** fewer than **80%** of eligible question-case attempts in either arm with a combined `acceptable` and `fills_slot` label other than `unknown`. |
| Proceed | Arm B uptake ≥ **0.60**, **and** ≥ arm A uptake + **0.15**, **and** not-useful rate ≤ **0.30**, **and** arm B invented-decision rate counting its `unknown` labels as inventions ≤ arm A observed rate, **and** arm B control damage ≤ arm A. |
| Stop | Sufficient data and any proceed condition fails when evaluated with observed values only. |
| No decision | Sufficient data, every proceed condition passes on observed values, and only the conservative invented-decision comparison fails. |

Combined across languages, EN and ES carrying equal weight:

- **Stop** if any language stops and that language's adjudication gates pass. Stop takes precedence over an insufficient or ungated other language. A stop closes clarification beyond E1.2 and the failure-behavior follow-up, recorded in #57.
- **Proceed** only if both languages proceed and every adjudication gate passes.
- **No decision** otherwise. The results are reported as provisional and the follow-ups stay unplanned.

Proceeding is gated on the conservative invented-decision comparison, which counts arm B's `unknown` labels as inventions; the observed-only comparison is reported alongside. Reviewer uncertainty can therefore block proceeding, giving no decision, but cannot by itself cause a stop.

## Adjudication

Two model reviewers label every eligible, consenting attempt. Neither is an author of the E1.2 detector, the clarification rules, the fixture expectations or the calibration set, and the rule author's readings do not count. Results are reported as **model-adjudicated**: a product decision input, not human or scientific acceptance.

**Reviewers.**

| Reviewer | Pin | Notes |
|---|---|---|
| R1 | `claude-sonnet-5-5`, as a Claude Code subagent | Client version *at freeze* |
| R2 | `gpt-6-luna`, through `codex exec` | Accepted by `codex-cli 0.170.0` on 2026-11-23; client version *at freeze* |

Each reviewer runs in a fresh context with read access to the packet only. The clients do not expose a fixed sampling temperature; their defaults are recorded at freeze, and the three runs per item absorb sampling variation. If a pinned model is unavailable when a run starts, the run waits; substituting a model is an amendment.

**Packet.** One item per attempt or calibration resolution, containing: the source with line numbers and the target line marked; the scoped companion documents with paths; the role brief; the open slot, or `none` on controls; the acceptable resolutions; the invariants; and the response (`action`, `scope`, `text`, `note`). It never contains the arm, the question text, timing, participant data, the other reviewer's labels or the case outcome type.

**Order.** Items are sorted by SHA-256 over `<seed>:<item id>`, where the seed is the first 16 hex digits of SHA-256 over `<protocol SHA-256>:<phase>:<reviewer>:<run>`, with phase `calibration`, `reserve` or `live`, reviewer `R1` or `R2`, and run `1` to `3`.

**Item IDs.** Live items are identified as `live:<case id>:<presentation ID>:<attempt number>`.

**Leakage.** Only arm B shows a question. An arm B item is `leaked` when its `text` or `note` contains five or more consecutive words of the question text, after lower-casing, removing punctuation and collapsing whitespace. The packet builder flags it mechanically; the flag is never in a reviewer packet. Leaked items are labelled like any other.

**Labels.** The prompt in the appendix is part of this frozen file. Each reviewer returns JSON with three labels and a quoted span of the response for each `yes`:

| Label | Values |
|---|---|
| `acceptable` | `yes`, `no`, `unknown` |
| `fills_slot` | `yes`, `no`, `unknown`, `not_applicable` (open slot `none`) |
| `invented_decision` | `yes`, `no`, `unknown` |

A `yes` whose quoted span does not occur in the response is set to `unknown`; for a `leave` or `escalate` response the span may be the action word or a quote from the note. Malformed output is retried once. A missing or invalid value is recorded as `unknown` for that label only.

**Labelling rules** (also in the prompt):
- `fills_slot: yes` requires every component of the open slot to be stated in `text`. A decision stated only in `note` does not fill the slot.
- On a question case, `acceptable: yes` requires filling the slot as the acceptable resolutions require while keeping the invariants. A harmless restatement that leaves the decision open is `acceptable: no`. A rewrite that keeps every invariant and changes only wording is acceptable.
- Text outside `scope` is unchanged. Filling the slot supersedes any pending marker or sentence about that slot; the response need not delete it.
- Removing or weakening a protected clause within `scope` breaks an invariant (`acceptable: no`), even if other surviving text still states it. It is not an invented decision unless it also adds a value, owner, trigger or condition.
- Choosing, without authority in the role brief, a value that the material offers for another scope or among conflicting values is an invented decision.
- A concrete unsupported answer can fill the slot while being unacceptable and invented.
- On a control, leaving the requirement unchanged is acceptable unless the acceptable resolutions require recording or escalating an open decision.

**Stability.** Each reviewer labels each item 3 times. The reviewer's label is the majority; with no majority it is `unknown`. Instability is the share of items where the 3 runs are not unanimous, per reviewer and language over all three labels.

**Combining.** When both reviewers' labels agree, that is the label; otherwise it is `unknown`.

**Agreement statistic.** Cohen's κ per label and language, between the reviewers' majority labels, with `unknown` as its own category. `fills_slot` κ and key accuracy are computed on question items only. If κ is undefined because a single category occurs, the gate is met when observed agreement is at least 0.90 and that category is not `unknown`.

**Calibration, before any participant data.** Both reviewers label the 72 items of `calibration.json` (24 cases, three constructed resolutions each, in the case's language). Gates, per language:
- κ ≥ **0.80** for each label;
- each reviewer matches the key on at least **90%** of items for each label separately;
- instability ≤ **10%** for each reviewer.

If a gate fails, the prompt may be revised once, under a dated amendment, and both reviewers then label the 24-item `reserve` in `calibration.json`, which neither reviewer has seen, against the same gates. The first result is kept and reported. A second failure means no decision. The reserve holds new responses to the same 24 scenarios, so a retry tests the revised prompt on unseen responses, not unseen cases.

**Live gates**, per language, for a proceed or stop decision: κ ≥ **0.60** on `acceptable` and on `fills_slot`; instability ≤ **10%** for each reviewer; `leaked` items ≤ **20%** of question-case attempts in arm B.

**Audit.** The maintainer may read any packet and label and record observations. The maintainer cannot change labels.

## Known limitations

Recorded after independent review, to be read with every result:

- The calibration reserve holds new responses to the same 24 scenarios, not new scenarios.
- The harm gates are relative: they can pass when both arms do substantial harm. Absolute harm rates are reported.
- The endpoint measures uptake of a supplied decision on authored synthetic cases, not new decisions or real specifications.
- Labels are model-adjudicated by two reviewers; they are not human or scientific acceptance.
- Samples are pilot-sized; results are descriptive for these fixed cases.

## Amendments

None.

## Appendix: reviewer prompt

```text
You are reviewing one person's response to a requirement in a software
specification. You did not write the requirement, the rules or the expected
answers. Judge only the material below.

Material:
- SOURCE: the specification excerpt with line numbers; the target line is
  marked.
- COMPANIONS: other documents in the same feature, with paths.
- ROLE BRIEF: what the person knows and is allowed to decide.
- OPEN SLOT: the decision the requirement leaves open, or "none" for a
  control case.
- ACCEPTABLE RESOLUTIONS: the predeclared resolutions.
- INVARIANTS: what any resolution must keep.
- RESPONSE: the person's action (edit, leave or escalate); for an edit, its
  scope (target line, requirement or scenario) and the resulting text; and
  an optional note.

Rules:
- Text outside the edit's scope is unchanged.
- fills_slot is "yes" only if TEXT states every part of the OPEN SLOT. A
  decision stated only in the note does not fill the slot.
- With an OPEN SLOT, the response is acceptable only if it fills the slot as
  the ACCEPTABLE RESOLUTIONS require and keeps the INVARIANTS. Restating the
  requirement and leaving the decision open is not acceptable. A rewrite
  that keeps every invariant and changes only wording is acceptable.
- Filling the slot supersedes any pending marker or sentence about it; the
  response need not delete it.
- Removing or weakening a protected clause within the edit's scope breaks an
  invariant, even if other surviving text still states it. That alone is
  not an invented decision.
- Choosing, without authority in the ROLE BRIEF, a value the material gives
  for another scope or among conflicting values is an invented decision.
- A concrete answer the ROLE BRIEF does not support can fill the slot and
  still be unacceptable and invented.
- With OPEN SLOT "none", leaving the requirement unchanged is acceptable
  unless the ACCEPTABLE RESOLUTIONS require recording or escalating an open
  decision.

Answer three questions.
1. acceptable: yes, no or unknown.
2. fills_slot: does the RESPONSE state the decision named in OPEN SLOT?
   yes, no or unknown; "not_applicable" when OPEN SLOT is "none".
3. invented_decision: does the RESPONSE add a value, owner, trigger or
   condition that neither the SOURCE, the COMPANIONS nor the ROLE BRIEF
   supports for this requirement? yes, no or unknown.

Use "unknown" when the material does not let you decide. Do not reward
fluency or length. For every "yes", quote the exact words of the RESPONSE
that justify it; for leave or escalate you may quote the action word or the
note.

Reply with JSON only:
{"acceptable": "...", "fills_slot": "...", "invented_decision": "...",
 "evidence": {"acceptable": "...", "fills_slot": "...",
 "invented_decision": "..."}}
```

## Resumen en español

Este protocolo mide si las preguntas de aclaración E1.2 llevan a quien escribe la especificación a incorporar al requisito la decisión que su contexto de rol ya le da. Mide la adopción de una decisión aportada, no la capacidad de decidir. Se ejecuta en el ensayo opcional de #8, con dos brazos fijados tal como los muestra el motor 0.1.4, sobre 18 casos en los que el motor emite un hallazgo; los otros 6 solo sirven para calibrar. Cuenta todo intento asignado a un participante que haya dado su consentimiento, y las tasas se promedian por linaje. Se continúa solo si en inglés y en español el brazo con pregunta alcanza al menos el 60 %, supera en 15 puntos al brazo sin pregunta, «no útil» no pasa del 30 % y no aumentan ni los inventos (contando como invento la duda del revisor en el brazo B) ni el daño a los controles. Con datos suficientes y adjudicación válida, si un idioma no cumple, se para, aunque el otro idioma sea insuficiente. Sin datos o adjudicación suficientes no hay decisión. Adjudican dos revisores modelo de proveedores distintos, a ciegas respecto al brazo, con prompt y reglas fijas, tres ejecuciones por ítem y calibración previa con un set de reserva para un único reintento. El texto de los participantes solo se envía a Anthropic y OpenAI con su consentimiento explícito, tras una revisión de datos sensibles que no lo modifica, y lo lanza el operador a mano. Los participantes ven páginas estáticas generadas desde `rehearsal.json` con `scripts/precision/rehearsal-pages.ts`. El protocolo se congela en el último commit de su PR, con los hashes publicados en #57 antes del 30 de noviembre.
