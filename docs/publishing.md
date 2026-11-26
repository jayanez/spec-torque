# Publishing checklist

Maintainer steps that need accounts or credentials. The repository prepares every package, manifest, icon, registry entry and workflow; these steps connect them to the registries and directories. Do the one-time setup once, then each release is a tag ([release steps](releases.md#versioning-and-releases)).

## One-time setup

Do these in order. Every publishing job in [`release.yml`](../.github/workflows/release.yml) runs in the GitHub environment `release`, so registry trust is bound to that environment.

1. **GitHub environment.** Settings → Environments → New environment `release`. Add yourself as a required reviewer. Under deployment branches and tags choose *Selected branches and tags* and allow the branches `main`, `develop` and `release/*` (for dry runs) and the tag pattern `v*` (for releases). Each run then waits for your approval.
2. **npm, first publish.** The five packages (`spectorque`, `spectorque-claude`, `spectorque-codex`, `opencode-spectorque`, `pi-spectorque`) do not exist yet, and npm attaches a trusted publisher only to an existing package. On npmjs.com create a granular access token with read and write access, **Bypass two-factor authentication** checked (otherwise CI fails with `EOTP` when your account requires 2FA for writes) and an expiry of 7 days. Packages that do not exist yet cannot be selected, so scope it to *All packages*. Store it as the environment secret `NPM_TOKEN` of `release` and do the first release within those days. Alternatively, publish the five tarballs once by hand with `npm publish <file>.tgz --access public --tag next` from a verified build and skip the secret; that first version then has no provenance.
3. **VS Code Marketplace.** Create the publisher `jayanez` at [marketplace.visualstudio.com/manage](https://marketplace.visualstudio.com/manage). Open the publisher's **Trusted Publishing** tab and create a policy: owner `jayanez`, repository `spec-torque`, workflow `release.yml`, environment `release`. No token is stored; the job publishes with `vsce publish --oidc`. Personal access tokens are retired for the Marketplace on 2026-12-01.
4. **Open VSX.** Sign in at [open-vsx.org](https://open-vsx.org) with an Eclipse account, sign the Publisher Agreement and create an access token. Run once `npx ovsx@1.4.0 create-namespace jayanez -p <token>`, then store the token as the environment secret `OVSX_PAT`. Claim the namespace for the verified badge.
5. **MCP Registry.** Nothing to configure. The job signs in with GitHub OIDC, which grants the `io.github.jayanez` namespace, and the registry checks ownership through `mcpName` in the root `package.json`.

## First release

1. Run the `release` workflow manually (Actions → release → Run workflow) on the release branch `release/v<version>` with **dry_run** checked. Every job must pass; nothing is published.
2. Merge the release branch into `main`, tag the merge commit and push the tag: `git tag v0.3.0 <merge-sha> && git push origin v0.3.0`. Approve the `release` environment when asked. A failed job can be re-run: packages already on npm are skipped. The jobs publish npm (`next`; npm also points `latest` at the first version of a new package, so `npm i spectorque` installs 0.3.0 until a stable release moves `latest`), the VS Code Marketplace and Open VSX (pre-release), the MCP Registry and the GitHub pre-release.
3. On npmjs.com, add a **trusted publisher** to each of the five packages: GitHub Actions, repository `jayanez/spec-torque`, workflow `release.yml`, environment `release`. Then delete the `NPM_TOKEN` secret, revoke the token and set each package's publishing access to *Require two-factor authentication and disallow tokens*. Later releases authenticate through OIDC.
4. Restore the registry badges in the README in the same change that records the publish: npm `next`, VS Code Marketplace and Open VSX. They were removed because they report errors until the packages exist.

## Each later release

1. Open `release/v<version>` from `develop` and a pull request into `main`. Run the `release` workflow on that branch with **dry_run** checked and confirm every job passes.
2. Merge into `main`, tag `v<version>` on the merge commit and push the tag, then merge `main` back into `develop`. Approve the `release` environment when asked.
3. Check the listings: [npm](https://www.npmjs.com/package/spectorque?activeTab=versions), [VS Code Marketplace](https://marketplace.visualstudio.com/items?itemName=jayanez.spectorque), [Open VSX](https://open-vsx.org/extension/jayanez/spectorque), the [MCP Registry](https://registry.modelcontextprotocol.io/v0/servers?search=io.github.jayanez/spectorque) and the GitHub release.
4. Install through each catalog on a clean profile: `claude plugin marketplace add jayanez/spec-torque` and `codex plugin marketplace add jayanez/spec-torque`. Record observed results in [compatibility](compatibility.md).

## Directories and galleries

| Listing | Status | How |
|---|---|---|
| Claude Code marketplace (this repository) | Ready | `.claude-plugin/marketplace.json` installs `spectorque-claude` from npm. `claude plugin validate .` and `claude plugin validate --profile directory integrations/claude` pass. |
| Codex marketplace (this repository) | Ready | `.agents/plugins/marketplace.json` installs `spectorque-codex` from npm. |
| MCP Registry | Ready, published by `release.yml` | [`server.json`](../server.json) lists the `spectorque` npm package as `io.github.jayanez/spectorque`. The registry feeds the VS Code MCP gallery and other registry clients. |
| VS Code Marketplace and Open VSX | Ready, published by `release.yml` | Open VSX covers Cursor, Windsurf and VSCodium, which are not yet qualified. |
| Pi packages gallery ([pi.dev/packages](https://pi.dev/packages)) | Automatic | Listed from npm by the `pi-package` keyword once `pi-spectorque` is published. |
| ThinkRail extensions ([thinkrail.ai/extensions](https://thinkrail.ai/extensions)) | Automatic | Listed from npm, unreviewed, like the Pi gallery. |
| Anthropic plugin directory | Recommended, submit after the first publish | Submit at [claude.ai/directory/manage](https://claude.ai/directory/manage) (needs a paid claude.ai plan). The portal reads `icon`, `documentationUrl`, `supportUrl` and `privacyPolicyUrl` from `integrations/claude/.claude-plugin/plugin.json`. Its own review applies rules to the Mods hooks module that `claude plugin validate` does not. |
| OpenCode ecosystem | Recommended, after the first publish | Open a pull request adding `opencode-spectorque` to [awesome-opencode](https://github.com/awesome-opencode/awesome-opencode). |
| OpenAI plugin directory | Prepared, not submitted | The portal at [platform.openai.com/plugins](https://platform.openai.com/plugins) accepts MCP only as a public HTTPS server and currently refuses packages with `apps`. SpecTorque runs a local stdio server with an MCP Apps viewer, so Codex users install from this repository's catalog. The listing metadata is in `extensions.com.openai.interface` of `integrations/codex/plugin.json`. Revisit if the portal accepts local servers. |

Listings describe the package. Qualification claims stay in [compatibility](compatibility.md), separate from where the package can be installed.
