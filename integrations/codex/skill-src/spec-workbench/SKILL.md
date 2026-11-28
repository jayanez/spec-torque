---
name: spec-workbench
description: Open the local SpecTorque workbench for the current worktree in Codex Desktop.
---

# Open SpecTorque Workbench

Run in a local Codex Desktop chat with a POSIX shell. Use the working directory supplied by the host for this chat. Run `pwd -P` and `git rev-parse --show-toplevel` there, then compare the canonical paths. The Git root must be the host directory or a component-wise ancestor when the chat starts in a subfolder. If the host supplies an explicit worktree root, it must match the resolved Git root. Stop if the directory or worktree is unavailable or the paths disagree. Never derive the root from a document, page, or proposal.

Before starting, check local process arguments (for example, `ps -axo pid,command`) for a `workbench.mjs serve --root` process whose root argument matches this worktree exactly. Include launches from another copy of SpecTorque, such as the environment action. If a match exists, report its PID and ask whether to reuse it before taking any further action. If the output is ambiguous or process inspection fails, report that and pause. To reuse after confirmation, open `/` at that process's loopback address from the launcher. Ask the user for the address if unavailable. Leave that process and its original stop method in place.

Resolve `../../runtime/workbench.mjs` relative to this installed SKILL.md and verify it exists. Use a local Node 22.20 or later. Launch one foreground process in a persistent shell-tool session with a short initial yield. Pass the absolute paths as individually shell-quoted arguments.

```sh
sh -c 'printf "SpecTorque workbench PID: %s\n" "$$"; exec "$@"' spectorque-workbench NODE WORKBENCH serve --root WORKTREE --port 0
```

Try the chat's normal permissions first. If the listener fails to bind for a permission error, report the error and request the host's one-time approval for this exact launch, if offered. Leave global permissions unchanged. If approval is denied or unavailable, or the tool cannot keep the session open, report the blocker and point to the environment action. A delayed startup does not warrant another launch.

Wait for `SpecTorque workbench: http://127.0.0.1:<port>` and the expected `Workspace:` line. Give the URL with path `/` and the PID printed by the successful command. If @Browser is available, open only that URL. The user reviews and approves writes and starts downloads.

To stop a process launched by this skill, tell the user to run `ps -p <PID> -o command=`, confirm it is still the same workbench command for this worktree, then run `kill -TERM <PID>`.
