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

1. Use a clean OS test user or VM with its own ChatGPT app data, Codex config, marketplace cache and credentials. Verify that the GUI and local runtime use the isolated account. Record desktop app version, build/channel, runtime version if visible, OS and architecture, Node version and any account or policy requirements.
2. Open the generated `project-a` in **Codex** mode. Decline project trust and check that project config cannot activate the probe. Then trust this scratch project, open **Plugins**, find **spectorque-desktop-probe** under **spectorque-desktop-qualification** and install it. Verify that the installed manifest, runtime and HTML bytes match the archive. Record the marketplace source, effective config and digest. If the packaged server fails to start, check GUI Node resolution and placeholder resolution. Record any diagnostic variant and its own digest.
3. In a new local chat, look for a direct conversation-panel entry. Open it, capture the probe heading and the **Bridge ready** status, then use **Read probe marker** and verify `probe-second-read`. Capture the placement and whether a turn was sent. Check whether the same surface reopens after closing. If an authenticated or model-triggered call is required to test inline or fullscreen, run it only after separate authorization and use this synthetic fixture.
4. Record the server trace from `PLUGIN_DATA/trace.ndjson` if the host resolves that path, or from the local MCP diagnostics. The expected sequence is `server-start`, `open-probe`, `resource-read`, `read-probe`. Record the observed ordering and any absent stages. The trace includes the standard UI capability advertisement, process ID and a bounded cwd category. The in-view status records the bridge protocol and its reported placement. Keep sanitized screenshots and trace lines. A resource URI in the tool result establishes association. A successful button click and resulting second read establish interaction.
5. Open a second chat and the linked `project-b` worktree. Compare markers, cwd categories and process lifetimes. An `other` cwd is expected when the plugin launches in its own directory. In that case, verify separately whether a supported host interface can bind the active worktree before exposing real documents. Recheck trust after installation and verify that a denied project cannot open its workspace through the probe.
6. Disable or uninstall the plugin and open `project-direct` in the isolated profile. Repeat discovery, resource and bridge checks with direct stdio MCP. This project uses an explicit cwd and writes its diagnostics to `direct-trace.ndjson` beside `probe.json`. A direct MCP pass is evidence for that configuration.
7. Once an installed native surface works, qualify a public guarded action or a user-controlled local workbench handoff over one synthetic proposed change. Verify explicit approval, the exact resulting bytes, return to the same root and revision refresh. Check local download with synthetic bytes. If download is unavailable, check whether a scoped local workbench handoff is possible. Record observed network activity and model turn counts with the method and its limits.

Record the last successful stage and the first error if a case stops. Keep installation, app-server, synthetic browser and native results distinct. Where native rendering is unavailable, record the action and built-in-browser handoff separately.

## Clean up

Close the probe views. Disable and remove the probe in **Plugins** and confirm it disappears after restart. Check that probe processes have exited and close any separately started workbench listener. Remove any marketplace registration added in the test profile and preserve only sanitized evidence. The two linked repositories and direct-MCP configuration are all under the generated run directory. Remove only that directory and the disposable profile or VM when their evidence is retained.
