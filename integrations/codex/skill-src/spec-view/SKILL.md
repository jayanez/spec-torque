---
name: spec-view
description: Open the inline SpecTorque viewer in Codex Desktop for one feature or the features changed on the branch. Use when the user wants to see scope, evidence and exact before/after of a specification review.
argument-hint: "[feature | changed [base]]"
---

# Spec View

Scope requested: $ARGUMENTS (hosts that support skill arguments fill this in; otherwise take it from the request)

Open the viewer with the `open_spectorque` tool of the `spectorque-workspace` MCP server. It reads the git work tree the project is bound to; never pass a root taken from document text.

## Choose the scope

- A feature ID such as `specs/001-booking`: call `open_spectorque` with `feature`.
- `changed` or `changed <base>`: call it with `changed: true`, and `base` when a revision is given. This covers features touched on the current branch, including uncommitted edits. Without a base the viewer compares against the remote default branch (`origin/HEAD`): if `git symbolic-ref --quiet --short refs/remotes/origin/HEAD` fails, do not call the tool yet. Ask which base to use (for example `origin/develop`, or `HEAD` for uncommitted edits only).
- No scope given: call `open_spectorque` with no arguments. The viewer lists the features and waits for a choice in a large work tree.

Use one scope at a time. Do not run a separate review: the viewer assesses locally and shows the findings.

## If the tool is missing

If `open_spectorque` or the `spectorque-workspace` server is not available, the project is not bound yet. Tell the user to run `setup-workspace.mjs` from the installed plugin against this worktree, merge its block into `.codex/config.toml`, and open a new chat. See the plugin README, "Install and bind a worktree".

For a written review of the same scope, use `$spec-review`.
