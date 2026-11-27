# Compatibility and observed qualification

The current release is the [0.3.0 prerelease](releases.md); earlier previews are [0.2.0](https://github.com/jayanez/spec-torque/releases/tag/v0.2.0) and [0.1.0](https://github.com/jayanez/spec-torque/releases/tag/v0.1.0). Each row records observed host behavior for the version it names, primarily from the November 18 to 20 qualification; a marketplace listing is not a qualification. Rows for 0.3.0 are added as the installed packages are observed. Model turns for MCP/skill use and Desktop opening are documented in the host runbooks.

| Surface | Version observed | Observed evidence | Remaining qualification |
|---|---|---|---|
| Node core / CLI | Node 22.20.0; qualification commands now verify their effective executable | Contract, bilingual, filesystem, HTTP, CLI and real MCP stdio tests pass; TypeScript and production build pass. | Clean-install macOS/Linux/Windows release matrix. |
| Common browser workbench | macOS 27.2.1 arm64, Node 22.20.0, Playwright 1.65.1 | Clean local tarball install. Chromium and WebKit passed 60 cases and the installed Chrome channel passed 30 cases at 375, 768 and 1280 px. Native Safari 27.2 exercised EN/ES keyboard decisions, focus, undo and downloads at its desktop viewport. | Firefox startup blocked on this Mac. Exact-width Safari and manual VoiceOver acceptance remain open. See [common workbench qualification](common-workbench-qualification.md). |
| Claude Code Mod | 2.1.311 | Terminal matrix on GitHub-hosted runners ([run 44298839122](https://github.com/jayanez/spec-torque/actions/runs/44298839122)) with an isolated profile and OS-enforced egress: the same ZIP passed on darwin-arm64, darwin-x64, linux-x64 and linux-arm64 (21 cases) and win32-x64 and win32-arm64 (20; the unreadable-file case is POSIX-only), with no inference request observed. Installed ZIP `spectorque-claude-0.1.0.zip` driven in the real terminal client on macOS 27.2.1 arm64 by `npm run qualify:claude`: EN/ES scope selection, nested evidence, reject without writes, explicit application, stale-source rejection and recovery, common-workbench JSON/ZIP handoff with server shutdown, empty/unreadable/missing-Node errors, and a project-scoped marketplace install and removal, plus host MCP/skill discovery and all six MCP tools over the protocol without writes. One headless model turn per language then used the `spec-review` skill and the MCP tools without writing files. The native harness (`plugin test`) separately covers terminal and desktop render paths with stubs. | Desktop on Windows or Linux, musl builds, automated Desktop runs. See [Claude Code installed package](host-common-qualification.md#claude-code-installed-package). |
| Claude Code in Claude Desktop | Desktop app with bundled Claude Code 2.1.325, macOS 27.2.1 arm64 | Project-scoped install from a local marketplace of the same ZIP. The operator typed `/spectorque` in a Desktop Code-tab session: the native pane rendered the EN and ES fixtures with the same findings and evidence as the terminal; in EN, reject, explicit application (pending decision), stale-source rejection with the external edit preserved, refresh, common-workbench JSON/ZIP handoff and server shutdown on pane close were observed. | ES beyond pane rendering (covered in the terminal), Windows Desktop, automated Desktop runs. See [Claude Desktop](host-common-qualification.md#claude-desktop). |
| Codex MCP | 0.169.0-alpha.11.1 | Real Codex app-server discovers three project skills and six tools; EN/ES source → proposal → common-panel reject/apply → reanalysis/export passed without inference. | Conversational/desktop UI and other OS remain pending. See [qualification and limits](qualification.md). |
| Shared VS Code workbench | VS Code 1.146.0, bundled Node 24.22.1 | Installed VSIX in isolated real extension host: iframe, source/evidence, reject/apply, JSON export, singleton and shutdown passed. Actual Restricted Mode blocks its command. | Codex IDE 26.51111.21308 sidebar coexists in an isolated profile without a submitted turn. Authenticated agent interaction, ES native walkthrough and other OS remain pending. |
| OpenCode TUI | 2.1.4 | The installed ZIP passed EN/ES native session scope, reviewed writes, stale-source recovery and scoped browser export across twelve macOS, Linux and Windows executable variants. | The observed route is the TUI with a local session. See [#6](https://github.com/jayanez/spec-torque/issues/6#issuecomment-6964485668). |
| ThinkRail desktop with Pi package | ThinkRail 0.4.0; `pi-spectorque` 0.2.0 (released ZIP `b475c885…`); macOS 27.2.1 arm64 | Project-local install of the 0.2.0 ZIP. An untrusted project hides `/spectorque` and the project skills; after trust, `/spectorque` and all three skills are discovered. EN/ES: All documents matches the engine; reviewed writes change exactly one line; rejection writes nothing (EN); an external edit during review causes stale-proposal rejection and is preserved; browser handoff JSON and ZIP exports pass with no external requests. No model prompt was submitted. | The 0.2.0 package offers only All documents in ThinkRail, because the scope picker was limited to Pi's TUI mode; the unreleased fix was observed in ThinkRail with both feature scopes matching the engine in EN. The host editor shows the previously submitted text after the first proposal in a chat (the before/after confirmation shows the true original). Pi dialog text is English in ES projects. Other ThinkRail/Pi versions and operating systems, model-backed skill invocation and human accessibility. See [ThinkRail/Pi qualification](host-common-qualification.md#thinkrail-desktop-with-pi-package). |
| Pi CLI | 1.5.2 with `pi-spectorque` 0.1.0 | Clean project-local install, trust and removal controls, extension and skill discovery, EN/ES text and JSON reports, and real terminal refinement with JSON/ZIP workbench handoff passed on [GitHub-hosted macOS, Linux and Windows](https://github.com/jayanez/spec-torque/actions/runs/44178615320). | Other Pi versions and model-backed skill invocation remain unqualified. |
| Codex Desktop viewer | Desktop 26.1117.31558 build 29513, macOS 27.2.1 arm64 | Installed ZIP EN/ES native walkthrough at `4a62ed9`; focused feedback fix at `54a57c2` verified in Desktop in EN and the prior fix in ES. The merged tree `959271f` reproduced the final ZIP digest. Existing profile and bounded model turns were used. See [Desktop qualification](codex-desktop-probe.md#020-candidate-qualification-on-macos-arm64). | Clean OS profile, final fix in Desktop ES, VoiceOver, other macOS architectures and Windows Desktop remain unqualified. Network and exact turn payload were not measured. |
| Cursor / Copilot / Gemini CLI | Not qualified | Connection guidance only. | Real host qualification after the committed four-host scope. |

## 0.2.0 candidate checks

The [post-merge run for PR #40](https://github.com/jayanez/spec-torque/actions/runs/44684548830) passed installed CLI smoke tests on Ubuntu, macOS and Windows, and installed workbench browser checks on Ubuntu. The PR also ran the installed-terminal matrices for [Claude Code](https://github.com/jayanez/spec-torque/actions/runs/44639162600), [OpenCode](https://github.com/jayanez/spec-torque/actions/runs/44639162540) and [Pi](https://github.com/jayanez/spec-torque/actions/runs/44639162654). These results apply to the commits and artifacts in those runs. Check the exact release artifact before extending the results to another build.

The [pilot runbook](pilot-operations.md) tracks participant and release acceptance. Safari with VoiceOver, the wider VS Code workflow and Windows Desktop variants retain the limits in the table.

## 0.3.0 package checks (local, macOS 27.2 arm64, Node 22.20.0)

Observed on 2026-11-26 against the uncommitted 0.3.0 working tree, before publication. They exercise package shape and catalog parsing, not installation from the public registries, and do not extend the qualification rows above.

| Check | Result |
|---|---|
| `npm run pack:hosts` | Five npm tarballs packed and their entry points verified from a clean extraction. The root tarball no longer bundles host integrations. |
| Claude Code 2.1.311 | `SPECTORQUE_CLAUDE_ISOLATED=1 npm run qualify:claude` on `spectorque-claude-0.3.0.zip`: 21 of 21 cases pass in EN/ES, including install and removal through the committed catalog (source rewritten to the archive) at project scope. In the operator's own profile the removal case fails only because a separately installed SpecTorque plugin still answers `/spectorque`. `claude plugin validate .` and `claude plugin validate --profile directory integrations/claude` pass (the second reports advisory notes on two gating hooks without `.catch`). `claude plugin test integrations/claude`: 12 of 12 pass. The pane rendered 0.3.0 with `--plugin-dir integrations/claude`. |
| Codex CLI 0.170.0 | With an isolated `CODEX_HOME`, the committed catalog with its source pointed at the extracted `spectorque-codex` tarball installed `spectorque@spectorque` 0.3.0. The unchanged catalog parsed its `npm` source and failed to install only because the package is not yet published. `npm run verify:codex-package` passed. |
| OpenCode 2.1.4 | `npm run qualify:opencode` on `spectorque-opencode-0.3.0.zip` (darwin-arm64) passes in EN/ES. The extracted `opencode-spectorque` tarball, listed in `cli.json`, opened the native panel in an active session. `opencode plugin add` accepts only registry or git specifiers, so the published package cannot be tried before release. |
| Pi 1.5.2 | `npm run qualify:pi -- <pi 1.5.2> --installed-archive spectorque-pi-0.3.0.zip --terminal-driver <node-pty>` passes: discovery, trust controls, text and JSON reports, RPC scopes and the EN/ES terminal walkthrough with JSON/ZIP handoff. |
| Pi 1.6.1 | The same qualifier stops at the headless text report: with no model configured, Pi 1.6.1 writes a "No models available" warning to stderr, which the check requires to be empty. The SpecTorque report itself is unchanged. `pi install` of the extracted `pi-spectorque` tarball (`--local`) loaded the extension and the three skills; `/spectorque` showed the widget and finding picker offline. |
| VS Code 1.147.0 | The VSIX built by `@vscode/vsce` 4.1.1 installed in an isolated extension host and passed `npm run test:vscode`. |

## 0.3.0 installs from the public registries (macOS 27.2 arm64, Node 22.20.0)

Observed on 2026-11-26 after release [v0.3.0](https://github.com/jayanez/spec-torque/releases/tag/v0.3.0), each in an isolated profile. They confirm that the published packages and catalogs install; they do not repeat the qualification runs above.

| Route | Result |
|---|---|
| Claude Code 2.1.311 | With an isolated `CLAUDE_CONFIG_DIR`, `claude plugin marketplace add jayanez/spec-torque` and `claude plugin install spectorque@spectorque` installed `spectorque@spectorque` 0.3.0, enabled. |
| Codex CLI 0.170.0 | With an isolated `CODEX_HOME`, `codex plugin marketplace add jayanez/spec-torque` and `codex plugin add spectorque@spectorque` installed 0.3.0 from npm with its runtime (`server.mjs`, `viewer.html`, `workbench.mjs`), skills and web assets. |
| Pi 1.5.2 | `pi install npm:pi-spectorque@0.3.0 --local` in a scratch git project installed the package and recorded it in `.pi/settings.json`. |
| npm CLI and MCP | `npx -y spectorque@0.3.0 --help` reports SpecTorque 0.3.0; `npx -y spectorque@0.3.0 mcp` answers `initialize` as server `spectorque` 0.3.0. |
| Listings | npm: five packages at 0.3.0 (`next`, and `latest` as first versions). VS Code Marketplace: `jayanez.spectorque` 0.3.0 pre-release. MCP Registry: `io.github.jayanez/spectorque` 0.3.0. Open VSX: not published, namespace claim pending. |

OpenCode was not reinstalled from npm in this pass.

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
