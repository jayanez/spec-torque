# Spike: inventory bilingual lexical signals

Closes #58.

SpecTorque can miss equivalent EN/ES wording and count keywords without the intended information. This spike adds 51 hashed synthetic controls and a contextual scanner for the authorized DEV sources. It records each observation and the evidence supporting its disposition.

The scan covered all 974 matching specifications across 17 pinned revisions. **One defect meets intake.** E3.3 reports `missing` for exceptional scenarios with explicit conditions and observable outcomes in two independent repositories and feature lineages. Two additional scenarios in those repositories corroborate the finding. The separate corrective issue draft in `research/58/e33-issue-draft.md` records the evidence and evaluation gates.

The report keeps C2.3 pending because the authorized documents contain only specification artifacts. It records the other unadmitted observations and recommends explaining the partial ceiling in a follow-up. H2c remains stopped.

## Verification

- Seven focused tests, strict script type checking, all 51 synthetic controls, the build and integration packaging passed under Node 22.20.0.
- Two executions on the same 974-spec cache produced byte-identical results and coverage reports. The historical comparator and the spike engine agreed on all 716 predictions. Any corrective candidate requires its own replay and independent precision evaluation.
- An earlier full `npm run check` passed 154 tests but loaded committed E1.2 clarification fixtures. Their relationship to the excluded #57/#60 material could not be established, so the full check was not repeated.
- Exact-commit Luna Latest review with access restricted to this spike remains required before merge.
