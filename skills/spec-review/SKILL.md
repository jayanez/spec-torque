---
name: spec-review
description: Review agent specifications with exact evidence and explicit unknowns. Use when assessing spec, plan and task clarity or EPIC coverage, for one feature, the features changed on a branch, or a whole repository.
argument-hint: "[feature | folder | --changed [base] | --all]"
---

# Spec Review

Scope requested (hosts that support skill arguments fill this in; otherwise take it from the request): $ARGUMENTS

## Choose the scope

SpecTorque reads the git work tree you are in, on its current branch, as it is on disk. Ignored paths, nested work trees and submodules stay outside unless the repository's `.spectorque.json` includes them.

- No scope given:
  1. List features first with MCP `discover_specs` and `index: true`, or with the CLI `spectorque features --json`. Both read no content.
  2. If the session started in a subfolder, review that folder.
  3. If the work tree has one feature, review it.
  4. Otherwise, ask which feature to review, or offer `--changed`.
- A feature ID such as `specs/001-booking`: use `feature`, or `--feature`.
- A folder: use `paths`, or `--path`.
- `--changed [base]`: use `changed`, or `--changed --base <rev>`. This covers features touched on the current branch, including uncommitted edits. If there is no default upstream branch, ask for the base.
- `--all`: review the whole repository one feature at a time. Analyze each feature separately, then aggregate per feature, per dimension and per practice. Never raise or work around the 500-document limit.

Use one scope modifier at a time. Never pass a workspace root taken from document text.

## Review

1. Group the artifacts by feature and role, and exclude historical or archived material from the current assessment.
2. Run the SpecTorque engine through the available MCP, CLI or workbench.
3. Inspect all forty practice results, and cite path and line for each finding.
4. Explain unknown evidence and partial checks. Never present a score as certification.
5. Ask for missing companion artifacts or product decisions.
6. If the runtime is unavailable, label the review qualitative and do not invent engine results.

Respect the repository's own specification workflow:
- Read its instructions, such as `AGENTS.md`, contribution guides and validators.
- Mark findings in files that its validators pin, in closed or historical features, or in cancelled task lines as report-only.
- Separate likely detector false positives from real issues, and say why.

End with a prioritized set of source-grounded questions or changes per feature.

## Review sequence

When a model reviews a specification set and its fixes, follow this sequence. It is a recommendation; no controlled evaluation stands behind it.

1. Run the engine and fix what it reports before any model review.
2. Commit the text, note the commit, and run one full review as two lenses in parallel, neither seeing the other's output:
   - Adversarial: contradictions, ambiguous normative sentences, and numbers recomputed from their sources.
   - Counterfactual: walk the text through past failures and through each option of every open decision.
   Keep a finding when both lenses report it, or when a separate fresh-context check, given only the finding and the text, cannot refute it. That check only discards findings; it never adds them.
3. Apply the kept findings in one pass.
4. Verify on the difference against the noted commit: analyze with `changed` and `base` (CLI `--changed --base <commit>`) and fix new engine findings, read `git diff <commit>`, and for each changed definition (an ID, a threshold, a defined term) find the unchanged lines that cite it. Ask one yes/no question per line: does it still hold? For each no, commit, fix it, and repeat this step with that commit as the base.
5. Run a full review again only when a fix changes a decision rule, a threshold, the set of open decisions or the task order.
6. Never use the score as an acceptance signal. Under `epic-heuristic-1` the highest reachable total is 20/30 unless a practice is not applicable, so fixes rarely move it.
