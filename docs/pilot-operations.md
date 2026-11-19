# Pilot operations

The maintainer coordinates confirmations and the release decision in [issue #8](https://github.com/jayanez/spec-torque/issues/8). All dates use Europe/Madrid. This runbook is for the 2026 pilot. Dates record planned checkpoints.

| Window | Operator action and evidence |
|---|---|
| Through November 26 | Agree the release scope and routes. Confirm the EN/ES audience, support and receiving channel, and operators for the required platforms. Freeze feature intake. |
| November 27–30 | Rehearse both languages on freshly installed packages. Freeze the pilot SHA, package digests, fixture versions and guides on November 30. Mark internal runs as synthetic. |
| December 1–4 | Offer the local route to confirmed participants. Record the Windows, Linux and macOS operational evidence and the per-client native evidence by host, version, architecture and digest. Offer the workbench where an optional native route is unavailable. |
| December 5–10 | Triage volunteered reports daily and verify narrowly scoped fixes. Freeze the stable candidate on December 9. Close collection December 10 and finish review against that exact candidate. |
| December 11 | Record proceed, iterate or hold, with evidence links, remaining limits and a named owner for each pending check. Merge, release tag, publication and issue closure each require maintainer authorization. |

## Intake and triage

Use the [voluntary form](pilot-feedback.md) through the confirmed receiving channel. Keep raw submissions access-restricted. Before sharing, ask participants to approve the minimum synthetic or sanitized reproduction. Reports, ZIP contents and captures can expose source excerpts, names, credentials, host paths or metadata. If a submission contains sensitive material, stop redistributing it, contact the participant privately and arrange removal from each controlled copy and the original channel. Public evidence consists of approved excerpts, reproducible public or licensed fixtures, and consented aggregates.

Record the observation, suspected cause, repeatable steps, owner, severity, candidate digest and outcome. Group repeats by root cause while retaining separate attempts. Stop the affected route for data loss, unauthorized writes or an unexpected disclosure. After November 26, accept agreed scope completion and concrete defects. Use the smallest existing check that reproduces the issue, or add a regression for the precise failure. Requalify changed routes with a fresh digest. Keep unresolved, untested and partial reports visible.

Summarize known sessions and attempts, denominators per question and missing data. Use installation attempts for observed failures, complete timings for time to first analysis, and reported proposal decisions for proposal results. Report language coverage and voluntary-selection bias. Keep synthetic runs, historical agent-reviewed corpus labels and participant observations in separate evidence records. The pilot supplies evidence about observed sessions and errors.

## Candidate gate

For each advertised route record exact versions, fixture, input architecture, product SHA and digest, steps and observed result. The evidence index distinguishes hosted CI, browser automation, installed native clients, manual keyboard or assistive technology, and participant runs. Safari with VoiceOver remains pending until actually exercised. A concrete barrier may be fixed with regression evidence and its own recheck. Use [installation](releases.md) and [qualification](qualification.md) for the commands.

The participant route uses the local workbench. Codex Desktop's native opening is an operator-only qualification. On the observed build it submits a host turn to the provider configured in Codex, which may receive conversation and tool context. Obtain separate operator authorization for the turn, use only the public disposable fixture, and record the prompt purpose, context permitted, provider, turn count and observation limits separately from offline results. Use the CLI workbench if that authorization is unavailable.

- **Proceed** when the required clean installs and four host routes have evidence for the exact candidate, an independent replay covers both demo languages, independent Luna Latest review and CI pass, and real pilot sessions EN/ES are documented.
- **Iterate** for a bounded defect or a missing observation with a clear recheck. Keep the working candidate local, assign the owner and record the date and affected surface. Qualify a replacement candidate before sharing it.
- **Hold** for a safety or privacy failure, irreproducible artifacts, failed required checks, unavailable required route, or no real participation. If participant availability or channel confirmation is missing, record the internal rehearsal and leave the external pilot pending. An approval to reduce scope must identify the coverage being deferred.

VS Code shared workflows, unqualified Windows installed variants and research follow-ups are tracked separately in [#5](https://github.com/jayanez/spec-torque/issues/5), [#34](https://github.com/jayanez/spec-torque/issues/34), [#38](https://github.com/jayanez/spec-torque/issues/38) and [#39](https://github.com/jayanez/spec-torque/issues/39).
