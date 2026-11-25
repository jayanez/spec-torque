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
