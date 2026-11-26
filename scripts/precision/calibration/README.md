# Reviewer calibration tooling (#57, #65)

Tools used to run and score the model-reviewer calibration for the E1.2 clarification rehearsal. They implement [docs/clarification-actionability.md](../../../docs/clarification-actionability.md) and [docs/clarification-actionability-run2.md](../../../docs/clarification-actionability-run2.md) with their dated amendments.

- `protocol.mjs`: pinned hashes, phases, seed rule and packet checks shared by the runner and scorer.
- `run-reviewer.mjs`: runs one reviewer over one packet, one call per item, with isolation (R1: headless Claude Code with no tools or settings; R2: the `r2-image` container), per-call model checks, locking, resumable records and one malformed-output retry. `--screen` runs an exploratory second-reviewer candidate in `screen-image`; such runs are marked and never scored by the gated scorer.
- `score-calibration.mjs`: `seal` hashes all six runs before any key is read; `score` verifies the seal, packets and runs, then computes per-language κ, key accuracy and instability against the gates.
- `archive/`: the exact runner, scorer and R2 config used in earlier runs. The run-2 pre-registration pins `run-reviewer.run2-pinned.mjs` and `score-calibration.run2-pinned.mjs` by SHA-256.

Packets are built by `scripts/precision/rehearsal-packets.ts`. Packets, keys maps, raw outputs and reports stay in the git-ignored `.spec-torque/rehearsal/` folder and are never committed. Nothing here sends data anywhere unless the operator starts a run.

Tests: `node --test scripts/precision/calibration/score-calibration.test.mjs` (also run from `tests/calibration-tools.test.ts`).
