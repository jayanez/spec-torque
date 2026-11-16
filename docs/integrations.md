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

MCP/skills connect the agent. The visual deliverable is a standard VS Code webview alongside Codex. Install the packaged VSIX or load `integrations/vscode` through VS Code's extension development host, open your project and run **SpecTorque: Open Specification Workbench**. It launches a workspace-scoped local server and displays the same panel. The extension stops its child server when disposed.

The VS Code path uses public extension APIs; it is not a custom panel injected into the Codex desktop application. Desktop MCP Apps rendering needs independent real-client qualification and is additional scope. API metadata alone is insufficient evidence of rendering.

Official reference: [VS Code webviews](https://code.visualstudio.com/api/extension-guides/webview).

## OpenCode

The adapter in `integrations/opencode` targets the public V2 TUI plugin API. Add the absolute generated folder to your client's `cli.json`: `{"plugins":["/absolute/spectorque/integrations/opencode"]}`. Local entries are directories, not individual files; the package exports `./tui`. `/spectorque` refreshes a session panel; `/spectorque-review` opens finding selection and a reviewed refinement flow. The common panel and local MCP remain the fallback while installed-version compatibility is qualified.

## Pi

Load `integrations/pi/index.ts` with Pi's extension option, or install the generated `integrations/pi` package through Pi's package mechanism. `/spectorque` supplies a score/evidence widget and interactive finding selection, editor and explicit confirmation. Headless invocation returns the report without starting a model turn. Skills are included.

## Other hosts

Cursor and Copilot in VS Code can use the standard extension and their documented MCP setup; no custom branded panel is promised. Gemini CLI uses local MCP/skills and the common panel. Connection configuration shapes differ between hosts: use their current official schema rather than copying the wrapper object blindly. Full acceptance of these additional hosts is post-V1.

See [compatibility](compatibility.md) for observed versions and limits; package generation is not native qualification.
