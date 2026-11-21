# Adjudicating changed admission lines (#51)

This protocol labels the distinct lines that a detector candidate stops (or starts)
admitting. It serves the independent adjudication criterion of #51 and follows the
general rules in [corpus labeling](corpus-labeling.md).

## Packet

Build a packet from a public scan detail file:

```sh
node --import tsx scripts/precision/adjudication-packet.ts --detail <public-detail.json> --roots <roots.json> --out <dir>
```

- Each item is one distinct line (trimmed text), with two lines of context before
  and after, taken from the pinned revision.
- Items are ordered by ID. Engine decisions are withheld, so reviewers do not see
  which arm admitted the line.
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

1. The owner fixes the acceptance threshold before anyone labels, and records it in
   #51. Options: zero requirements wrongly excluded, or an upper 95% bound of at
   most 5% counted by lineage.
2. Two reviewers who did not write the rule label every item independently, in
   `labels.reviewerA` and `labels.reviewerB`. They do not see each other's labels.
3. An adjudicator resolves every disagreement and every `unknown`, writes
   `labels.adjudicated`, and adds a short `note` for each resolved item.
4. Report counts by label and by lineage, and Cohen's kappa between the reviewers.
   Report only counts for restricted sources.

An item adjudicated `requirement` on a line the candidate stops admitting counts as
a wrongly excluded requirement.
