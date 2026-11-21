# Ignore modal words that are mentioned, not used (E1.4 admission)

## Problem

Requirement admission and the E1.4 check count every MUST/SHALL/SHOULD/MAY and
DEBE/PUEDE token, even when the token is only *mentioned*. Mentions take three
common forms:
- Keywords named as terms, as in ``Keywords such as `SHALL` and `MUST` stay in English.``
- BCP 14 boilerplate: `The key words "MUST", "MUST NOT", … are to be interpreted …`
- Quoted examples, messages and user input, such as
  `- ✅ "The service shall reply in under 200 ms"` (synthetic).

Each mention becomes an E1.4 false positive and may also create I1.2 or E2.1
findings. The downstream findings have not been adjudicated one by one.

## Evidence and what it does and does not show

This work belongs to #39, on branch `claude/spectorque-detector-accuracy-1c5cb9`.
The method is in `docs/precision-replay.md` and the decisions are in
`docs/precision-decisions.md`.

- **Recurrence (development).** Before H2, the 0.1.4 arm admitted quoted-only
  modal lines in 2 public repositories (4 lineages) and in more restricted
  roots. These lines informed the rule's design, so they are not confirmation.
- **Synthetic conformance.** Across 98 constructed targets, E1.4 false positives
  fall from 16 to 9 in EN and from 15 to 7 in ES. True positives stay at 25 and
  21, and there are no regressions. The cases were written alongside the rule,
  so they show that the rule behaves as specified. They are not an accuracy
  estimate.
- **No collateral change.** None of the 716 historical predictions change.
- **Fresh natural set.** 18 repositories (MIT or Apache-2.0) were frozen before
  the candidate existed. They hold 1,716 documents and 855 lineages.
  - The candidate changes 95 lines, which reduce to 47 distinct texts.
  - Every change falls on a quoted-only line. This holds by construction (the
    scope scanner encodes the same policy), so it shows the change is
    contained, not that it is correct.
  - **Correctness rests on one provisional review by the rule's author.** It
    found 46 mentions and 1 borderline requirement, listed under Known limits
    (1).
  - The set contains **no Spanish** modal lines.

## Proposed rule (candidate H2b, engine 0.1.5)

A modal word counts as a mention, not a use, when it appears in one of these:
- A code span containing only keywords and joiners (`` `SHALL` ``,
  `` `MUST`/`SHALL` ``, `` `MUST NOT` ``), on a line with an even number of
  backticks.
- A straight double-quote span bounded by non-word characters, so an inch mark
  such as `27"` never opens a quotation.
- Curly double quotes, or guillemets `«…»`.

Lines that carry a requirement ID remain admitted. Source bytes, line numbers,
hashes and evidence do not change.

## Known limits and counterfactual risks

1. **Modal-less requirements.** A requirement written with "can", whose only
   modal is quoted, stops being admitted. Example:
   `**FR-7:** The tool can flag a reply such as "you must log in again".` (synthetic). The gap existed before; this rule exposes it.
2. **Quoted binding rules.** A spec that quotes its own invariant loses that
   line. Example: `Core invariant: "No record may change unless it is locked."` (synthetic).
   This pattern was seen while H2a was under development, and H2b keeps the
   quotation rule unchanged.
3. **Templates in code spans.** Code-formatted templates such as
   `` `WHEN …, THE SYSTEM SHALL …` `` remain false positives by design, because
   code spans can hold real requirements.
4. **Incomplete quote coverage.** Single quotes, quotations that span lines, and
   quotes inside code are handled differently from the cases above.
5. **Contract change.** `«deberá»` no longer counts as a modal
   (`tests/normative.test.ts`).
6. **Score drift.** Assessments of the same document can differ between 0.1.4
   and 0.1.5. Compare the engine version before comparing scores.
7. **Ablation (measured; this set is now development data).** Of the 47
   distinct changed lines in the fresh set:
   - the keyword-only code-span part alone excludes 4;
   - the quotation part alone excludes 46;
   - 1 line needs both parts.

   A rule restricted to code spans would therefore lose about 90% of the
   benefit. Limits 1 and 2 come with the quotation part. The borderline capability-worded
   line is excluded by that part.

## Acceptance (fixed before evaluation)

- [x] **Ablation.** On the 18-repository set, the quotation part accounts for
      almost all of the benefit (46 of 47 distinct lines), so H2b keeps both
      parts. Final confirmation therefore needs a new, untouched set.
- [ ] **Independent adjudication.** Two reviewers who did not write the rule
      label every distinct changed line as mention, requirement or unknown,
      following `docs/corpus-labeling.md`, with one adjudicator. Bound on
      requirements wrongly excluded: 0 of the adjudicated lines, or an upper
      95% bound of at most 5% counted by lineage, whichever the owner fixes
      before labeling.
- [ ] **Spanish confirmation.** Draw a fresh set with at least 20 Spanish
      changed lines from repositories not used in #39 and adjudicate it under
      the same rule.
- [ ] **Regression controls.** The 716 historical predictions, the supplemental
      controls and the synthetic suite show no regressions.
- [ ] **Downstream findings.** Spot-check the removed I1.2 and E2.1 findings
      and report them with counts.
- [ ] **Documentation.** Update `CHANGELOG.md` and
      `docs/normative-recognition.md`, including limits 1–6.
- [ ] **Independent review.** Review the exact commit with Luna Latest, as
      required by AGENTS.md.
