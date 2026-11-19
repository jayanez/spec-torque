# Delivery roadmap

Target release year: **2026**. Dates describe planned acceptance, not automatic completion.

| Window | Deliverable |
|---|---|
| Nov 16–18 | Constitution, contracts, public repository and issue backlog. First import → assessment → evidence workflow; inspect all four native surfaces early. |
| Nov 19–22 | Builder, format detection, EN/ES checks and common panel. |
| Nov 23–26 | Reviewed refinement, exports, real-agent connection and integrated views. |
| Nov 27–30 | Clean installation, end-to-end qualification and corrections. |
| **Dec 1** | Operational V1: create/import → analyze → review an improvement → export through four agents and the common panel. |
| **Dec 4** | Four integrated visual views connected to the shared motor and exercised in real clients. |
| Dec 1–10 | Pilot feedback, installation fixes, accessibility, original bilingual examples and reproducible demo. |
| **Dec 11** | Stabilized version, documentation and demonstration materials. |

Three workstreams: engine/formats; visual experience/builder; integrations/distribution. GitHub Issues records owners, dependencies, checks and state; this document does not duplicate their checklists. Reversible choices are resolved during implementation. New feature intake closes Nov 26; remaining work completes the agreed scope and fixes defects.

V1 excludes code/test implementation verification, model training, advanced enterprise features and additional host-specific visual shells. Cursor, Copilot and Gemini CLI receive connection guides. The Codex visual deliverable is the Codex Desktop viewer in [#27](https://github.com/jayanez/spec-torque/issues/27). The shared VS Code workbench is tracked separately in [#5](https://github.com/jayanez/spec-torque/issues/5). Windows qualification follows [#34](https://github.com/jayanez/spec-torque/issues/34).

The [common-workbench qualification](common-workbench-qualification.md) records the clean installed-package browser checks on macOS. [#3](https://github.com/jayanez/spec-torque/issues/3) tracks the remaining Safari viewport and VoiceOver evidence.

The [EN/ES format corpus](format-corpus.md) has a reproducible comparison
with blind agent annotations and adjudication. Human validation remains
separate from the corpus evidence in [#2](https://github.com/jayanez/spec-torque/issues/2).

The proposed [local-model experiment](research.md#offline-model-research)
requires separate authorization and a reserved evaluation sample. Directory
publication and model-provider accounts do not determine delivery dates.
