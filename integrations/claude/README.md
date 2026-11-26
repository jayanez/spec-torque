# SpecTorque for Claude Code

A native Mod pane, three author/review/refine skills and six read-only MCP tools, all backed by the shared SpecTorque engine.

## Install

```sh
claude plugin marketplace add jayanez/spec-torque
claude plugin install spectorque@spectorque
```

Or in one step inside a session: `/plugin install spectorque --marketplace jayanez/spec-torque`. Then run `/spectorque [feature | folder | --changed [base]]` in a project. The pane runs `node` from `PATH`, which must be Node 22.20+. In the Claude Desktop Code tab, send the first message of a new session before typing `/spectorque`.

For an offline install, load a release archive for one session with `claude --plugin-dir /absolute/path/to/spectorque-claude-<version>.zip`.

## What it does

The pane shows heuristic evidence and requires reviewed differences before writing. No model is called by the pane. The MCP tools never write files. See the repository's [integration guide](https://github.com/jayanez/spec-torque/blob/develop/docs/integrations.md#claude-code) and [compatibility matrix](https://github.com/jayanez/spec-torque/blob/develop/docs/compatibility.md) for the exact observed validation and remaining client qualification.
