# Release installation

The 0.1.0 preview is an initial executable release. It is not the completed December V1; consult the compatibility matrix before selecting a host path.

| Asset | Use |
|---|---|
| `spectorque-0.1.0.tgz` | Install into a local npm project with `npm install --ignore-scripts /path/to/spectorque-0.1.0.tgz`; invoke `npx --no-install spectorque` from that project. |
| `spectorque-claude-0.1.0.zip` | Extract, then load the folder with `claude --plugin-dir /absolute/spectorque-claude`. Run `/spectorque`. |
| `spectorque-vscode-0.1.0.vsix` | In VS Code, choose Extensions → Install from VSIX, open a project, then run SpecTorque: Open Specification Workbench. |
| `spectorque-opencode-0.1.0.zip` | Extract and put the directory in `cli.json` under `plugins`; run `/spectorque` or `/spectorque-review`. |
| `spectorque-pi-0.1.0.zip` | Extract and load `index.ts` with Pi's `--extension` option; run `/spectorque`. |
| `SHA256SUMS` | Checksums for the downloadable packages. |

The root tarball uses Node.js 22.20+ and npm dependencies. Native archives include the shared bundled runtime and third-party notices; host APIs still come from the installed client. No GPU or model credentials are needed for the basic workflow. Public directory publication is not required to install these assets.

For a source checkout use the main README. For MCP, skills and host-specific details use [integrations](integrations.md); for what has actually passed use [compatibility](compatibility.md).
