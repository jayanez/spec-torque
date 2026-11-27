# Detector precision replay (#39)

Tracking: [#39](https://github.com/jayanez/spec-torque/issues/39). This page
pre-registers one deterministic hypothesis and documents a paired replay for
comparing engine revisions. Results are recorded in
[precision decisions](precision-decisions.md).

## Frozen comparator

Engine 0.1.4 at `865af59eeaec7ec56b854ea7a2b2635ee381d2ca` (rubric
`epic-heuristic-1`). The 716 historical units in
[the corpus](format-corpus.md) remain regression controls. They are kept separate
from this experiment.

## Pre-registered hypothesis H1 (frozen before any natural-source scan)

**Failure.** `linesOf` in `src/core/analyze.ts` tracks fenced code with one boolean.
Any line starting with three backticks or tildes toggles it, whatever the fence
character, run length or trailing text. As a result:
- a backtick fence inside a tilde fence closes it early;
- a shorter run, or a run followed by an info string, closes a longer fence;
- an inline run such as ```` ```json``` ```` opens a fence.

Example lines inside the fence are then admitted as requirements. Requirement
lines after the fence can be hidden.

**Policy.** Follow CommonMark fence pairing:
- An opener is a run of three or more backticks or tildes.
- A backtick opener's info string cannot contain a backtick.
- A closer uses the same character, with a run at least as long as the opener,
  followed only by spaces or tabs.
- An unclosed fence still runs to the end of the document.
- Indentation and container structure are unchanged from 0.1.4 and are outside H1.
- Only admission changes. Line text, line numbers, hashes and evidence bytes are
  preserved.

**Endpoint.** For each language (EN, ES), the E1.4 false positives and the
admission errors on lines whose fence pairing differs between the two policies.

**Adjacent effects.** Admission feeds every requirement-based rule. The scan
reports status, evidence and finding changes for all practices in each affected
feature, not only E1.4.

**Proceed gate (all required):**

1. In natural sources, the 0.1.4 engine admits a line that the independent fence
   oracle (`scripts/precision/probe.ts`) places inside a fence. This must happen in
   at least two independent repositories and two distinct lineages, after collapsing
   clones, copies and revisions of the same text.
2. All 716 historical predictions and the supplemental development controls are
   unchanged.
3. Engine unknowns are preserved, and no synthetic target moves away from its
   expected outcome.
4. Every candidate admission change in natural sources agrees with the oracle.

If any condition fails, H1 stops and the engine change is not proposed. The
sealed reserve is not opened by this experiment.

**Outcome: stop.** The H1 candidate was committed and then reverted. It removed
every synthetic fence-mismatch false positive without regressions, and it left the
716 historical predictions unchanged. It nevertheless failed condition 1. Across 18
committed roots (3 public, 3 personal, 12 corporate; 344 target documents), the
0.1.4 engine admitted no line that the oracle places inside a fence. The details
are in [precision decisions](precision-decisions.md).

## Pre-registered hypothesis H2 (frozen before the candidate is built)

**Failure.** The H1 scans also measured a second signal: E1.4 admits lines whose
only modal words are *mentioned* rather than used. They appear inside a code span
(`` `SHALL` ``) or a double-quoted string (`"…"`, `“…”`).

On the 0.1.4 arm, this signal appeared in two independent public repositories and
four lineages, for 14 lines. A provisional agent review of the public lines found
that every one is a mention of a keyword or an example, not a requirement.
Restricted roots added two personal repositories (three lineages) and one corporate
repository (one lineage), as aggregate counts only. Their semantic relevance was
not inspected.

H2 was formulated after seeing these lines. They are development evidence, not
confirmation.

**Policy.** For both admission and the E1.4 modal decision, a modal word counts only
outside inline code spans and double or curly double quotations.
- Single quotes, unbalanced quote marks and every other construct are unchanged.
- A line with a requirement ID is still admitted.
- Line text, numbers, hashes and evidence bytes are preserved.

**Endpoint.** For each language (EN, ES), the E1.4 false positives on quoted-only
modal lines, together with E1.4 true positives on lines that mix a bare modal with a
quoted one.

**Proceed gate (all required):**

1. All 716 historical predictions are unchanged.
2. No synthetic target moves away from its expected outcome, including the
   mixed bare-and-quoted controls.
3. Every natural-source admission or E1.4 change is a quoted-only modal line. A
   provisional review of the public changes classifies them as mentions or
   examples.
4. Adjacent effects (E1.2, E2.1, E1.3, I1.2, I2.2, I2.3 and contradictions) are
   reported for every affected feature, and none affects a line with a bare modal.

If all four pass, the decision is **iterate**: a provisional engineering candidate
for a separate product issue. A claim about natural-specification accuracy would
need independent labels or an untouched reserve, and neither is available here.

### Amendment H2a (before any new measurement)

An independent code review of the first H2 candidate found that two inch marks
around a bare modal, as in `27" MUST … 32"`, formed a "quotation". A real
requirement was then blanked, giving a false negative that the first scans could
not reveal.

H2a keeps the endpoint and gate. It changes the policy as follows:
- A straight double-quote span must open after start-of-line, whitespace or
  punctuation, and must close before end-of-line, whitespace or punctuation.
  Inch marks after a digit therefore never open a span.
- Code spans pair backtick runs of equal length, so ``` ``MUST`` ``` is covered.
- Curly double quotes and Spanish guillemets (`«…»`) are mentions in both
  languages, for EN/ES parity.
- Single quotes remain outside the policy.

The scan's scope check now uses an independent character scanner rather than the
engine's regular expression. The first H2 measurements are kept as superseded
evidence.

The scan population is reported in two parts:
- the pre-registered primary population, OpenSpec and Spec Kit;
- every other supported family (Kiro, Spec Kitty, BMAD, ZeeSpec and generic PRD),
  with one row per family. These families are part of the corpus.

## Pre-registered hypothesis H2b (frozen before sources are chosen or the candidate is built)

**Why.** H2a reached the decision **iterate**. In its confirmation scan, at least
three changed lines were requirements:
- two were written inside a code span (`` `x DEBE ser "0.00"` ``);
- one started with a stray backtick left over from a span that opened on the
  previous line.

**Policy.** H2a changes as follows:

1. A code span is a mention only when its content consists of modal keywords
   alone. Separators (whitespace, `/`, `,`, `|`, `.`) and the joiners
   `or`/`and`/`o`/`y` are allowed, as in `` `SHALL` `` or `` `SHALL`/`MUST` ``.
   Any other code span is ordinary text, so its modal words count.
2. On a line with an odd number of backticks, no code span is treated as a
   mention.
3. Quotation rules (bounded straight quotes, curly quotes, guillemets) are as
   in H2a.

This deliberately gives up excluding code-formatted sentence templates such as
`` `WHEN …, THE SYSTEM SHALL …` ``. That residual false positive is recorded in
the synthetic suite.

**Endpoint and gate.** Both are the same as H2. Condition 3 now applies to a fresh
confirmation set, defined below, and requires that a provisional review finds
**no** changed line that is a requirement.

**Confirmation sources.** They are selected before the candidate exists, by path
and license only, without reading any file content:
- public GitHub repositories under an MIT or Apache-2.0 license;
- none of them used earlier in #39 (the 18 scanned roots and the 16 external
  inventory repositories);
- up to three repositories per family, taken in search order, for OpenSpec, Spec
  Kit, Spec Kitty, Kiro, BMAD, ZeeSpec and generic PRD.

Each repository is pinned to its default-branch head SHA at selection time. The
list is committed in `fixtures/precision/h2b-confirmation-sources.json` before
the candidate commit.

## Pre-registered hypothesis H2c (frozen before sources are chosen or the candidate is built)

