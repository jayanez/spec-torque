# Integrations

Build the source checkout with `npm ci --ignore-scripts && npm run build && npm run package:integrations`. Generated host runtimes bundle their dependencies; they do not require a provider or copy your credentials. Start the common workbench with `node dist/cli.js serve --root /absolute/project`. It opens on that work tree: `serve --feature <id>` loads that feature, otherwise the whole work tree loads when it fits one read, and a larger tree waits for a feature choice without reading any document. **Reload local workspace** reads the current choice again. The **Local workspace feature** picker filters as you type. The side panels collapse and resize, and remember that in the browser. **Artifact set** narrows a loaded set in memory and appears only when that set holds more than one feature. Every host (the workbench, the Claude Code pane, Codex, OpenCode, Pi and VS Code) shows the same title with the product version, scope labels (**All documents**, **Changed on this branch**, a feature ID, `Other · <id>` for groups without a known layout or for templates), summary (`15/30 · 13 findings · 0 open decisions · engine 0.1.9`), finding card (`Finding 1 of 13 · I1.2 · warning`, the location, the evidence and the fix) and closing note, built from `src/core/presentation.ts`.

## MCP and skills

Use this server configuration in a host's supported local MCP configuration:

```json
{"mcpServers":{"spectorque":{"command":"node","args":["/absolute/spectorque/dist/mcp.js"],"env":{"SPECTORQUE_ROOT":"/absolute/project"}}}}
```

Without `SPECTORQUE_ROOT`, the server uses the git work tree of the host's project folder (`CLAUDE_PROJECT_DIR` or its working directory). See [discovery criteria](architecture.md#discovery-criteria). `discover_specs` with `index: true` lists features without reading content; `discover_specs`, `analyze_specs` and `export_report` accept one of `feature`, `paths` or `changed` (with optional `base`). The CLI offers the same through `spectorque features`, `--feature`, `--path` and `--changed [--base rev]`.

Tools: `discover_specs`, `analyze_specs`, `create_specs`, `refinement_context`, `propose_refinement`, `export_report`. They are read-only: creation returns text, proposals return reviewed-change objects. Use the workbench or the host's own edit tools after approval. Do not configure a user-controlled workspace root from imported text.

The three portable skills in `skills/` cover authoring, review and refinement. Install in the host's documented skill directory or use the packaged plugin. They never substitute a model opinion for engine output.

## Claude Code

