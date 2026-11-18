# Compatibility and observed qualification

Snapshot: **2026-11-17**, preview 0.1.0. “Implemented” means source exists; “exercised” describes an observed check. Neither means full December acceptance. No provider inference was required for the checks below.

| Surface | Version observed | Observed evidence | Remaining qualification |
|---|---|---|---|
| Node core / CLI | Node 22.20.0; qualification commands now verify their effective executable | Contract, bilingual, filesystem, HTTP, CLI and real MCP stdio tests pass; TypeScript and production build pass. | Clean-install macOS/Linux/Windows release matrix. |
| Common browser workbench | React 19.3.1, esbuild 0.28.1; Playwright 1.65.1 on macOS 27.2.1 | Sample import, evidence selection, clarification, diff, accept, reanalysis, undo, direct draft undo and guided builder exercised. Narrow-screen width checked; pending-decision navigation and feature-scoped ZIP exports are implemented, with portability/security regression tests. | 24 Chromium/WebKit cases pass across three widths, including EN/ES keyboard and axe checks. Firefox startup is blocked locally; full matrix remains in Linux CI. Human/screen-reader acceptance remains pending. See [qualification](qualification.md). |
| Claude Code Mod | 2.1.311 | Installed ZIP `spectorque-claude-0.1.0.zip` driven in the real terminal client on macOS 27.2.1 arm64 by `npm run qualify:claude`: EN/ES scope selection, nested evidence, reject without writes, explicit application, stale-source rejection and recovery, common-workbench JSON/ZIP handoff with server shutdown, empty/unreadable/missing-Node errors, and a project-scoped marketplace install and removal, plus host MCP/skill discovery and all six MCP tools over the protocol without writes. One headless model turn per language then used the `spec-review` skill and the MCP tools without writing files. The native harness (`plugin test`) separately covers terminal and desktop render paths with stubs. | Linux, Windows and other macOS architectures; Desktop on other operating systems. See [Claude Code installed package](host-common-qualification.md#claude-code-installed-package). |
| Claude Code in Claude Desktop | Desktop app with bundled Claude Code 2.1.325, macOS 27.2.1 arm64 | Project-scoped install from a local marketplace of the same ZIP. The operator typed `/spectorque` in a Desktop Code-tab session: the native pane rendered the EN and ES fixtures with the same findings and evidence as the terminal; in EN, reject, explicit application (pending decision), stale-source rejection with the external edit preserved, refresh, common-workbench JSON/ZIP handoff and server shutdown on pane close were observed. | ES beyond pane rendering (covered in the terminal), Windows Desktop, automated Desktop runs. See [Claude Desktop](host-common-qualification.md#claude-desktop). |
| Codex MCP | 0.169.0-alpha.11.1 | Real Codex app-server discovers three project skills and six tools; EN/ES source → proposal → common-panel reject/apply → reanalysis/export passed without inference. | Conversational/desktop UI and other OS remain pending. See [qualification and limits](qualification.md). |
| Codex visual surface | VS Code 1.146.0, bundled Node 24.22.1 | Installed VSIX in isolated real extension host: iframe, source/evidence, reject/apply, JSON export, singleton and shutdown passed. Actual Restricted Mode blocks its command. | Codex IDE 26.51111.21308 sidebar coexists in an isolated profile without a submitted turn. Authenticated agent interaction, ES native walkthrough and other OS remain pending. |
| OpenCode TUI | 2.1.4 | Prior macOS arm64 walkthrough observed the home dialog, reviewed EN/ES writes and ES stale-source rejection. The active-session panel also rendered in an isolated macOS baseline run. | Installed ZIP evidence, feature selection and same-session browser exports are tracked by platform and executable variant in [#6](https://github.com/jayanez/spec-torque/issues/6). See the [native walkthrough](host-common-qualification.md#opencode-installed-package). |
| ThinkRail desktop with Pi package | ThinkRail 0.4.0; `pi-spectorque` 0.1.0; macOS 27.2.1 arm64 | Repository-only package install from generated `integrations/pi`; `/spectorque` and all three skills are discovered. In an isolated scratch project, EN/ES proposals were reviewed, accepted and rejected; a concurrent edit caused stale-proposal rejection; assessment refreshed. Common-panel JSON and ZIP exports matched the current assessment and source artifacts. No model prompt was submitted. | Other ThinkRail/Pi versions and operating systems, model-backed skill invocation and human accessibility. See [ThinkRail/Pi qualification](host-common-qualification.md#thinkrail-desktop-with-pi-package). |
| Pi CLI | 1.5.2 with `pi-spectorque` 0.1.0 | Clean project-local install, trust and removal controls, extension and skill discovery, EN/ES text and JSON reports, and real terminal refinement with JSON/ZIP workbench handoff passed on [GitHub-hosted macOS, Linux and Windows](https://github.com/jayanez/spec-torque/actions/runs/44178615320). | Other Pi versions and model-backed skill invocation remain unqualified. |
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

The [original format-layout corpus](format-corpus.md) exercises fourteen constructed
EN/ES cases with nested paths, archives and scoped IDs. It is regression evidence
for the documented hints, not qualification of files from real framework producers.
