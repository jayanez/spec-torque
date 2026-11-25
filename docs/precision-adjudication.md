# Adjudicating changed admission lines (#51)

This protocol labels the distinct lines that a detector candidate stops (or starts)
admitting. It serves the independent adjudication criterion of #51 and follows the
general rules in [corpus labeling](corpus-labeling.md). Requirement-line classification (#52) uses the
label set and gate in [requirement classification](requirement-classification.md).

## Packet

Build a packet from a public scan detail file:

```sh
node --import tsx scripts/precision/adjudication-packet.ts --detail <public-detail.json> --roots <roots.json> --out <dir>
```

- Each item is one distinct line (trimmed text), with two lines of context before
  and after, taken from the pinned revision.
- Only lines whose admission changed are included. `--sample <n> --seed <s>` draws a
  seeded sample of distinct lines.
- Items are ordered by ID. The direction of each change (`excluded` or `admitted`)
  is written to a separate `key.json`, which reviewers do not open.
- Packets are built from public roots only. The script refuses restricted roots.
- Packets stay local (`.spec-torque/precision/`). They are not versioned.

## Labels

Label the line, not the document:

| Label | Use when |
|---|---|
| `requirement` | The line states a requirement, constraint or rule that the document itself imposes, in any wording. |
| `mention` | Every modal word on the line is named, quoted, exemplified, or part of a message, template or boilerplate, and the line imposes no rule of its own. |
| `unknown` | The line and its context do not settle the choice. |

A quoted rule that the document calls binding is a `requirement`. A line that
contains both a quoted example and a rule of its own is a `requirement`.

## Procedure

1. The owner fixed the acceptance threshold before labeling (2026-11-21, recorded
   in #51), as follows.
   - Compute the upper bound of the one-sided 95% Clopper-Pearson interval for the
     error rate, counted by lineage.
   - An excluded item that is adjudicated `requirement` is an error. So is an
     admitted item that is adjudicated `mention`.
   - A lineage counts as an error when any of its items is.
   - Compute the bound separately for excluded and admitted changes.
   - Both bounds must be at most 5%. Adjudicated `unknown` items count as errors.
2. Two reviewers who did not write the rule label every item independently, in
   `labels.reviewerA` and `labels.reviewerB`. They do not see each other's labels.
3. An adjudicator resolves every disagreement and every `unknown`, writes
   `labels.adjudicated`, and adds a short `note` for each resolved item.
4. Report counts by label and by lineage, and Cohen's kappa between the reviewers.
   Report only counts for restricted sources.

With 100 sampled items, a 5% upper bound needs a low observed error rate. For
example, about 1 erroneous lineage out of 95 or more passes, and 3 out of 60 do not.

## H3a: requirement definitions (#83)

H3a changes I1.2 and I2.3 findings, not admission. The labels and packet differ
from the admission protocol above. The owner fixed the threshold on 2026-11-25,
before any labeling.

**Packet.** It is built from the H3a fresh-set scan with
`scripts/precision/definitions-packet.ts`. It contains:
- a seeded sample of 100 removed findings (seed 42039);
- all 12 added findings.

Each item has:
- an opaque ID;
- one proposition;
- the target line with three lines of context on each side;
- every line in the feature's spec documents that contains the same ID (at most 8).

Item order is shuffled. Whether the candidate removed or added the finding, and
both engines' outputs, are kept in a separate `key.json` that reviewers do not
open.

**Propositions.**

| Finding | Proposition |
|---|---|
| Duplicate identifier | This line states a second, separate requirement under an ID that the same feature already uses for a different requirement. |
| Missing identifier | This line states a requirement that has no stable identifier of its own and is not under an enclosing requirement heading that identifies it. |
| Unresolved reference | The requirement ID cited on this line has no definition anywhere in the feature's specification documents. |

Labels are `positive` (the proposition holds, so the finding is a true problem),
`negative` and `unknown`, each with a one-line reason grounded in the supplied text.

**Reviewers.** Two independent sessions label separately. They do not see engine
output, the key, this conversation, implementation diffs or each other's labels.

**Threshold.**
- At most 2 of the 100 removed findings may be agreed `positive`; these are true
  problems the candidate would lose.
- Disputed items count against the threshold until the owner resolves them.
- Added findings are reported. They are already recorded as a known limit and do
  not gate the decision.


## H5: wrapped continuations (#78)

H5 removes I1.2 findings and adds none. The owner fixed the threshold on 2026-11-25,
before any labeling.

**Packet.** It is built from the H5 fresh-set scan:

```sh
node --import tsx scripts/precision/definitions-packet.ts --detail <h5 scan>/h3-scan.json --roots <roots.json> --out .spec-torque/precision/h5-adjudication --context 6 --propositions h5
```

It holds all 38 removed findings (no sampling), shuffled with seed 42039, with six
lines of context on each side so that a wrapped item's first line is visible. Each
item otherwise has the H3a fields. `key.json` is not opened by reviewers.

**Propositions.** As in H3a, except for the missing identifier:

| Finding | Proposition |
|---|---|
| Duplicate identifier | This line states a second, separate requirement under an ID that the same feature already uses for a different requirement. |
| Missing identifier | This line states a requirement that has no stable identifier: neither the line, nor the list item or paragraph it belongs to (including its wrapped lines), nor an enclosing requirement heading identifies it. |

**Reviewers.** Two independent agent sessions, as in H3a, with the same limits.

**Threshold.** At most 2 of the 38 removed findings may be agreed `positive`.
Disputed items count against the threshold until the owner resolves them.

## H5a: wrapped continuations, narrowed (#78)

H5a removes I1.2 findings and adds none relative to 0.1.9. The owner confirmed the
threshold on 2026-11-25, after the deterministic gates and before any labeling.

**Packet.** The same builder and options as H5, from the H5a fresh-set scan (4
repositories, 109 features): all 27 removed findings, six lines of context, seed
42039 and the H5 propositions.

**Reviewers.** Two new independent agent sessions, as in H5.

**Threshold.** At most 2 of the 27 removed findings may be agreed `positive`.
Disputed items count against the threshold until the owner resolves them.
