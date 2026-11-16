# Pattern source navigator and TypeScript decisions

Source: [Refactoring.Guru — Design Patterns in TypeScript](https://refactoring.guru/design-patterns/typescript), catalog checked 2026-11-16. It lists **22** patterns: five creational, seven structural, ten behavioral. Interpreter is not listed there; do not invent an upstream TypeScript example for it.

The table preserves names and the three source entrypoints. Read only the row relevant to the task. Usage and example fragments share a page: fetch that page once and inspect the corresponding sections. Catalog links were retrieved; that does not establish full article coverage or runtime execution of examples. No upstream code or images are bundled here.

## Creational

| Pattern | Main article | Usage in TypeScript | Code example |
|---|---|---|---|
| Abstract Factory | [Article](https://refactoring.guru/design-patterns/abstract-factory) | [Usage](https://refactoring.guru/design-patterns/abstract-factory/typescript/example#lang-features) | [Example](https://refactoring.guru/design-patterns/abstract-factory/typescript/example#example-0) |
| Builder | [Article](https://refactoring.guru/design-patterns/builder) | [Usage](https://refactoring.guru/design-patterns/builder/typescript/example#lang-features) | [Example](https://refactoring.guru/design-patterns/builder/typescript/example#example-0) |
| Factory Method | [Article](https://refactoring.guru/design-patterns/factory-method) | [Usage](https://refactoring.guru/design-patterns/factory-method/typescript/example#lang-features) | [Example](https://refactoring.guru/design-patterns/factory-method/typescript/example#example-0) |
| Prototype | [Article](https://refactoring.guru/design-patterns/prototype) | [Usage](https://refactoring.guru/design-patterns/prototype/typescript/example#lang-features) | [Example](https://refactoring.guru/design-patterns/prototype/typescript/example#example-0) |
| Singleton | [Article](https://refactoring.guru/design-patterns/singleton) | [Usage](https://refactoring.guru/design-patterns/singleton/typescript/example#lang-features) | [Example](https://refactoring.guru/design-patterns/singleton/typescript/example#example-0) |

Before building a hierarchy, compare a typed options object or factory function. Reserve a builder for construction constraints that an options object cannot express clearly. Keep singleton lifetime and reset/isolation explicit; a module variable is not automatically one instance across workers or bundles. Object spread and `structuredClone` do not by themselves preserve class-specific clone semantics.

## Structural

| Pattern | Main article | Usage in TypeScript | Code example |
|---|---|---|---|
| Adapter | [Article](https://refactoring.guru/design-patterns/adapter) | [Usage](https://refactoring.guru/design-patterns/adapter/typescript/example#lang-features) | [Example](https://refactoring.guru/design-patterns/adapter/typescript/example#example-0) |
| Bridge | [Article](https://refactoring.guru/design-patterns/bridge) | [Usage](https://refactoring.guru/design-patterns/bridge/typescript/example#lang-features) | [Example](https://refactoring.guru/design-patterns/bridge/typescript/example#example-0) |
| Composite | [Article](https://refactoring.guru/design-patterns/composite) | [Usage](https://refactoring.guru/design-patterns/composite/typescript/example#lang-features) | [Example](https://refactoring.guru/design-patterns/composite/typescript/example#example-0) |
| Decorator | [Article](https://refactoring.guru/design-patterns/decorator) | [Usage](https://refactoring.guru/design-patterns/decorator/typescript/example#lang-features) | [Example](https://refactoring.guru/design-patterns/decorator/typescript/example#example-0) |
| Facade | [Article](https://refactoring.guru/design-patterns/facade) | [Usage](https://refactoring.guru/design-patterns/facade/typescript/example#lang-features) | [Example](https://refactoring.guru/design-patterns/facade/typescript/example#example-0) |
| Flyweight | [Article](https://refactoring.guru/design-patterns/flyweight) | [Usage](https://refactoring.guru/design-patterns/flyweight/typescript/example#lang-features) | [Example](https://refactoring.guru/design-patterns/flyweight/typescript/example#example-0) |
| Proxy | [Article](https://refactoring.guru/design-patterns/proxy) | [Usage](https://refactoring.guru/design-patterns/proxy/typescript/example#lang-features) | [Example](https://refactoring.guru/design-patterns/proxy/typescript/example#example-0) |

Locate the actual incompatibility before adding an Adapter; a Facade simplifies an existing boundary, while a Bridge separates independently varying concerns. Decorator/Proxy wrappers must preserve the required contract, cancellation and errors; wrapping must not silently add network calls or retries. Require measured allocation pressure before introducing Flyweight sharing, and make shared state immutable or explicitly owned.

## Behavioral

| Pattern | Main article | Usage in TypeScript | Code example |
|---|---|---|---|
| Chain of Responsibility | [Article](https://refactoring.guru/design-patterns/chain-of-responsibility) | [Usage](https://refactoring.guru/design-patterns/chain-of-responsibility/typescript/example#lang-features) | [Example](https://refactoring.guru/design-patterns/chain-of-responsibility/typescript/example#example-0) |
| Command | [Article](https://refactoring.guru/design-patterns/command) | [Usage](https://refactoring.guru/design-patterns/command/typescript/example#lang-features) | [Example](https://refactoring.guru/design-patterns/command/typescript/example#example-0) |
| Iterator | [Article](https://refactoring.guru/design-patterns/iterator) | [Usage](https://refactoring.guru/design-patterns/iterator/typescript/example#lang-features) | [Example](https://refactoring.guru/design-patterns/iterator/typescript/example#example-0) |
| Mediator | [Article](https://refactoring.guru/design-patterns/mediator) | [Usage](https://refactoring.guru/design-patterns/mediator/typescript/example#lang-features) | [Example](https://refactoring.guru/design-patterns/mediator/typescript/example#example-0) |
| Memento | [Article](https://refactoring.guru/design-patterns/memento) | [Usage](https://refactoring.guru/design-patterns/memento/typescript/example#lang-features) | [Example](https://refactoring.guru/design-patterns/memento/typescript/example#example-0) |
| Observer | [Article](https://refactoring.guru/design-patterns/observer) | [Usage](https://refactoring.guru/design-patterns/observer/typescript/example#lang-features) | [Example](https://refactoring.guru/design-patterns/observer/typescript/example#example-0) |
| State | [Article](https://refactoring.guru/design-patterns/state) | [Usage](https://refactoring.guru/design-patterns/state/typescript/example#lang-features) | [Example](https://refactoring.guru/design-patterns/state/typescript/example#example-0) |
| Strategy | [Article](https://refactoring.guru/design-patterns/strategy) | [Usage](https://refactoring.guru/design-patterns/strategy/typescript/example#lang-features) | [Example](https://refactoring.guru/design-patterns/strategy/typescript/example#example-0) |
| Template Method | [Article](https://refactoring.guru/design-patterns/template-method) | [Usage](https://refactoring.guru/design-patterns/template-method/typescript/example#lang-features) | [Example](https://refactoring.guru/design-patterns/template-method/typescript/example#example-0) |
| Visitor | [Article](https://refactoring.guru/design-patterns/visitor) | [Usage](https://refactoring.guru/design-patterns/visitor/typescript/example#lang-features) | [Example](https://refactoring.guru/design-patterns/visitor/typescript/example#example-0) |

A Strategy can be a typed function; it does not require a class per algorithm. A closed State model often fits a discriminated union and exhaustive transitions. Prefer native iterables/generators before a custom Iterator hierarchy. Observer needs subscription disposal and an explicit error policy; Command/Memento need bounded history and an honest account of which external effects can be undone. Do not introduce Mediator merely to centralize already-simple calls, or inheritance-based Template Method when function composition is enough.

### Visitor: verified worked reading

Both the [main article](https://refactoring.guru/design-patterns/visitor) and [TypeScript page](https://refactoring.guru/design-patterns/visitor/typescript/example) were read on 2026-11-16. Visitor is useful when element kinds are comparatively stable and new operations are frequent. Adding an element kind affects the visitors; adopting the pattern can require an initial change to existing elements. In the example, each element's `accept` method selects its corresponding visitor method. TypeScript overload declarations do not supply runtime double dispatch. For a small tagged-union model, compare an exhaustive function before introducing visitors. The page demonstrates structure, not asynchronous execution, resource safety, or SpecTorque acceptance.

The cautions above are original TypeScript engineering judgments, not copied tutorial text or claims that every linked example was tested.
