# Compatibility and observed qualification

The [published preview](https://github.com/jayanez/spec-torque/releases/tag/v0.1.0) is 0.1.0. The table records observed host behavior, primarily from the November 18 and 19 qualification. Model turns for MCP/skill use and Desktop opening are documented in the host runbooks.

| Surface | Version observed | Observed evidence | Remaining qualification |
|---|---|---|---|
| Node core / CLI | Node 22.20.0; qualification commands now verify their effective executable | Contract, bilingual, filesystem, HTTP, CLI and real MCP stdio tests pass; TypeScript and production build pass. | Clean-install macOS/Linux/Windows release matrix. |
| Common browser workbench | macOS 27.2.1 arm64, Node 22.20.0, Playwright 1.65.1 | Clean local tarball install. Chromium and WebKit passed 60 cases and the installed Chrome channel passed 30 cases at 375, 768 and 1280 px. Native Safari 27.2 exercised EN/ES keyboard decisions, focus, undo and downloads at its desktop viewport. | Firefox startup blocked on this Mac. Exact-width Safari and manual VoiceOver acceptance remain open. See [common workbench qualification](common-workbench-qualification.md). |
| Claude Code Mod | 2.1.311 | Terminal matrix on GitHub-hosted runners ([run 44298839122](https://github.com/jayanez/spec-torque/actions/runs/44298839122)) with an isolated profile and OS-enforced egress: the same ZIP passed on darwin-arm64, darwin-x64, linux-x64 and linux-arm64 (21 cases) and win32-x64 and win32-arm64 (20; the unreadable-file case is POSIX-only), with no inference request observed. Installed ZIP `spectorque-claude-0.1.0.zip` driven in the real terminal client on macOS 27.2.1 arm64 by `npm run qualify:claude`: EN/ES scope selection, nested evidence, reject without writes, explicit application, stale-source rejection and recovery, common-workbench JSON/ZIP handoff with server shutdown, empty/unreadable/missing-Node errors, and a project-scoped marketplace install and removal, plus host MCP/skill discovery and all six MCP tools over the protocol without writes. One headless model turn per language then used the `spec-review` skill and the MCP tools without writing files. The native harness (`plugin test`) separately covers terminal and desktop render paths with stubs. | Desktop on Windows or Linux, musl builds, automated Desktop runs. See [Claude Code installed package](host-common-qualification.md#claude-code-installed-package). |
| Claude Code in Claude Desktop | Desktop app with bundled Claude Code 2.1.325, macOS 27.2.1 arm64 | Project-scoped install from a local marketplace of the same ZIP. The operator typed `/spectorque` in a Desktop Code-tab session: the native pane rendered the EN and ES fixtures with the same findings and evidence as the terminal; in EN, reject, explicit application (pending decision), stale-source rejection with the external edit preserved, refresh, common-workbench JSON/ZIP handoff and server shutdown on pane close were observed. | ES beyond pane rendering (covered in the terminal), Windows Desktop, automated Desktop runs. See [Claude Desktop](host-common-qualification.md#claude-desktop). |
| Codex MCP | 0.169.0-alpha.11.1 | Real Codex app-server discovers three project skills and six tools; EN/ES source → proposal → common-panel reject/apply → reanalysis/export passed without inference. | Conversational/desktop UI and other OS remain pending. See [qualification and limits](qualification.md). |
| Shared VS Code workbench | VS Code 1.146.0, bundled Node 24.22.1 | Installed VSIX in isolated real extension host: iframe, source/evidence, reject/apply, JSON export, singleton and shutdown passed. Actual Restricted Mode blocks its command. | Codex IDE 26.51111.21308 sidebar coexists in an isolated profile without a submitted turn. Authenticated agent interaction, ES native walkthrough and other OS remain pending. |
| OpenCode TUI | 2.1.4 | The installed ZIP passed EN/ES native session scope, reviewed writes, stale-source recovery and scoped browser export across twelve macOS, Linux and Windows executable variants. | The observed route is the TUI with a local session. See [#6](https://github.com/jayanez/spec-torque/issues/6#issuecomment-6964485668). |
| ThinkRail desktop with Pi package | ThinkRail 0.4.0; `pi-spectorque` 0.1.0; macOS 27.2.1 arm64 | Repository-only package install from generated `integrations/pi`; `/spectorque` and all three skills are discovered. In an isolated scratch project, EN/ES proposals were reviewed, accepted and rejected; a concurrent edit caused stale-proposal rejection; assessment refreshed. Common-panel JSON and ZIP exports matched the current assessment and source artifacts. No model prompt was submitted. | Other ThinkRail/Pi versions and operating systems, model-backed skill invocation and human accessibility. See [ThinkRail/Pi qualification](host-common-qualification.md#thinkrail-desktop-with-pi-package). |
| Pi CLI | 1.5.2 with `pi-spectorque` 0.1.0 | Clean project-local install, trust and removal controls, extension and skill discovery, EN/ES text and JSON reports, and real terminal refinement with JSON/ZIP workbench handoff passed on [GitHub-hosted macOS, Linux and Windows](https://github.com/jayanez/spec-torque/actions/runs/44178615320). | Other Pi versions and model-backed skill invocation remain unqualified. |
| Codex Desktop viewer | Desktop 26.1117.31558 build 29513, macOS 27.2.1 arm64 | Installed ZIP EN/ES native walkthrough at `4a62ed9`; focused feedback fix at `54a57c2` verified in Desktop in EN and the prior fix in ES. The merged tree `959271f` reproduced the final ZIP digest. Existing profile and bounded model turns were used. See [Desktop qualification](codex-desktop-probe.md#020-candidate-qualification-on-macos-arm64). | Clean OS profile, final fix in Desktop ES, VoiceOver, other macOS architectures and Windows Desktop remain unqualified. Network and exact turn payload were not measured. |
| Cursor / Copilot / Gemini CLI | Not qualified | Connection guidance only. | Real host qualification after the committed four-host scope. |

## 0.2.0 candidate checks

The [post-merge run for PR #40](https://github.com/jayanez/spec-torque/actions/runs/44684548830) passed installed CLI smoke tests on Ubuntu, macOS and Windows, and installed workbench browser checks on Ubuntu. The PR also ran the installed-terminal matrices for [Claude Code](https://github.com/jayanez/spec-torque/actions/runs/44639162600), [OpenCode](https://github.com/jayanez/spec-torque/actions/runs/44639162540) and [Pi](https://github.com/jayanez/spec-torque/actions/runs/44639162654). These results apply to the commits and artifacts in those runs. Check the exact release artifact before extending the results to another build.

The [pilot runbook](pilot-operations.md) tracks participant and release acceptance. Safari with VoiceOver, the wider VS Code workflow and Windows Desktop variants retain the limits in the table.

## Detected layout hints

| Family | Main hint | Caveat |
|---|---|---|
| Spec Kit | `.specify/`, `specs/<feature>/` | A generic `specs/` directory is not proof of framework ownership. |
| Spec Kitty | `kitty-specs/<mission>/`, `.kittify/` or explicit header marker | Markdown work packages are grouped by mission. YAML manifests are outside this input path. |
| OpenSpec | `openspec/` and change folders | Change proposals are discovered as context. Dated archives have distinct feature IDs and stay outside active analysis. |
| Kiro | `.kiro/specs/<feature>/` | Requirement, design and task basenames determine roles. |
| BMAD | `_bmad/`, `_bmad-output/` | Complex cross-folder story grouping needs explicit selection. |
| ZeeSpec | `.spec/` and question-named Markdown | Direct `what.md` and `how.md` are the spec and plan. Other documented question and dependency files provide context. |
| Generic Markdown / PRD | Candidate basename and content | Arbitrary document semantics are not inferred reliably. |

All detections and all heuristic statuses remain visible in exported assessments. Unsupported context must not become a passing result.

The [format and linguistic corpus](format-corpus.md) records the original
fourteen probes, 28 format-based project sets, focused controls and a
published OpenSpec example. The resulting compatibility evidence is scoped
to the supplied Markdown variants. The lexical comparison uses blind agent
labels. Human calibration remains pending.
