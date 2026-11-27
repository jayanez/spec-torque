# Rubric reference

Rubric `epic-heuristic-1`, used by engine 0.1.20. Forty EPIC-derived practice concepts, paraphrased and adapted. See NOTICE for CC BY 4.0 attribution and docs/architecture.md for the original heuristic scoring policy. Textual signals are partial evidence; they do not establish complete semantic coverage.

| ID | Practice | Review action |
|---|---|---|
| E1.1 | Explicit clarification-seeking | Record unresolved decisions as specific questions, or explicitly state that none remain. |
| E1.2 | Quantified and measurable requirements | State the measurable outcome and operating conditions; ask for unknown values. |
| E1.3 | Bounded vocabulary and enumerations | Define domain terms and enumerate supported values. |
| E1.4 | Normative and structural consistency | Use intentional MUST, SHOULD or MAY wording consistently; preserve the chosen obligation. |
| E1.5 | Scope and verification boundaries | State explicit exclusions and the boundaries of verification. |
| E2.1 | Atomic behavioral statements | Split independent obligations while keeping conditions of the same obligation together. |
| E2.2 | Singular architecture and design facts | Record each design fact as a separate statement in the plan. |
| E2.3 | Isolated risks, assumptions and edge cases | Give each risk, assumption or edge case its own entry. |
| E2.4 | Singular definitions and scenarios | Define one behavior per scenario and one concept per definition. |
| E2.5 | Singular security and privacy properties | State applicable security and privacy obligations as separate, testable requirements. |
| E3.1 | Verification criteria and outcomes | Connect each requirement to observable acceptance criteria. |
| E3.2 | Validation methods | Describe an executable or manual method for checking each outcome. |
| E3.3 | Verification coverage | Cover normal, exceptional and boundary scenarios. |
| E3.4 | Verification completion and readiness | State what evidence is required to consider verification complete. |
| P1.1 | Declared assumptions and dependencies | Declare dependencies and assumptions, including an explicit absence where applicable. |
| P1.2 | Explicit constraints and scope | Document constraints that affect feasible solutions. |
| P1.3 | Requirement-level dependency traceability | Link each dependency or risk to the requirement or task it affects. |
| P1.4 | Dependency verification and failure handling | State how dependencies are checked and what happens when they fail. |
| P2.1 | Functional and user requirement coverage | Identify intended actors, capabilities and scope; completeness still needs domain review. |
| P2.2 | Exceptional behavior and scope definition | Describe relevant invalid input, failures, empty states and exclusions. |
| P2.3 | Operational and quality constraints | Describe applicable operational and non-functional expectations. |
| P2.4 | Dependency and delivery planning | Describe a delivery order and its prerequisites. |
| P2.5 | Completeness management | Track unanswered questions until a decision and owner are recorded. |
| I1.1 | Standardized document structure | Organize documents by purpose using recognizable headings. |
| I1.2 | Stable unique requirement identifiers | Give each requirement a stable, unique identifier. |
| I1.3 | Explicit template declaration | Declare the document convention and validate it. |
| I2.1 | Shared terminology | Use a shared glossary and consistent domain names. |
| I2.2 | Uniform identifiers and notation | Keep identifier syntax and references consistent. |
| I2.3 | Cross-artifact alignment | Reference requirement identifiers from plans and tasks, then inspect semantic agreement. |
| I2.4 | Consistent organization | Use a predictable organization across related artifacts. |
| I3.1 | Structured document organization | Group information in navigable sections with meaningful headings. |
| I3.2 | Cross-document navigation | Link related specifications, plans and tasks. |
| I3.3 | Comprehension support | Explain the product purpose and include a concrete example. |
| C1.1 | Behavioral product specification | State required behavior from the user or system perspective. |
| C1.2 | Separation of product and project concerns | Keep behavior identifiable and place implementation choices in supporting artifacts. |
| C1.3 | Traceable transition to implementation | Connect tasks to the requirements they implement. |
| C2.1 | Technical context and foundations | Document the technical context and required compatibility in the plan. |
| C2.2 | Task organization | Break delivery into individually checkable tasks. |
| C2.3 | Requirements-to-implementation traceability | Record the requirement IDs served by each task; links alone do not prove implementation. |
| C2.4 | Data models and evolution | Describe relevant data or interface contracts and evolution requirements. |
