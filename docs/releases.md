# Releases and installation

SpecTorque 0.3.0 is the current **prerelease**. It is published to npm under the `next` dist-tag, to the VS Code Marketplace as a pre-release (Open VSX follows once the `jayanez` namespace is approved), and as a GitHub pre-release, until the [stable candidate gate](pilot-operations.md#stable-candidate-gate) passes. Earlier previews remain available: [0.2.0 pilot prerelease](https://github.com/jayanez/spec-torque/releases/tag/v0.2.0) and [0.1.0 executable preview](https://github.com/jayanez/spec-torque/releases/tag/v0.1.0). Check the release's qualification record for supported host versions, operating systems and architectures.

## Install from the marketplaces

| Host | Package | Install |
|---|---|---|
| CLI, browser workbench, any MCP client | `spectorque` | `npx -y spectorque@<version> serve --root .` or `npx -y spectorque@<version> mcp` |
| Claude Code (CLI and Desktop) | `spectorque-claude` through `.claude-plugin/marketplace.json` | `claude plugin marketplace add jayanez/spec-torque`, then `claude plugin install spectorque@spectorque` |
| Codex (CLI and Desktop) | `spectorque-codex` through `.agents/plugins/marketplace.json` | `codex plugin marketplace add jayanez/spec-torque`, then `codex plugin add spectorque@spectorque` and [bind a worktree](../integrations/codex/README.md#install-and-bind-a-worktree) |
| OpenCode | `opencode-spectorque` | Add `"opencode-spectorque@<version>"` to `plugins` in `~/.config/opencode/cli.json` |
| Pi and ThinkRail | `pi-spectorque` | `pi install npm:pi-spectorque@<version>` |
| VS Code | `jayanez.spectorque` | Marketplace, *Switch to Pre-Release*; or `code --install-extension jayanez.spectorque --pre-release` |
| Cursor, Windsurf, VSCodium | `spectorque-<version>.vsix` from the GitHub release; `jayanez/spectorque` on Open VSX once the namespace is approved | *Install from VSIX…* (installable, not yet qualified) |

`<version>` is the release you install, `0.3.0` for this prerelease. The two catalogs pin the npm version they install, so a catalog update is the upgrade path for Claude Code and Codex.

## Install from release assets

Each GitHub release carries the same builds for offline or audited installs:

| Asset | Installation |
|---|---|
| `spectorque-<version>.tgz` | Install into an empty npm prefix with `npm install --no-audit --ignore-scripts --prefix "$INSTALL" "$TGZ"`. Run `node "$INSTALL/node_modules/spectorque/dist/cli.js" serve --root "$WORKSPACE" --port 0`. |
| `spectorque-claude-<version>.zip` | In the test project run `claude --plugin-dir /absolute/path/to/archive.zip`, then `/spectorque`. Closing that session unloads the session-only plugin. |
| `spectorque-opencode-<version>.zip` | Extract into an isolated profile and add its absolute directory to `plugins` in the profile's `opencode/cli.json`. Open a local session and run `/spectorque`. Remove the entry and restart to uninstall. |
| `spectorque-pi-<version>.zip` | Extract and run `pi install /absolute/extracted/package --local` in the test project. Open Pi offline, trust the scratch project and run `/spectorque`. Remove with `pi remove /absolute/extracted/package --local --approve`. |
| `spectorque-codex-<version>.zip` | Use the [local marketplace and project setup](../integrations/codex/README.md). Pilot participants use the standalone local workbench. |
| `spectorque-<version>.vsix` | `code --install-extension spectorque-<version>.vsix`. |
| `*-<version>.tgz` host packages | The npm packages above, for registries mirrored inside a network. |
| `spectorque-demo-<version>.zip` | The EN/ES walkthrough and versioned evidence. Follow [English](pilot.md) or [Español](pilot.es.md). |
| `SHA256SUMS` | Verify with `shasum -a 256 -c SHA256SUMS` or compare using `Get-FileHash -Algorithm SHA256` on Windows. |

The basic workbench runs with Node.js 22.20+ and npm dependencies. Acquire the files and dependencies first. Analysis, reviewed changes and exports then use local files and loopback. Native packages include the bundled runtime and third-party notices and depend on their installed host. See [privacy](privacy.md) and [observed compatibility](compatibility.md).

## Versioning and releases

**One product version.** The root `package.json` version is the product version. The CLI, every host package (`spectorque-claude`, `spectorque-codex`, `opencode-spectorque`, `pi-spectorque`), the Claude and Codex plugin manifests, the VSIX, both marketplace catalogs, the MCP Registry entry `server.json` and `CITATION.cff` carry the same number. `npm run version:sync` copies it from the root (see `scripts/versions.mjs` for the list), and `tests/manifests.test.ts` fails on any drift.

**Product numbering (SemVer).** Before 1.0, a minor version marks a new public surface or distribution route (0.3.0 added the marketplaces). A patch version covers fixes, presentation changes and engine rule refinements. Versions bumped on `develop` without a tag are internal; the changelog groups them under the next released version (0.2.1–0.2.9 shipped in 0.3.0). The Marketplace accepts only `major.minor.patch`, so prereleases do not use a `-pre` suffix; the channel marks them instead.

**Engine and rubric versions are independent.** `ENGINE_VERSION` in `src/core/analyze.ts` gets a patch bump for every rule change that can alter findings or scores, with its decision recorded in [precision decisions](precision-decisions.md). `RUBRIC_VERSION` (`epic-heuristic-1`) changes only when the practice catalog or scoring policy changes. Both appear in the workbench header, in every host panel and in each exported assessment, so a report always names the rules that produced it. The README engine badge is checked against `ENGINE_VERSION`. The constitution version and the Codex desktop probe version are also separate.

**Channels.** Until a gate in [pilot operations](pilot-operations.md) passes, a release is a prerelease: npm dist-tag `next`, VS Code Marketplace and Open VSX pre-release, GitHub pre-release. Promotion to stable moves npm with `npm dist-tag add <package>@<version> latest` without republishing; the VS Code Marketplace needs a new version number for a stable listing of the same code.

**Release steps.**

1. Change the root version, run `npm run version:sync`, add a `## <version>` section to the [changelog](../CHANGELOG.md) with the engine and rubric versions, and set `date-released` in `CITATION.cff`.
2. Merge through review with `npm run check` green.
3. The maintainer tags `v<version>` on the merged commit. The tag, publication and issue closure each need maintainer authorization.
4. [`release.yml`](../.github/workflows/release.yml) checks that the tag matches the version, builds every package, archive and the VSIX, writes `SHA256SUMS`, publishes to npm with provenance, publishes the VSIX to both editor registries, publishes `server.json` to the MCP Registry and creates the GitHub release. A manual run is a dry run by default. Account setup is in [publishing](publishing.md).

**Current and historical documents.** Install instructions in the README, this page, [integrations](integrations.md), the [Spanish guide](es.md) and the host READMEs describe the current version and are updated every release; `tests/docs.test.ts` rejects a stale product version there. Qualification records ([compatibility](compatibility.md), [host qualification](host-common-qualification.md), [Codex Desktop probe](codex-desktop-probe.md), the precision pages and past changelog entries) are evidence for the exact version they name. They are never rewritten; a new observation adds a row.

## Build a candidate

Use two independently checked out copies of the exact commit, with LF source checkout (`core.autocrlf=false`), Node 22.20.0, npm 10.9.3 and the committed lockfile. Use a fresh absolute output directory outside both repositories.

```sh
npm ci --ignore-scripts
npm run check
npm run package:integrations
npm audit --audit-level=moderate
npm run pack:hosts
npm run package:claude
npm run package:opencode
npm run package:codex
npm run verify:codex-package
npm run package:pi
node scripts/package-vscode.mjs --pre-release
VERSION="$(node -p "require('./package.json').version")"
mkdir -p "$OUT"
cp artifacts/npm/*.tgz artifacts/spectorque-*-"$VERSION".zip artifacts/spectorque-"$VERSION".vsix "$OUT/"
```

Compare the installer digests between builds. Inspect archive contents, licenses, notices and version metadata. Compare installed dependencies against the recorded test environment. With Chromium provisioned and a new absolute `DEMO_OUT` directory, assemble the demonstration:

```sh
npm run browsers:install -- chromium
npm run pilot:demo -- "$OUT/spectorque-$VERSION.tgz" "$DEMO_OUT"
npm run package:pilot -- "$OUT" "$DEMO_OUT"
(cd "$OUT" && shasum -a 256 -c SHA256SUMS)
```

The assembly command checks the recorded TGZ digest, adds the installer digests to the demo manifest, packages the reviewed demo file list and computes `SHA256SUMS`. Video and report creation times may vary between recordings. The manifest records the source SHA and the reproducible report and source checks.

Run the installed workbench browser suite, host-specific terminal qualifiers and the Desktop walkthrough as described in [qualification](qualification.md) and [integrations](integrations.md). Record the commit, artifact digest, exact client, OS and architecture, Node, fixture, result and evidence location for each advertised route. Keep CI, browser, installed client, manual accessibility and participant observations separate. A release requires approval of the exact candidate and its public assets.
