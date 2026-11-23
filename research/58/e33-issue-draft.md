# E3.3 misses documented exceptional scenarios with an observable outcome

## Problem

An active spec can document an exceptional scenario using a scenario heading and explicit condition and outcome steps, yet engine 0.1.4 reports E3.3 as `missing`. For example, an original control can state that an out-of-range input leaves a record unchanged in separate WHEN and THEN steps. The E3.3 lexical check can miss the scenario when its trigger and outcome do not appear in a recognized same-line cue.

## Reproduction, evidence and limits

Run the #58 contextual scan on the authorized, pinned DEV copies. Both original documents below return whole-document E3.3 `missing` with zero E3.3 evidence.

| Language | Pinned source | License at revision | Observed scenario |
| --- | --- | --- | --- |
| EN | [kcalvelli/cairn, syncthing-xdg-sync, lines 61–64](https://github.com/kcalvelli/cairn/blob/712dc76d47efd44f2affc5a07865cd26231ef3e6/openspec/specs/syncthing-xdg-sync/spec.md#L61-L64) | MIT | An unsupported folder name produces a NixOS module evaluation type error. |
| ES | [ElPitagoras14/aniseek, anime-catalog, lines 40–44](https://github.com/ElPitagoras14/aniseek/blob/8010a757eab11db7fca993b88b97901cd426569b/openspec/specs/anime-catalog/spec.md#L40-L44) | Apache-2.0 | A failed write during synchronization leaves the previous persisted state intact. |

Raw document SHA-256 values are `80337b80d4a8973b681c553d85aecaf4dd655152dc7037f1e90ae634a7c239e2` and `2e876515a900c7f0337aeba257797f663759ea433aff95ff997d4b9caf7d4e72` respectively. Root license text matched both manifests at the pinned revisions. The projects have distinct owners and feature lineages. They share a scenario scaffold, but the conditions, actions, domain and expected results are distinct authored material. Count one lineage per project. These sightings support intake. They do not establish prevalence, detector precision or independent test performance.

Two additional development passages corroborate the same omission. In [cairn remote-desktop, lines 125–127](https://github.com/kcalvelli/cairn/blob/712dc76d47efd44f2affc5a07865cd26231ef3e6/openspec/specs/remote-desktop/spec.md#L125-L127), the command exits nonzero when neither lookup resolves the user's port and no port is supplied. In [aniseek frontend-runtime-config, lines 24–27](https://github.com/ElPitagoras14/aniseek/blob/8010a757eab11db7fca993b88b97901cd426569b/openspec/specs/frontend-runtime-config/spec.md#L24-L27), an unconfigured key uses its declared default. Both documents returned `missing` with no E3.3 evidence. They remain development examples in the original two repositories.

## Scope and collateral risks

Evaluate whether bounded structure can supply a partial E3.3 signal for exceptional scenarios with a condition and observable outcome. Preserve the role, source lines, existing evidence behavior and practice ceiling. Include counterexamples for an empty or generic heading, a normal scenario, unrelated neighboring sections, fenced examples, quoted templates and non-observable outcomes. Explain any changes to other statuses or evidence ordering. The prototype and adjudication belong to this issue.

The forecast for the 716 historical predictions is zero changes if the candidate is confined to E3.3. The historical evaluator has no E3.3 endpoint and does not establish target-practice correctness. Changes to shared structure or admission could affect historical predictions and other practices. Obtain the actual counts from the candidate replay.

## Acceptance

- [ ] Pre-register one bounded candidate, error definitions, language slices, limits and stop rules under [the precision process](../../docs/requirement-classification.md). Use at most three DEV rounds.
- [ ] Freeze the candidate before opening a fresh lineage-disjoint test set, once. Keep the two intake sources in development evidence. Use independent blinded labels from two reviewers other than the author, independent adjudication of disagreements and unknowns, and report EN and ES separately.
- [ ] Show one-sided 95% Clopper–Pearson upper error bounds within the pre-registered limits, with at least 100 independent lineages per bound. Preserve unknowns in output and count adjudicated unknowns as errors for the gate.
- [ ] Compare all 716 historical predictions individually and require zero changes. Run the dedicated synthetic controls and inspect collateral practice changes and line-level evidence separately.
- [ ] Present results and limits for exact-commit Luna Latest review in an isolated workspace before any merge.
