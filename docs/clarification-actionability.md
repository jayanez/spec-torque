# E1.2 clarification actionability protocol

Status: **draft, not frozen.** Freeze this file before the first rehearsal session and record its SHA-256 in [#57](https://github.com/jayanez/spec-torque/issues/57). After the freeze, changes need a dated amendment below, and any session run before the amendment keeps the frozen version.

## Decision

Do E1.2 clarification questions lead authors to a substantive, self-decided change often enough to justify clarifiers for other practices? The answer gates two possible follow-ups that are not planned yet: generalising clarification beyond E1.2, and asking about failure behavior for state-changing operations. A question that nobody acts on is an effective false positive even when it is well formed.

This protocol adds one pre-registered endpoint to the optional E1.2 rehearsal in [#8](https://github.com/jayanez/spec-torque/issues/8). It keeps the rehearsal design in #8: two arms, complementary cohorts within language and role, one version per case lineage per person, opaque presentation IDs, reversed case order for the second cohort, and blind adjudication against predeclared acceptable resolutions. Engine 0.1.4 and the pilot functionality stay unchanged. No practice status changes, so this is not the precision process in [requirement classification](requirement-classification.md).

## Materials

- Engine and workbench: the frozen pilot SHA.
- Cases: `tests/fixtures/e12/study.json` (12 cases from #39) and `tests/fixtures/e12/fresh.json` (12 lineages from #49), at the SHA-256 values recorded at freeze. Both sets are authored synthetic controls. Their authors saw them while writing the rules, so participants are the only independent element.
- Arm A shows the finding and the existing guidance. Arm B adds the clarification question, the documented abstention or the review referral. Both arms get the same source, context and role brief.

| Case group | EN | ES | Use |
|---|---|---|---|
| Question cases (`ask` in study, `question` in fresh) | 6 | 4 | Primary endpoint |
| Abstention and clear controls (`abstain`, `clear`) | 6 | 6 | Harm check |
| Review referrals (`review`) | 0 | 2 | Harm check |

SHA-256 at drafting: `study.json` `56710e687f8f1ba22212e018b7fdf39c77a797d74911e6b0ba3627c382a0a383`, `fresh.json` `d7195fd51c7b528296af76761c4ce4c5ee8121ab63530fa2059c3015d08afa73` (the value recorded for #49).

The sets are not balanced: Spanish has fewer question cases, and only Spanish has review referrals. Reaching 10 eligible arm B attempts on question cases takes at least 2 complete EN participants and 3 complete ES participants in arm B, and the same again in arm A for the comparison.

### Before freeze

- The fresh set records a `focus` per lineage but no role brief and no acceptable resolutions. Write both for its 12 lineages, in the style of `expected.role` and `expected.resolution` in the study set, by someone who did not write the E1.2 rules or fixtures. Freeze them with their SHA-256.
- Author and freeze the calibration set described under Adjudication.
- Pin the reviewer model IDs, client versions, sampling settings and packet seeds.

## Unit and records

The unit is one attempt: one participant on one case in one arm. Record for each attempt, without the participant's identity:

- random session ID, opaque presentation ID, case lineage, language, arm and build;
- the submitted resolution, or `escalated`, `deferred`, `incomplete` or `timed out`;
- elapsed time, iterations and consultations, as defined in #8;
- in arm B only, the participant's answer to "Did the question help you decide?" (`yes`, `no`, `not useful`, `no answer`).

Retain every attempt, including deferred, incomplete and timed-out ones. Collect only voluntary sanitized records through the approved channel. Records stay with the operator. Publish aggregates only, as in [privacy](privacy.md).

## Endpoints

**Primary: actionable resolution rate.** On question cases, the share of eligible attempts whose resolution the adjudicator judges acceptable **and** whose resolution fills the case's open slot (`expected.openSlot` in the study set, the declared `focus` in the fresh set). Reported per arm and per language. Arm A on the same lineages is the comparator.

**Secondary.**
- Not-useful rate: arm B attempts on question cases answered `no` or `not useful`.
- Invented decisions: resolutions that add a value, owner or condition the role brief does not support. Counted in both arms on every case group.
- Control respect: on abstention and clear controls, the share of attempts that leave the requirement alone or escalate. On review referrals, the share that escalate or record the conflict.
- Elapsed time, iterations and consultations by arm and language, with denominators.

Report counts with denominators and Wilson 95% intervals. With pilot-sized samples these intervals are wide; the decision rule below is a product rule, not a statistical claim.

## Decision rule

Apply per language. EN and ES carry equal weight, so **proceed** requires both languages.

| Result | Condition |
|---|---|
| Insufficient | Fewer than **10** eligible arm B attempts on question cases in that language. Report as insufficient; no decision for that language. |
| Stop | Arm B actionable rate ≤ arm A rate, **or** not-useful rate > **0.50**, **or** more invented decisions in arm B than in arm A. |
| Proceed | Arm B actionable rate ≥ **0.60**, **and** ≥ arm A rate + **0.15**, **and** not-useful rate ≤ **0.30**, **and** invented decisions in arm B ≤ arm A. |
| Iterate | Anything else. Revise the question templates once and rerun on fresh lineages under an amendment. |

A stop closes clarification beyond E1.2 and the failure-behavior follow-up, recorded in #57. Insufficient in either language leaves the follow-ups unplanned. A proceed decision also requires the adjudication gates below.

## Adjudication

Two model reviewers label every attempt. Neither is an author of the E1.2 detector, the clarification rules or the fixture expectations, and the rule author's own readings do not count. Results are reported as **model-adjudicated**. They are a product decision input, not human or scientific acceptance.

**Reviewers.** Two models from different vendors, so that their errors are less likely to coincide: one Claude model run as a Claude Code subagent, and one OpenAI model run through Codex. Pin the exact model IDs, client versions and sampling settings at freeze. Each reviewer runs in a fresh context with no repository access beyond the packet.

**Blind packet.** One item per attempt, in a random order drawn from a recorded seed, different for each reviewer. An item contains the case source, the role brief, the predeclared acceptable resolutions and open slot, and the participant's resolution. It never contains the arm, the question text, timing, the participant, the other reviewer's label or the case outcome type. If a resolution quotes or paraphrases the question, record the item as `leaked` and report it separately.

**Fixed prompt and labels.** The prompt in the appendix is part of this frozen file. Each reviewer returns JSON with three labels and a quoted span of the resolution for each `yes`:

| Label | Values |
|---|---|
| `acceptable` | `yes`, `no`, `unknown` |
| `fills_slot` | `yes`, `no`, `unknown`, `not_applicable` (controls) |
| `invented_decision` | `yes`, `no`, `unknown` |

Malformed output is retried once, then recorded as `unknown`.

**Stability.** Each reviewer labels each item 3 times. The reviewer's label is the majority; with no majority it is `unknown`. Report the share of items where the 3 runs disagree.

**Combining.** When both reviewers agree, that is the label. When they disagree, the label is `unknown`. On the primary endpoint and on invented decisions, `unknown` counts against arm B: it is not actionable and it counts as an invented decision in arm B only. This is conservative, in line with counting `unknown` as an error in the precision process.

**Calibration before any participant data.** Before the first session, author a calibration set of 3 resolutions per case for all 24 cases: one acceptable that fills the slot, one plausible that misses the slot, and one with an invented decision, in the case's language. The calibration author is not an author of the E1.2 rules or fixtures. Freeze it with its SHA-256 alongside this file. Run both reviewers on it. Each label must reach Cohen's κ ≥ 0.80 between the reviewers in each language, and each reviewer must match the constructed key on at least 90% of items. If either check fails, revise the prompt once under a dated amendment and re-run on the same set. A second failure means the rehearsal results are reported as provisional and no proceed decision is taken.

**Live consistency gates.** Report κ per label and language on the live items. The result can support a proceed decision only if, in each language, κ ≥ 0.60 on `acceptable` and `fills_slot`, the 3-run disagreement rate is at most 10%, and `leaked` items are at most 20%. Otherwise report the results as provisional.

**Audit.** The maintainer may read any packet and label and record observations. The maintainer cannot change labels.

## Amendments

None.

## Appendix: reviewer prompt

```text
You are reviewing one person's resolution of a requirement in a software
specification. You did not write the requirement, the rules or the expected
answers. Judge only the material below.

Material:
- SOURCE: the specification excerpt.
- ROLE BRIEF: what the person knows and is allowed to decide.
- OPEN SLOT: the decision the requirement leaves open, or "none" for a
  control case where leaving the requirement alone is acceptable.
- ACCEPTABLE RESOLUTIONS: the predeclared resolutions and invariants.
- RESOLUTION: what the person submitted.

Answer three questions.
1. acceptable: Is the RESOLUTION consistent with the ACCEPTABLE RESOLUTIONS
   and the SOURCE invariants? Leaving a control case unchanged, or escalating
   a conflict, is acceptable.
2. fills_slot: Does the RESOLUTION state the decision named in OPEN SLOT?
   Use "not_applicable" when OPEN SLOT is "none".
3. invented_decision: Does the RESOLUTION add a value, owner, trigger or
   condition that neither the SOURCE nor the ROLE BRIEF supports?

Use "unknown" when the material does not let you decide. Do not reward
fluency or length. For every "yes", quote the exact words of the RESOLUTION
that justify it.

Reply with JSON only:
{"acceptable": "...", "fills_slot": "...", "invented_decision": "...",
 "evidence": {"acceptable": "...", "fills_slot": "...",
 "invented_decision": "..."}}
```

## Resumen en español

Este protocolo mide si las preguntas de aclaración E1.2 llevan a quien escribe la especificación a un cambio sustantivo decidido por esa persona. Se ejecuta dentro del ensayo opcional de #8, con su diseño de dos brazos y sin cambiar el motor 0.1.4. La métrica principal es la proporción de intentos en casos con pregunta cuya resolución es aceptable y completa el hueco declarado, comparada entre el brazo B (con pregunta) y el A (sin ella), por idioma. Continuar exige resultado suficiente en inglés y en español. Una parada cierra la aclaración más allá de E1.2 y la pregunta sobre comportamiento ante fallos. Adjudican dos revisores modelo de proveedores distintos, a ciegas respecto al brazo, con un prompt fijo, tres ejecuciones por ítem y calibración previa (κ ≥ 0,80 por etiqueta e idioma). Un desacuerdo cuenta como `unknown` y penaliza al brazo B. El resultado se declara adjudicado por modelos. El documento se congela con su SHA-256 en #57 antes de la primera sesión.
