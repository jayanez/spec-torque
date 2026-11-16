---
name: typescript-design-patterns
description: Choose, compare, explain, or implement named GoF design patterns in TypeScript using Refactoring.Guru references and proportionate TypeScript idioms. Use for a concrete pattern-selection problem or an explicit pattern request; ordinary TypeScript editing, React component composition, specification review, and generic code cleanup do not by themselves trigger this skill.
---

# TypeScript Design Patterns

Use patterns to resolve an observed design pressure, not to make code appear more sophisticated. A function, object literal, discriminated union, or unchanged implementation can be the best answer.

## Select and adapt

- Establish what must vary, what must remain stable, and the affected caller or boundary. Inspect the relevant source before proposing changes; do not infer a pattern from a filename alone.
- Compare a plausible pattern with the smallest adequate alternative. Explain the concrete benefit and added indirection, ownership, lifecycle, or change cost. Respect an explicitly requested teaching example without turning it into a repository refactor.
- Use [the source navigator](references/patterns.md) for the relevant family or named pattern. Read its **Main article** for applicability/trade-offs and its TypeScript page for **Usage in TypeScript** and **Code example** before attributing specific implementation advice to that source. Those last two links are anchors in one page, not separate documents. If retrieval fails, disclose the gap and distinguish general reasoning from verified source guidance.
- Adapt roles to TypeScript: structural interfaces and function values often replace nominal hierarchies; a tagged union can model a closed set of states or nodes. Class-based examples are instructional, not a requirement to introduce classes. Do not equate a generic factory function with GoF Factory Method, GoF Decorator with TypeScript decorator syntax, or GoF Proxy with JavaScript `Proxy`.
- Keep implementation inside the requested boundary. A pattern does not authorize new dependencies, global registries, provider calls, contract changes, or adjacent rewrites. For library/compiler/host API details, use the project's current official-documentation workflow; Refactoring.Guru is a design reference, not an API compatibility guarantee.
- Validate the behavior that matters: substitution, state transitions, dispatch coverage, composition order, resource disposal, error propagation or undo/stale-source rules, as applicable. Do not use pattern-shaped class structure as proof of correctness.

A useful answer names the pressure, chosen approach (including “no new pattern”), simpler alternative, trade-off, relevant source links, and the actual validation performed or still needed. Scale that explanation to the request.

## Coexistence

This skill adds pattern-selection reasoning; it does not replace the surrounding workflow. Read [routing boundaries](references/routing.md) only when another skill appears to overlap. In particular, React rendering/composition belongs to the React skill, public contracts to interface design, simplification to the simplification workflow, and quality/security acceptance to review. Specification authoring/refinement/EPIC scoring stays with SpecTorque's product skills. Do not invoke unrelated workflows merely because a pattern has an architectural name.

In SpecTorque, preserve the host-independent core and thin adapters. A design-pattern suggestion does not establish semantic preservation, scientific acceptance, a better heuristic score, or permission to write imported specifications.

## Source use

Based on the [Refactoring.Guru TypeScript catalog](https://refactoring.guru/design-patterns/typescript), consulted 2026-11-16. The navigator records catalog links, not a claim that every linked article has been read. The selection cautions are original engineering guidance. Do not reproduce the site's tutorials, diagrams, or code wholesale; attribute and link the relevant source. Check upstream terms before reusing actual source code. This project skill lives in `.agents/skills`, separate from the three distributed product skills in `skills/`.
