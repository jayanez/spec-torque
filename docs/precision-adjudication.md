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
