# Delivery roadmap

Target release year: **2026**. Dates are planning checkpoints. Move a checkpoint earlier when its evidence and required people are available.

| Window | Deliverable |
|---|---|
| Nov 16–18 | Constitution, contracts, public repository and issue backlog. First import → assessment → evidence workflow; inspect all four native surfaces early. |
| Nov 19–22 | Builder, format detection, EN/ES checks and common panel. |
| Nov 23–26 | Reviewed refinement, exports, real-agent connection and integrated views. |
| Nov 27–30 | Clean installation, end-to-end qualification and corrections. |
| **Dec 1** | Operational V1: create/import → analyze → review an improvement → export through four agents and the common panel. |
| **Dec 4** | Four integrated visual views connected to the shared motor and exercised in real clients. |
| Dec 1–10 | Pilot feedback, installation fixes, accessibility, original bilingual examples and reproducible demo. |
| **Dec 11 target** | Review pilot evidence and decide whether to publish a stabilized version with the demonstration materials. |

Three workstreams: engine/formats; visual experience/builder; integrations/distribution. GitHub Issues records owners, dependencies, checks and state; this document does not duplicate their checklists. Reversible choices are resolved during implementation. November 26 is the target for locking pilot scope. Feature work continues on `develop` for the next release. Keep the pilot on an exact version and accept only agreed scope completion and fixes on its release branch. A qualified prerelease may ship before the pilot. A later release may include new features once they have their own verification and any affected pilot routes have been requalified.

V1 excludes code/test implementation verification, model training, advanced enterprise features and additional host-specific visual shells. Cursor, Copilot and Gemini CLI receive connection guides. The Codex visual deliverable is the Codex Desktop viewer in [#27](https://github.com/jayanez/spec-torque/issues/27). The shared VS Code workbench is tracked separately in [#5](https://github.com/jayanez/spec-torque/issues/5). Windows qualification follows [#34](https://github.com/jayanez/spec-torque/issues/34).

The [common-workbench qualification](common-workbench-qualification.md) records the clean installed-package browser checks on macOS. [#3](https://github.com/jayanez/spec-torque/issues/3) closed with explicit limits. Safari at the exact test widths and the manual Safari with VoiceOver walkthrough still need evidence.

The [EN/ES format corpus](format-corpus.md) has a reproducible comparison
with blind agent annotations and adjudication. Human validation remains
separate from the corpus evidence in [#2](https://github.com/jayanez/spec-torque/issues/2).

The proposed [local-model experiment](research.md#offline-model-research)
requires separate authorization and a reserved evaluation sample. Directory
publication and model-provider accounts do not determine delivery dates.
