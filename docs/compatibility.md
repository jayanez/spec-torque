# Compatibility and observed qualification

Snapshot: **2026-11-16**, preview 0.1.0. “Implemented” means source exists; “exercised” describes an observed check. Neither means full December acceptance. No provider inference was required for the checks below.

| Surface | Version observed | Observed evidence | Remaining qualification |
|---|---|---|---|
| Node core / CLI | Node 22.20.0; qualification commands now verify their effective executable | Contract, bilingual, filesystem, HTTP, CLI and real MCP stdio tests pass; TypeScript and production build pass. | Clean-install macOS/Linux/Windows release matrix. |
| Common browser workbench | React 19.3.1, Vite 8.3.8; Playwright 1.65.1 on macOS 27.2.1 | Sample import, evidence selection, clarification, diff, accept, reanalysis, undo, direct draft undo and guided builder exercised. Narrow-screen width checked; pending-decision navigation and feature-scoped ZIP exports are implemented, with portability/security regression tests. | 24 Chromium/WebKit cases pass across three widths, including EN/ES keyboard and axe checks. Firefox startup is blocked locally; full matrix remains in Linux CI. Human/screen-reader acceptance remains pending. See [qualification](qualification.md). |
| Claude Code Mod | 2.1.311 | `plugin validate` passes. One native render-harness test covers terminal and desktop with process/UI-call stubs. The real terminal client also loads the three hooks and opens the native score pane. | Real interactive finding/refinement/write/export walkthrough. A harness is not an interactive-client pass. |
| Codex MCP | 0.169.0-alpha.11.1 | Real Codex app-server discovers three project skills and six tools; EN/ES source → proposal → common-panel reject/apply → reanalysis/export passed without inference. | Conversational/desktop UI and other OS remain pending. See [qualification and limits](qualification.md). |
| Codex visual surface | VS Code 1.146.0, bundled Node 24.22.1 | Installed VSIX in isolated real extension host: iframe, source/evidence, reject/apply, JSON export, singleton and shutdown passed. Actual Restricted Mode blocks its command. | Codex IDE 26.51111.21308 sidebar coexists in an isolated profile without a submitted turn. Authenticated agent interaction, ES native walkthrough and other OS remain pending. |
| OpenCode TUI | 2.1.4 | Plugin loads in the real terminal client; commands appear; score/evidence dialog, replacement, before/after confirmation and scratch-file write exercised. | Session panel on an active session, export/common-panel flow and cross-platform packaging. |
| Pi | 1.5.2, isolated local install | Real terminal extension loads offline with no models; widget, status, finding selection, source editor, before/after confirmation, reviewed scratch-file write and refreshed assessment exercised. | Full export/common-panel flow, headless reporting and cross-platform installation. |
| Codex desktop MCP Apps | Optional | Protocol metadata is not proof of rendering; no visual acceptance claimed. | Actual desktop rendering and interaction test before enabling a native app surface. |
| Cursor / Copilot / Gemini CLI | Not qualified | Connection guidance only. | Real host qualification after the committed four-host scope. |

CI is configured for Node 22 on ubuntu-latest, macos-latest and windows-latest. The preview passed all three jobs in [run 43894304803](https://github.com/jayanez/spec-torque/actions/runs/43894304803). Consult the repository's actual workflow run before treating a platform as passed. No GPU/provider evaluation, human-scored corpus calibration or defect-reduction claim is included.

## Detected layout hints

| Family | Main hint | Caveat |
|---|---|---|
| Spec Kit | `.specify/`, `specs/<feature>/` | A generic `specs/` directory is not proof of framework ownership. |
| Spec Kitty | `.kittify/` or explicit header marker | Shared Spec Kit layouts can be ambiguous. |
| OpenSpec | `openspec/` and change folders | Archives excluded from active analysis. |
| Kiro | `.kiro/specs/<feature>/` | Requirement, design and task basenames determine roles. |
| BMAD | `_bmad/`, `_bmad-output/` | Complex cross-folder story grouping needs explicit selection. |
| ZeeSpec | `.spec/` and question-named Markdown | Variants may need explicit role overrides in future. |
| Generic Markdown / PRD | Candidate basename and content | Arbitrary document semantics are not inferred reliably. |

All detections and all heuristic statuses remain visible in exported assessments. Unsupported context must not become a passing result.
