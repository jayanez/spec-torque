# Contributor instructions

Read CONSTITUTION.md and docs/architecture.md. Keep core rules host-independent. Canonical prose is English with Spanish guides. Never equate heuristic or mocked checks with scientific or real-client acceptance.

Use Node.js 22.20+. Run npm run check and npm run package:integrations. Obtain independent review before merging; in Codex use Luna Latest (gpt-6-luna) for review agents. Do not weaken validation or erase unknown states to improve scores. Use current official documentation through Context7 for host/library APIs.

GitHub Issues is the task source of truth. Keep reversible decisions brief in the issue/PR; no ADR gate. Keep generated runtimes out of source commits and package them for release. Follow the versioning policy in docs/releases.md: one product version synced by npm run version:sync; engine and rubric versions move independently. No telemetry or automatic cloud/model calls.
