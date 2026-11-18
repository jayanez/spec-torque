# Changelog

## Unreleased

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
