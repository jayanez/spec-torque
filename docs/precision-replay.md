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
1. The 15 known development lines that are constraints are admitted.
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
