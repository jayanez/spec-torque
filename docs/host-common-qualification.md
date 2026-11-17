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

## OpenCode installed package

The OpenCode workflow tests the ZIP at each runner's checkout revision.
Build with Node 22.20+ in major 22, run `npm run package:integrations` after
the build, then run `npm run package:opencode`. Install Chromium and provide
an isolated tools directory containing `node-pty@1.1.0` and
`@xterm/headless@6.0.0`:

```sh
npm run qualify:opencode -- /path/to/opencode artifacts/spectorque-opencode-0.1.0.zip /path/to/tools/node_modules darwin-arm64
```

The walkthrough uses the public `session.create` API on a private loopback
service to seed empty EN/ES sessions. The driver enters the real TUI, verifies
source hashes and checks that the sessions have no messages. The driver blocks
and records HTTP(S) requests routed to its rejecting proxy. Chromium rejects
non-loopback page requests. That evidence covers those channels.

The browser portion consumes the URL offered by the running terminal plugin.
It compares the scoped JSON and ZIP against the accepted workspace revision.
The CI artifacts include the ZIP, its SHA-256, host and release metadata,
native terminal captures and browser export evidence. A variant without a
passing native run remains pending in [#6](https://github.com/jayanez/spec-torque/issues/6).
For musl, the workflow exercises the published musl executable with the musl
loader on a Linux runner. It records the runner's actual OS and architecture.

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
