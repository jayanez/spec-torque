# Codex Desktop viewer probe

This opt-in fixture for [SpecTorque #27](https://github.com/jayanez/spec-torque/issues/27) tests whether the ChatGPT desktop app in Codex mode can mount and interact with a local plugin resource. The bundled MCP server has two read-only tools, a self-contained HTML resource and a synthetic marker. It uses no SpecTorque production adapter or project documents.

## Prepare the fixture and protocol control

Use Node 22.20.0 and Git. Prepare the fixture from the user account that will run the desktop test. Node must also be available to GUI-launched local MCP processes.

```sh
npm ci --ignore-scripts
npm run prepare:codex-desktop-probe
npm run browsers:install -- chromium
npm run qualify:codex-desktop-probe -- /path/to/generated/probe.json
```

Preparation prints the path to `probe.json`, a primary repository with a local marketplace, a linked worktree, a separate direct-MCP control project and the versioned archive with its SHA-256. An optional directory argument sets where to create the fixtures. Preparation leaves the desktop profile untouched.

The protocol control verifies the package digest and extracted files, then uses a real Codex app-server with a temporary `CODEX_HOME`. It checks trust denial and a successful tool and resource read through the direct project MCP configuration. A sandboxed Chromium iframe tests initialization and a button-driven second read through a synthetic host backed by that app-server. The control submits no turn and asserts zero requests to its loopback model-provider trap. Its `evidence.json` records protocol and synthetic browser evidence.

## Run in the installed desktop client

1. Use a clean OS test user or VM to measure clean-install behavior. A regular Codex profile can be used for an existing-profile smoke test with the disposable project. Record which profile was used, desktop app version, build/channel, runtime version if visible, OS and architecture, Node version and any account or policy requirements.
2. Open the generated `project-a` in **Codex** mode. Decline project trust and check that project config cannot activate the probe. Then trust this scratch project, open **Plugins**, find **spectorque-desktop-probe** under **spectorque-desktop-qualification** and install it. Verify that the installed manifest, runtime and HTML bytes match the archive. Record the marketplace source, effective config and digest. If the packaged server fails to start, check GUI Node resolution and placeholder resolution. Record any diagnostic variant and its own digest.
3. In a new local chat, look for a direct conversation-panel entry. Open it, capture the probe heading and the **Bridge ready** status, then use **Read probe marker** and verify `probe-second-read`. Capture the placement and whether a turn was sent. Check whether the same surface reopens after closing. If an authenticated or model-triggered call is required to test inline or fullscreen, run it only after separate authorization and use this synthetic fixture.
4. Record the server trace from `PLUGIN_DATA/trace.ndjson` if the host resolves that path, or from the local MCP diagnostics. The expected sequence is `server-start`, `open-probe`, `resource-read`, `read-probe`. Record the observed ordering and any absent stages. The trace includes the standard UI capability advertisement, process ID and bounded categories for cwd and any MCP roots advertised by the host. The in-view status records the bridge protocol and its reported placement. Keep sanitized screenshots and trace lines. A resource URI in the tool result establishes association. A successful button click and resulting second read establish interaction.
5. Open a second chat and the linked `project-b` worktree. Compare markers, cwd categories and process lifetimes. An `other` cwd is expected when the plugin launches in its own directory. In that case, verify separately whether a supported host interface can bind the active worktree before exposing real documents. Recheck trust after installation and verify that a denied project cannot open its workspace through the probe.
6. Disable or uninstall the plugin and open `project-direct` in the isolated profile. Repeat discovery, resource and bridge checks with direct stdio MCP. This project uses an explicit cwd and writes its diagnostics to `direct-trace.ndjson` beside `probe.json`. A direct MCP pass is evidence for that configuration.
7. Once an installed native surface works, qualify a public guarded action or a user-controlled local workbench handoff over one synthetic proposed change. Verify explicit approval, the exact resulting bytes, return to the same root and revision refresh. Check local download with synthetic bytes. If download is unavailable, check whether a scoped local workbench handoff is possible. Record observed network activity and model turn counts with the method and its limits.

Record the last successful stage and the first error if a case stops. Keep installation, app-server, synthetic browser and native results distinct. Where native rendering is unavailable, record the action and built-in-browser handoff separately.

## Install and open using the CLI

When the installed Codex CLI supports local marketplace installation, run the following from the generated `project-a` directory:

```sh
codex plugin marketplace add .
codex plugin add spectorque-desktop-probe@spectorque-desktop-qualification
codex app .
```

The CLI installs in the current Codex profile and opens the project in the desktop app on macOS. Continue the rendering and interaction checks in the desktop UI. Compare the archived files with the installed copy before recording the installation. Codex may generate a `.codex-plugin/plugin.json` compatibility overlay in that copy. Record additional files separately. See the [marketplace documentation](https://developers.openai.com/plugins/build/plugins#add-plugins-from-a-local-marketplace) and [CLI reference](https://learn.chatgpt.com/docs/cli/reference#codex-app).

## Observed on macOS arm64

ChatGPT Desktop `26.1111.21308` build `27194`, with bundled Codex `0.169.0-alpha.11.1`, installed the portable package but did not expose its MCP tools in the tested session. The same bundled runtime exposed both tools with a compatibility `.mcp.json` declaring an absolute Node executable and the installed runtime path. This compatibility variant was generated for the machine and used only with the disposable fixture.

With the compatibility variant installed, a user-initiated turn invoked `open_probe` and rendered the resource inline in Codex mode. The widget displayed bridge protocol `2026-01-26`. The user clicked **Read probe marker** and received `probe-second-read · cwd: other`. Server traces for the same process confirmed `open-probe`, `resource-read` and `read-probe` with the UI capability advertised. The process cwd pointed at the installed package. Workspace identity, direct launch without a model turn, persistent panel, guarded write and export remain to be qualified.

### Bind the probe to a trusted project

Probe 0.1.1 rendered inline in the same build and returned `roots: not-advertised`. A package-local cwd therefore cannot identify the active worktree in this configuration. To test a project-scoped binding, give each disposable worktree its own `.codex/config.toml` with the same server name as the installed plugin:

```toml
[mcp_servers.spectorque-desktop-probe]
command = "/absolute/path/to/node"
args = ["/absolute/path/to/installed/plugin/runtime/server.mjs"]
cwd = "/absolute/path/to/this/worktree"

[mcp_servers.spectorque-desktop-probe.env]
SPECTORQUE_PROBE_TRACE = "/absolute/path/to/this/worktree-probe-trace.ndjson"
```

Open a new local chat in each trusted worktree. Invoke the probe and use its **Read probe marker** button. Compare the displayed categories and the separate traces. A control using the bundled app-server with an installed legacy-compatible package returned `project-a` and `project-b` from two concurrent threads and read the UI resource in both. Record desktop rendering with the project-scoped configuration separately. The real adapter must derive the workspace from trusted configuration and reject a missing or invalid binding.

## Clean up

Close the probe views. Disable and remove the probe in **Plugins** and confirm it disappears after restart. Check that probe processes have exited and close any separately started workbench listener. Remove any marketplace registration added for the probe and preserve only sanitized evidence. For the CLI route, use `codex plugin remove spectorque-desktop-probe@spectorque-desktop-qualification` and `codex plugin marketplace remove spectorque-desktop-qualification`. The two linked repositories and direct-MCP configuration are all under the generated run directory. Remove only that directory and the disposable profile or VM when their evidence is retained.
