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

## Offline model research

[Requirements Smells](https://doi.org/10.1016/j.jss.2016.02.047) reports
variable results across lexical checks in industrial requirements.
[Sclar et al.](https://openreview.net/forum?id=RIu5lyNXjT) found model
sensitivity to equivalent prompt formats, and
[MaXIFE](https://aclanthology.org/2025.acl-long.698/) evaluates verifiable
multilingual instructions. These peer-reviewed studies motivate separate
rule, language and prompt-variant results.
[IFEval](https://arxiv.org/abs/2311.07911) and
[EPIC](https://arxiv.org/abs/2610.07534) were consulted as preprints.
Instruction-following, specification assessment and code-generation outcomes
are different endpoints.

| Candidate | Published specifications and limits |
| --- | --- |
| Qwen3.5-9B | Apache-2.0, 262,144 native context tokens, multilingual aggregate benchmark results and a 5.68 GB Q4_K_M file. The file size excludes runtime memory and cache. Evaluate EN and ES directly. [Model](https://huggingface.co/Qwen/Qwen3.5-9B), [GGUF](https://huggingface.co/unsloth/Qwen3.5-9B-GGUF/blob/main/Qwen3.5-9B-Q4_K_M.gguf) |
| gpt-oss-20b | Apache-2.0, 128k context, primarily English training data and Spanish in the vendor's multilingual evaluation. The published MXFP4 GGUF is 12.1 GB. NVIDIA describes a 16 GB VRAM RTX profile. [Model](https://openai.com/index/introducing-gpt-oss/), [GGUF](https://huggingface.co/ggml-org/gpt-oss-20b-GGUF/tree/main), [NVIDIA](https://developer.nvidia.com/blog/?p=104177) |

The planning pass used Consensus, Hugging Face and Context7, plus primary
publications and official documentation. There was no NVIDIA connector.
Vercel's connector was available for installation, so the pass used its
official documentation and Context7. These are documentary observations.
SpecTorque recorded no model latency, memory peak, egress or accuracy.

An isolated experiment could use
[llama.cpp](https://github.com/ggml-org/llama.cpp/blob/master/tools/server/README.md)
with an existing local GGUF file, Metal or CUDA, and loopback if using a
server. Keep prompt caches in memory and inspect logs and other writes in an
isolated directory. [Ollama](https://docs.ollama.com/faq) is an alternative when
the model is present and `OLLAMA_NO_CLOUD=1` disables cloud features. A
[Vercel-compatible provider](https://ai-sdk.dev/providers/openai-compatible-providers)
can target an explicit loopback URL. A bare model string defaults to
[Vercel AI Gateway](https://ai-sdk.dev/docs/ai-sdk-core/provider-management).
Use process-level isolation with outbound network blocked and inspect traffic
and persistence before any non-fixture content enters an experiment.

**Recommendation.** Consider an independently authorized experiment using
Qwen first, followed by gpt-oss as a comparator. Use a fresh, independently
annotated EN/ES holdout outside #2 and the model/prompt selection sample.
Pin the engine, weights, quantization, runtime, backend and prompt. Start at
8k context and test 16k separately. Record evidence locations, FP/FN,
abstentions and preservation of `unknown`, along with three repeats across
three equivalent prompt variants. Measure p50/p95 latency with warm and cold
starts, peak RAM/VRAM, context failures and all egress and persistence.
An integration decision requires measurable benefit in both languages and
separate product approval.

## Evaluation policy

Measure detection precision/recall on independently reviewed EN/ES examples, false positives by format, preserved decisions, accepted/rejected proposals, time to first analysis and installation success. Separate original/synthetic cases, human labels, offline contracts and real-client results. No observed outcome yet establishes reduced implementation defects or international adoption.
