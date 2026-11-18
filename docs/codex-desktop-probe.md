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

Open a new local chat in each trusted worktree. Invoke the probe and use its **Read probe marker** button. Compare the displayed categories and the separate traces. A control using the bundled app-server with an installed legacy-compatible package returned `project-a` and `project-b` from two concurrent threads and read the UI resource in both. In Desktop, the installed plugin continued to handle requests while both routes were available. After uninstalling the probe plugin and giving the project MCP server its own name, the desktop UI rendered inline and the button returned `project-a` and `project-b` in their respective chats. Both traces recorded the resource read and second tool call. Each launch used a user-initiated model turn. The real adapter must derive the workspace from trusted configuration and reject a missing or invalid binding.

## Exercise the scoped assessment viewer

Run `npm run check` and `npm run package:integrations` from the SpecTorque checkout. The latter generates the desktop server and HTML under `integrations/codex/runtime`. In a trusted disposable project, add the following project-local configuration using absolute paths appropriate for that machine and worktree:

```toml
[mcp_servers.spectorque-workspace]
command = "/absolute/path/to/node"
args = ["/absolute/path/to/integrations/codex/runtime/server.mjs"]
cwd = "/absolute/path/to/this/worktree"

[mcp_servers.spectorque-workspace.env]
SPECTORQUE_ROOT = "/absolute/path/to/this/worktree"
```

Copy `fixtures/en-draft/specs/booking` to the scratch workspace and add the Spanish booking spec as `specs/other/spec.md`. Add a shared `AGENTS.md` with synthetic instructions. Open a new local Codex Desktop chat and, using synthetic documents only, request `open_spectorque` from `spectorque-workspace`. The open tool returns a generic acknowledgement. The app-only assessment tool puts the source excerpts and report in UI metadata.

Verify that **All documents** is initially selected, that both features are offered, and that each scope matches the shared engine. Use the finding selector and check the path, line and excerpt against the fixture. The inline view shows one finding at a time. Expand **Assessment details** for the full revision, worktree path and dimensions. Repeat for the other feature and use **Refresh** to reload the selected scope. The sandboxed browser control exercises English and Spanish UI via the host locale. Desktop qualification records the observed locale separately. For read-only refinement, open **Preview a change**, enter a revised line and choose **Show difference**. Verify the exact before and after text, discard the preview and compare the unchanged file bytes.

On macOS arm64, the compact viewer rendered in Codex Desktop and opened on **All documents**. The displayed ten findings, ten unknown practices and first evidence excerpt at `specs/booking/spec.md:5` matched the shared engine. The initial finding picker and excerpt fit within the host's inline area. Changing to `specs/other` in Desktop produced five findings and showed the exact Spanish excerpt at `specs/other/spec.md:5`, matching the engine.

### Approve a preview in the local workbench

Start the existing workbench with `node dist/cli.js serve --root /absolute/path/to/this/worktree --port 0`. Open the printed loopback URL with `?review=1` in the integrated browser. In the Codex preview, open **Review in local workbench**, copy the review data and paste it into the review page. The workbench reconstructs the proposal against the configured root and revision before displaying a second before/after preview. Choose **Reject change** or **Approve and write to disk**. Approval revalidates the review and uses the existing guarded write. After approval, return to Codex and refresh the same scope. Stop the local workbench process when the test ends.

`specs/other` was approved in the built-in browser and refreshed in Desktop on macOS arm64. The viewer showed four findings and one pending decision at line 5. The reviewed line matched the expected file bytes and the sibling feature was unchanged.

### Export the visible scope

In the viewer, expand **Export in local workbench** and choose **Select export data**. Copy the selection and paste it into the workbench loopback page with `?export=1`, then choose **Download JSON** or **Download ZIP**. The workbench checks the exact worktree and assessment revision before export. If the scope changed, refresh the viewer and copy a new selection. ZIP export uses the shared 20 MB archive limit.

On macOS arm64 with Desktop `26.1111.21308`, the user reported that the inline JSON and ZIP download controls did not start either download. Both files downloaded from the local workbench in the integrated browser. The JSON matched the engine assessment for `specs/other`; the ZIP contained `AGENTS.md` and `specs/other/spec.md`, both byte-identical to the fixture. The viewer now offers the observed workbench route directly.

## Qualify the installed viewer ZIP

