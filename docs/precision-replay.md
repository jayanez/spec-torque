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

## Synthetic minimal pairs

`fixtures/precision/minimal-pairs.json` has 36 original EN/ES cases with 82
target lines. Their expected outcomes are constructed references, not independent
labels. The families are:
- fence mismatch, the H1 target;
- fence controls that must not move;
- a fence residual outside H1 (an indented code block);
- quoted-only modal mentions for H2, with mixed bare-modal controls;
- blockquote, single-quoted modal, HTML comment and table admission;
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

Operators should run restricted roots separately from public roots, review the
aggregate, and release only approved totals.
