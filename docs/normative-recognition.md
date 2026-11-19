# EN/ES normative recognition

Since engine **0.1.1**, recognition covers complete Unicode words for MUST, SHALL, SHOULD and MAY,
and DEBE/DEBEN, DEBERÁ/DEBERÁN, DEBERÍA/DEBERÍAN and PUEDE/PUEDEN. Matching is
case-insensitive and uses NFC-normalized text for matching; original source text,
hashes and evidence are retained. Refinement also protects decomposed accented
modal words. A stable requirement ID is not needed for recognition; a missing
ID still produces its own finding. An explicit ID can identify a requirement even
when no normative word is present.

Original regression examples, also exercised with an `FR-001:` prefix:

| Example | Expected bounded behavior |
|---|---|
| The service MAY respond quickly. | Recognized permission; unbounded wording and absent ID remain visible. |
| Los servicios DEBEN responder rápido. | Recognized obligation with the exact source line. |
| El servicio DEBERÁ responder rápido. | Accented future obligation is recognized. |
| Los servicios DEBERÍAN responder rápido. | Recognized recommendation, without mandatory force. |
| Los servicios PUEDEN responder rápido. | Recognized permission, without mandatory force. |
| MAYOR, MAYoría, DEBEMOS, DEBERÍAMOS, PUEDES, SHOULDER | Embedded or unsupported forms are not normative tokens. |

Headings, Markdown block quotes, fenced code and recognized GIVEN/WHEN/THEN or
DADO/CUANDO/ENTONCES scenario lines remain excluded from requirement recognition.
This is a bounded line-based heuristic, not a complete Markdown or language parser.
Negation does not change a token's strength: explicit mandatory opposites can be
reported within one feature; SHOULD/MAY and their supported Spanish counterparts
are not promoted to mandatory contradictions. Broader semantic contradictions,
unlisted inflections and general discourse interpretation remain unsupported.

Compared with engine 0.1.0, newly recognized lines can change findings and the
evidence ratios for E1.4 and other requirement-based checks. Assessment schema
`1.0`, rubric `epic-heuristic-1`, dimension scoring and unknown-state policy are
unchanged. The assessment ID identifies source/options; compare engine and rubric
versions as well when comparing reports across engine revisions.

Reproduce with `node --import tsx --test tests/normative.test.ts` after installing
the project's locked dependencies.

The [calibration corpus](format-corpus.md) records contrast cases for modality
and observable measurement, including NFC/NFD Spanish, decimal separators,
nonbreaking spaces, comparison symbols, quantities per time period, plural
rejection or denial, dates, identifiers, examples and ambiguous wording.
Engine **0.1.3** uses NFC for E1.2 comparisons, including plural
`DEBEN rechazar` and `DEBERÁN denegar`, an explicit Spanish minimum
duration, and bounded rate phrases such as `≤ 120 turnos por minuto`.
E1.4 excludes clear English dates such as `May 12 is …` and `in May`
while preserving a permission in the same line. The analyzed line's bytes,
hash and evidence remain unchanged. Unlisted units, other uses of `May` and
discourse-level interpretation can still yield errors or abstentions. The
[agent comparison](format-corpus.md#observed-agent-comparison) records
the affected corpus counts and limits.
