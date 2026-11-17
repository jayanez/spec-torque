# Product requirements

Version 1.0 · Canonical language: English

| ID | Required behavior | Acceptance evidence |
|---|---|---|
| FR-001 | Create spec, plan and tasks from adaptive questions without invented facts. | EN/ES examples retain unanswered decisions and stable requirement references. |
| FR-002 | Import text, files, bounded local workspaces and public GitHub repositories. | Network/path failures are visible; GitHub content records a resolved revision. |
| FR-003 | Detect seven layout families and group by feature, role and archive state. | Fixture matrix covers role distinctions and independent ID namespaces. |
| FR-004 | Assess all 40 EPIC practices with five explicit states and source evidence. | Missing companions remain unknown; non-applicability needs a rationale. |
| FR-005 | Detect bilingual wording, simple consistency and requirement-reference issues. | Exact source lines; false-positive regression corpus. |
| FR-006 | Display radar, dimension scores, practices, findings and evidence navigation. | Keyboard and narrow-screen walkthroughs. |
| FR-007 | Ask concrete clarification questions and draft proposed refinements. | No invented limits; host-model prompt treats source as untrusted data. |
| FR-008 | Review, reject, accept, undo and reanalyze changes. | Stale hashes, altered obligations and concurrent edits reject safely. |
| FR-009 | Separate optional model judgments from deterministic analysis. | Basic flow works offline; provider errors preserve the document. |
| FR-010 | Export editable artifacts, Markdown/JSON reports and revision-bound badges. | IDs and feature paths survive export. |
| FR-011 | Offer CLI, skills and read-only MCP operations. | Protocol and command tests plus real host qualification. |
| FR-012 | Connect Claude Code, Codex, OpenCode and Pi to one motor and common panel by Dec 1. | Real client walkthrough: create/import → analyze → refine → export. |
| FR-013 | Complete Claude Mod, VS Code webview, OpenCode TUI and Pi review widgets by Dec 4. | Select findings, inspect evidence and conduct refinement inside each supported client. |
| FR-014 | Keep session revision history and visible pending decisions. | Comparisons identify revision and rubric; drafts can be undone. |

| ID | Constraint |
|---|---|
| NFR-001 | Node.js 22, TypeScript, React/esbuild; local loopback server. |
| NFR-002 | No AI credentials, GPU or telemetry required for deterministic analysis. |
| NFR-003 | Test essential installation on macOS, Linux and Windows within host-supported surfaces. |
| NFR-004 | Bound document, traversal, request and provider output sizes. Reject symlink/path escapes. |
| NFR-005 | English canonical docs, Spanish guides, EN/ES analysis and examples. |
| NFR-006 | Apache-2.0 original work; preserve third-party attribution. |
| NFR-007 | Ship GitHub Releases/local packages; external directories are optional distribution channels. |

The release acceptance procedure is in [evaluation](evaluation.md). Requirements are commitments; [compatibility](compatibility.md) records what has actually been exercised. No requirement is accepted by an adapter file merely existing.