**Why.** The second Spanish confirmation set for H2b (#51) found 18 requirements
that H2b wrongly excludes, all in one repository (4 lineages). They have the form
`- RF-58: EL SISTEMA no dejará … «no debe …»`: the requirement is worded in the future
tense, its only recognized modal is quoted, and `RF-` is not a recognized
requirement ID. Both Spanish sets used for H2b are now development data.

**Policy.** H2b plus one change: `RF-<n>` and `RNF-<n>` (Spanish *requisito
funcional* and *requisito no funcional*) are recognized wherever `FR-<n>` and
`NFR-<n>` are:
1. A line carrying one of these IDs is admitted as a requirement, whatever its
   modal words.
2. The ID counts for requirement-ID coverage (I1.2) and is stripped from comparator
   scope (E1.2), like the English IDs.

Nothing else changes. In particular, future-tense wording without an ID stays
unadmitted, as a measured residual.

**Comparators.** Each arm is measured against 0.1.4 (`865af59`) and against H2b
(`bb8e185`), so that the effects of H2b and H2c stay separable.

**Endpoints.**
- Primary: requirement lines with an `RF-`/`RNF-` ID that are excluded, under
  H2b versus under H2c.
- Collateral: lines newly admitted relative to 0.1.4, and status changes in every
  practice (E1.4 ratio, I1.2, E2.1, E1.2).

**Gate (all must hold to proceed).**
1. On the development sets, all 18 known false negatives are admitted again.
2. On a fresh set, a provisional review finds that every line newly admitted
   relative to H2b is a requirement.
3. On the fresh set, no line that H2b excludes as a mention is re-admitted unless it
   carries an `RF-`/`RNF-` ID and is a requirement.
4. The 716 historical predictions, the supplemental controls and the synthetic
   suite (extended with `RF-`/`RNF-` twins before the candidate) show no
   regressions, and no evidence becomes invalid.

Independent adjudication under [precision adjudication](precision-adjudication.md)
is still required before any merge.

**Fresh sources.** They are selected before the candidate exists, without reading
any file content:
- GitHub code search for `"RF-"` together with `"EL SISTEMA"`, by the family
  paths used for H2b;
- up to 5 repositories per family, public, non-fork, not archived, MIT or
  Apache-2.0;
- every repository and owner used earlier in #39 and #51 excluded;
- each repository pinned to its default-branch head SHA.

The list is committed in `fixtures/precision/h2c-sources.json` before the
candidate commit.

## Pre-registered hypothesis H2d (frozen before sources are chosen or the candidate is built)

**Why.** H2c stopped. On its fresh set, about half of the 975 newly admitted lines
only cite a requirement ID: task checkboxes, traceability tables, and prose such as
`Ver RF-99`. The cause predates H2c: a line is admitted when it *contains* an ID
anywhere. H2c's sets (development and fresh) are now development data.

**Policy.** H2b plus the following:
1. A line is admitted by its ID only when the ID (`FR`, `NFR`, `RF`, `RNF` or `REQ`,
   followed by `-<n>`) is in a defining position. After optional leading
   whitespace, that means:
   - an optional list marker (`-`, `*`, `+`, `1.`, `1)`);
   - an optional task checkbox;
   - an optional opening `|` of a table row (first cell only);
   - optional bold or code markup;
   - then the ID itself.
2. A line whose ID is elsewhere is admitted only if it has a normative modal outside
   mentions, which is the H2b rule.
3. ID recognition for coverage (I1.2), traceability (plan and task references) and
   comparator stripping (E1.2) recognizes `RF-`/`RNF-` as in H2c, anywhere on the
   line. Only admission is anchored.

This changes the contract for English IDs as well. A line like
`Satisfies FR-3 and FR-4.` is no longer admitted unless it uses a modal.

**Comparators.** 0.1.4 (`865af59`) and H2b (`bb8e185`).

**Gate (all must hold to proceed).**
1. On the development sets, all 18 known false negatives from the second Spanish
   set are admitted.
2. On a fresh set, a provisional review of a sample of newly admitted lines finds
   that every one is a requirement. The sample is all lines when there are at most
   100, otherwise 100 drawn with seed 42039.
3. On the fresh set, a provisional review of a sample of lines that H2d *stops*
   admitting relative to 0.1.4 (same sampling) finds no requirement. These are
   lines with an ID off the defining position and no modal.
4. The 716 historical predictions are unchanged. Any change must be listed and
   justified line by line, and it blocks the gate until the owner accepts it. The
   synthetic suite, extended before the candidate with defining-position and
   reference twins in EN and ES, shows no regressions. No evidence becomes
   invalid.

Independent adjudication is still required before any merge.

**Fresh sources.** They are selected before the candidate exists, without reading
any file content:
- GitHub code search by the H2b family paths, run once for `"FR-"` and once for
  `"RF-"`;
- up to 3 repositories per family and query, public, non-fork, not archived, MIT
  or Apache-2.0;
- every repository and owner used earlier in #39 and #51 excluded;
- each repository pinned to its default-branch head SHA.

The list is committed in `fixtures/precision/h2d-sources.json` before the
candidate commit.

## Pre-registered hypothesis H2e (frozen before sources are chosen or the candidate is built)

**Why.** H2d reached **iterate**. Its fresh set showed 15 lines that are no longer
admitted because their own ID is not recognized:
- constraints (`| C-003 | No credential appears in argv … |`);
- success criteria (`**SC-002**: …`).

Before H2d they were admitted only because they cite an `FR-` ID later in the line.
H2d's sets are now development data.

**Policy.** H2d plus the following:
1. Constraint IDs `C-<n>` and `CON-<n>` are recognized in the defining position.
   They admit the line and count as a stable identifier for I1.2.
2. Success-criterion IDs (`SC-<n>`) are **not** added. Spec Kit templates use them
   for measurable outcomes, which this engine does not treat as requirements. Such
   lines stay admitted only through a normative modal, and are measured as a
   residual.
3. Nothing else changes.

**Endpoints, comparators and gate.** As in H2d, with H2d (`38a1c09`) as an extra
comparator:
1. Every development line among those 15 whose own ID is `C-` or `CON-` is admitted.
2. All lines newly admitted relative to H2d (or 100 sampled, seed 42039) are
   requirements.
3. A sample of the lines no longer admitted relative to 0.1.4 contains no
   requirement.
4. The 716 historical predictions are unchanged, there are no synthetic
   regressions (twins added before the candidate), and no evidence becomes invalid.

**Stop rule.** This is the last iteration of the H2 family in #39. If any gate
fails, there is no H2f. The best passing-so-far candidate goes to independent
adjudication, with its failures recorded as known limits, and the owner decides on
the product change.

**Fresh sources.** They are selected before the candidate exists, without reading
any file content:
- GitHub code search for `"C-001"`, by the H2b family paths;
- up to 4 repositories per family, public, non-fork, not archived, MIT or
  Apache-2.0;
- every repository and owner used earlier in #39 and #51 excluded;
- each repository pinned to its default-branch head SHA.

The list is committed in `fixtures/precision/h2e-sources.json` before the
candidate commit.

## Pre-registered hypothesis H3 (frozen before sources are chosen or the candidate is built)

Tracking: [#83](https://github.com/jayanez/spec-torque/issues/83). The #8 pilot
repository is development data for H3. In its 32 open features, 455 of 599 engine
false positives come from requirement definitions:
- **Heading definitions.** A requirement defined as `### REQ-001 — Title` is not a
  definition, because headings are never admitted. Its references get I2.3 errors,
  and its body lines get "Requirement has no stable identifier" (I1.2).
- **Mentions as redefinitions.** An admitted spec line that only mentions an ID is
  counted as a second definition, which gives "Duplicate requirement identifier"
  (I1.2).

**Policy.** Only requirement definitions change. Admission (which lines are
requirements), the ID family (`FR`, `NFR`, `REQ`, `R`) and every other rule are
unchanged from 0.1.4. H2d's admission anchoring, which was rejected, is not
reused.
1. An ID is in a **defining position** on a spec-role line when it comes first on
   the line, after optional leading whitespace and these optional prefixes in
   order:
   - a heading marker (`#` to `######` plus a space);
   - a list marker (`-`, `*`, `+`, `1.`, `1)`);
   - a task checkbox;
   - the opening `|` of a table row (first cell only);
   - bold or code markup.

   Heading lines are considered even though they are not admitted.
2. **Duplicates** (I1.2) count only defining positions, among admitted spec lines
   and spec headings of the same feature.
3. **Resolution** (I2.3): a plan or task reference resolves when its ID has a
   defining position in the feature's specs, or appears anywhere on an admitted
   spec line, as in 0.1.4.
4. **Inheritance** (I1.2): an admitted spec line without its own ID counts as
   identified when the nearest preceding heading in the same document defines an
   ID. This applies to the "no stable identifier" finding and to the I1.2/I2.2
   ratio.

**Endpoints.** I1.2 findings (missing identifier and duplicate), I2.3
unresolved-reference findings and the I1.2/I2.2 practice status, by language.

**Comparator.** 0.1.4 (`865af59`).

**Gate (all must hold to proceed).**
1. Synthetic twins in EN and ES are committed before the candidate. Each
   construction has a twin with the opposite expected outcome:
   - heading, bold-lead, list and table definitions;
   - a mention after a definition;
   - a body line under a defining heading;
   - a body line after a heading that defines no ID.

   The candidate meets every twin's expectation. The existing minimal pairs show
   no admission, E1.4 or E1.2 change.
2. The 716 historical predictions are unchanged, except `I1.2:duplicate` and
   `I2.3:resolved` units. Each of those changes is listed and justified line by
   line, and blocks the gate until the owner accepts it.
3. On a fresh public set, a provisional review covers every finding the candidate
   removes or adds relative to 0.1.4, or 100 of each drawn with seed 42039:
   - no removed finding was a true problem (a real duplicate, a requirement
     really lacking an ID, or a reference with no definition anywhere);
   - every added finding is correct.
4. No evidence becomes invalid.

Independent adjudication is still required before any merge.

**Stop rule.** If gate 1, 2 or 4 fails, the candidate is reverted. If gate 3 finds
lost true problems, the failing construction is recorded. The owner decides
between narrowing the policy as a new pre-registered H3a, or stopping.

**Fresh sources.** They are selected before the candidate exists, without reading
any file content:
- GitHub code search, once each for `"### REQ-001"` and `"**REQ-001"`, limited to
  Markdown files named `spec.md`;
- up to 4 repositories per query, public, non-fork, not archived, MIT or
  Apache-2.0;
- every repository and owner used earlier in #39, #51 and #52, and the pilot
  repository, excluded;
- each repository pinned to its default-branch head SHA.

The list is committed in `fixtures/precision/h3-sources.json` before the
candidate commit.

## Pre-registered hypothesis H3a (frozen before sources are chosen or the candidate is built)

**Why.** H3 failed gate 3 because its fresh set gained 431 duplicates. In a sample
of 100:
- 75 are traceability table rows whose first cell restates an ID already defined
  by a heading;
- 10 are dotted sub-requirements (`REQ-2.1`) read as their parent (`REQ-2`).

H3's sources and twins are now development data.

**Policy.** H3 with two narrowings:
1. Table cells are not defining positions. A table row's ID still resolves
   references, as any ID on an admitted spec line does in 0.1.4.
2. A defining ID ends before a following `.` and digit. `REQ-2.1` therefore
   defines no `REQ-2`. A dotted ID is not itself a definition, and its line
   counts as identified, as in 0.1.4.

Nothing else changes.

**Comparators.** 0.1.4 (`865af59`) and H3 (`6a33bee`).

**Gate (all must hold to proceed).**
1. The H3 twins plus new EN/ES twins, all committed before the candidate, are met.
   The new twins are:
   - a heading definition with a traceability table that restates the ID;
   - two table rows defining the same ID, which no longer counts as a duplicate;
   - dotted sub-IDs under a parent heading;
   - a real duplicate of two defining list items, as a control.

   The existing minimal pairs show no admission, E1.4 or E1.2 change.
2. The 716 historical predictions are unchanged.
3. On a fresh public set, a provisional review covers every finding the candidate
   adds or removes relative to 0.1.4, or 100 of each drawn with seed 42039:
   - every added finding is correct;
   - no removed finding was a true problem.

   The same review is repeated on the H3 development set, for the added findings
   only.
4. No evidence becomes invalid.

Independent adjudication is still required before any merge.

**Stop rule.** If a gate fails, H3a stops and there is no H3b. The owner decides
between merging the best candidate with its failures recorded as known limits
after adjudication, and stopping.

**Fresh sources.** They are selected before the candidate exists, without reading
any file content:
- GitHub code search, once each for `"### FR-001"` and `"| REQ-001 |"`, limited
  to Markdown files named `spec.md`;
- up to 4 repositories per query, public, non-fork, not archived, MIT or
  Apache-2.0;
- every repository and owner used earlier in #39, #51, #52 and H3, and the pilot
  repository, excluded;
- each repository pinned to its default-branch head SHA.

The list is committed in `fixtures/precision/h3a-sources.json` before the
candidate commit.

## Pre-registered hypothesis H5 (frozen before sources are chosen or the candidate is built)

Tracking: [#78](https://github.com/jayanez/spec-torque/issues/78). The #8 pilot
repository is development data for H5. After H3a (engine 0.1.9), in its 32 open
features:
- 49 I1.2 "Requirement has no stable identifier" findings come from hard-wrapped
  list items. The continuation line carries a modal word but no ID, so it is
  admitted as a requirement of its own.
- 8 I1.2 duplicates come from the same wrapping. A continuation line that happens
  to start with an ID (`  REQ-001 episodes already written.`) is taken as a
  defining position.

**Policy.** Only requirement identification and definitions change. Admission
(which lines are requirements), the ID family and every other rule are unchanged
from 0.1.9.
1. A spec-role line is a **continuation** when all of the following hold:
   - the previous line of the same document is not blank, is outside a fenced
     block, and is paragraph or list-item text: not a heading, table row (`|`),
     blockquote (`>`), HTML line (`<`), fence run or thematic break;
   - the line itself does not start a block: it is not blank, a heading, a list
     item (`-`, `*`, `+`, `1.`, `1)`), a table row, a blockquote, an HTML line, a
     fence run or a thematic break;
   - it is not an unindented line whose first token is a requirement ID in a
     defining position. One-requirement-per-line paragraphs
     (`FR-001 …` / `FR-002 …` with no blank line between) therefore keep their
     definitions. An indented line that starts with an ID is a continuation.

   A line that is not a continuation starts a **unit**. The unit holds the line and
   its following continuations.
2. **Identification** (I1.2 missing identifier and the I1.2/I2.2 ratio): an
   admitted spec line counts as identified when any line of its unit carries a
   requirement ID, in addition to the 0.1.9 rules (its own ID, or an enclosing
   defining heading).
3. **Definitions** (I1.2 duplicates): a continuation line is never a defining
   position.
4. **Resolution** (I2.3) is unchanged: any ID on an admitted spec line still
   resolves references.

E1.2, E1.3, E1.4, E2.1, contradiction checks and evidence stay per physical line.

**Endpoints.** I1.2 findings (missing identifier and duplicate), I2.3 findings and
the I1.2/I2.2 practice status, by language.

**Comparator.** 0.1.9 (`develop` at `c3f79b0`).

**Predictions.**
- The 716 historical predictions do not change. The two `I1.2:duplicate` units are
  not continuations, and the E1.2/E1.4 probes isolate one line, so no unit forms.
- The existing minimal pairs and the H3a twins show no change.
- On natural sources, I1.2 findings are removed and almost none are added. An added
  finding can only come from a duplicate group whose second defining line changes.
  I2.3 findings do not change.

**Gate (all must hold to proceed).**
1. EN/ES synthetic twins are committed before the candidate, each with a twin of
   the opposite expected outcome:
   - a wrapped list item whose continuation has a modal and no ID;
   - the same continuation after a list item without an ID (the finding stays);
   - a continuation that starts with an ID already defined elsewhere (no duplicate);
   - the same ID as an unindented one-per-line paragraph definition (the
     duplicate stays);
   - a wrapped plain paragraph;
   - a continuation after a table row or heading (no unit forms).

   The candidate meets every twin. The minimal pairs show no admission, E1.4 or
   E1.2 change, and the H3a twins are all still met.
2. The 716 historical predictions are unchanged (`npm run corpus:report -- --baseline
   develop`).
3. On a fresh public set, a provisional review covers every finding the candidate
   adds or removes relative to 0.1.9, or 100 of each drawn with seed 42039:
   - no removed finding was a true problem (a requirement really lacking an ID, or
     a real duplicate);
   - every added finding is correct.
4. No evidence becomes invalid.

Independent adjudication of the removed findings is still required before merge;
the owner fixes its threshold before labeling.

**Stop rule.** If a gate fails, the candidate is reverted and the failing
construction is recorded. The owner decides between a narrowed H5a and stopping.

**Fresh sources.** They are selected before the candidate exists, without reading
any file content:
- GitHub code search, once each for `"- **FR-001"` and `"- REQ-001"`, limited to
  Markdown files named `spec.md`;
- up to 4 repositories per query, public, non-fork, not archived, MIT or
  Apache-2.0;
- every repository and owner used earlier in #39, #51, #52, H3 and H3a, and the
  pilot repository owner, excluded;
- each repository pinned to its default-branch head SHA.

The list is committed in `fixtures/precision/h5-sources.json` before the
candidate commit.

## Pre-registered hypothesis H5a (frozen before sources are chosen or the candidate is built)

**Why.** H5 failed its adjudication. 3 of its 38 removed findings were agreed true
problems, against a threshold of 2, and 4 more were disputed. All 7 have the same
construction: an item or paragraph that states its own rule, where the only ID in
the unit is a citation (`(see FR-006)`, `(FR-009)`, "per FR-005"). Under H5, any ID
in the unit identifies all its lines. H5's sources, twins and packet are now
development data.

**Policy.** H5 with one narrowing:
1. Units and continuations are defined as in H5.
2. **Identification:** an admitted spec line counts as identified when the
   **first line of its unit** has an ID in a defining position (the H3a rule), in
   addition to the 0.1.9 rules (its own ID anywhere on the line, or an enclosing
   defining heading). An ID cited later in the unit no longer identifies the
   unit's other lines.
3. **Definitions:** a continuation line is never a defining position, as in H5.

Nothing else changes.

**Comparators.** 0.1.9 (`develop`, `c3f79b0`) and H5 (`9336e2b`). Engine 0.1.11,
because 0.1.10 is H6.

**Predictions.**
- The 716 historical predictions, the minimal pairs, the H3a twins and the H5
  twins do not change.
- On the H5 fresh set, H5a keeps all 7 adjudicated positive or disputed findings.
  Relative to H5, it adds back only findings whose unit does not start with a
  defining ID. Relative to 0.1.9, it removes a subset of H5's removals and adds
  none.

**Gate (all must hold to proceed).**
1. The H5 twins plus new EN/ES twins, all committed before the candidate, are met.
   The new twins:
   - a two-line paragraph that states a rule and cites an ID on its second line
     (the finding stays);
   - a wrapped "Never"-list item that ends with a trace tag `(FR-009)` (the
     finding stays);
   - a wrapped item led by a defining ID, as a control (no finding).

   The minimal pairs and the H3a twins are unchanged.
2. The 716 historical predictions are unchanged.
3. On the H5 development set, all 7 adjudicated positive or disputed findings are
   kept, and every finding H5a adds back relative to H5 is listed.
4. On a fresh public set:
   - H5a adds no finding relative to 0.1.9;
   - its removed findings, all of them or 100 drawn with seed 42039, are
     adjudicated as in H5. At most 2 may be agreed true problems, and disputed
     items count against that until the owner resolves them. This is the H5
     threshold carried over; the owner confirms it before labeling.
5. No evidence becomes invalid.

**Stop rule.** If a gate fails, H5a stops and there is no H5b. The owner decides
between stopping #78 and a different approach.

**Fresh sources.** They are selected before the candidate exists, without reading
any file content:
- GitHub code search, once each for `"**NFR-001**"` and `"- **REQ-001**"`, limited
  to Markdown files named `spec.md`;
- up to 4 repositories per query, public, non-fork, not archived, MIT or
  Apache-2.0;
- every repository and owner used earlier in #39, #51, #52, H3, H3a, H5 and H6, and
  the pilot repository owner, excluded;
- each repository pinned to its default-branch head SHA.

The list is committed in `fixtures/precision/h5a-sources.json` before the
candidate commit.

## Pre-registered hypothesis H6 (frozen before sources are chosen or the candidate is built)

Tracking: [#88](https://github.com/jayanez/spec-torque/issues/88). The #8 pilot
repository is development data for H6. E3.1 and E3.2 report `missing` in 30 of its
32 open features, although the specs carry verification criteria and validation
methods. Both practices are detected by vocabulary, and the vocabulary misses three
common forms:
- acceptance scenarios, including numbered Given/When/Then scenarios
  (`SC-001: Given …, when …, then …`), for E3.1;
- validation-plan tables that map a scenario or requirement to a planned test file,
  for E3.2;
- commands in the Spec Kit `quickstart.md`, which is not indexed as a feature
  artifact, for E3.2.

**Policy.** Comparator 0.1.10 (H5). Three changes, nothing else:
1. **E3.1** (spec role, unchanged) also counts a line that contains
   `acceptance scenario(s)` / `escenario(s) de aceptación`, or a Given/When/Then
   scenario on one line: `Given`/`Dado`/`Dada`, then `when`/`cuando`, then
   `then`/`entonces`, in that order and case-insensitive. The heading rule is
   unchanged: a heading counts only when it is followed by content.
2. **E3.2** (all roles, unchanged) also counts a table row (`|` first) that has an
   identifier cell (`| SC-001 |`, `| REQ-001 |`, optionally bold or code) and a
   test-file reference: a path under `test/`, `tests/` or `__tests__/`, or a file
   named `test_*.py`, `*_test.*`, `*_spec.*`, `*.test.*`, `*.spec.*` or
   `*Test(s).cs|java|kt|swift`.
3. **Discovery.** A Spec Kit `specs/<NNN-name>/quickstart.md` is a feature artifact
   with role `context`, as `data-model.md` already is. Every rule reads it as it
   reads any other context document.

**Endpoints.** E3.1 and E3.2 status per feature, with the new evidence lines; all
other practice status changes, dimension scores, finding counts by practice and
artifact sets, by language.

**Comparator.** 0.1.10 (H5, `13cfd0d`).

**Predictions.**
- The 716 historical predictions and the 36 corpus artifact sets do not change. The
  corpus has no `quickstart.md` and no E3 units.
- The minimal pairs, the H3a twins and the H5 twins do not change.
- On natural sources, E3.1 and E3.2 only move from `missing` to `partial`. Features
  with a `quickstart.md` gain one context artifact. Other practices that read
  context documents (E1.1, E2.3, E3.3, E3.4, P1.1, P1.4, P2.5, I1.1, I1.3, I2.1,
  I3.1) can only move from `missing` to `partial`. Findings can be added on
  `quickstart.md` lines with a modal word (E1.2, E1.3, E2.1, opposite obligations),
  and open decisions can be added. No status and no dimension score goes down.

**Gate (all must hold to proceed).**
1. EN/ES synthetic twins are committed before the candidate, each with a twin of
   the opposite expected outcome:
   - an `acceptance scenarios` heading over content, against a heading without
     verification words;
   - a numbered Given/When/Then scenario, against a Given line with no when/then;
   - a validation table row that names a test file, against one that names a
     source file;
   - a feature `quickstart.md` with a test command, against one without.

   The candidate meets every twin. The minimal pairs, H3a twins and H5 twins are
   unchanged.
2. The 716 historical predictions are unchanged (`npm run corpus:report -- --baseline
   <H5>`).
3. On a fresh public set:
   - no practice status and no dimension score goes down;
   - a provisional review of every feature whose E3.1 or E3.2 status changes, or
     100 drawn with seed 42039, finds that the first new evidence line is a real
     verification criterion (E3.1) or validation method (E3.2);
   - every other change is counted and listed by practice. Added findings on
     `quickstart.md` lines are reviewed (up to 100, seed 42039) to establish whether
     they are of a kind the rules already produce on other context documents.
4. No evidence becomes invalid.

Independent adjudication of the new E3 evidence is still required before merge; the
owner fixes its threshold before labeling.

**Stop rule.** If a gate fails, the failing change (1, 2 or 3) is reverted and
recorded. The owner decides between a narrowed H6a and stopping.

**Fresh sources.** They are selected before the candidate exists, without reading
any file content:
- GitHub code search, once each for `"SC-001: Given"` in files named `spec.md` and
  `"python3 -m pytest"` in files named `quickstart.md`;
- up to 4 repositories per query, public, non-fork, not archived, MIT or
  Apache-2.0;
- every repository and owner used earlier in #39, #51, #52, H3, H3a and H5, and the
  pilot repository owner, excluded;
- each repository pinned to its default-branch head SHA.

The list is committed in `fixtures/precision/h6-sources.json` before the
candidate commit.

### Amendment H6 (2026-11-25, after adjudication; owner decision)

H5 failed its adjudication, so H6 no longer builds on it. H6 is rebased onto
`develop`. The comparator becomes 0.1.9 (`c3f79b0`), the candidate engine becomes
0.1.10, and the H5 twins drop out of gate 1. The policy, twins, sources and gates are
unchanged, and every measurement was repeated against the new comparator.

H5a then merged first as engine 0.1.10, so H6 ships as engine 0.1.11 (product
0.2.4), measured again against `develop` with H5a.

## Pre-registered hypothesis H6a (frozen before sources are chosen or the candidate is built)

Tracking: [#88](https://github.com/jayanez/spec-torque/issues/88). Owner decision
after H6 (2026-11-25). The #8 pilot repository is development data for H6a. On its
32 open features, engine 0.1.11 against 0.1.9:
- E3.2 moves to `partial` in 8 features, and 22 stay `missing`. A token count over
  the pilot quickstarts finds `python3 -m pytest` in 1 of 57 files and
  `python3 -m unittest` in 24.
- 3 E2.1 findings are added, all on `quickstart.md` lines (setup or verification
  instructions with two "must" clauses). They are the H6 known limit: once indexed,
  the quickstart is read by every rule, like any context document.

**Owner expectation.** `quickstart.md` is evidence of validation methods only. It
is not requirements text.

**Policy.** Two changes, nothing else:
1. **Quickstart scope.** The lines of a Spec Kit `specs/<NNN-name>/quickstart.md`
   are read only by E3.2. They are never admitted as requirements, so the line
   rules (E1.2, E1.3, E2.1, opposite obligations) do not run on them. They do not
   count for any other practice (E1.1, E2.3, E3.3, E3.4, P1.1, P1.4, P2.5, I1.1,
   I1.3, I2.1, I3.1, C1.2) or for open decisions. The artifact is still discovered
   and hashed, as in H6.
2. **Runner vocabulary.** E3.2 also counts these test runners:
   - `python -m unittest` / `python3 -m unittest`;
   - `go test`, `node --test`, `bun test`, `deno test`;
   - `make test` / `make check`;
   - `mvn test`, `gradle test` / `./gradlew test`.

   Generic script runs (`python3 scripts/…`) are not included, because a script
   path alone does not show that it checks anything.

**Comparator.** 0.1.11 (`develop` at `56d4fea`). Engine 0.1.12, product 0.2.5.

**Predictions.**
- The 716 historical predictions, the minimal pairs and the H3a, H5a and H6 twins
  do not change. The corpus has no `quickstart.md`, and no corpus document uses the
  new runners on a unit line.
- On natural sources, every finding on a `quickstart.md` line is removed, and no
  other finding changes. Practices other than E3.2 can only move from `partial` to
  `missing`, and only where a quickstart line was their sole evidence. That
  includes the 2 E3.4 gains on the H6 fresh set. E3.2 can only move from `missing`
  to `partial`.

**Gate (all must hold to proceed).**
1. EN/ES synthetic twins are committed before the candidate, each with a twin of
   the opposite expected outcome:
   - a quickstart with `python3 -m unittest`, against one with `python3 scripts/…`;
   - a plan with `go test ./...` or `node --test`, against one with `go build`;
   - a quickstart with two "must" clauses on one line (no E2.1 finding), against the
     same line in a plan (the finding stays).

   The candidate meets every twin. The minimal pairs and the H3a, H5a and H6 twins
   are unchanged.
2. The 716 historical predictions are unchanged (`npm run corpus:report -- --baseline
   develop`).
3. On the H6 fresh set:
   - every removed finding is on a `quickstart.md` line, and none is added;
   - every status change is a predicted direction, and each is listed.
4. On a fresh public set chosen for the runners, nothing goes down outside the
   predictions. The first new E3.2 evidence line of every raised feature (or 100
   drawn with seed 42039) is adjudicated as in H6 (E3.2 proposition). The owner
   fixes the threshold before labeling.
5. No evidence becomes invalid.

**Stop rule.** If a gate fails, the failing change (1 or 2) is reverted and
recorded. The owner decides between a narrowed H6b and stopping.

**Fresh sources.** They are selected before the candidate exists, without reading
any file content:
- GitHub code search, once each for `"python3 -m unittest"` and `"go test ./..."`,
  limited to Markdown files named `quickstart.md`;
- up to 4 repositories per query, public, non-fork, not archived, MIT or
  Apache-2.0;
- every repository and owner used earlier in #39, #51, #52, H3, H3a, H5, H5a and H6,
  and the pilot repository owner, excluded;
- each repository pinned to its default-branch head SHA.

The list is committed in `fixtures/precision/h6a-sources.json` before the
candidate commit.

### Amendment H6a-2 (2026-11-25, after the first fresh set; owner decision)

The first fresh set held only 5 Spec Kit features, and all 4 of its E3.2 gains came
from one line, so it is too weak to test the runner rule. A second fresh set is
added, and gate 4 applies to it:
- GitHub code search, once each for `"python3 -m unittest" path:specs` and
  `"go test" path:specs`, limited to Markdown files named `quickstart.md`, with the
  same eligibility rules and exclusions (now including the H6a sources);
- committed in `fixtures/precision/h6a-2-sources.json` before any scan.

Adjudication: up to 30 of the first new E3.2 evidence lines (seed 42039), deduplicated
by line text and labeled blind by two agent sessions. **Threshold (owner, fixed
before selection):** at most 2 agreed not genuine or unknown.

## Pre-registered hypothesis H8 (frozen before sources are chosen or the candidate is built)

Tracking: [#80](https://github.com/jayanez/spec-torque/issues/80). The #8 pilot
repository is development data for H8. On its 86 open features, engine 0.1.12
reports 42 unresolved-reference I2.3 errors. 10 of them cite `R-n` labels, all in
one feature. That feature's plan and tasks number their own acceptance checks
`R-1`, `R-2`, …, and its specification documents contain no `R-n` token at all.

**Why.** `R-` is in the requirement-ID family. A plan or task list that labels its
own checks, risks or steps `R-1`, `R-2` therefore gets one I2.3 error per label,
although nothing in the specification uses that family. The longer prefixes
(`FR-`, `NFR-`, `REQ-`) are rarely used as local labels; the bare `R-` is.

**Policy.** One change, nothing else:
1. **Family scope for `R-`.** On a `plan` or `tasks` line, an `R-n` token is a
   requirement reference only when the feature's specification documents (active
   `spec`-role artifacts of the same feature) contain at least one `R-n` token on any
   line. Otherwise it is a document-local label:
   - it creates no traceability edge and no I2.3 "has no definition" finding;
   - it is not reference evidence for I2.3, C1.3 or C2.3. A line still counts when it
     also cites an `FR-`, `NFR-` or `REQ-` ID.

   `FR-`, `NFR-` and `REQ-` references, spec-side definitions (including `R-n`
   definitions), I1.2, I2.2 and admission are unchanged. When the specification uses
   the `R-` family, every `R-n` reference is checked exactly as in 0.1.12.

**Comparator.** 0.1.12 (`develop` at `3a888f0`). Engine 0.1.13, product 0.2.6 (a
parallel track that merges first may shift both by one patch; the rules do not
change).

**Predictions.**
- The 716 historical predictions, the minimal pairs and the H3a, H5a, H6 and H6a
  twins do not change.
- On natural sources, the only findings removed are I2.3 "Reference R-n has no
  definition" findings in features whose specification documents have no `R-n`
  token; none is added. I2.3, C1.3 and C2.3 can only move from `partial` to
  `missing`, and only where plan-local `R-n` lines were their sole evidence. No other
  practice or finding changes.
- On the pilot, the 10 `R-n` findings are removed, and nothing else changes.

**Gate (all must hold to proceed).**
1. EN/ES synthetic twins are committed before the candidate, each with a twin of
   the opposite expected outcome:
   - plan-local `R-1`/`R-2` acceptance labels with an `FR-`-only specification (no
     finding), against the same plan with a specification that defines `R-1` and
     `R-2` and a plan that also cites an undefined `R-3` (the `R-3` finding stays);
   - local `R-n` step labels in `tasks.md` (no finding), against an undefined `FR-`
     reference in the same tasks file (the finding stays);
   - a specification that mentions `R-1` only in a table row, with a plan citing
     `R-1` and `R-2` (the `R-2` finding stays, because the family is in use).

   The candidate meets every twin. The minimal pairs and the H3a, H5a, H6 and H6a
   twins are unchanged.
2. The 716 historical predictions are unchanged (`npm run corpus:report --
   --baseline origin/develop`).
3. On a fresh public set:
   - every removed finding is a predicted `R-n` finding, and none is added;
   - every status change is a predicted direction, and each is listed.
4. The removed findings (all, or 100 drawn with seed 42039) are adjudicated blind by
   two independent sessions. The proposition is: *"The `R-n` label on this line cites
   a requirement of the feature's specification, so its missing definition is a true
   problem."* The owner fixes the threshold before labeling.
5. No evidence becomes invalid.

**Stop rule.** If a gate fails, H8 stops and there is no H8a without an owner
decision. The owner decides between a narrowed rule and stopping #80.

**Fresh sources.** They are selected before the candidate exists, without reading
any file content:
- GitHub code search, once each for `"R-001" path:specs` and `"R-1" path:specs`,
  limited to Markdown files named `plan.md` and `tasks.md` respectively;
- up to 4 repositories per query, public, non-fork, not archived, MIT or
  Apache-2.0;
- every repository and owner used earlier in #39, #51, #52, H3, H3a, H5, H5a, H6
  and H6a, and the pilot repository owner, excluded;
- each repository pinned to its default-branch head SHA.

The list is committed in `fixtures/precision/h8-sources.json` before the
candidate commit.

## Pre-registered hypothesis H85 (frozen before sources are chosen or the candidate is built)

Tracking: [#85](https://github.com/jayanez/spec-torque/issues/85). Four precision
tracks run in parallel, so this hypothesis is named after its issue. The #8 pilot
repository is development data for H85. On its 32 open features, engine 0.1.12
reports 6 E1.3 findings and 1 E1.2 finding. Two of the E1.3 findings start with a
demonstrative followed by a noun ("This *noun* …"), which is a noun phrase, not a
pronoun.

**One hypothesis, not two.** Issue #85 names two practices, but only E1.3 gets a
detection change. The owner decided (2026-11-25, in this track) how E1.2 is handled:
- E1.2 detection and scores do not change. An unquoted label ("easily copied items")
  cannot be told apart from a quality claim by a deterministic rule.
- Suppressing a vague word inside a code span or quotation would remove the frozen
  rehearsal case `FR-091 … the profile \`fast\` …`. The engine flags that case by
  design, and the clarifier abstains on it as a named option (#49, #57).
- Instead, the clarifier's named-option abstention is widened, as described below.
  This changes no practice status, finding or score, so it is outside the gates
  below. It is covered by tests, and `tests/rehearsal.test.ts` must stay unchanged
  and green.

**Policy (E1.3).** One change, nothing else. E1.3 still flags an admitted
requirement line whose subject comes first, after an optional list marker and ID.
The subject is `it`, `esto`, `eso` or `ello` (unchanged), or `this` / `that` used as
a pronoun. `this` / `that` is a pronoun when the word after it meets any of these:
1. There is no next word, or the next character is punctuation (`.`, `,`, `;`, `:`,
   `!`, `?`, `)`, a dash).
2. It is a modal or auxiliary: `must`, `shall`, `should`, `may`, `might`, `can`,
   `could`, `will`, `would`, `is`, `was`, `are`, `were`, `be`, `been`, `being`,
   `has`, `had`, `have`, `does`, `did`, `do`.
3. It is an adverb: it ends in `-ly`, or it is `also`, `only`, `never`, `always`,
   `then`, `now`, `still`, `not`, `alone` or `itself`.
4. It is a verb form: it ends in `-s` but not in `-ss`, `-us` or `-is`, or it ends in
   `-ed`, or it is `made`, `led`, `meant`, `became`, `took`, `gave` or `kept`.

Otherwise `this` / `that` is the determiner of a noun phrase ("This amendment MUST …"),
and E1.3 does not flag the line. Rules 3 and 4 err towards keeping a finding: an
adjective in `-ed` ("This shared cache") or a noun in `-s` ("This alias") still
counts as a pronoun, as in 0.1.12. Spanish is unchanged: `esto`, `eso` and `ello`
are pronouns only, and the determiners `este`, `esta`, `ese` and `esa` were never
flagged.

**Policy (clarifier, outside the gates).** The clarifier already abstains with
`named-option` when the cue is the whole content of a quotation or code span that
follows `profile`, `preset`, `mode`, `option`, `perfil`, `modo` or `opción`, with an
optional `named` / `called` / `llamado` / `llamada`. Two changes:
- The label nouns also include `class`, `category`, `label`, `tag`, `status`,
  `state`, `type`, `tier`, `clase`, `categoría`, `etiqueta`, `estado`, `tipo` and
  `nivel`.
- The cue may be one word of a multi-word label in the same span
  (``the class `easily copied` ``).

The existing cases keep their outcome.

**Comparator.** 0.1.12 (`develop` at `3a888f0`). Candidate engine 0.1.13, product
0.2.6. If another track merges first, the candidate takes the next patch versions
and every measurement is repeated against the new `develop`.

**Endpoints.** E1.3 findings by language, with the removed and added lines. Also
every other finding by practice, every practice status, dimension scores, open
decisions and artifact sets.

**Predictions.**
- The 716 historical predictions do not change. The corpus rules (E1.2, E1.4, I1.2,
  I2.3) do not include E1.3. The minimal pairs and the H3a, H5a, H6 and H6a twins do
  not change.
- On natural sources, E1.3 findings are only removed, and none is added. Every
  removed finding is on an English line that starts with `this` or `that`. No other
  finding, practice status, dimension score, open decision or artifact set changes.
  E1.3 status is pattern-based (glossary, enumerations) and does not depend on
  findings.
- On the pilot, the 2 "This *noun*" findings are removed and the other 4 E1.3
  findings stay. Those 4 are a pronoun subject (`It …`), `This is …`, and two
  wrapped continuation lines that start with `that` or `it`. Continuation lines are
  a separate class and are not addressed here.

**Gate (all must hold to proceed).**
1. EN/ES synthetic twins are committed before the candidate, each with a twin of
   the opposite expected outcome:
   - `This amendment MUST …` (no E1.3), against `This MUST …` (E1.3);
   - `That endpoint MUST …` (no E1.3), against `That means the endpoint MUST …`
     (E1.3);
   - `This new export MUST …` (no E1.3), against `This only applies …, and the
     service MUST …` (E1.3);
   - `It MUST …` as a control (E1.3 in both engines);
   - Spanish controls, unchanged in both engines: `Esta enmienda DEBE …` and
     `Ese servicio DEBE …` (no E1.3), against `Esto DEBE …` and
     `Eso significa que el servicio DEBE …` (E1.3).

   The candidate meets every twin. The minimal pairs and the H3a, H5a, H6 and H6a
   twins are unchanged.
2. The 716 historical predictions are unchanged (`npm run corpus:report --
   --baseline origin/develop`).
3. On a fresh public set:
   - only E1.3 findings change, they are only removed, and every removed finding is
     on a line that starts with `this` or `that`;
   - the removed findings, all of them or 100 drawn with seed 42039 (deduplicated by
     line text), are adjudicated blind by two agent sessions. The owner fixes the
     threshold before labeling.
4. No evidence becomes invalid.

**Adjudication proposition.** "The subject of this line is a bare pronoun: the
reader must look outside the line to know what the requirement is about." Labels
are `positive` (the finding was right), `negative` and `unknown`. Removed findings
that are agreed `positive`, or that remain disputed, count against the threshold.

**Stop rule.** If a gate fails, H85 stops and is reverted. The owner decides between
a narrowed H85a and stopping. The clarifier change is kept or reverted on its own
tests.

**Fresh sources.** They are selected before the candidate exists, without reading
any file content:
- GitHub code search, once each for `"This feature MUST"` and `"This endpoint MUST"`,
  limited to Markdown files named `spec.md` under `specs/`;
- up to 4 repositories per query, public, non-fork, not archived, MIT or
  Apache-2.0;
- every repository and owner used earlier in #39, #51, #52, H3, H3a, H5, H5a, H6 and
  H6a, and the pilot repository owner, excluded;
- each repository pinned to its default-branch head SHA.

The list is committed in `fixtures/precision/h85-sources.json` before the candidate
commit.

### Amendment H85-1 (2026-11-25, before the candidate and any measurement)

While writing the candidate, two pronoun forms were found that the frozen rules
would read as determiners. Both are added as pronoun cues. Each one only keeps
findings that 0.1.12 already reports:
- **Contractions.** `this` / `that` directly followed by `'s`, `'ll` or `'d`
  (straight or curly apostrophe): "That's why …".
- **Prepositions and conjunctions.** A determiner is never followed directly by one,
  so a next word from this list makes `this` / `that` a pronoun: `and`, `or`, `but`,
  `in`, `on`, `at`, `for`, `with`, `by`, `of`, `to`, `from`, `as`, `if`, `when`,
  `because`, `so`. Example: "This in turn means …".

Two EN twins are added to gate 1, both expected to keep their E1.3 finding:
`That's why the export MUST …` and `This in turn means the export MUST …`. Nothing
else changes.

### Amendment H85-2 (2026-11-25, after adjudication; code review)

The pre-merge review found that `cannot` and `won't` were missing from rule 2, so
"That cannot happen …" read as a determiner. Both are added as pronoun cues
(`cannot`, and `won` before `'t`). The change only keeps findings that 0.1.12
reports. On the fresh set it restores 1 of the 29 adjudicated lines (23 findings,
all from one inherited instruction file). The 28 removed lines that remain are a
subset of the adjudicated items, so the adjudication result carries over.

### Amendment H85-3 (2026-11-25, after adjudication; code review)

A second review found that negative contractions of the listed auxiliaries
("This isn't …", "That doesn't …", "This shouldn't …") matched no rule and read as
determiners. A next word that ends in `n't` (straight or curly apostrophe) is now a
pronoun cue. Like H85-2, this only keeps findings that 0.1.12 reports. The fresh set
and the pilot were measured again; see the decision record.

## Pre-registered hypothesis H7 (frozen before sources are chosen or the candidate is built)

Tracking: [#79](https://github.com/jayanez/spec-torque/issues/79). The #8 pilot
repository is development data for H7. Spec Kit writes a quality checklist to
`specs/<NNN-name>/checklists/requirements.md`. The checklist reviews the
specification and cites its requirement IDs (`- [x] REQ-001 has a task and a
validation procedure.`). Its basename matches the spec role pattern, so engine
0.1.12 classifies it as a spec:
- its citations become definitions, so I1.2 reports a duplicate for an ID that only
  `spec.md` defines, and the evidence points at the real definition;
- its items become spec requirement lines, so they can be reported as lacking an
  identifier, and they count toward spec-only practices (the H6 adjudication found
  one such E3.1 gain, `- [x] Requirements and acceptance scenarios are testable.`);
- its template line `No [NEEDS CLARIFICATION] markers remain` counts as an open
  decision.

The pilot has 36 such checklists among 81 Spec Kit features (a path count; no
content was read). Checklists with other basenames (`ux.md`, `security.md`) are
either not discovered or are classified as context or plan, depending on their name.

**Owner expectation (#79).** A Spec Kit checklist is a review of the
specification. It is not requirements text.

**Policy.** Comparator 0.1.12. Two changes, nothing else:
1. **Classification.** A Markdown file directly under the `checklists/` folder of a
   Spec Kit feature (`specs/<NNN-name>/checklists/*.md`) has role `context`,
   whatever its basename. Framework, feature ID and archive marker are unchanged,
   and discovery is unchanged.
2. **Scope.** As with the quickstart (H6a), the lines of such a checklist are never
   admitted as requirements, so the line rules (E1.2, E1.3, E2.1, opposite
   obligations) do not run on them. They count for no practice and no open
   decision. Unlike the quickstart, there is no E3.2 exception. The artifact is
   still discovered and hashed.

**Comparator.** 0.1.12 (`develop` at `3a888f0`). Engine 0.1.13, product 0.2.6.

**Predictions.**
- The 716 historical predictions and the 36 corpus artifact sets do not change. The
  corpus has no `checklists/` folder.
- The minimal pairs and the H3a, H5a, H6 and H6a twins do not change.
- On natural sources, every change is in a feature that has a Spec Kit checklist,
  and each checklist changes role only from `spec`, `plan` or `tasks` to `context`.
  - Findings: every finding whose evidence is on a checklist line is removed, and so
    is every I1.2 duplicate whose other definition is on a checklist line (that
    evidence may be on a `spec.md` line). No finding is added, except an I2.3
    unresolved reference where a plan or task cites an ID that only a checklist
    states; each such case is listed.
  - Decisions: decisions on checklist lines are no longer counted; none is added.
  - Status: practices that read all roles can only move down, and only where a
    checklist line was their only evidence. Spec-only pattern practices (E1.3, E1.5,
    E2.4, E2.5, E3.1, P1.2, P2.2, P2.3, I3.3) can only move down, for the same
    reason. Spec-only ratio practices (E1.2, E1.4, E2.1, I1.2, I2.2) can move either
    way, because their denominator loses the checklist lines. A feature whose only
    spec-role file is a checklist is no longer listed. Where a checklist was a
    feature's only plan or tasks file, practices that need that role become
    `unknown`. Every status change is listed.

**Gate (all must hold to proceed).**
1. EN/ES synthetic twins are committed before the candidate, each with a twin of
   the opposite expected outcome:
   - a checklist that cites `REQ-001` from `spec.md` (no duplicate), against a second
     spec document that defines `REQ-001` again (the duplicate stays);
   - a checklist item with a modal word and no ID (no I1.2 finding), against the same
     line in `spec.md` (the finding stays);
   - a checklist with `No [NEEDS CLARIFICATION] markers remain` (no decision),
     against a spec line with a real `[NEEDS CLARIFICATION: …]` marker (the decision
     stays);
   - a checklist item naming acceptance scenarios as the only E3.1 candidate (E3.1
     `missing`), against a spec with a real acceptance-scenario block (`partial`);
   - a checklist file under `checklists/` with a non-spec basename that matches the
     plan pattern (`design.md`, role `context`), against a feature `design.md`
     (role `plan`).

   The candidate meets every twin. The minimal pairs and the H3a, H5a, H6 and H6a
   twins are unchanged.
2. The 716 historical predictions are unchanged (`npm run corpus:report -- --baseline
   origin/develop`).
3. On a fresh public set:
   - every change is in a feature with a checklist, and every removed finding,
     decision and status change is of a predicted kind; each is listed by practice;
   - no finding is added outside the I2.3 exception, and each exception is listed.
4. Independent adjudication of the reclassified checklists: up to 30 distinct
   checklist files whose role changes on the fresh set (seed 42039), each labeled
   blind against the proposition "This document states the feature's requirements,
   rather than reviewing them or citing them." The owner fixes the threshold before
   selection.
5. No evidence becomes invalid.

**Stop rule.** If a gate fails, the failing change (1 or 2) is reverted and
recorded. The owner decides between a narrowed H7a and stopping.

**Fresh sources.** They are selected before the candidate exists, without reading
any file content:
- GitHub code search, once each for `"Specification Quality Checklist"
  path:checklists` and `"FR-001" path:checklists`, limited to Markdown files named
  `requirements.md`;
- up to 4 repositories per query, public, non-fork, not archived, MIT or
  Apache-2.0;
- every repository and owner used earlier in #39, #51, #52, H3, H3a, H5, H5a, H6
  and H6a, and the pilot repository owner, excluded;
- each repository pinned to its default-branch head SHA.

The list is committed in `fixtures/precision/h7-sources.json` before the
candidate commit.

### Amendment H7-1 (2026-11-25, before any source was selected or read)

The code search API matches `path:` as a path prefix, so `path:checklists` misses
nested `specs/<NNN-name>/checklists/` folders. Run as written, the two queries
returned 4 and 0 repositories, and none of the 4 has a license. The queries are
replaced, with the same eligibility rules and exclusions:
- `"Specification Quality Checklist" filename:requirements.md`;
- `"FR-001" filename:requirements.md path:specs`.

Only results whose path is `specs/<NNN-name>/checklists/requirements.md` count
toward a repository's selection.

### Amendment H7-2 (2026-11-25, after gates 1–3, before any packet or label; owner approved)

The owner asked for an adversarial review of the H7 test after the first fresh set
(217 features: E1.1 and P2.5 drop in 87, 30 dimension scores go down, 123 decisions
and 92 findings are removed). An independent reviewer session checked the replan in
two rounds. The owner approved this amendment as a whole on 2026-11-25, including
the replacement of the gate 4 they had set.

**Why the frozen gate 4 is not enough.**
- It adjudicates whether a checklist is a specification. That is almost always
  false by construction, and it leaves every score-moving deletion unadjudicated.
- The two changes are confounded. Spec-only practices (E1.5, P2.1, C1.1, P2.2,
  P2.3, I3.3, E3.1) lose checklist evidence from change 1 alone. All-role practices
  (E1.1, P2.5, E2.3, P1.1) and decisions lose it only through change 2.
- About 80 features owe their E1.1/P2.5 change to one template line,
  `- [x] No [NEEDS CLARIFICATION] markers remain`. Its 0.1.12 hit is a pattern
  accident: E1.1 matches the marker name, not a "none remain" reading. 0.1.12 also
  counts the same line as an open decision. This is a detector issue outside H7,
  because the same line in `spec.md` behaves the same way; it is recorded, not fixed.
- Checked and unchecked items differ: `- [ ]` does not state that none remain.
- Predictions were weak: ratio practices "either way", and P2.1, C1.1 and I3.2 were
  not listed. The 2 duplicate relocations counted as additions only because findings
  were identified by path and line.

**Arms.** Both are measured against 0.1.12. Arm A (classification only) is reported
as counts and does not enter the decision.
- **C**: H7 as frozen (`b1bfdf8`).
- **B (H7a)**: change 1, and checklist lines are never admitted as requirements and
  never counted as decisions. They still count for the practices that read context
  documents. Arm B is fixed here, before fresh set 2 is selected.

**Gate 4 (replaces the document-level gate).** The packet is built from arm C on both
fresh sets. Features are capped at 15 per repository (seed 42039). Items are
deduplicated by trimmed line text, shuffled with seed 42039 and shown with four lines
of context. Lost-evidence items also show the feature's own `spec.md` evidence for
the same practice, or "none". Two blind reviewer sessions label them as in H6a-2.

Named items, labeled by both reviewers, with outcomes fixed now:
- **N1**: the checked template line. Its variants are listed in advance:
  - EN `No [NEEDS CLARIFICATION] markers remain`, with `[x]` or `[X]` and with or
    without a trailing note;
  - ES `No quedan marcadores [NEEDS CLARIFICATION]`;
  - ZH `无 [NEEDS CLARIFICATION]`, only as the checklist item itself.

  Proposition: "This line explicitly states, for this feature, that no clarification
  remains open." Agreed `positive` means stratum 1b fails. Agreed `negative` means
  arm C stands for this line. Disputed or `unknown` goes to the owner before anything
  else.
- **N2**: the same item unchecked (`- [ ]`). Proposition: "This line records a
  decision about this feature that is still open." It gates stratum 2.

Sampled strata (lines other than N1 and N2):
- **1a**: lost evidence, spec-only practices (change 1).
- **1b**: lost evidence, all-role practices (change 2).
- **2**: removed decisions.
- **3**: a sanity stratum of up to 10 removed findings and up to 10 reclassified
  files (the original document proposition).

An agreed `positive` is an error: genuine evidence, a real open decision or a real
finding lost. Disputed and `unknown` items count against.

**Threshold rule (owner).**

| Distinct items in a stratum | Errors allowed |
|---|---|
| 30 or more (30 drawn) | at most 2 |
| 15 to 29 | at most 1 |
| fewer than 15 | 0 |

**Decision rule.**
- 1a fails: change 1 itself loses genuine evidence. Stop; the owner decides.
- Stratum 2 or 3 fails: stop; the owner decides.
- 1b or N1 fails and the rest pass: propose H7a (arm B). Fresh set 2 is its
  confirmation set, which is acceptable because arm B is frozen before selection.
  Gates 1–3 are rerun for arm B, and anything it gains against 0.1.12 is adjudicated
  under the same rule.
- Everything passes: propose H7 (arm C).

One reviewer pair's judgment on N1 decides about 80 features. Both reviewers are
sessions of the same model family (#65). The decision record states both limits.

**Predictions.**
- Arm B leaves all-role practices unchanged. It can only gain where a ratio practice's
  denominator loses checklist lines (E1.2, E1.4, E2.1, I1.2, I2.2), in features whose
  checklist held admitted lines.
- Arm B still counts unchecked `- [ ]` marker lines for E1.1/P2.5, through the same
  pattern accident. Features that rest only on such lines are counted and recorded as
  an H7a limit.
- Duplicate identity is (practice, feature, ID), so relocations are not additions.

**Fresh set 2 (non-template checklists).**
- GitHub code search for `filename:requirements.md path:specs NOT "Specification
  Quality Checklist"`, counting only `specs/<NNN-name>/checklists/requirements.md`
  results, up to 4 repositories.
- If fewer than 4 eligible repositories are found, `"out of scope"
  filename:requirements.md path:specs` fills the rest.
- Eligibility and exclusions as before, plus the H7 sources.
- Below 30 changed features, gate 4 is reported as underpowered.
- Committed in `fixtures/precision/h7-2-sources.json` before any scan.

## Pre-registered hypothesis H9 (frozen before sources are chosen or the candidate is built)

Tracking: [#84](https://github.com/jayanez/spec-torque/issues/84).

**Failure.** I2.3 resolves every requirement ID on a plan or tasks line against the
current feature. Two kinds of reference are reported as undefined although the line
itself says they are not this feature's requirements:
- **Qualified references.** The ID is qualified by another specification:
  `reuses SPEC-028 REQ-004 unchanged` reports `REQ-004`. The same happens when the
  qualifier is joined to the ID by a hyphen: `VPC-REQ-01` is read as `REQ-01`,
  because the ID pattern starts at the word boundary after the hyphen.
- **Non-adopted references.** The line marks the ID as not adopted:
  `The proposed (not adopted) REQ-007 text is not installed` reports `REQ-007`.

**Development data.** The #8 pilot repository. On its 32 open features, engine
0.1.12 reports 42 I2.3 unresolved-reference findings:
- 23 are hyphen-qualified IDs (`<NS>-REQ-<n>`, three namespaces) that no spec line
  of their feature uses;
- 10 are plan-local `R-n` labels, the subject of #80;
- 7 cite an ID whose line calls it a proposal. Their committed text does not use
  the words "not adopted"; the shorter form in the #84 comment does;
- 2 cite an ID with another specification named elsewhere on the line, not
  directly before the ID.

The issue's `SPEC-028 REQ-004` form does not occur in the open features.

**One hypothesis, two rules.** Both constructions are a reference that the line
itself places outside the feature, and both are judged by the same proposition. They
are pre-registered together and adjudicated in one packet. Their cues differ, so each
rule is measured and gated on its own, and a failing rule is reverted alone.

**Policy.** Only I2.3 unresolved-reference findings change. Admission, definitions,
identification (I1.2, I2.2), the I2.3/C1.3/C2.3 practice evidence, contradiction
checks and the `traceability` edges are unchanged. A reference that H9 leaves out
keeps its edge, with `resolved: false`, as in 0.1.12.

1. **Qualified references.** A requirement ID on a plan or tasks line is *external*
   when it is directly qualified, and the qualifier is not the feature's own.
   - Directly qualified means one of:
     - a hyphen-joined namespace: an uppercase token run such as `VPC-` or
       `SPEC-028-` immediately before the ID, with no space;
     - a specification qualifier `SPEC-<n>` (any case) immediately before the ID,
       separated only by spaces, `/`, `:`, `#`, `§` or a possessive `'s`.
   - A hyphen-joined prefix that itself ends in a requirement ID is a range
     (`FR-001-FR-003`), not a namespace. Such an ID is not external.
   - The qualifier is the feature's own when:
     - the same namespace is joined to an ID on an admitted spec line or a spec
       heading of the feature; or
     - it is `SPEC-<n>`, and `<n>` equals the leading number of the feature folder
       (`specs/028-…`), compared as numbers.

   External references are not resolved locally, so they produce no I2.3 finding.
   The workspace index (#68) is not consulted: whether the other specification
   exists, or defines the ID, is outside H9.
2. **Non-adopted references.** A requirement ID on a plan or tasks line is left out
   of I2.3 when a non-adoption marker is directly attached to it. The marker is
   `not adopted` (or `not-adopted`) in English and `no adoptado` (`adoptada`,
   `adoptados`, `adoptadas`) in Spanish, in either of these positions:
   - immediately before the ID, separated only by spaces and an optional closing
     parenthesis: `proposed (not adopted) REQ-007`;
   - in a parenthesis immediately after the ID, optionally after `/<digits>`
     continuations and the word "proposed" (`propuesto`, `propuesta`, …):
     `REQ-007 (not adopted)`, `REQ-007/008 (proposed, not adopted)`,
     `REQ-007 propuesto (no adoptado)`.

   Other words ("proposal", "draft", "rejected", "superseded") are not markers.
   Another ID elsewhere on the same line is unaffected.

**Endpoints.** I2.3 unresolved-reference findings, by rule and language.

**Comparator.** 0.1.12 (`develop` at `3a888f0`). The candidate is engine 0.1.13. At
merge the engine and product patch versions are bumped on top of `develop`.

**Predictions.**
- The 716 historical predictions, the minimal pairs and the H3a, H5a, H6 and H6a
  twins do not change.
- H9 only removes I2.3 unresolved-reference findings. It adds none, and it changes
  no other finding, no practice status, no evidence and no traceability edge.
- Every removed finding is on a reference that matches rule 1 or rule 2.
- Pilot (development data, the 32 open features): the 23 hyphen-qualified findings
  are removed, and the other 19 stay. The 10 `R-n` findings are #80's. After #80
  merges, its effect is subtracted, and any change in these counts is recorded as a
  deviation.

**Gate (all must hold to proceed).**
1. EN/ES synthetic twins are committed before the candidate, each with a twin of
   the opposite expected outcome:
   - `SPEC-028 REQ-004` cited from feature 001 (no finding), against
     `REQ-004` with no qualifier (the finding stays);
   - `SPEC-028 REQ-004` cited from feature 028 itself (the finding stays);
   - a hyphen-qualified `VPC-REQ-01` whose namespace no spec line uses (no
     finding), against a namespace the spec does use, with an undefined ID (the
     finding stays);
   - a hyphenated range `FR-001-FR-003` with `FR-003` undefined (the finding
     stays);
   - `proposed (not adopted) REQ-007` and `REQ-007 (not adopted)` (no finding),
     against `proposed REQ-007` and `REQ-007 is a proposal` (the finding stays);
   - a non-adopted `REQ-007` and an undefined `REQ-009` on the same line (only the
     `REQ-009` finding stays).

   The candidate meets every twin. The minimal pairs and the H3a, H5a, H6 and H6a
   twins are unchanged.
2. The 716 historical predictions are unchanged (`npm run corpus:report --
   --baseline origin/develop`).
3. On the earlier fresh sets (H3a, H5a, H6, H6a and H6a-2, development data for
   H9): no finding is added, and every removed finding matches rule 1 or rule 2.
   Each is listed.
4. On a fresh public set, no finding is added, and the removed findings of each
   rule (all, or 100 drawn with seed 42039) are adjudicated blind. The proposition
   for a removed finding: *the requirement ID cited on this line is meant as a
   requirement of this feature, and the feature's specification documents do not
   define it.* An agreed `positive` is a true problem that H9 loses. The owner fixes
   the threshold before labeling. A rule with no removal on the fresh set is
   reported as unconfirmed, and the owner decides whether it ships.
5. No evidence becomes invalid.

**Stop rule.** If a gate fails for one rule, that rule is reverted and the result is
recorded. The other rule proceeds if its own gates hold. If both fail, H9 stops; the
owner decides between a narrowed H9a and stopping #84.

**Fresh sources.** They are selected before the candidate exists, without reading
any file content:
- GitHub code search, once each for `"SPEC-0" "FR-0" path:specs` and
  `"SPEC-0" "REQ-0" path:specs` in Markdown files named `tasks.md`, and for
  `"not adopted" path:specs` in files named `plan.md`;
- up to 4 repositories per query, public, non-fork, not archived, MIT or
  Apache-2.0;
- every repository and owner used earlier in #39, #51, #52, H3, H3a, H5, H5a, H6,
  H6a and H6a-2, and the pilot repository owner, excluded;
- each repository pinned to its default-branch head SHA.

The list is committed in `fixtures/precision/h9-sources.json` before the candidate
commit.

### Amendment H9-2 (2026-11-25, after the first fresh set; owner decision)

The first fresh set held 2567 Spec Kit features in 10 roots, but H9 removed only 1
finding there (rule 1) and none for rule 2. Code search splits `SPEC-0` into
separate tokens, so the queries did not select the qualified construction. A
broader second fresh set is added, and gate 4 applies to it:
- GitHub code search, once each for `"FR-0" path:specs` and `"REQ-0" path:specs`,
  limited to Markdown files named `tasks.md`;
- up to 8 repositories per query, with the same eligibility rules and exclusions
  (now including the H9 sources);
- committed in `fixtures/precision/h9-2-sources.json` before any scan.

All removed findings of both fresh sets (or 100 drawn with seed 42039) are
adjudicated together, with the owner's threshold of at most 2 agreed positive per
rule. A rule that still removes nothing is reported as unconfirmed.

### Outcome of rule 2 (2026-11-25, owner decision)

Rule 2 removed nothing on either fresh set. Two independent reviews then found that
its marker also silences true problems (`Implement REQ-007 (not adopted) …`), and
that it acts on none of 103 natural "not adopted" lines. Under the stop rule it is
reverted at `d58628e`, and rule 1 proceeds alone. The details are in
[precision decisions](precision-decisions.md).

## Pre-registered hypothesis H104 (frozen before sources are chosen or the candidate is built)

Tracking: [#104](https://github.com/jayanez/spec-torque/issues/104). Like H85, this
hypothesis is named after its issue, because precision tracks run in parallel.

**Failure.** P2.1 (functional and user requirement coverage) and C1.1 (behavioral
product specification) are `partial` only when the feature's spec has admitted
requirements and a spec line that is neither a requirement nor a heading contains
`user`, `visitor`, `actor`, `customer`, `usuario`, `visitante` or `cliente`.
Otherwise both are `missing`. A spec that names its actors by role ("the developer
requests …", "el operador aprueba …") gets `missing`, although it says who acts.
Since H7a (#79) Spec Kit checklists are `context`, so their lines no longer supply
the word, and this gap alone decides the status.

**Development data.** The #8 pilot repository. On its 32 open features, engine
0.1.16 reports P2.1 and C1.1 `partial` in 26 features and `missing` in 6, the same 6
for both practices. The owner adjudicated 3 of the 6 as an engine defect: the spec
states its actor by role in a scenario or narrative line. In the other 3, role
nouns occur only as modifiers of another noun (synthetic: "the reviewer queue") or in
constructions this rule does not read (a relative clause, a subjunctive).

**Why a position rule and not a wider word list.** The current cue is a bare
substring anywhere on the line; adding role nouns to it would make any mention
count ("operator precedence", "owner field", "reviewer comments", "the owner-approved
plan"). H104 instead reads a role noun only in *actor position*: a user story, or
the subject of a clause, recognised by a determiner or the start of a clause and a
verb right after the noun. The noun list is bounded to human roles; system nouns
(`agent`, `service`, `client`, `caller`, `consumer`, `worker`) are left out,
because in agent and API specifications they usually name the system itself. The
verb test is H85's, already used for E1.3, so the two rules read "a verb follows"
the same way.

**Policy.** P2.1 and C1.1 keep their current cue, unchanged. A spec line that is
neither a requirement nor a heading now also counts when it names an actor in one
of these two forms:
1. **User story.** `As a` / `As an` + one to four words + a comma + `I want`,
   `I need`, `I can`, `I would like`, `I should` or `I must`; in Spanish `Como` +
   optional `un` / `una` + one to four words + a comma + `quiero`, `necesito`,
   `puedo`, `deseo` or `me gustaría`. Any role word counts here: the form itself
   states the actor.
2. **Role subject.** A role noun from the list below, singular or plural:
   - *Position:* directly after a determiner (`the`, `a`, `an`, `each`, `every`,
     `any`; `el`, `la`, `los`, `las`, `un`, `una`, `cada`), or first on the line
     after optional quote, list and bold markers and an optional scenario keyword
     (`Given`, `When`, `Then`, `And`, `But`; `Dado`, `Dado que`, `Cuando`,
     `Entonces`, `Y`).
   - *Verb right after the noun,* separated only by spaces. English: a modal or
     auxiliary (`must`, `shall`, `should`, `may`, `might`, `can`, `cannot`,
     `could`, `will`, `would`, `is`, `are`, `was`, `were`, `has`, `have`, `had`,
     `does`, `do`, `did`), a negative contraction ending in `n't`, or a verb form
     as in H85 (ends in `-s` but not `-ss`, `-us` or `-is`, or ends in `-ed`).
     Spanish: `debe`, `deben`, `deberá`, `deberán`, `puede`, `pueden`, `podrá`,
     `podrán`, `es`, `son`, `está`, `están`, `tiene`, `tienen`, `ha`, `han`, or a
     word ending in `-a`, `-e`, `-an`, `-en`, `-ó` or `-ió`.
   - *Role nouns.* English: developer, operator, maintainer, reviewer,
     administrator, admin, owner, engineer, author, contributor, approver, auditor,
     analyst, member (with `-s`). Spanish: desarrollador, operador, mantenedor,
     revisor, administrador, propietario, dueño, ingeniero, autor, colaborador,
     aprobador, auditor, analista, miembro, with their feminine and plural forms
     (`-a`, `-es`/`-os`, `-as`).

A role noun joined to the next word by a hyphen or apostrophe ("owner-approved",
"the operator's token") is not followed by a verb, so it does not count. Nothing
else changes: the practices' scope (spec lines only), their `partial` ceiling,
their evidence (the first three spec requirements), every other practice, finding,
decision and artifact set.

**Comparator.** 0.1.16 (`develop` at `0084178`, product 0.3.0). Candidate engine
0.1.17, product 0.3.1. If another track merges first, the candidate takes the next
patch versions and every measurement is repeated against the new `develop`.

**Endpoints.** P2.1 and C1.1 statuses, by language, with the lines that carry the
new cue. Also every other practice status, finding, dimension score, open decision
and artifact set.

**Predictions.**
- The 716 historical predictions, the minimal pairs and the H3a, H5a, H6, H6a, H7a,
  H8, H85 and H9 twins do not change. The corpus rules do not include P2.1 or C1.1.
- On natural sources, P2.1 and C1.1 only move from `missing` to `partial`, always
  together, and their new evidence is the feature's first three spec requirements.
  The P and C dimension scores may rise accordingly. Nothing else changes.
- Pilot (development data): the 3 adjudicated features move to `partial` on both
  practices; the other 3 stay `missing`; the 26 `partial` features do not change.

**Gate (all must hold to proceed).**
1. EN/ES synthetic twins are committed before the candidate, each with a twin of
   the opposite expected outcome:
   - the issue's example (`Given the developer requests a release`) is `partial`,
     against the same spec whose only role mention is `operator precedence`
     (`missing`);
   - `When the operator approves …` / `Cuando el operador aprueba …` (`partial`),
     against `The operator status is shown …` / `El operador lógico se evalúa …`
     style modifiers (`missing`);
   - a user story `As a maintainer, I want …` / `Como mantenedora, quiero …`
     (`partial`), against `as a result, the cache …` / `como resultado, …`
     (`missing`);
   - `Maintainers can …` / `Los revisores pueden …` first on the line (`partial`),
     against `the owner-approved plan` / `el campo propietario` (`missing`);
   - a role subject on a requirement line only (`REQ-001: The operator MUST …`,
     `missing`, as in 0.1.16), and on a heading only (`missing`);
   - a generic-word control (`The user …`, `partial` in both engines).

   The candidate meets every twin. The minimal pairs and the earlier twin suites
   are unchanged.
2. The 716 historical predictions are unchanged (`npm run corpus:report --
   --baseline origin/develop`).
3. On the earlier sets (development data for H104, never examined for P2.1 or
   C1.1: the 33 roots of the H3a–H6a-2 sets and the H9 and H9-2 fresh sets): only
   P2.1 and C1.1 change, only upward, together, and with the P and C dimension
   scores. Each changed feature is listed.
4. On a fresh public set, the same holds. The changed features of gates 3 and 4
   (all, or 100 drawn with seed 42104) are adjudicated blind by two agent sessions.
   The threshold, fixed now and open to the owner to tighten before any label: at
   most 2 items agreed `negative` or disputed, or at most 5% when there are more
   than 40 items.
5. No evidence becomes invalid.

**Adjudication proposition.** For a changed feature the packet shows each line that
carries the new cue, with two lines of context on each side: "This line names a
person or role who performs, requests or receives the specified product behavior."
Labels are `positive` (the gain is right), `negative` and `unknown`. A feature is
`positive` when at least one of its lines is.

**Stop rule.** If a gate fails, H104 stops and is reverted; the owner decides
between a narrowed H104a and stopping #104.

**Fresh sources.** They are selected before the candidate exists, without reading
any file content:
- GitHub code search, once each for `"When the operator"`, `"As a developer"`,
  `"operator precedence"` (a negative control) and `"el operador"`, limited to
  Markdown files named `spec.md` under `specs/`;
- up to 4 repositories per query, public, non-fork, not archived, MIT or
  Apache-2.0;
- every repository and owner used earlier in #39, #51, #52, H3–H9, and the pilot
  repository owner, excluded; one repository per owner;
- each repository pinned to its default-branch head SHA.

The list is committed in `fixtures/precision/h104-sources.json` before the
candidate commit.

### Amendment H104-1 (2026-11-27, before the twins and the candidate)

The issue's synthetic example defines its requirement in a heading
(`### REQ-001 — Draft note`) and states its obligation in a `then` scenario line.
Neither is admitted as a requirement (headings and scenario lines never are), so the
spec has no admitted requirement, and P2.1 and C1.1 stay `missing` for that reason,
with or without H104. The gate-1 twin adds one admitted requirement line
(`- REQ-001: The release note MUST list every merged change.`). Scenario-only
requirements are a separate gap and are not addressed here. Nothing else changes.

### Amendment H104-2 (2026-11-27, before the candidate and any measurement)

While writing the candidate, two prepositions were found that the frozen verb test
reads as verbs. Both are excluded, so they only keep 0.1.16's `missing`:
- **English.** `as` ends in `-s` and passes H85's verb-form test: "The owner as a
  concept …". It is not a verb after a role noun.
- **Spanish.** The prepositions `a`, `ante`, `contra`, `de`, `desde`, `durante`,
  `entre`, `hacia`, `hasta`, `mediante`, `para` and `sobre` end in `-a` or `-e`:
  "Ayudar a las mantenedoras a publicar …".

Two twins are added to gate 1, both expected `missing`: `The owner as a concept is
defined …` and `Ayudar a las mantenedoras a publicar …`. Nothing else changes.

### Amendment H104-3 (2026-11-27, after the first twin run, before any natural measurement)

The first candidate run met 24 of 25 twins. The miss, `Los revisores pueden aprobar
la nota.`, is a twin error: `pueden` is a normative modal in this engine, so the line
is admitted as a requirement, and requirement lines never carry the cue (by policy,
as in 0.1.16). The twin is kept as a scope twin expecting `missing`
(`revisores-pueden-es`), and the intended form is added as `revisores-es`:
`Los revisores aprueban la nota.` (`partial`). The rule is unchanged.

## Pre-registered hypothesis H104a (frozen before sources are chosen or the candidate is built)

Tracking: [#104](https://github.com/jayanez/spec-torque/issues/104). H104 failed its
adjudication gate: 2 agreed `negative` and 5 disputed, against a threshold of 5. The
owner decided (2026-11-27) to retry once, narrowed, with a new fresh set and new blind
labels, under the same stop rule.

**Owner policy.** A role noun names an actor only when the role acts on the product or
system behavior. A role acting on the specification's own process does not count:
requesting, asking for, approving, deciding or writing the document ("the maintainer
requested …", "the operator asked for the spec", "the owner approved the thresholds").
The two agreed-negative classes are also fixed: `member` naming a system node, and a
role noun first on a wrapped continuation line.

**Development data.** The #8 pilot repository and every set measured for H104 (the 59
earlier roots, the 16 H104 fresh roots and the 100 labeled items). In the pilot, the
H104 cue lines of the 3 owner-adjudicated features fall into two groups: present-tense
roles acting on the system (in a terminology entry and in a scenario line), and
process records (in a clarifications section, a risks section, and past-tense
approvals).

**Policy.** H104's rule, narrowed as follows. Each change removes a class of false
positive seen in H104's adjudication, in the pilot or in the H104 review:
1. **No `member`.** Removed from the role nouns (system nodes in distributed specs),
   with `miembro`.
2. **Process sections.** A line under a heading (of any level, the nearest one above
   it) whose text contains `clarif`, `decision`, `status`, `risk`, `assumption`,
   `note`, `changelog`, `history`, `revision`, `review`, `sign-off`, `signoff`,
   `approval` or `open question`, or in Spanish `aclaraci`, `decisi`, `estado`,
   `riesgo`, `supuesto`, `nota`, `historial`, `revisi`, `aprobaci` or `pregunta`,
   does not carry the role cue. These sections record the specification's process.
3. **Dated lines.** A line with an ISO date (`2026-11-03`) does not carry the role
   cue: it records an event, not behavior.
4. **Present tense only.** The verb test drops the past forms: English `-ed`, `was`,
   `were`, `had`, `did`, and Spanish `-ó` / `-ió`. Product behavior is stated in the
   present or with a modal; a past form after a role records what someone did.
5. **Document objects.** The cue does not count when one of `spec`, `specs`,
   `specification`, `plan`, `tasks`, `document`, `draft`, `proposal`,
   `clarification`; `especificación`, `plan`, `tareas`, `documento`, `borrador`,
   `propuesta` or `aclaración` occurs within the six words after the verb: the role
   acts on the document.
6. **Continuation lines.** The line-start position is not read on a line that the
   engine joins to the previous one (H5a continuation); the determiner position
   still is.
7. **Plural nouns.** A word in `-s` after the role noun is not a verb when the next
   word is `is`, `are`, `was`, `were`, `has` or `have` ("the operator logs are …").
8. **Bold scenario keywords.** The keyword may be wrapped in bold
   (`1. **Given** the operator …`), as in Spec Kit's acceptance scenarios.
9. **One verb test.** H85's `-s` verb-form fragment is shared by E1.3 and H104a, not
   retyped. E1.3 does not change.
10. **Generic cue, word boundaries and fences.** The 0.1.16 words (`user`, `visitor`,
    `actor`, `customer`, `usuario`, `visitante`, `cliente`) count only as whole words,
    singular or plural, so "refactor", "factor" and "superuser" no longer count. No
    cue, generic or role, is read inside a fenced code block.

The user-story form is unchanged. Nothing else changes: the practices' scope (spec
lines that are neither requirements nor headings), their `partial` ceiling, their
evidence, and every other practice, finding, decision and artifact set.

**Comparator.** 0.1.16 (`develop` at `0084178`, product 0.3.0). Candidate engine
0.1.17, product unchanged (owner decision: engine-only bumps until the next release).
If #106 merges first, the candidate takes 0.1.18 and every measurement is repeated.

**Endpoints.** P2.1 and C1.1 statuses by language, with the lines that carry the new
cue (gains) or lost the 0.1.16 cue (losses); every other practice status, finding,
dimension score, open decision and artifact set.

**Predictions.**
- The 716 historical predictions, the minimal pairs and the H3a, H5a, H6, H6a, H7,
  H7a, H8, H85 and H9 twins do not change.
- P2.1 and C1.1 change only together. Gains (`missing` → `partial`) come from the
  role cue; losses (`partial` → `missing`) only from rule 10. Nothing else changes.
- Pilot: 041, 043 and 079 move to `partial` (each keeps at least one present-tense
  role line outside a process section); 048, 050 and 076 stay `missing`; no
  `partial` feature drops. If the 3 gains disappear, that is recorded and #104 stops.

**Gate (all must hold to proceed).**
1. The H104 twins are re-run, and new EN/ES twins are committed before the candidate,
   each with an opposite twin: a process role (`the maintainer requested …`,
   `el operador pidió la especificación`), a process section, a dated line, a past
   form, a document object, `member`, a continuation line, a plural noun, a bold
   `**Given**`, a fenced line, and generic substrings (`refactor`, `superusuario`).
   The candidate meets every twin; the earlier suites and minimal pairs are unchanged.
2. The 716 historical predictions are unchanged.
3. On the earlier sets (now 75 roots, development data): only P2.1 and C1.1 change,
   together; every loss comes from rule 10. Each changed feature is listed.
4. On a new fresh public set, the same holds. The changed features of gates 3 and 4,
   excluding the 100 items labeled for H104 (all, or 100 drawn with seed 42105), are
   adjudicated blind by two new agent sessions. Same threshold: at most 2 items agreed
   wrong or disputed, or at most 5% when there are more than 40. A gain is wrong when
   agreed `negative`; a loss is wrong when agreed `positive`.
5. No evidence becomes invalid.

**Adjudication proposition.** As for H104, with the line's section heading shown: "This
line names a person or role who performs, requests or receives the specified product
behavior." Process roles are `negative` under the owner policy, and the reviewers are
told so.

**Stop rule.** As for H104. If a gate fails, H104a is reverted and #104 closes as a
recorded failure with a docs-only result.

**Fresh sources.** Selected before the candidate exists, without reading any file
content: GitHub code search, once each for `"When the developer"`, `"As an operator"`,
`"the maintainer can"` and `"el administrador"`, in Markdown files named `spec.md` under
`specs/`; up to 4 repositories per query, public, non-fork, not archived, MIT or
Apache-2.0; every repository and owner used earlier in #39, #51, #52, H3–H9 and H104,
and the pilot repository owner, excluded; one repository per owner; pinned to the
default-branch head SHA. Committed in `fixtures/precision/h104a-sources.json` before
the candidate.

### Amendment H104a-1 (2026-11-27, after the first twin run, before any natural measurement)

The first candidate run met the 29 H104a twins but 3 of the 26 H104 twins. Two rules
were wider than intended:
- **Rule 2** matched `note` inside the heading "Draft note" and `nota` in "Redactar la
  nota", a product's own release note. The section words are now whole words, and the
  note words only plural: `clarification(s)`, `decision(s)`, `status`, `risk(s)`,
  `assumption(s)`, `notes`, `changelog`, `history`, `revision(s)`, `review(s)`,
  `sign-off`, `signoff`, `approval(s)`, `open question(s)`; `aclaración`/`aclaraciones`,
  `decisión`/`decisiones`, `estado`, `riesgo(s)`, `supuesto(s)`, `notas`, `historial`,
  `revisión`/`revisiones`, `aprobación`/`aprobaciones`, `preguntas`.
- **Rule 5** read the verb `draft` ("Maintainers can draft a note") as a document
  noun. `draft` is removed from the document objects; `borrador` stays.

The twins are unchanged.

## Synthetic minimal pairs

`fixtures/precision/minimal-pairs.json` has 43 original EN/ES cases with 98
target lines. Their expected outcomes are constructed references, not independent
labels. The families are:
- fence mismatch, the H1 target;
- fence controls that must not move;
- a fence residual outside H1 (an indented code block);
- quoted-only modal mentions for H2, with mixed bare-modal controls;
- blockquote, HTML comment and table admission, plus a double-quoted keyword case
  (`quoted-modal-residual`) that was labelled before H2 and is also within its scope;
- comparator scope for E1.2;
- CRLF, BOM and NFD encodings.

Twins with opposite outcomes share structure. The comparator and admission
residual families are measured only.

## Commands

The replay reads committed engine sources of both revisions (`git archive`).
Commit candidate engine changes first.

```sh
node --import tsx scripts/precision/replay.ts synthetic --baseline 865af59 --candidate HEAD
node --import tsx scripts/precision/replay.ts scan --baseline 865af59 --candidate HEAD --roots <roots.json> [--out <operator-dir>]
```

`roots.json` lists Git roots, for example:

```json
[{ "id": "openspec-public", "repository": "github.com/Fission-AI/OpenSpec",
   "path": "/path/to/clone", "ref": "HEAD", "restricted": false }]
```

Each root is read from its committed `ref` through `git cat-file`. The working
tree is ignored and nothing is written to the root.

The targets are:
- OpenSpec: current specs and active change spec deltas. Proposals, support
  files and archives are excluded.
- Spec Kit: `spec.md` documents.

Clones of one upstream must share `repository`, so independence counts them once.

## Probe

Each candidate line (a modal token or a requirement ID) is analyzed in an
isolated copy of its document. Other candidate lines are blanked. The target
line, every structural line (headings, quotes and fence runs) and all line
separators are kept. The target is then the only line that can be admitted. An
`unknown` E1.4 status therefore means the line was not admitted, which counts as
an abstention, as in the corpus report. Evidence is valid when its text equals
the original line bytes (the first 300 UTF-16 units).

## Restricted roots

A root marked `"restricted": true` never has text, excerpts, paths or hashes in
its output.
- Per-line locators go only to `--out`, a 0700 directory, as a 0600 file.
- Standard output prints global aggregate counts. Any line-level count between 1
  and 4 is replaced by `<5`.
- Errors print only the error class.
- The run makes no network or model calls.

Run restricted roots separately from public roots, review the aggregate, and
release only approved totals. In the #39 session the assistant ran restricted
scans with the owner's explicit authorization. Only the aggregate output was read
and the detail files were not opened.

The `agreeWithOracle` / `disagreeWithOracle` counts compare admission changes with
the fence oracle, so they apply to H1 only. For H2, use `changeScope` and
`findingChangesOnOtherLines`.
