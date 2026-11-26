# Publishing checklist

Maintainer steps that need accounts or credentials. The repository prepares every package, manifest, icon and workflow; these steps connect them to the registries and directories. Do them once, then each release is a tag ([release steps](releases.md#versioning-and-releases)).

## One-time setup

| Registry | What to do | Used by |
|---|---|---|
| GitHub | Create the `release` environment (Settings → Environments) with required reviewers. The `npm` and `editors` jobs in `release.yml` wait for its approval. | Every publish |
| npm | Create the five packages on the first publish: `spectorque`, `spectorque-claude`, `spectorque-codex`, `opencode-spectorque`, `pi-spectorque`. For each, add a **trusted publisher** (package settings → Trusted publishing → GitHub Actions) with repository `jayanez/spec-torque`, workflow `release.yml` and environment `release`. No npm token is stored. | npm job |
| VS Code Marketplace | Create publisher `jayanez` at [marketplace.visualstudio.com/manage](https://marketplace.visualstudio.com/manage). Store a token with Marketplace (Manage) scope as the `VSCE_PAT` secret of the `release` environment, or switch the job to Entra ID or trusted publishing when available for the publisher; global Azure DevOps PATs are retired on 2026-12-01. | editors job |
| Open VSX | Sign in at [open-vsx.org](https://open-vsx.org) with an Eclipse account, sign the Publisher Agreement, create an access token, then run `npx ovsx@1.4.0 create-namespace jayanez -p <token>` once. Store the token as `OVSX_PAT`. Claim the namespace for the verified badge. | editors job |

The first npm publish of a new package cannot use trusted publishing until the package exists. Publish 0.3.0 from the workflow with a temporary granular token scoped to the five package names, then add the trusted publishers and revoke the token.

## Each release

1. Run the `release` workflow manually with **dry_run** checked and confirm every job passes.
2. Tag `v<version>` on the merged commit and push the tag. Approve the `release` environment when asked.
3. Check the listings: [npm](https://www.npmjs.com/package/spectorque?activeTab=versions), [VS Code Marketplace](https://marketplace.visualstudio.com/items?itemName=jayanez.spectorque), [Open VSX](https://open-vsx.org/extension/jayanez/spectorque) and the GitHub release.
4. Install through each catalog on a clean profile: `claude plugin marketplace add jayanez/spec-torque` and `codex plugin marketplace add jayanez/spec-torque`. Record observed results in [compatibility](compatibility.md).

## Directories and galleries

| Listing | Status | How |
|---|---|---|
| Claude Code marketplace (this repository) | Ready | `.claude-plugin/marketplace.json` installs `spectorque-claude` from npm. `claude plugin validate .` and `claude plugin validate --profile directory integrations/claude` pass. |
| Codex marketplace (this repository) | Ready | `.agents/plugins/marketplace.json` installs `spectorque-codex` from npm. |
| Anthropic plugin directory | Recommended, submit after the first publish | Submit at [claude.ai/directory/manage](https://claude.ai/directory/manage) (needs a paid claude.ai plan). The portal reads `icon`, `documentationUrl`, `supportUrl` and `privacyPolicyUrl` from `integrations/claude/.claude-plugin/plugin.json`. Its own review applies rules to the Mods hooks module that `claude plugin validate` does not. |
| OpenAI plugin directory | Prepared, not submitted | The portal at [platform.openai.com/plugins](https://platform.openai.com/plugins) accepts MCP only as a public HTTPS server and currently refuses packages with `apps`. SpecTorque runs a local stdio server with an MCP Apps viewer, so Codex users install from this repository's catalog. The listing metadata is in `extensions.com.openai.interface` of `integrations/codex/plugin.json`. Revisit if the portal accepts local servers. |
| Pi packages gallery ([pi.dev/packages](https://pi.dev/packages)) | Automatic | Listed from npm by the `pi-package` keyword once `pi-spectorque` is published. |
| ThinkRail extensions ([thinkrail.ai/extensions](https://thinkrail.ai/extensions)) | Automatic | Listed from npm, unreviewed, like the Pi gallery. |
| OpenCode ecosystem | Recommended | Open a pull request adding `opencode-spectorque` to [awesome-opencode](https://github.com/awesome-opencode/awesome-opencode). |
| VS Code Marketplace and Open VSX | Ready | Published by `release.yml`. Open VSX covers Cursor, Windsurf and VSCodium, which are not yet qualified. |

Listings describe the package. Qualification claims stay in [compatibility](compatibility.md), separate from where the package can be installed.
