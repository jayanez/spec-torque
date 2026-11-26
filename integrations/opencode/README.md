# SpecTorque for OpenCode

## Install

SpecTorque is a terminal-only plugin. Add it to `plugins` in the CLI settings,
`~/.config/opencode/cli.json` (or `$XDG_CONFIG_HOME/opencode/cli.json`), and
restart OpenCode:

```json
{"plugins":["opencode-spectorque@<version>"]}
```

For an offline install, extract the OpenCode release ZIP and add its absolute
directory to the same `plugins` list. Remove the entry and restart the
terminal to uninstall the adapter.

## Use

Run `/spectorque` in an existing session to analyze its local workspace.
The home screen displays the summary in a dialog. With the panel focused,
press **s** to select a feature, **e** to inspect its source evidence, **r** to
review a proposed line change, **w** to get the common workbench URL, or **q**
to close the panel. `/spectorque-review` also opens the review flow. The
workbench binds to local loopback. Load the workspace and select the scope
shown in the terminal before exporting. Reconnect and rerun `/spectorque`
if the session becomes unavailable.

The package contains the TUI entry, shared runtime and web assets. The TUI
works with the local filesystem of the terminal client and requires no model
turn. Installation tests and platform limits are recorded in the repository's
[compatibility matrix](https://github.com/jayanez/spec-torque/blob/develop/docs/compatibility.md).
