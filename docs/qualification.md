# Local qualification and critical review

Snapshot: 2026-11-16. Related tasks: [operational workflow #1](https://github.com/jayanez/spec-torque/issues/1), [workbench #3](https://github.com/jayanez/spec-torque/issues/3), [VS Code #5](https://github.com/jayanez/spec-torque/issues/5). This is partial evidence toward the existing milestones, not four-host acceptance.

## Reproduce the environment

Use Node **22.20.0** from `.nvmrc` (`nvm use` if available). `npm run verify:node` prints the actual npm subprocess executable and rejects development/qualification under other Node majors. The distributable still declares Node >=22.20; VS Code's bundled runtime is recorded separately.

```sh
npm ci --ignore-scripts
npm run check
npm run package:integrations
npm audit --audit-level=moderate
npm run browsers:install
npm run test:browser
npm run package:vscode
```

Browser binaries live in ignored `.spectorque/browsers`, with results in `test-results` and `playwright-report`. Each test starts an ephemeral loopback server over disposable documents. The browser suite covers EN/ES import, exact evidence selection, keyboard navigation, rejection, acceptance, reanalysis, JSON/ZIP export, undo, stale disk writes, failed connections and empty workspaces. Axe runs WCAG A/AA checks on the reviewed document state. These automated checks do not establish complete accessibility or screen-reader acceptance. macOS WebKit uses Option+Tab for full keyboard traversal ([upstream guidance](https://github.com/microsoft/playwright/issues/5609)).

Tool versions: Playwright 1.65.1, axe-core/Playwright 4.14.0, test-electron 3.1.0 and vsce 4.1.1. The scoped vsce override pins minimatch 11.0.1 because its default dependency was affected by [GHSA-g3hv-75wg-m249](https://github.com/advisories/GHSA-g3hv-75wg-m249). The generated VSIX was installed and exercised with this override. No forced bulk dependency upgrade was used.

## Codex project installation and removal

```sh
npm run prepare:codex -- en
npm run prepare:codex -- es
```

Each command creates a new ignored `.spectorque/codex-en` or `codex-es` workspace, copies original example documents and the three canonical skills into `.agents/skills`, and writes a local `.codex/config.toml` for the built stdio MCP server. It refuses to reset an existing directory. Paths are generated on the local machine, not committed. Open that directory in Codex, trust only that test workspace, and verify the SpecTorque MCP inventory. Project skill discovery follows the [official Codex implementation](https://github.com/openai/codex/blob/main/codex-rs/ext/skills/src/host_roots.rs).

The MCP tools return drafts and proposals; they do not apply edits. Review the source and difference in the common workbench and explicitly opt into a disk write, or use an approved host editing action. Export before removing the generated workspace. Removal consists of deleting that generated directory after retaining wanted edits; no global Codex configuration or skills need changing.

```sh
npm run qualify:codex
```

This opt-in script requires a local `codex` executable (or `CODEX_EXECUTABLE`). It uses a fresh project, separate `CODEX_HOME`, ephemeral app-server thread and a loopback-only model-provider trap. It starts no model turn. In both languages the real client discovers all three skills and six tools, creates a draft, discovers/analyzes source, reads refinement context, proposes without writing, rejects once in the actual browser, explicitly applies another proposal through the common workbench, reanalyzes and exports through Codex. It also checks an escaped source path. The trap must receive zero inference requests. Evidence and scratch files remain under the printed `.spectorque/codex-run-*` directory.

## Installed VS Code qualification

After `npm run package:vscode`, set `VSCODE_EXECUTABLE` to the actual installed editor executable and run:

```sh
npm run test:vscode
npm run test:vscode -- --restricted
```

For example on macOS, the executable is `/Applications/Visual Studio Code.app/Contents/MacOS/Code`. The harness installs the generated VSIX into a fresh extensions directory and uses isolated user data with telemetry and updates disabled. It never downloads an editor or changes the user's profile. The positive run attaches Playwright to the real Electron renderer, exercises the embedded workbench and checks the actual loopback listener stops after closing its tab. Screenshots, exported assessment and evidence JSON are saved in `.spectorque/vscode-run-*`.

To check coexistence, optionally set `CODEX_VSCODE_EXTENSION` to an existing local Codex extension directory. The harness copies it into the isolated profile and explicitly loads that copy; it opens the sidebar with a separate `CODEX_HOME` and submits no turn. No extension marketplace or user profile is changed.

The negative run retains Workspace Trust and verifies an untrusted workspace cannot activate the command or open the panel. It launches the extension-test entrypoint directly because test-electron 3.1.0 unconditionally adds `--disable-workspace-trust`; using that helper would invalidate the negative check. See [Workspace Trust](https://code.visualstudio.com/api/extension-guides/workspace-trust).

## Observed results and limits

| Check | Observed result |
|---|---|
| Baseline at 4290549, Node 22.20.0 | 27 tests, production build, integration packaging passed; zero audit findings. |
| Updated core/protocol/boundary tests | 37 passed; build and integration packaging passed. |
| Updated dependency audit | Zero vulnerabilities at moderate threshold, including development tooling. |
| Chromium and WebKit, macOS 27.2.1 arm64 | 24 cases passed across 375/768/1280 widths; EN/ES axe and keyboard assertions passed. |
| Firefox, same machine | All 12 cases blocked before application load. Headless reports missing profile; headed probe reports sandbox extension failure. Also reproduced with Playwright 1.64.1. No sandbox protection was disabled, no case skipped, no Firefox pass claimed. The full suite remains active in Linux CI. |
| Codex 0.169.0-alpha.11.1 | Real app-server + common browser workbench passed EN/ES, three project skills, six tools, changed revision identity and zero inference requests. |
| VS Code 1.146.0, bundled Node 24.22.1 | Installed VSIX exercised: rendered iframe, evidence, reject/apply, JSON download, singleton panel and server disposal. Actual untrusted-workspace run blocked the command. Codex IDE 26.51111.21308 was also activated beside the panel with no submitted turn. |

Codex's conversational/desktop UI, authenticated IDE workflows, other operating systems, the other three hosts and human/screen-reader acceptance remain pending. App-server and extension-host evidence must not be renamed full native or four-host acceptance. These checks establish neither scientific calibration nor semantic completeness.

## Critical findings and disposition

| Priority | Location and reproduction | Impact and disposition |
|---|---|---|
| P1 | `src/core/refine.ts`: change `MUST never disclose credentials` to `MUST disclose credentials, never log errors`; or remove `sin publicarlos` in ES. | The previous guard accepted altered negative scope. Creation and application now require detected negative clauses to remain verbatim apart from whitespace; ten regression tests cover rejection and permitted edits. Ambiguous rewrites are blocked, not automatically accepted. |
| P2 | `src/web/SourcePanel.tsx`: import a Markdown file using the selector. Its live FileList was reset before asynchronous reads finished. | Import failed after reading. Snapshot selected File objects before awaiting; EN/ES browser regressions exercise the real selector. |
| P2 | `src/web/styles.css`: the `/30` label used contrast below 4.5:1; Linux fonts also caused the Spanish report controls to overflow at 375px. | Reuse the readable muted color and allow report controls to wrap; axe and viewport assertions retain the same thresholds. |
| P2 | VS Code manifest/command had no explicit trust boundary. | Declare unsupported untrusted/virtual workspaces and enforce trusted local workspace access before starting a child. Verified in actual Restricted Mode. |
| P2 | `src/node/server.ts`: real VS Code iframe was blocked by frame-ancestors. | Add only the observed desktop ancestor `vscode-file://vscode-app`, retaining loopback Host/Origin/session checks and restricted embedding. The installed VSIX test verifies actual rendering. |

Reviewed filesystem/hash, request/response bounds, explicit providers and read-only MCP boundaries retain their existing guarantees and tests. This bounded review found no additional confirmed bypass there; it does not prove race-free behavior against a hostile process controlling the same filesystem. Regex analysis and exclusion detection remain deliberately incomplete. The EN/ES corpus and human calibration stay in #2.

## Remaining terminal clients

See [the bounded Claude, OpenCode and Pi walkthroughs](host-common-qualification.md)
for real terminal interactions and the separate `qualify:handoff` browser check.
These results do not close four-host, package-discovery or cross-platform acceptance.
