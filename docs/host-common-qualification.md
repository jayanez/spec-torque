# Remaining hosts: common-workbench qualification

Tracking: [#1](https://github.com/jayanez/spec-torque/issues/1). This increment adds
an opt-in browser handoff check and records bounded real terminal-client evidence.
It does not close four-host, package-discovery or cross-platform acceptance.

## Observed environment and boundaries

The native walkthroughs used `develop` revision `6f527c8`, engine 0.1.0,
Node 22.20.0 and macOS 27.2.1 arm64. The separate EN/ES recognition change in
PR #13 is not included in these native results. Generated runtimes came from
`npm run build` and `npm run package:integrations` in a separate checkout.

Original `fixtures/en-draft` and `fixtures/es-draft` documents were copied into
disposable workspaces. Each accepted replacement retained FR-001 and MUST/DEBE,
replacing the vague response requirement with an explicit unanswered response-time
question. No numeric product limit was invented. Native controls remain English;
EN/ES here refers to the source documents.

| Client | Observed real-client behavior | Limits |
|---|---|---|
| Claude Code 2.1.311 | Local plugin loaded; native pane showed `specs/booking/spec.md:5`; before/after, rejection, explicit application and refreshed pending decision worked for EN/ES. An EN concurrent edit rejected as stale; reopening analysis allowed a fresh proposal and preserved the external edit. `/mcp` listed the plugin server with six tools; plugin skill commands appeared in completion. | No model turn or authenticated provider interaction. MCP discovery is not proof of every tool being called by this client. Desktop and other OS remain pending. |
| OpenCode 2.1.4 | Local TUI plugin commands loaded with no provider selected. `/spectorque` displayed the assessment dialog. `/spectorque-review` selected evidence, prompted for wording, showed before/after, cancelled once, then applied EN/ES changes. An ES concurrent edit produced the stale-source error. | The assessment used the dialog fallback on the home screen; an active-session panel is still pending in #6. Package/skill discovery and other OS remain pending. |
| Pi 1.5.2 | Real interactive client loaded the explicit extension offline with no models. Widget, exact evidence selection, source editor, rejection and application worked; EN/ES updates showed four findings and one open decision. An EN concurrent edit rejected as stale; reopening selection read the updated source. | Skills/MCP discovery was disabled for this extension-only probe. Package discovery and other OS remain pending in #1/#7. A separate print-mode `/spectorque` probe returned no visible report; headless reporting is not accepted. |

Claude used a fresh `CLAUDE_CONFIG_DIR`, explicit dummy API key, rejecting
loopback API endpoint and disabled nonessential traffic/marketplace auto-install.
The endpoint observed zero requests. Pi ran `--offline` with an empty agent
directory and no models. OpenCode used isolated XDG directories, disabled model
fetching/updates and no selected provider. No model prompt was submitted in any
client. The Claude trap does not attest to every other process's network traffic.

## Reproduce the native portion

Build/package under Node 22.20+. Set an absolute checkout path and create a fresh
scratch directory; copy `fixtures/en-draft/specs` into it, then repeat with ES in
a separate scratch directory. Never use working documents for the race checks.

- Claude: use a fresh `CLAUDE_CONFIG_DIR`, `--setting-sources user` and
  `--plugin-dir /absolute/checkout/integrations/claude`. Disable nonessential
  traffic and official marketplace auto-install as documented by Claude. For the
  no-inference probe use a dummy API key and a rejecting loopback endpoint, not
  live provider credentials. Trust only the scratch workspace.
- OpenCode: point XDG config/data/cache/state directories at the scratch run.
  Add the absolute `integrations/opencode` directory to `plugins` in
  `$XDG_CONFIG_HOME/opencode/cli.json`; disable model fetching and auto-updates.
  The default managed service port was occupied by the user's existing service.
  Setting a different port with `opencode service set port <port>` under the
  isolated XDG environment avoided changing or stopping that service.
- Pi: reuse a known installed client; point `PI_CODING_AGENT_DIR` at an empty run
  directory. Start with `--offline --no-session --no-extensions --no-skills
  --no-context-files --no-mcp --extension /absolute/checkout/integrations/pi/index.ts`.
  These switches intentionally isolate extension behavior from package discovery.

Run the commands shown in the table. Select the first vague-language finding,
inspect its path/line, enter a replacement containing a specific
`[NEEDS CLARIFICATION: ...]` question, inspect the difference and reject once.
Check that the file remains unchanged. Repeat and explicitly accept; verify the
pending decision and unchanged normative word/identifier in the file.

For the race check, create a proposal, append a separate line to the scratch file
before accepting, then verify rejection and preservation of that appended line.
Reload analysis before proposing again. On Claude, Tab cycles native controls;
Enter submits the focused field or button. Send terminal text and Enter as
separate events so a paste does not insert an unintended newline.

Official references consulted through Context7: [Claude Mods input and focus](https://code.claude.com/docs/en/plugins/mods/interface),
[Claude environment variables](https://code.claude.com/docs/en/env-vars),
[OpenCode local CLI plugins](https://github.com/anomalyco/opencode/blob/dev/services/site/src/docs/content/cli/plugins.mdx),
and [Pi extensions](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/docs/extensions.md).

## Verify the common-panel handoff separately

After a native client has written the pending decision, exit it and run:

```sh
npm run browsers:install -- chromium
npm run qualify:handoff -- /absolute/scratch-workspace
```

An existing project browser cache can be selected with `PLAYWRIGHT_BROWSERS_PATH`.
The script launches an ephemeral loopback server and an isolated Chromium
context, loads the workspace, selects the exact pending-decision line, compares
the downloaded JSON with the engine assessment apart from its creation timestamp,
and checks the exact ZIP entry set and every source file
against disk. It aborts non-loopback browser requests and rejects page errors.
It saves the report, ZIP, screenshot and bounded evidence in an ignored
`.spec-torque/handoff-*` directory without changing the input workspace.

This handoff passed on the three clients' ES post-application scratch workspaces
and on separate copies of their saved EN post-application documents.
It checks real browser UI and downloaded artifacts; it does not automate native
client controls or prove inference absence. EN native refinement, browser handoff,
MCP discovery, headless reporting and broader human accessibility are distinct
evidence categories. Retain native transcripts/source snapshots separately.

## Claude Code installed package

`npm run qualify:claude` drives the installed plugin ZIP in a real Claude Code
terminal through a pseudo-terminal. Build with Node 22.20+ in major 22, run
`npm run package:claude` (it rebuilds and runs `package:integrations` first), install Chromium,
and provide an isolated tools directory with `node-pty@1.1.0` and
`@xterm/headless@6.0.0`:

```sh
version="$(node -p "require('./package.json').version")"
npm run qualify:claude -- "$(which claude)" "artifacts/spectorque-claude-$version.zip" /path/to/tools/node_modules
```

For EN and ES, the driver copies the draft fixture into two features
(`specs/booking`, `specs/payments`) in a disposable workspace and loads the ZIP
with `--plugin-dir`. It selects one feature in the pane, matches the nested
evidence path, line and text with the file, reviews and rejects a proposal
(every file byte-identical), applies a clarification that keeps `FR-001` and
`MUST`/`DEBE` (the other feature unchanged, a pending decision and new revision
shown), makes a proposal stale with an external edit (rejected, edit
preserved), refreshes and proposes again, then opens the common workbench and
runs `qualify:handoff --url <address> --feature specs/booking`. Escape closes
the pane and the driver checks that the server port stops listening. It also
checks an empty workspace, an unreadable source, Node.js missing from `PATH`,
and a project-scoped marketplace install: the installed plugin loads the pane,
another profile in another directory does not list it, and after removal the
client reports `No commands match "/spectorque"`. Evidence, terminal frames and
the ZIP SHA-256 are saved under an ignored `.spec-torque/claude-*` directory.

MCP and skills are recorded at three separate levels:

1. **Host discovery (no model).** `claude --plugin-dir <ZIP> mcp list` reports
   `plugin:spectorque:spectorque … Connected`, and `plugin details
   spectorque@inline` lists the three skills and the MCP server.
2. **Direct protocol (no model).** For EN and ES, the driver starts the ZIP's
   `dist/mcp.js` over stdio, lists exactly six read-only tools, calls
   `discover_specs`, `analyze_specs` (same revision and findings as the engine),
   `refinement_context`, `propose_refinement`, `create_specs` and
   `export_report`, rejects an escaped path, and checks that no workspace file
   changed.
3. **Use by Claude (one model turn per language, outside the driver).** In a
   disposable workspace, run headless with only SpecTorque read tools and
   `Skill` allowed and file edits and the shell denied:

   ```sh
   claude -p "Use the spec-review skill to review the specifications in this workspace with the SpecTorque MCP tools. Do not modify any file. Report the first finding with its exact path and line." \
     --plugin-dir /absolute/artifacts/spectorque-claude-0.1.0.zip --output-format stream-json --verbose \
     --allowedTools Skill mcp__plugin_spectorque_spectorque__discover_specs mcp__plugin_spectorque_spectorque__analyze_specs mcp__plugin_spectorque_spectorque__refinement_context mcp__plugin_spectorque_spectorque__export_report \
     --disallowedTools Edit Write MultiEdit NotebookEdit Bash --max-budget-usd 1
   ```

   Inspect the stream for `Skill` (`spectorque:spec-review`) and
   `mcp__plugin_spectorque_spectorque__*` tool uses and compare file hashes
   before and after. If user settings define an API key or gateway that should
   not be used, add `--setting-sources project,local` to use the signed-in
   session instead.

Observed on 2026-11-18 with Claude Code 2.1.311, macOS 27.2.1 arm64 and Node
22.20.0: 21/21 driver cases (including host MCP/skill discovery and the six
tools over the protocol in EN and ES) passed for ZIP SHA-256
`c1e71ed6783d8c40343acc71694b718ba21bcccf6024461134f1c0e42ba56ca4`. The run used
the operator's usual signed-in profile; no model prompt was submitted and
network traffic was not restricted or captured. Uninstalling unregistered the
plugin but left its copy in the user plugin cache. The driver's evidence records
`modelPrompts: 0`; it contains no model-turn evidence.

Separately and manually, on the same machine and ZIP, one headless model turn
per language was run with the level-3 command in disposable copies of
`fixtures/<lang>-draft` (`claude-opus-5-5`, signed-in session via
`--setting-sources project,local` because the operator's user settings pointed
at an API key without credit). Their `stream-json` transcripts were kept
locally and summarized in [PR #29](https://github.com/jayanez/spec-torque/pull/29):
in EN and ES, Claude invoked `Skill` `spectorque:spec-review`, then
`discover_specs` and `analyze_specs`, cited `specs/booking/spec.md:5`, had no
permission denied and left every file hash unchanged. `refinement_context`,
`propose_refinement`, `create_specs` and `export_report` were exercised only at
the protocol level. Desktop and other operating systems and architectures
remain pending in
[#4](https://github.com/jayanez/spec-torque/issues/4).

### Claude Code terminal matrix in CI

The [Claude Code qualification workflow](../.github/workflows/qualify-claude.yml)
runs `qualify:claude` with `SPECTORQUE_CLAUDE_ISOLATED=1` against the pinned
`@anthropic-ai/claude-code-<variant>@2.1.311` native package. The isolated
profile has onboarding completed, an approved dummy API key and pre-accepted
workspace trust; child sessions get a controlled `PATH`. A loopback trap is the
API endpoint and HTTP(S) proxy: it rejects and records what it receives, and an
inference request (`POST /v1/messages`) fails the run. Egress is enforced by the
OS as in the OpenCode workflow: a loopback-only network namespace on Linux,
`sandbox-exec` allowing only localhost on macOS, and an outbound firewall rule
for the client executable on Windows (Node.js child processes are not covered
by that rule).

Observed in [run 44298839122](https://github.com/jayanez/spec-torque/actions/runs/44298839122) at `1944dfe`, ZIP SHA-256
`c1e71ed6783d8c40343acc71694b718ba21bcccf6024461134f1c0e42ba56ca4`:

| Variant | Runner OS release | Node.js | Boundary | Cases | Result |
|---|---|---|---|---|---|
| darwin-arm64 | macOS (Darwin 25.6.0) | 22.23.4 | macos-sandbox | 21 | passed |
| darwin-x64 | macOS (Darwin 24.6.0) | 22.23.2 | macos-sandbox | 21 | passed |
| linux-x64 | Ubuntu (kernel 7.0.0-1019-azure) | 22.23.4 | linux-netns | 21 | passed |
| linux-arm64 | Ubuntu (kernel 7.0.0-1017-azure) | 22.23.4 | linux-netns | 21 | passed |
| win32-x64 | Windows 10.0.26100 | 22.23.4 | windows-firewall-client | 20 | passed |
| win32-arm64 | Windows 10.0.26200 | 22.23.5 | windows-firewall-client | 20 | passed |

Windows runs 20 cases because the unreadable-source case uses POSIX permissions.
Every variant's trap recorded only rejected requests: `CONNECT
downloads.claude.ai:443` (and `CONNECT github.com:443` outside Windows), plus two
`POST /v1/messages/count_tokens` made by `plugin details` for its token-cost
estimate; none was inference. The run artifacts hold the ZIP, evidence, terminal
frames and handoff exports for each variant. musl builds are not in the matrix.

## Claude Desktop

Observed on 2026-11-18 on macOS 27.2.1 arm64 with the operator's usual profile.
The Desktop app ran its bundled Claude Code 2.1.325 (Mods require 2.1.286 or
later). For EN and ES, a disposable folder with a copy of the draft fixture was
made its own git root, and the ZIP from `npm run package:claude` (SHA-256
`c1e71ed6783d8c40343acc71694b718ba21bcccf6024461134f1c0e42ba56ca4`) was installed
with that bundled CLI from a local directory marketplace at project scope
(`plugin marketplace add <dir> --scope project`, then
`plugin install spectorque@<marketplace> --scope project`).

A Desktop Code-tab session was opened in each folder and the operator typed
`/spectorque`. Desktop sends a session's first prompt to the model, so the
command must be typed in the message box; computer-use cannot drive the Claude
app itself, so Desktop steps were performed by the operator and checked from
disk and screenshots kept locally.

- EN: the pane showed `5 findings · 0 open decisions` and
  `specs/booking/spec.md:5`. A clarification was reviewed and rejected, then
  applied: line 5 contained the replacement and the engine reported 4 findings
  and the pending decision at `specs/booking/spec.md:5`, as the pane did. A
  proposal for line 6 was made stale by appending a line from outside; applying
  it showed `Apply failed: Source changed…`, the file stayed byte-identical to
  the externally edited version, and **Refresh analysis** reloaded it. **Open
  common workbench** copied a loopback address; `npm run qualify:handoff --
  <workspace> --url <address>` passed (JSON and ZIP match, no external
  requests or page errors), and closing the pane stopped the server.
- ES: the pane rendered `5 findings · 0 open decisions` and
  `FR-001: El sistema DEBE ser rápido.` at `specs/booking/spec.md:5`. The full ES
  flow is covered in the terminal by `qualify:claude`.

The operator submitted no prompt during these checks, but they were not
inference-free: Desktop sent each new session's first message to the model, so
two short model turns occurred (one per session). Uninstalling
the plugin from one project removed the shared install record while the other
project's settings still listed it as enabled; that disposable settings file
was reset by hand. Windows Desktop and automated Desktop runs remain pending in
[#4](https://github.com/jayanez/spec-torque/issues/4).

## OpenCode installed package

The OpenCode workflow tests the ZIP at each runner's checkout revision.
The checkout preserves the committed line endings on every runner, and the
CI driver checks that generating the archive left its source checkout clean.
Build with Node 22.20+ in major 22, run `npm run package:integrations` after
the build, then run `npm run package:opencode`. Install Chromium and provide
an isolated tools directory containing `node-pty@1.1.0` and
`@xterm/headless@6.0.0`:

```sh
version="$(node -p "require('./package.json').version")"
npm run qualify:opencode -- /path/to/opencode "artifacts/spectorque-opencode-$version.zip" /path/to/tools/node_modules darwin-arm64
```

The walkthrough uses the public `session.create` API on a private loopback
service to seed empty EN/ES sessions. The driver enters the real TUI, verifies
source hashes and checks that the sessions have no messages. The driver blocks
and records HTTP(S) requests routed to its rejecting proxy. Chromium rejects
non-loopback page requests. Hosted runs also enforce a loopback-only network
namespace on Linux, an outbound sandbox on macOS and a scoped outbound firewall
rule for the extracted Windows executable. The evidence identifies the boundary
used and the destinations observed by the rejecting proxy.

The browser portion consumes the URL offered by the running terminal plugin.
It compares the scoped JSON and ZIP against the accepted workspace revision.
The CI artifacts include the ZIP, its SHA-256, host and release metadata,
native terminal captures and browser export evidence. A variant without a
passing native run remains pending in [#6](https://github.com/jayanez/spec-torque/issues/6).
For musl, the workflow exercises the published executable with the Alpine
musl loader and matching C++ libraries inside a private mount namespace.
The browser and Node test driver use the Linux runner's glibc userspace.
The evidence records the runner's actual OS and architecture.

## ThinkRail desktop with Pi package

Follow-up qualification on 2026-11-17 used ThinkRail 0.4.0, Pi 1.5.2,
`pi-spectorque` 0.1.0, Node 22.20.0 and macOS 27.2.1 arm64. The generated
`integrations/pi` package was installed for the private testbed repository only.
ThinkRail listed `/spectorque` and the `spec-author`, `spec-refine` and
`spec-review` skills. The project trust gate was explicitly enabled for the
disposable scratch project.

The interactive walkthrough ran against copied EN/ES fixtures, never the
original repository. Both languages exercised evidence selection, before/after
review, rejection and explicit application of a replacement preserving FR-001
and MUST/DEBE while leaving the response-time limit as a pending clarification.
The assessment refreshed from ten findings and no pending decisions to eight
findings and two pending decisions. A separate EN proposal was made stale by an
external scratch edit; ThinkRail rejected it with a stale-source error and
preserved the external edit. The scratch documents were restored after
verification.

The common browser handoff was then qualified against the same scratch state:
downloaded JSON matched the engine assessment, the ZIP contained exactly the
expected artifacts and their on-disk contents, and the browser recorded no
external requests or page errors. Pi 1.5.2 headless qualification separately
passed all EN/ES × text/JSON combinations offline, with exact engine output,
unchanged source documents and no model-turn events. Core checks passed 100/100
and integration packaging passed under Node 22.20.0.

ThinkRail showed one unrelated global Agent Braid MCP server as failed because
its configured launcher path was missing. This did not prevent SpecTorque's
Pi package workflow; no SpecTorque MCP server was configured in this host. No
model-backed skill was invoked. These results qualify this ThinkRail/Pi/macOS
combination only; other host versions, operating systems and human accessibility
remain unqualified. Tracking remains in [#7](https://github.com/jayanez/spec-torque/issues/7).

Requalification on 2026-11-20 used ThinkRail 0.4.0, Pi 1.5.2 for project-local
`install`/`remove`, Node 22.20.0 and macOS 27.2.1 arm64 with the released 0.2.0
ZIP (SHA-256 `b475c88549609dd27ce24e946590db165420b66ff88ac05fcc1373201ac57602`).
The untrusted project exposed neither `/spectorque` nor the project skills.
All documents matched the engine in EN and ES; approval, EN rejection,
stale-source rejection and the browser handoff behaved as above, and no model
prompt was submitted. ThinkRail drives Pi in RPC mode, and this package shows the
scope picker only in Pi's TUI mode, so feature scopes were not reachable.
The unreleased fix (package SHA-256
`4085332b022826b76999598466799a0142c9253874296e82fc0e80c134111c19`) showed the
picker in ThinkRail, and `specs/booking` and `specs/other` matched the engine in
EN; `qualify:pi` checks scope selection over RPC in the EN and ES workspaces.
Two host behaviors remain: after the first proposal in a chat, the ThinkRail
editor shows the previously submitted text instead of the selected line, and
running `/spectorque` while a picker is open queues the second run and
interleaves both runs' dialogs. The before/after confirmation and stale-source
check still apply, and cancelling wrote nothing. Back up
`~/.thinkrail/projects.json`, `workspaces.json` and `chats.json` before the run
and restore them after quitting ThinkRail; closing a project keeps its
entries.
