# Implementation plan

Approved scope: docs/requirements.md. Dates and workstreams: docs/roadmap.md. Task ownership, dependencies, acceptance checks and completion state live in GitHub Issues.

Deliver thin usable slices: bounded discovery and evidence; guided creation and common panel; reviewed refinements and exports; real host connections and native visual surfaces; clean-install and cross-platform qualification; pilot corrections and reproducible demonstration.

Implementation choices resolved: shared TypeScript engine, Node 22, React/Vite local workbench, optional explicit model use, bundled native runtimes and read-only MCP. No database, GPU, remote service or directory publication is required for basic operation.

## Next increments after corrective integration

PRs #10/#12 and corrective tracking #11 are integrated. Continue with the bounded
EN/ES normative-recognition increment in #2, then the remaining real-client
common-workbench routes in #1 (Claude Code, OpenCode, Pi). Complete the rest of the
format corpus and #3 acceptance before final native qualification in #4–#7 and
pilot #8. Arrange human accessibility checks during these increments. This order
does not change milestone scope or close any broader acceptance issue.

For each increment: reproduce defects first, verify focused regressions, run
`npm run check` and `npm run package:integrations`, require the three-OS and browser
CI checks, and obtain independent Luna Latest review before merge. Unsupported
client/OS combinations and human labels remain explicit pending evidence.
