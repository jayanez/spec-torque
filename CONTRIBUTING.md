# Contributing

Open an issue with a concrete workflow, expected behavior and a small non-sensitive reproduction. For new framework support, supply original or appropriately licensed fixtures. Keep deterministic checks, model suggestions and human acceptance distinct.

Use Node.js 22.20+, then `npm ci --ignore-scripts`, `npm run check`, and `npm run package:integrations`. Add regression tests for real failures and keep native adapters thin. UI changes require browser/keyboard checks; native changes require the relevant real client. Do not mark a client supported from a mock alone.

Development qualification pins Node 22 through `.nvmrc` and verifies the actual subprocess runtime. Use `npm run browsers:install` and `npm run test:browser` for the full browser matrix. See [local qualification](docs/qualification.md) for project-local Codex setup, installed-VSIX tests, tool versions and observed limits.

Canonical documentation is English; Spanish guides and original EN/ES examples are welcome. Preserve upstream licensing. Use the public issue tracker as the task source of truth; reversible choices belong in the issue or PR, without a separate ADR gate.

Product, engine and rubric versions follow the [versioning policy](docs/releases.md#versioning-and-releases): change the root version and run `npm run version:sync`; bump `ENGINE_VERSION` for any rule change that can alter findings. `npm run docs:capture` regenerates documentation screenshots.

Before merging, obtain an independent review of correctness, security, integration contracts and scientific claims. Release evidence must identify platform and client version.
