# Precision decisions (#39, 2026-11-21)

Tracking: [#39](https://github.com/jayanez/spec-torque/issues/39). Method and
pre-registration: [precision replay](precision-replay.md). The comparator is
engine 0.1.4 at `865af59`, which was also live `develop` when the work started.

All counts below are measurements, from runs on this branch. The text says
explicitly where something is a hypothesis or a provisional judgment. Agent review
here means a single provisional reviewer (this session), not independent labels.
Restricted roots (personal and corporate) were scanned with the owner's
authorization. Their aggregates are held locally pending release approval, so this
page reports only whether each gate condition held for them.

## 1. Detector rule

### H1: fence pairing — **stop**

| Measure | 0.1.4 | H1 candidate |
|---|---:|---:|
| Synthetic E1.4 FP, fence-mismatch, EN / ES | 5 / 4 | 0 / 0 |
| Synthetic regressions | — | 0 |
| Historical predictions changed (716) | — | 0 |
| Natural lines admitted inside an oracle fence (18 roots, 344 documents) | 0 | 0 |

The failure did not occur in any natural root, so gate condition 1 failed. The
candidate (`d3afc42`) was reverted (`63e2f8d`). The synthetic suite still
documents the failure.

### H2 / H2a: mentioned modal words — **iterate**

H2 was pre-registered after the H1 scans showed quoted-only modal admissions in
several repositories. An independent code review then found an inch-mark false
negative before any decision, and H2a amended the policy (`78b9643`) before it was
re-measured. The candidate is at `src/core/analyze.ts` (`mentioned`), engine
0.1.5.

**Synthetic results** (constructed references, 90 targets):

| Language | E1.4 TP | E1.4 FP | Regressions |
|---|---|---|---|
| EN | 23 → 23 | 14 → 8 | 0 |
| ES | 19 → 19 | 13 → 6 | 0 |

**Historical controls:** all 716 predictions are unchanged. The three
supplemental controls contain no quotes or backticks.

**Development scan** (the three public roots seen before H2):
- 22 lines changed, all quoted-only.
- No finding changed on any other line, and no evidence became invalid.

**Confirmation scan** (12 MIT repositories from the external inventory, not used
to design H2):
- Population: 1,750 target documents and 1,102 lineages, across OpenSpec, Spec
  Kit, Spec Kitty, Kiro, BMAD, ZeeSpec and generic PRD.
- 130 E1.4 changes (95 distinct lines). Every change is quoted-only under the
  independent scanner, and every finding change is on those lines: 258 distinct
  findings removed and none added. The raw sum of 2,014 counts inherited
  instruction files once per feature.

A provisional agent review of the 95 distinct lines found:
- **Correct:** most are keyword mentions, EARS templates, quoted user input, error
  messages, ✅/❌ examples, or accounting terms (`Debe`/`Haber`) inside code.
- **False negatives (at least 3):**
  - Two requirements written inside a code span, of the form
    `` `saldoInicialBob DEBE ser "0.00"` ``.
  - One Spanish requirement whose code span opens on the previous line, so the
    line starts with a stray backtick and the span is paired wrongly.
- **Ambiguous (a few):** quoted invariants that the spec itself calls binding.

**Restricted roots** (license-limited public, personal and corporate): every
change was quoted-only, with no findings on other lines and no invalid evidence.

**Decision.** Gate conditions 1, 2 and 4 hold. Condition 3 does not hold strictly:
some confirmed changes are requirements, not mentions. H2a removes roughly 40–55%
of the synthetic E1.4 false positives without measured true-positive loss. On
natural sources, however, it trades many correct exclusions for a small number of
false negatives.

The decision is not to merge. The next iteration is H2b, pre-registered and
evaluated on a fresh, untouched set. Its candidate policies are:
- skip code-span pairing on lines with an odd number of backticks;
- count a code span as a mention only when its content is one or more bare modal
  keywords (for example `` `SHALL` ``/`` `MUST` ``), and keep sentence-length code
  spans as possible requirements.

H2a also changes one earlier contract: guillemets (`«…»`) now mark a mention
(`tests/normative.test.ts`). It stays on this branch only.

## 2. Feedback workflow (F1) — **keep, unchanged**

No new evidence was gathered on feedback in this session.
- Feedback stays opt-in, local, inspectable, deletable and replayable.
- A user accepting a suggestion is not a correctness label.
- The replay harness here adds what F1 needs to compare revisions: case IDs,
  input, policy and engine hashes, and per-arm decisions.

## 3. Optional linguistic assistance (F2) — **iterate, stays gated**

**Design.** Candidate-span classification replaces free generation:
- The engine proposes the modal spans, each with exact offsets.
- The model only picks a class from a closed enum.
- Evidence is the span the engine proposed.

**Setup.**
- 48 balanced synthetic probes, frozen first (`03f46d5`).
- Local Ollama 0.40.16 on loopback; `qwen3.5:9b` with digest `d63f830f28d5`,
  quantized NVFP4 on MLX; three seeds; temperature 0.
- This runner has no grammar support. The fallback validates the enum and the
  candidate IDs locally, and any other answer counts as unresolved.
- The first fallback run was invalid because the model echoed the schema, so the
  prompt now shows an answer shape (`4f88efe`).

**Strict correctness** (positives need exact evidence; unknown references need an
abstention):

| Arm | Positive | Negative | Unknown | All |
|---|---:|---:|---:|---:|
| D: deterministic, H2a | 16/16 | 7/16 | 0/16 | 23/48 (47.9%) |
| M: local model | 15/16 | 13/16 | 0/16 | 28/48 (58.3%) |

**Findings.**
- M classified every response validly and all three seeds agreed every time. At
  temperature 0, extra seeds add nothing.
- M never abstained: on unknown probes it chose permission or possibility.
- Its errors are Spanish:
  - `PUEDEN` permission read as possibility;
  - quoted error text read as an obligation;
  - `debe de` conjecture read as an obligation.

**Decision.** M meets the nominal +3 pp gate, with no loss on unknowns. It still
fails the design aim of abstention, and the evidence is synthetic only (n = 48).
It is not enabled.

**Next steps.**
- Calibrate abstention with sampled self-consistency at temperature above 0.
- Add a second local model with an explicit download approval.

Restricted-data inference stays local, and its model policy is the operator's
decision.

## 4. Document clarification — **not run**

Clarification quality remains a separate experiment. No clarification output was
produced or evaluated here.

## Tooling assessment

[NVIDIA Model Optimizer](https://github.com/NVIDIA/Model-Optimizer) quantizes,
prunes, distills and sparsifies models, and adds speculative decoding, for
deployment through TensorRT-LLM, vLLM or SGLang on NVIDIA GPUs (CUDA, Linux).

It does not address the bottlenecks measured here:
- missing abstention;
- reference quality;
- deterministic mention rules.

Distillation is model training, which V1 excludes. The current workstation runs
MLX, not CUDA. It could matter later, for example to serve a quantized local model
on NVIDIA hardware for restricted data, once F2 shows a stable advantage.

## Reproduce

```sh
node --import tsx scripts/precision/replay.ts synthetic --baseline 865af59 --candidate HEAD
npm run corpus:report -- --baseline 865af59 --labels fixtures/calibration/agent-reviews.json
node --import tsx scripts/precision/replay.ts scan --baseline 865af59 --candidate HEAD --roots <roots.json> [--out <dir>]
node --import tsx scripts/precision/assist-trial.ts --model <local model> --seeds 3 [--no-format]
node --import tsx scripts/precision/audit-denominators.ts --fixture <f.jsonl> --results <r.jsonl>
```

The public roots file lists repositories and pinned SHAs. The external inventory's
non-MIT and unconfirmed-license sources were scanned only as restricted, so none of
their text was stored. None of their text is copied into the corpus.
