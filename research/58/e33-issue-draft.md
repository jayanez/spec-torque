# E3.3 misses documented exceptional scenarios with an observable outcome

## Problem

An active spec can document an exceptional scenario using a scenario heading and explicit condition and outcome steps, yet engine 0.1.4 reports E3.3 as `missing`. For example, an original control can state that an out-of-range input leaves a record unchanged in separate WHEN and THEN steps. The E3.3 lexical check can miss the scenario when its trigger and outcome do not appear in a recognized same-line cue.

## Reproduction, evidence and limits

Run the #58 contextual scan on the authorized, pinned DEV copies. Both original documents below return whole-document E3.3 `missing` with zero E3.3 evidence.

| Language | Pinned source | License at revision | Observed scenario |
| --- | --- | --- | --- |
| EN | [kcalvelli/cairn, syncthing-xdg-sync, lines 61–64](https://github.com/kcalvelli/cairn/blob/712dc76d47efd44f2affc5a07865cd26231ef3e6/openspec/specs/syncthing-xdg-sync/spec.md#L61-L64) | MIT | An unsupported folder name produces a NixOS module evaluation type error. |
| ES | [ElPitagoras14/aniseek, anime-catalog, lines 40–44](https://github.com/ElPitagoras14/aniseek/blob/8010a757eab11db7fca993b88b97901cd426569b/openspec/specs/anime-catalog/spec.md#L40-L44) | Apache-2.0 | A failed write during synchronization leaves the previous persisted state intact. |

Raw document SHA-256 values are `80337b80d4a8973b681c553d85aecaf4dd655152dc7037f1e90ae634a7c239e2` and `2e876515a900c7f0337aeba257797f663759ea433aff95ff997d4b9caf7d4e72` respectively. The root license text matched the DEV manifest at both revisions. See [cairn's MIT license](https://github.com/kcalvelli/cairn/blob/712dc76d47efd44f2affc5a07865cd26231ef3e6/LICENSE) and [aniseek's Apache-2.0 license](https://github.com/ElPitagoras14/aniseek/blob/8010a757eab11db7fca993b88b97901cd426569b/LICENSE).

After the [expanded scan](context-scan.md#expanded-scan), extract the two admission records from its JSONL output:

```sh
jq -c 'select(.practice == "E3.3" and
  ((.repository == "github.com/kcalvelli/cairn" and
    .path == "openspec/specs/syncthing-xdg-sync/spec.md" and .start == 61) or
   (.repository == "github.com/ElPitagoras14/aniseek" and
    .path == "openspec/specs/anime-catalog/spec.md" and .start == 40))) |
  {repository, revision, path, start, end, documentHash, licenseCheck,
   cues, observation}' /tmp/spec58-leads.jsonl
```

This selects one `test-and-exception` lead at the scenario heading in each document. The pinned links above show the full condition and outcome below each heading. Both scanner records show `documentStatus: "missing"`, `documentEvidence: []`, `passageEvidence: []` and `findings: []`. The analyzer reason is `No evidence found by this check in the supplied artifacts.` Read the full pinned document for this comparison because the status is computed across the entire spec.

## Content lineage

Trace each active spec back to the first public commit that contains the scenario at a known path. Compare the active, archived and proposal forms within each repository before counting the lineages.

- **cairn.** The active path first appears in the February 17 archive commit (`7e5c244`). That commit moves the original proposal spec into `openspec/changes/archive/2026-02-17-add-syncthing-xdg-sync/` and adds the active spec. Its parent (`2bf4e7b`, February 17, 2026) adds the proposal under `openspec/changes/add-syncthing-xdg-sync/` and adds the NixOS module under `modules/syncthing/default.nix`. The proposal already contains the invalid-folder scenario, tied to that module's XDG enum. Its scenario hash matches the archived copy, the first active copy, the April rename revision (`3c3de95`) and the pinned active spec. Count these as one lineage. [Proposal and module commit](https://github.com/kcalvelli/cairn/commit/2bf4e7b139ad0959e82d769f0dd465c316ea18c2) · [Archive commit](https://github.com/kcalvelli/cairn/commit/7e5c2440e2b6a9a008c90ca05c9e26cc8f23dcc7) · [Rename revision](https://github.com/kcalvelli/cairn/commit/3c3de95b028ffa0e8b2256a7ca858fdc806d59bd)
- **aniseek.** The October 14 sync refactor (`094a0f9`, October 14, 2026) adds both the active spec and the archive under `openspec/changes/archive/2026-10-14-unify-anime-sync/`. The preceding tree contains neither path. The same changeset revises `backend/tests/test_animes_atomicity.py`, including the test that injects failure after the first transactional write and verifies that an existing anime retains its previous state. The archived, first active and pinned active versions have the same scenario hash. Count these as one lineage. [Parent tree](https://github.com/ElPitagoras14/aniseek/tree/b2dafb3a77d759b33902a7aff16906e152d71132) · [Spec and backend test commit](https://github.com/ElPitagoras14/aniseek/commit/094a0f9b6ee431a61e512dcdb816b3c09997a2b0)

To reproduce the comparison, request the GitHub commits endpoint for each active path with `sha` set to its pinned revision and `path` set to its repository-relative path. Follow the changes in the linked commits to the proposal and archive paths. Hash the UTF-8 text from the exact `#### Scenario:` heading up to the next Markdown heading of level 1–4, or EOF. Normalize line endings to LF, trim trailing whitespace from the end of the extracted block and append one LF before SHA-256. Keep the condition, actions and outcomes in the hash.

| Scenario lineage | SHA-256 of the scenario block |
| --- | --- |
| cairn, invalid XDG folder name | `9011db1b4fd1f53a8ad157004113a5d62b9450dae62793d2b383e8147bae1448` |
| aniseek, mid-persistence write failure | `556f7e52aca1f739c306a3066e71418f187bc08e8b323612470cbdb6619e6509` |

The admission judgment counts two documented content lineages because each scenario is traceable to a different project-local changeset whose code or test expresses its specific outcome. The shared OpenSpec heading and step markers are formatting. Neither scenario describes the other project's mechanism or outcome. The public history bounds this conclusion to the observed paths and commits. Off-repository drafting and tool use are unknown, and this is not a claim about two unaided human authors or independent test performance.

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
