# Release installation

The [0.1.0 executable preview](https://github.com/jayanez/spec-torque/releases/tag/v0.1.0) remains available. The planned 0.2.0 release uses GitHub download assets. Check the release's qualification record for supported host versions, operating systems and architectures.

| 0.2.0 asset | Installation |
|---|---|
| `spectorque-0.2.0.tgz` | Install into an empty npm prefix with `npm install --no-audit --ignore-scripts --prefix "$INSTALL" "$TGZ"`. Run `node "$INSTALL/node_modules/spectorque/dist/cli.js" serve --root "$WORKSPACE" --port 0`. |
| `spectorque-claude-0.2.0.zip` | In the test project run `claude --plugin-dir /absolute/path/to/archive.zip`, then `/spectorque`. Closing that session unloads the session-only plugin. |
| `spectorque-opencode-0.2.0.zip` | Extract into an isolated profile and add its absolute directory to `plugins` in the profile's `opencode/cli.json`. Open a local session and run `/spectorque`. Remove the entry and restart to uninstall. |
| `spectorque-pi-0.2.0.zip` | Extract and run `pi install /absolute/extracted/package --local` in the test project. Open Pi offline, trust the scratch project and run `/spectorque`. Remove with `pi remove /absolute/extracted/package --local --approve`. |
| `spectorque-codex-0.2.0.zip` | Use the [local marketplace and project setup](../integrations/codex/README.md). The observed native opening requires a user-initiated turn. The standalone workbench offers a fully local route. |
| `spectorque-demo-0.2.0.zip` | Contains the EN/ES walkthrough and versioned evidence. Follow [English](pilot.md) or [Español](pilot.es.md). |
| `SHA256SUMS` | Verify with `shasum -a 256 -c SHA256SUMS` or compare using `Get-FileHash -Algorithm SHA256` on Windows. |

The basic workbench runs with Node.js 22.20+ and npm dependencies. Acquire the files and dependencies first. Analysis, reviewed changes and exports then use local files and loopback. Native packages include the bundled runtime and third-party notices and depend on their installed host. The [VSIX preview](https://github.com/jayanez/spec-torque/releases/tag/v0.1.0) and its separate [editor qualification](https://github.com/jayanez/spec-torque/issues/5) remain available. See [privacy](privacy.md) and [observed compatibility](compatibility.md).

## Build a candidate

Use two independently checked out copies of the exact commit, with LF source checkout (`core.autocrlf=false`), Node 22.20.0, npm 10.9.3 and the committed lockfile. Use a fresh absolute output directory outside both repositories.

```sh
npm ci --ignore-scripts
npm run check
npm run package:integrations
npm audit --audit-level=moderate
npm run package:claude
npm run package:opencode
npm run package:codex
npm run verify:codex-package
npm run package:pi
mkdir -p "$OUT"
npm pack --ignore-scripts --pack-destination "$OUT"
```

Compare the five installer digests between builds. Inspect archive contents, licenses, notices and version metadata. Compare installed dependencies against the recorded test environment. With Chromium provisioned and a new absolute `DEMO_OUT` directory, assemble the release:

```sh
cp artifacts/spectorque-claude-0.2.0.zip artifacts/spectorque-codex-0.2.0.zip "$OUT/"
cp artifacts/spectorque-opencode-0.2.0.zip artifacts/spectorque-pi-0.2.0.zip "$OUT/"
npm run browsers:install -- chromium
npm run pilot:demo -- "$OUT/spectorque-0.2.0.tgz" "$DEMO_OUT"
npm run package:pilot -- "$OUT" "$DEMO_OUT"
(cd "$OUT" && shasum -a 256 -c SHA256SUMS)
```

The assembly command checks the recorded TGZ digest, adds all five installer digests to the demo manifest, packages the reviewed demo file list and computes `SHA256SUMS`. Video and report creation times may vary between recordings. The manifest records the source SHA and the reproducible report and source checks.

Run the installed workbench browser suite, host-specific terminal qualifiers and the Desktop walkthrough as described in [qualification](qualification.md) and [integrations](integrations.md). Record the commit, artifact digest, exact client, OS and architecture, Node, fixture, result and evidence location for each advertised route. Keep CI, browser, installed client, manual accessibility and participant observations separate. A release requires approval of the exact candidate and its public assets.
