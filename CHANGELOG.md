# Changelog

## Unreleased

- Every host scopes through the shared work-tree index (#68, #72–#77), so large repositories open without the 500-document error. Claude Code: `/spectorque [feature | folder | --changed [base]]`, a filtered selector and the last scope remembered per work tree. Codex Desktop: `open_spectorque` takes a feature or `changed`, and the viewer waits for a feature in large worktrees. OpenCode and Pi: `/spectorque` arguments and searchable pickers over the shared feature list. VS Code: a feature QuickPick with a branch-changes option. The `spec-review` and `spec-refine` skills take scope arguments, review many features one at a time and respect files the host repository protects. A cross-host parity test checks that CLI, MCP, the workbench, Codex and the in-process adapters agree. Version 0.2.1.
- Discovery is scoped to the current git work tree (#68, #69–#71): ignored paths, nested work trees and submodules are left out, a path-only index lists features without reading content, and only the selected scope is read, so large repositories no longer fail with the 500-artifact limit. `.spectorque.json` can widen discovery inside the work tree (`include`, `submodules`). New `spectorque features`, `--path`, `--changed [--base]`; MCP `discover_specs`/`analyze_specs`/`export_report` accept `feature`, `paths`, `changed` and `index`. The workbench loads large workspaces one feature at a time (`serve --feature`). Scoring is unchanged. Artifacts are now ordered by code point instead of the host locale, so revision IDs can change for workspaces with mixed-case paths; the corpus comparison shows identical artifact sets and practice results, with a different order in 2 of 36 cases.
- Research note on outcome-driven development and failure semantics, engine unchanged at 0.1.4: no ODD profile is added; follow-ups are a clarification actionability measurement (#57) and an EN/ES lexical parity spike (#58). See docs/research.md.
- Research tooling (#39, #51), engine unchanged at 0.1.4: paired precision replay with synthetic minimal pairs and natural-source scans, blind adjudication packets, the label-derived calibration audit and the F2 span-classification trial. No detector candidate (H1, H2–H2e) met its gates; see docs/precision-decisions.md.
- Pi: offer the feature scope picker in every interactive mode, including RPC hosts such as ThinkRail, which previously reached only All documents. `qualify:pi` now checks the picker over RPC.

## 0.2.0 — candidate

- Prepare independently verifiable CLI and native host packages, including the downloadable Pi archive and local Codex Desktop viewer.
- Add a reproducible English and Spanish local pilot walkthrough with reviewed edits, stale-source recovery and revision-bound exports.
- Add original EN/ES format fixtures, scoped structural controls and reproducible, provisional agent annotations with explicit unknowns.
- Add the OpenCode and Pi feature review paths and document exact versions and limitations.

- Codex workbench review and export pages: announce a rejected change and return focus to the review data, and replace the raw network error shown when the local workbench stops with EN/ES restart guidance that states no file was written.
- Record the Claude Code terminal matrix: the same plugin ZIP passed `qualify:claude` on darwin-arm64/x64, linux-x64/arm64 and win32-x64/arm64 with an isolated profile and OS-enforced egress, and no inference request.
- Workbench: reveal a selected finding's source line during the selection commit instead of on a deferred timer, which could move focus after typing had started and replace that line in memory without review (the intermittent `Review difference` browser-test timeout).
- Record Claude Desktop qualification (bundled Claude Code 2.1.325, macOS arm64): project-scoped install of the ZIP; EN pane walkthrough including stale-source rejection, handoff and server shutdown, and ES pane rendering.
- `qualify:claude` also checks host discovery of the plugin MCP server and skills, and the driver itself calls all six MCP tools over stdio from the ZIP runtime in EN/ES without writes (a protocol check, not use by Claude). Separately, the qualification guide records a manually observed headless turn per language in which Claude used the `spec-review` skill and the MCP tools.
- Add `npm run qualify:claude`, a real-terminal walkthrough of the installed Claude Code ZIP (EN/ES scope, evidence, reject, apply, stale source, handoff, errors, marketplace install and removal) with saved evidence; no model prompt is submitted.
- Claude Code pane: open the common workbench for the session workspace from the pane, copy its loopback address with the scope to select, report startup failures or an unexpected exit, and stop the server on close, pane close or session end; a second press cancels a pending startup.
- Claude Code pane: select All documents or one feature when a workspace has several, as in OpenCode; bind proposals to the assessed source hash; report an unsuitable or missing Node.js 22.20+ runtime and label analysis, proposal and apply failures. CLI: `analyze --feature <id>` (unknown features are rejected) and `refine --expect-hash <sha256>`.
- Package the Claude Code plugin as a deterministic ZIP with `npm run package:claude`, sharing the archive helper with OpenCode (OpenCode bytes unchanged).
- Engine 0.1.1 recognizes complete EN/ES normative words, including Spanish plurals and accented forms, consistently with or without requirement IDs. Newly recognized requirements can change findings and evidence ratios; schema, rubric and scoring policy are unchanged. See docs/normative-recognition.md for examples and limits.
- Exclude concurrent apply/undo/save and ignore stale provider responses without replacing active documents.
- Reject multiline refinements and changed identifier multisets, including lowercase identifiers.
- Detect bounded explicit EN/ES mandatory contradictions with never/nunca; return HTTP 413 for oversized requests.

- Reject refinements that remove or relocate detected EN/ES prohibitions or exclusions. Negative clauses must remain verbatim apart from whitespace; ambiguous rewrites require an explicit product decision. This conservative guard does not establish semantic equivalence.
- Preserve selected files during asynchronous browser imports, improve assessment label contrast and wrap Spanish report controls on narrow screens across system fonts.
- Restrict the VS Code workbench to trusted local workspaces, reuse its panel, and recover visibly from server startup failures. Permit its exact desktop ancestor in the loopback server's embedding policy.
- Add project-local browser tooling, reproducible Codex qualification and actual VS Code extension-host checks. Their acceptance limits are documented separately.

## 0.1.0 — preview foundations

Guided bilingual authoring, bounded artifact discovery/public GitHub import, forty explainable practice checks, feature-scoped references, source evidence and radar, reviewed hash-protected refinements, exports, read-only MCP and four visual adapter implementations. Native qualification and cross-platform acceptance are tracked separately; this preview does not claim completion of the December V1.
