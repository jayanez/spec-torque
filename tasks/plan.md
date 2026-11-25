# Implementation plan

Approved scope: docs/requirements.md. Dates and workstreams: docs/roadmap.md. Task ownership, dependencies, acceptance checks and completion state live in GitHub Issues.

Deliver thin usable slices: bounded discovery and evidence; guided creation and common panel; reviewed refinements and exports; real host connections and native visual surfaces; clean-install and cross-platform qualification; pilot corrections and reproducible demonstration.

Implementation choices resolved: shared TypeScript engine, Node 22, React/Vite local workbench, optional explicit model use, bundled native runtimes and read-only MCP. No database, GPU, remote service or directory publication is required for basic operation.

## Next increments after corrective integration

PRs #10/#12 and corrective tracking #11 are integrated. Continue with the bounded
EN/ES normative-recognition increment in #2 (PR #13), then the remaining real-client
common-workbench routes in #1 (bounded evidence in PR #14 for Claude Code,
OpenCode and Pi). The original format-layout probes in #2 add regression coverage;
real-producer variants and independent labels remain pending. Complete the rest of the
format corpus and #3 acceptance before final native qualification in #4–#7 and
pilot #8. Arrange human accessibility checks during these increments. This order
does not change milestone scope or close any broader acceptance issue.

For each increment: reproduce defects first, verify focused regressions, run
`npm run check` and `npm run package:integrations`, require the three-OS and browser
CI checks, and obtain independent Luna Latest review before merge. Unsupported
client/OS combinations and human labels remain explicit pending evidence.

PRs #13–#17 are integrated. #1 is currently closed in GitHub; its documented
package/OS limits remain qualification boundaries, with client-specific remaining
work tracked in #4–#7. The next bounded correction addresses #7's reproduced empty
Pi print output and adds an explicit offline EN/ES text/JSON qualification route.
Package/skill discovery and supported-OS acceptance remain pending. Continue the
real-producer/independent-label corpus in #2 and human acceptance in #3 alongside
these client corrections.

## Work-tree-scoped discovery (#68)

The #8 pilot on a large Spec Kit repository showed that whole-root discovery fails
before any scope applies. Deliver it in two increments: first the shared engine, CLI,
MCP and workbench (#69–#71), then every host adapter, the skills and a cross-host
parity test (#72–#77). Discovery criteria are recorded in
[architecture](../docs/architecture.md#discovery-criteria). Detector precision
follow-ups from the same pilot (#78–#80, the #52 comment) follow the #39 replay
process and do not block this work.

Delivered: #81 (engine, CLI, MCP, workbench) and #82 (host adapters, skills,
parity test) closed #68–#77. H3a (#83, engine 0.1.9) is integrated through #86. Next
precision candidates from the pilot, by impact: #88 (E3.1/E3.2 vocabulary, 30 of 32
features) and #78 (wrapped continuations, the largest remaining false-positive class),
then #79, #80 and #85, each through the #39 replay process. A cross-host UI/UX
refinement (workbench auto-load, one scope control, a shared finding card) follows as
its own increment.

## Pilot precision follow-ups

Order agreed after #68: #78 and #88 first, then #79, #80, #85, #84 and #94, each
through the #39 replay (pre-registered hypothesis, synthetic twins, paired replay,
adjudication). H6 (#88, engine 0.1.10) adds acceptance-scenario and validation-table
vocabulary and discovers the Spec Kit `quickstart.md`; it passed adjudication, with
E3.2 unconfirmed on the fresh set. Runner vocabulary (H6a) follows. H5 (#78) failed
adjudication on units identified only by a cited ID and continues as a narrowed H5a.
