# SpecTorque for OpenCode

Extract the OpenCode ZIP and add the absolute directory containing its
`package.json` to `plugins` in the terminal client's `cli.json`. On OpenCode
2.1.4, this setting covers the CLI profile, using
`$XDG_CONFIG_HOME/opencode/cli.json` when XDG is configured. Remove the entry
and restart the terminal to uninstall the adapter.

Run `/spectorque` in an existing session to analyze its local workspace.
The home screen displays the summary in a dialog. With the panel focused,
press **s** to select a feature, **e** to inspect its source evidence, **r** to
review a proposed line change, **w** to get the common workbench URL, or **q**
to close the panel. `/spectorque-review` also opens the review flow. The
workbench binds to local loopback. Load the workspace and select the scope
shown in the terminal before exporting. Reconnect and rerun `/spectorque`
if the session becomes unavailable.

The archive contains the TUI entry, shared runtime and web assets. The TUI
works with the local filesystem of the terminal client and requires no model
turn. Installation tests and platform limits are recorded in the repository's
compatibility matrix.
