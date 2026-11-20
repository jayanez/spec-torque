# EN/ES corpus annotation guide

Run `npm run corpus:report -- --packet` on the corpus revision to review. Share
the resulting `annotation-packet.json`, these instructions and the same fixture
revision with each reviewer separately. The packet contains the candidate
questions and source pointers. Reviewers should work without engine output,
the other review, implementation diffs or author expectations. Use two people
who read both languages and did not implement the rules. Use distinct aliases
and keep the two annotation files until adjudication is complete.

Start with the development partition to rehearse the guide. Document any
changes to the guide, issue a fresh packet and label the evaluation partition
before comparing the engine output. Keep translations and adapted cases in the
same partition. The reserved cases are a regression sample once their labels
or errors have informed a subsequent iteration. The external and control
partitions have their own denominators.

## Labels

Choose `positive` when the corpus evidence supports the precise proposition
below, and `negative` when it supports its absence. Choose `unknown` for
plausible alternatives or missing context and `unsupported` when the question
requires a capability outside the documented input or analysis boundary. Give
a short reason grounded in the supplied source for each decision. The packet
identifies the project-relative path and, where applicable, line and comparison
target. A target is a proposition to judge.

| Rule | Proposition |
| --- | --- |
| `discovery` | This file is an in-scope Markdown artifact for this project. |
| `framework` | The supplied provenance and layout support the named family as a layout hint. A bare `specs/` folder can be ambiguous. |
| `role` | The artifact serves the named role in the documented layout. A proposal describing behavior can be a spec; metadata and descriptive context can have different roles. |
| `archive` | This artifact is historical and should be excluded from active analysis. |
| `feature` | This artifact belongs to the named path-defined feature within this fixture. |
| `shared-instructions` | The given active instructions apply to the named feature by workspace-relative ancestry. |
| `I1.2:duplicate` | This line redefines an already defined explicit requirement ID in the same active feature. |
| `I2.3:resolved` | The named ID has a definition in the same active feature as the reference at that line. |
| `E1.2` | In context the line states an observable bound or explicit rejection/denial behavior. A version, identifier, date, bare number or vague qualifier alone is insufficient. Judge the line as a requirement, including whether its Markdown context makes it quoted or illustrative. |
| `E1.4` | In context the line contains a normative obligation, recommendation or permission as a requirement. Consider the distinction between literal examples, dates, scenario steps and actual requirements. |

Archive, role and framework are separate questions. An artifact can be
historical and still have a well-defined role. Treat scope based on explicit
layout evidence. Avoid inferring unrelated features from a repeated name or
ID. The evaluation packet intentionally includes plausible distractors.

## Review file

Use the packet's `id` as `packet` and the exact unit IDs as keys. Each individual
review supplies an object with `id` and `annotations`. Collect both objects into
`reviewers` only after independent review. Example with an illustrative unit ID
and one disagreement:

```json
{
  "packet": "<64-character packet id>",
  "reviewers": [
    {
      "id": "reviewer-a",
      "annotations": {
        "example|E1.4|prd.md|12|": {
          "label": "unknown",
          "reason": "The passage could quote an external obligation."
        }
      }
    },
    {
      "id": "reviewer-b",
      "annotations": {
        "example|E1.4|prd.md|12|": {
          "label": "negative",
          "reason": "The heading identifies the passage as an example."
        }
      }
    }
  ],
  "adjudicator": {
    "id": "reviewer-c",
    "annotations": {
      "example|E1.4|prd.md|12|": {
        "label": "negative",
        "reason": "The source explicitly labels this quoted passage an example."
      }
    }
  }
}
```

An adjudicator records only disagreements and keeps the original judgments
intact. Assign `unknown` if the evidence cannot resolve the disagreement. An
omitted answer is pending. An unadjudicated disagreement is disputed. Use
`npm run corpus:report -- --baseline <commit> --labels <reviews.json>`. Retain the
packet, both round-one reviews and adjudication, with source and guide hashes.
Obtain the reviewers' consent before publishing identities or annotations.