1. Run `npm ci --ignore-scripts`, `npm run check`, `npm run package:integrations`, `npm run package:codex` and `npm run verify:codex-package`. Repeat packaging and compare the ZIP's SHA-256. The verifier extracts to a directory outside the checkout with spaces and launches the bundled runtime and workbench. It establishes package and protocol evidence.
2. Use two disposable local Git projects outside the checkout. For the English workspace, copy `fixtures/en-draft/specs/booking` under `specs` and put the Spanish booking spec at `specs/other/spec.md`. Swap the languages for the Spanish workspace. Add synthetic shared instructions as `AGENTS.md`. Before each run keep a copy or a hash of the file bytes.
3. Install the ZIP following the [package guide](../integrations/codex/README.md). Use a dedicated marketplace and install from a fresh entry. Verify that the skill paths and project MCP runtime refer to the installed copy. Record the CLI, desktop build and channel, OS, architecture and Node. A clean package installation in an existing profile and a clean desktop profile are distinct evidence.
4. Open the disposable project in Codex mode. Record the project trust denial separately from the trusted run, and check that the project MCP is unavailable when denied. In a trusted local chat first look for a public SpecTorque entry beside the chat. If present, click and check whether the view opens without a turn. Record any persistent panel, fullscreen or inline placement, reopening and the second tool call. If the native launch requires a turn, submit a bounded request to invoke `open_spectorque` with the disposable fixture. Record this turn separately.
5. In each language, first compare All documents and each feature against the shared engine. Open exact evidence for the nested spec and verify selected-scope refresh. Exercise empty and single-feature flows. Open both worktrees and compare roots, revisions and outputs to detect crossed state.
6. Preview a wording change in `specs/booking/spec.md:5`. Discard once, then reject once in the workbench and compare file bytes. Approve a fresh preview after confirming the displayed path and exact diff. Compare the expected replacement and unchanged sibling. Refresh the same scope and inspect the pending decision. For stale-source coverage, preview a second change, edit the target outside the viewer before approval and verify the original request fails and leaves the outside edit intact.
7. Export JSON and ZIP through the integrated browser workbench. Compare JSON to the displayed revision and ZIP paths and bytes to the selected scope. Try keyboard operation, focus movement, a narrow pane and screen-reader labels or announcements. Record any assistive technology actually used.
8. Stop the workbench mid-flow and check disconnection recovery. Exercise project switch, reopen, disable and removal. Stop installed workbench processes and verify their loopback ports close. Restore the test-only profile changes once the evidence is collected. For no-turn workbench access, optionally use a public Local Environment action with the generated startup command and open its URL in the integrated browser. Record this route separately from the native viewer.
9. Save sanitized evidence with source commit, package digest, exact scope and revision, build and OS, trace/captures, turn counts, observed network activity and its measurement limits, and output hashes. Record the Windows follow-up in [#34](https://github.com/jayanez/spec-torque/issues/34).

## Installed ZIP results on macOS arm64

The local marketplace installed `spectorque-codex-0.1.0.zip` in an existing desktop profile, with Desktop `26.1111.21308` build `27194`, bundled Codex `0.169.0-alpha.11.1`, macOS `27.2.1` and Node `22.20.0`. The archive SHA-256 was `29f3d720853e329d4d86ee5036a8bdc4c3da3b717d46a1f7401404e3e7cdd21b`. The installed files matched the extracted archive, with a compatibility manifest generated by the host. Both trusted projects used that installed runtime and workbench outside the source checkout.

| Fixture | Desktop and file evidence |
| --- | --- |
| ES | The inline viewer opened on All documents with ten findings and matched the exact evidence at `specs/booking/spec.md:5`. The user approved the Spanish replacement in the integrated workbench and refreshed `specs/booking`. The view showed four findings and one decision at the exact line. JSON matched the assessed revision `a5667d315eb3…`. ZIP paths and file bytes matched the selected scope. |
| EN | The inline viewer showed the English scoped report after approval of the exact replacement at `specs/booking/spec.md:5`. Refresh preserved `specs/booking` and showed four findings and one pending decision. JSON matched revision `9f82f78d0c04…`. ZIP paths and file bytes matched the selected scope. |

The changed source bytes and the unchanged sibling were verified independently in both languages. Each ZIP contained `AGENTS.md` and `specs/booking/spec.md`. A user-triggered turn invoked `open_spectorque` for each native opening. The composer plus menu did not open the viewer directly in this build. A turn-free native entry remains unverified. The installed workbench review page opened in the integrated browser without a turn. Local Environment actions are a documented additional route for starting that workbench and were not exercised as a separate native action.

A follow-up with the same installed ZIP and Desktop build opened the viewer from the tool result into a side tab while keeping the chat visible. Closing and reopening that tab from the same result preserved `specs/booking`, the third finding at `specs/booking/spec.md:7`, and revision `9f82f78d0c04014e19eb76d55fa2ec8f4a93b737d627f2a0dc468964c14bc649`. The reopened view showed four findings and one pending decision. The operator confirmed navigation with Tab and Shift+Tab. The exact focus destination when closing the tab and screen-reader behavior were not separately verified. This observation covers reopening within the same chat.

Separate controls verified skill discovery, trust denial, isolation between two workbench tokens and roots, scoped rejection and stale-source preservation, and recovery after stopping and restarting an installed workbench. Native assistive-technology acceptance and negative Desktop UI cases beyond the observed EN/ES walkthrough remain unqualified. CI verified the relocated ZIP on macOS, Windows and Ubuntu, with the same digest on all three platforms. Windows Desktop variants remain in [#34](https://github.com/jayanez/spec-torque/issues/34).

The test marketplace and cached plugin were removed, both per-project MCP blocks were disabled, and both workbench ports closed. Open chats retained scoped stdio processes after removal. Those specific test processes were stopped and verified absent. On manual removal, close the affected chats as well as stopping the workbench.

## Clean up

Close the probe views. Disable and remove the probe in **Plugins** and confirm it disappears after restart. Check that probe processes have exited and close any separately started workbench listener. Remove any marketplace registration added for the probe and preserve only sanitized evidence. For the CLI route, use `codex plugin remove spectorque-desktop-probe@spectorque-desktop-qualification` and `codex plugin marketplace remove spectorque-desktop-qualification`. The two linked repositories and direct-MCP configuration are all under the generated run directory. Remove only that directory and the disposable profile or VM when their evidence is retained.
