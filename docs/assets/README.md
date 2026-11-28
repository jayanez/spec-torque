# Documentation images

Every image in the README and guides, with its source. Regenerate the scripted ones after a UI change:

```sh
npm run package:integrations
npm run pack:hosts
npm run docs:capture -- --only workbench,codex,claude,opencode,pi,vscode
```

The terminal and VS Code captures need the tools folder `.spec-torque/capture-tools` (`npm install --prefix .spec-torque/capture-tools node-pty @xterm/xterm @earendil-works/pi-coding-agent`, then make `node-pty`'s `spawn-helper` executable on macOS), `claude` and `opencode` on `PATH`, and `VSCODE_EXECUTABLE`. Hosts run with isolated profiles; model requests go to a local endpoint that refuses them, so no capture calls a model. Terminal output is replayed into xterm.js for the image.

| Image | Source | Fixture | Version shown |
|---|---|---|---|
| `workbench/analyze.jpg`, `build.jpg`, `history.jpg`, `connect.jpg` | `docs:capture` (`workbench`), Chromium 1360×930 at 1.5× | `fixtures/en-complete` | 0.3.0, engine 0.1.16 |
| `panels/codex.png` | `docs:capture` (`codex`): the Codex viewer in a local MCP Apps host | `fixtures/en-draft` | 0.3.0 |
| `panels/claude.png` | `docs:capture` (`claude`): Claude Code CLI with `--plugin-dir integrations/claude` | `fixtures/en-draft` | 0.3.0 in Claude Code 2.1.311 |
| `panels/opencode.png` | `docs:capture` (`opencode`): the packed `opencode-spectorque` tarball in an active session | `fixtures/en-draft` | 0.3.0 in OpenCode 2.1.4 |
| `panels/pi.png` | `docs:capture` (`pi`): the packed `pi-spectorque` tarball, Pi offline | `fixtures/en-draft` | 0.3.0 in Pi 1.6.1 |
| `panels/vscode.png` | `docs:capture` (`vscode`): end of the `test:vscode` extension-host walkthrough | `fixtures/en-draft` | 0.3.0 in VS Code 1.147.0 |
| `panels/claude-desktop.png` | Manual capture, Claude Desktop Code tab | `fixtures/en-draft` | 0.2.0 qualification |
| `panels/codex-desktop.jpg` | Manual capture, Codex Desktop conversation | Disposable public fixture | 0.2.0 qualification |
| `panels/thinkrail.jpg` | Desktop capture driven by Claude on 2026-11-26: the packed `pi-spectorque` tarball installed with `--local` in a disposable trusted project, `/spectorque` run as an extension command, project closed and deleted afterwards | `fixtures/en-draft` | 0.3.0 in ThinkRail |
| `workbench/workflow.png` | Rendered from `workbench/workflow.archify.json` | — | Unversioned diagram |
| `brand/icon.svg`, `icon-128.png`, `icon-256.png` | `node scripts/render-icon.mjs` renders the SVG; the PNG ships in every host package | — | — |

Desktop captures are not scripted: they need the plugin installed in a real desktop profile. Claude Desktop must be captured by hand (an agent running inside Claude cannot drive its own app), and opening the Codex Desktop viewer submits a model turn that [pilot operations](../pilot-operations.md#stable-candidate-gate) reserves for an authorized operator run. Replace them only with a capture of the version they claim.