Run `npm run package:claude`; it rebuilds the engine and host runtimes first (`npm run build` and `npm run package:integrations`), so the ZIP never carries a stale runtime. The script writes a deterministic `artifacts/spectorque-claude-<version>.zip` (sorted entries, fixed timestamps, no tests) and prints its SHA-256. Load it for one session with `claude --plugin-dir /absolute/artifacts/spectorque-claude-0.2.3.zip` in your project, or load the generated folder with `claude --plugin-dir /absolute/spectorque/integrations/claude`. `claude plugin validate` reads directories, not archives: validate an extracted copy. The pane runs `node` from `PATH`; use Node 22.20+ there. The pane lists features from the work tree index before reading anything. `/spectorque <feature | folder | --changed [base]>` opens a scope directly. Otherwise a filtered selector offers one feature, the branch's changes, and **All documents** only when the work tree fits one read. A session started in a subfolder opens on that folder, and the last scope is remembered per work tree. Companion completeness needs a single selected feature. A proposal is refused when the source no longer matches the assessed hash. The pane reads top to bottom: title, scope (filter and **Select scope**, which always lists the scope in use), summary and dimensions, the finding card with **Previous**/**Next** (dimmed at either end), **Proposed replacement for line N** and **Review change**, the reviewed difference with **Apply reviewed change** and **Reject proposal**, then **Refresh analysis** and the workbench button in one row. **Open common workbench** starts the loopback workbench for the session's work tree and shows the address as a clickable link, the same one it copies, with "Address copied to the clipboard · Opens on <feature>" dimmed below it; the workbench loads that feature by itself; it stops when you close it, close the pane or end the session. Pressing it while the server is starting cancels that startup. To verify the browser exports against that running server, run `npm run qualify:handoff -- /absolute/workspace --url <address>`. `npm run qualify:claude` drives the whole installed-ZIP walkthrough in a real terminal client; see [host qualification](host-common-qualification.md#claude-code-installed-package). Run `/spectorque` for the native Mod pane. It uses the current public Mods API (`hooks/hooks.json` modules, command registration and Pane rendering), not shell event hooks. The plugin also includes MCP and skills. Older clients without Mods should use MCP and the common workbench.

Validate with `claude plugin validate integrations/claude` and run the bundled native harness with `claude plugin test integrations/claude`. A harness result and a real interactive/client walkthrough are recorded separately.

Official references: [Mods](https://code.claude.com/docs/en/plugins/mods/create), [interface](https://code.claude.com/docs/en/plugins/mods/interface), [testing](https://code.claude.com/docs/en/plugins/mods/test).

## Codex Desktop

Build the viewer ZIP with `npm run check`, `npm run package:integrations` and `npm run package:codex`. Verify the package with `npm run verify:codex-package`. The ZIP bundles the project MCP runtime, the inline resource, the skills and the loopback workbench. Follow the [package guide](../integrations/codex/README.md) for local marketplace installation, binding a trusted worktree, upgrade and removal.

Use the inline viewer for scope, evidence and the exact before/after. It shows the summary and dimensions, then a labelled finding card with **Previous**/**Next**, and its scope selector offers **Changed on this branch** and always lists the current feature. `open_spectorque` accepts an optional `feature`, or `changed` with an optional `base`. In a worktree too large for one read, the viewer lists the features and waits for a choice, and long lists can be filtered. The integrated browser opens the loopback workbench for an explicitly approved disk write and for JSON/ZIP export. The tested opening route invokes `open_spectorque` in a local Codex chat. See [Desktop qualification](codex-desktop-probe.md) for observed builds and limits.

The independent project-MCP control `npm run prepare:codex -- en` or `-- es` generates a disposable workspace and three local skills. See [qualification](qualification.md) for the app-server run.

## VS Code workbench

Install the packaged VSIX or load `integrations/vscode` through the extension development host. Run **SpecTorque: Open Specification Workbench** from the project. With several features, the **Select scope** QuickPick offers All documents (when the tree fits one read), **Changed on this branch** and each feature, lists the remembered scope first marked *current*, and opens the workbench on it. The panel title names the scope, and the notification shows the same `Workbench: http://localhost:PORT/ — opens on <feature>` line as the other hosts. The extension launches and disposes a workspace-scoped loopback server. The shared editor workstream is tracked in [#5](https://github.com/jayanez/spec-torque/issues/5).

## OpenCode

Run `npm run build`, `npm run package:integrations` and `npm run package:opencode`
to create the host ZIP. Extract it and add its absolute directory to `plugins`
in your CLI profile: `{"plugins":["/absolute/spectorque-opencode"]}`. OpenCode
2.1.4 reads the single CLI settings file at
`$XDG_CONFIG_HOME/opencode/cli.json` when XDG is configured. The entry applies
across that profile's workspaces. Remove it and restart OpenCode to uninstall.
The ZIP exports `./tui` and includes the bundled runtime and workbench assets.
It contains no auto-discovered OpenCode skills.

`/spectorque` opens the native panel for a local, existing session and a summary
dialog from home; `/spectorque-scope <feature | folder | --changed [base]>` opens it on a scope. When no scope is set, a searchable dialog lists the work tree's features, with known layouts first. Focus the panel and press **s** for scope, **e** for the exact
source line, **r** for reviewed changes, **w** for the local workbench URL, **o** to open it in your browser and
**q** to close it. `/spectorque-review` remains available from the command
palette and prompt. The workbench uses the session's local workspace. In the
browser, load the workspace and select the same feature as the panel.

On a session connection error, reconnect and rerun `/spectorque`. The workbench
URL expires when the terminal changes workspaces or unloads the adapter.
Remote filesystems, the minimal CLI and the desktop client are outside the
observed TUI surface. See [OpenCode qualification](host-common-qualification.md#opencode-installed-package).

## Pi

Load `integrations/pi/index.ts` with Pi's extension option, or install the generated `integrations/pi` package through Pi's package mechanism. `/spectorque [feature | folder | --changed [base]]` supplies a score/evidence widget and interactive finding selection, editor and explicit confirmation. Without an argument, the scope picker lists the shared features and the branch's changes. Headless invocation returns the report without starting a model turn; on a work tree larger than one read it needs a scope argument. Skills are included.

## Other hosts

Cursor and Copilot in VS Code can use the standard extension and their documented MCP setup; no custom branded panel is promised. Gemini CLI uses local MCP/skills and the common panel. Connection configuration shapes differ between hosts: use their current official schema rather than copying the wrapper object blindly. Full acceptance of these additional hosts is post-V1.

See [compatibility](compatibility.md) for observed versions and limits; package generation is not native qualification.

### Pi headless qualification

After `npm run check` and `npm run package:integrations`, run
`npm run qualify:pi -- /absolute/path/to/pi/dist/bundle/cli.js` with an existing
Pi installation. This opt-in check creates disposable EN/ES workspaces and empty
agent directories, disables extension/skill/context/MCP discovery and runs the
explicit local extension offline in text and JSON modes. It compares the complete
summary with the shared engine, checks the source is unchanged, and rejects JSON
model-turn events. No client installation or provider request is required.

Observed with Pi 1.5.2, Node 22.20.0, macOS 27.2.1 arm64: all four language/mode
combinations pass. Previously print mode exited successfully with empty stdout;
the extension now writes its summary explicitly in print mode. JSON retains Pi's
custom-message event stream. This qualifies the explicit extension's headless
reporting, not package/skill discovery, other client versions, other systems or
human accessibility. Those remain tracked in #7.

API behavior reference: [Pi extension modes](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/docs/extensions.md).

### Pi installed package qualification

Generate the package using the build commands above and `npm run package:pi`, then run:

```sh
npm run qualify:pi -- /absolute/path/to/pi/dist/bundle/cli.js --installed-archive artifacts/spectorque-pi-0.2.0.zip
```

The check extracts the exact archive outside the checkout and registers it
with Pi's project-local package manager in disposable EN/ES workspaces. It uses
an isolated agent directory, trusts each project only for the relevant commands,
and checks command and skill discovery through Pi RPC. It exercises text and JSON
reports without a model turn, verifies project trust and removal controls, and
prints the package file digest and runtime versions. The workflow **Qualify
installed Pi package** runs these checks on macOS, Linux and Windows with Pi
1.5.2. The workflow also passes `--terminal-driver /absolute/node-pty` with
Node PTY 1.1.0 to drive real Pi terminals and then opens the accepted EN/ES
feature in Chromium. It compares each scope's visible widget and finding paths
with the shared engine and retains JSON/ZIP and browser evidence by platform.
For local runs with the terminal driver, install Playwright Chromium first
and make the Node PTY spawn helper executable on macOS if needed.

For a manual walkthrough, copy each bilingual draft fixture into its own
disposable workspace. In each workspace copy `fixtures/en-complete/specs/booking`
to `specs/other`,
install the generated directory with `pi install /absolute/generated/pi --local`,
then open Pi offline with an isolated agent profile and approve the scratch
project. Run `/spectorque` and check the widget and evidence paths for **All
documents** and both feature scopes. Choose `specs/booking`, reject a proposal, accept
a reviewed proposal that leaves a pending decision, and verify stale-source
rejection by editing the selected file before accepting a second proposal.
Run `npm run qualify:handoff -- /absolute/scratch-workspace --feature specs/booking`
from the SpecTorque checkout after the first acceptance and before the stale-source exercise.
Remove the package with `pi remove /absolute/generated/pi --local --approve`
and discard the isolated workspace and profile.

The feature selector for [#24](https://github.com/jayanez/spec-torque/issues/24)
passed installed-package qualification on 2026-11-18 at
`3783beb8fed401242b0f7e20b6448c65ba487257`. The run used Pi 1.5.2,
`pi-spectorque` 0.1.0, Node 22.20.0 and macOS 27.2.1 (26B131) arm64.
The package file digest was
`287f8b5c9f0e86e779152bb7b8a5ff81ec6f29e9c9b8ff54fda681fa4c943ae2` (SHA-256).
Both EN and ES terminal runs showed 7 findings across all documents, 6 in
`specs/booking` and 2 in `specs/other`. Both feature lists included shared
`AGENTS.md` evidence. The six companion practices were `unknown` across both
features and `partial` in the complete feature. Approved changes refreshed
`specs/booking` with one open decision, which was also verified in the workbench
and JSON export. Scope cancellation, proposal rejection, sibling bytes,
stale-source rejection and the four headless language/mode combinations passed.
