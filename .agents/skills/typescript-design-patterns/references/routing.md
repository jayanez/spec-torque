# Routing boundaries and overlap check

Checked 2026-11-16 against the repository's three product skills and the locally available workflow skills. No duplicate `typescript-design-patterns` name was found. This defines intended routing; it is not a guarantee that automatic model selection will never overlap.

| Request | Primary workflow | Role of this skill |
|---|---|---|
| Compare Strategy and State for a TypeScript domain object | TypeScript design patterns | Explain the change pressure, alternatives and trade-offs. |
| Explain Visitor with a small TypeScript example | TypeScript design patterns | Read the relevant source pages; provide an original example when requested. |
| Remove duplication from a working TypeScript function | Code simplification | Use only if a concrete pattern choice becomes relevant; do not introduce one automatically. |
| Design a public API or change a versioned contract | API and interface design | Optional pattern comparison; it does not own compatibility policy. |
| Reduce boolean props in React components | React composition / frontend UI | Do not replace component composition with GoF class hierarchies. |
| Audit a TypeScript diff for correctness or security | Code review / security | Supplement only a relevant pattern finding; not a substitute for review. |
| Apply Strategy in Java or C# | Matching Java/C# pattern skill | No TypeScript activation merely because the pattern name matches. |
| Author, assess or refine specifications / EPIC results | spec-author / spec-review / spec-refine | No architecture changes or scoring claims from this skill. |

These workflows may cooperate when the actual task spans their responsibilities. They do not form a mandatory invocation chain. Existing owner instructions and validation gates remain in force; this skill introduces no ADR gate, approval flow or requirement to adopt a pattern.

Installation boundary: `.agents/skills/typescript-design-patterns` is a developer skill discoverable in this repository. `skills/spec-*` are product skills copied into host packages and disposable example projects. Keep those collections separate; do not add a fourth product skill or change packaging to install this one globally.
