# Integrations

Build the source checkout with `npm ci --ignore-scripts && npm run build && npm run package:integrations`. Generated host runtimes bundle their dependencies; they do not require a provider or copy your credentials. Start the common workbench with `node dist/cli.js serve --root /absolute/project`.

## MCP and skills

Use this server configuration in a host's supported local MCP configuration:

```json
{"mcpServers":{"spectorque":{"command":"node","args":["/absolute/spectorque/dist/mcp.js"],"env":{"SPECTORQUE_ROOT":"/absolute/project"}}}}
```

Tools: `discover_specs`, `analyze_specs`, `create_specs`, `refinement_context`, `propose_refinement`, `export_report`. They are read-only: creation returns text, proposals return reviewed-change objects. Use the workbench or the host's own edit tools after approval. Do not configure a user-controlled workspace root from imported text.

The three portable skills in `skills/` cover authoring, review and refinement. Install in the host's documented skill directory or use the packaged plugin. They never substitute a model opinion for engine output.

## Claude Code

Load the generated folder using `claude --plugin-dir /absolute/spectorque/integrations/claude` in your project. Run `/spectorque` for the native Mod pane. It uses the current public Mods API (`hooks/hooks.json` modules, command registration and Pane rendering), not shell event hooks. The plugin also includes MCP and skills. Older clients without Mods should use MCP and the common workbench.

Validate with `claude plugin validate integrations/claude` and run the bundled native harness with `claude plugin test integrations/claude`. A harness result and a real interactive/client walkthrough are recorded separately.

Official references: [Mods](https://code.claude.com/docs/en/plugins/mods/create), [interface](https://code.claude.com/docs/en/plugins/mods/interface), [testing](https://code.claude.com/docs/en/plugins/mods/test).

## Codex and VS Code

For a disposable project-scoped Codex installation, run `npm run prepare:codex -- en` or `-- es` after building. The generated workspace contains the host-specific TOML configuration and three local skills. See [qualification](qualification.md) for reproduction and removal; the generic JSON configuration above is not a Codex TOML example.

MCP/skills connect the agent. The visual deliverable is a standard VS Code webview alongside Codex. Install the packaged VSIX or load `integrations/vscode` through VS Code's extension development host, open your project and run **SpecTorque: Open Specification Workbench**. It launches a workspace-scoped local server and displays the same panel. The extension stops its child server when disposed.

The VS Code path uses public extension APIs; it is not a custom panel injected into the Codex desktop application. Desktop MCP Apps rendering needs independent real-client qualification and is additional scope. API metadata alone is insufficient evidence of rendering.

Official reference: [VS Code webviews](https://code.visualstudio.com/api/extension-guides/webview).

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
dialog from home. Focus the panel and press **s** for scope, **e** for the exact
source line, **r** for reviewed changes, **w** for the local workbench URL and
**q** to close it. `/spectorque-review` remains available from the command
palette and prompt. The workbench uses the session's local workspace. In the
browser, load the workspace and select the same feature as the panel.

On a session connection error, reconnect and rerun `/spectorque`. The workbench
URL expires when the terminal changes workspaces or unloads the adapter.
Remote filesystems, the minimal CLI and the desktop client are outside the
observed TUI surface. See [OpenCode qualification](host-common-qualification.md#opencode-installed-package).

## Pi

Load `integrations/pi/index.ts` with Pi's extension option, or install the generated `integrations/pi` package through Pi's package mechanism. `/spectorque` supplies a score/evidence widget and interactive finding selection, editor and explicit confirmation. Headless invocation returns the report without starting a model turn. Skills are included.

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

Generate the package using the build commands above, then run:

```sh
npm run qualify:pi -- /absolute/path/to/pi/dist/bundle/cli.js --installed-package integrations/pi
```

The check stages the generated directory outside the checkout and registers it
with Pi's project-local package manager in disposable EN/ES workspaces. It uses
an isolated agent directory, trusts each project only for the relevant commands,
and checks command and skill discovery through Pi RPC. It exercises text and JSON
reports without a model turn, verifies project trust and removal controls, and
prints the package file digest and runtime versions. The workflow **Qualify
installed Pi package** runs these checks on macOS, Linux and Windows with Pi
1.5.2. The workflow also passes `--terminal-driver /absolute/node-pty` with
Node PTY 1.1.0 to drive real Pi terminals and then opens the accepted EN/ES
workspaces in Chromium. It retains JSON/ZIP and browser evidence by platform.
For local runs with the terminal driver, install Playwright Chromium first
and make the Node PTY spawn helper executable on macOS if needed.

For a manual walkthrough, create a disposable copy of each bilingual fixture,
install the generated directory with `pi install /absolute/generated/pi --local`,
then open Pi offline with an isolated agent profile and approve the scratch
project. Run `/spectorque`, verify evidence navigation, reject a proposal, accept
a reviewed proposal that leaves a pending decision, and verify stale-source
rejection by editing the selected file before accepting a second proposal.
Run `npm run qualify:handoff -- /absolute/scratch-workspace` from the SpecTorque
checkout after the first acceptance and before the stale-source exercise.
Remove the package with `pi remove /absolute/generated/pi --local --approve`
and discard the isolated workspace and profile.
