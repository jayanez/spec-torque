# Research basis and product interpretation

## EPIC

[The EPIC Framework for Spec-Driven Development](https://arxiv.org/abs/2610.07534), Claudino et al., 2026, introduces forty practices across ten dimensions. Its observational repository study and practitioner validation motivate inspectable specification review. They do not establish that raising an automatic score causes fewer bugs. Repository selection, framework mix, activity and human judgment limit generalization.

SpecTorque paraphrases the practices with attribution, implements explainable EN/ES signals and labels unsupported or incomplete evidence. These checks are not a replication of human scoring, an ISO conformance assessment, or an independently calibrated predictor. We do not apply the paper's quality bands as marketing guarantees. See [NOTICE](../NOTICE).

## Article and visual requirements

[How Bad Is Your Spec?](https://medium.com/@visrow/how-bad-is-your-spec-scoring-specs-for-ai-coding-agents-a7f2f0b5ed56) demonstrates ZeeSpec's interpretation. Its screenshots informed the interaction requirements below; no source code, branding or images are copied. Its automated score is a separate implementation, not scientific acceptance of ours.

| Visual sequence inspected | SpecTorque requirement |
|---|---|
| EPIC category/dimension overview | Ten dimensions, visible practice definitions and scoring explanation. |
| Guided specification authoring | Ask focused questions, emit editable spec/plan/tasks. |
| Score summary and radar | Show evaluated coverage and unknowns alongside scores. |
| Dimension breakdown | Expand individual practices and navigate to source evidence. |
| Evidence and missing-practice details | Exact document/line, actionable question or suggestion. |
| Vague-language examples | Bilingual wording signals with quoted source. |
| Revision/fix workflow | Before/after review, acceptance/rejection and reanalysis. |
| Sharing/badge output | Revision-bound artifact; avoid implying a current live score. |
| Non-ZeeSpec input | Classify artifacts by feature and role before assessment. |
| Public GitHub input | Resolve a public revision and inspect bounded source files. |
| Strong-spec example | Original reproducible examples; no score maximization target. |
| Terminal output | Same engine and evidence through CLI. |
| CI policy example | Explicit thresholds; incomplete evidence cannot silently pass. |

## Detection ecosystem

[spec-compare](https://github.com/cameronsjo/spec-compare) is a discovery inventory and comparison guide, not a universal parser specification. V1 supports bounded Markdown layout detection for Spec Kit, Spec Kitty, OpenSpec, Kiro, BMAD, ZeeSpec and generic PRDs. Layout names are hints. Variants, nested monorepos and cross-feature links need fixtures and evaluation; unsupported context remains visible.

## Linguistic refinement and models

The literature search through Consensus informed the separation between requirement-smell detection and clarification. Useful related directions include [automated smell detection and recommendation](https://consensus.app/papers/veizaga-shin-automated-smell-detection-and-recommendation-in/w:92669d84-e68c-4fe0-bf52-cbf27bd92326/) and [ClarifyGPT](https://doi.org/10.1145/3660810). Neither supplies an out-of-the-box guarantee for bilingual agent specifications. Evidence must be reproduced on our corpus before comparative claims.

A stronger practical V1 combination is deterministic linting, explicit clarification questions, source-grounded host-model proposals and human review with preservation checks. A provider's fluent text is not evidence that a decision was preserved. The optional model cannot silently alter numbers or obligations.

[NVIDIA Model Optimizer](https://github.com/NVIDIA/Model-Optimizer) optimizes model execution and representation, including quantization and deployment. It is not a requirements-language analyzer. NVIDIA Skills were consulted for this distinction. Later work may benchmark a compact local model and NVIDIA DataDesigner-generated challenge cases; training, GPU provisioning and synthetic-data performance claims are outside V1. Existing host models and optional explicit providers keep the initial delivery focused on the complete user workflow.

## Evaluation policy

Measure detection precision/recall on independently reviewed EN/ES examples, false positives by format, preserved decisions, accepted/rejected proposals, time to first analysis and installation success. Separate original/synthetic cases, human labels, offline contracts and real-client results. No observed outcome yet establishes reduced implementation defects or international adoption.
