# SpecTorque in Codex Desktop

The package includes the inline viewer, project MCP server, skills and local workbench. Use Node 22.20 or later. The desktop scenario uses a local project or worktree.

## Install and bind a worktree

1. Add this repository's marketplace and install the plugin:

   ```sh
   codex plugin marketplace add jayanez/spec-torque
   codex plugin add spectorque@spectorque --json
   ```

   The catalog installs the `spectorque-codex` npm package. Use the emitted `installedPath` in step 3. For an offline install, verify the release ZIP against its SHA-256 and extract it into a local marketplace directory, for example as `plugins/spectorque`, with this `.agents/plugins/marketplace.json` at the marketplace root:

   ```json
   {
     "name": "spectorque-local",
     "plugins": [{
       "name": "spectorque",
       "source": { "source": "local", "path": "./plugins/spectorque" },
       "policy": { "installation": "AVAILABLE", "authentication": "ON_INSTALL" },
       "category": "Developer Tools"
     }]
   }
   ```

2. For the offline route, run `codex plugin marketplace add .` and `codex plugin add spectorque@spectorque-local --json` from that marketplace root. Either route supplies the skills. The MCP connection comes from the trusted project.
3. Run `node /path/to/installed/plugin/setup-workspace.mjs /path/to/trusted/worktree [feature-id]`, quoting paths as needed. Merge its MCP block into that worktree’s `.codex/config.toml`. Replace any previous SpecTorque block for this server so the key is declared once. Create `.codex/environments/environment.toml` with the printed content, or merge the printed action into the existing file. Replace any previous **Open SpecTorque workbench** action and keep your other actions and setup script. Run setup once per worktree, including each linked worktree, and apply both blocks there. The script prints the configuration and a terminal fallback. On Windows it prints the fallback without an environment action. With a feature ID, the action and fallback open on that feature.
4. Open a new local chat in the trusted project in Codex Desktop. Type `$spec-view` (optionally `$spec-view specs/001-booking` or `$spec-view changed`); the skill calls `open_spectorque` from the local `spectorque-workspace` server, which you can also ask for directly. Codex has no plugin slash commands, and either route takes one model turn. The inline viewer opens with **All documents** and supports feature selection and exact source evidence. Testing the opening turn uses disposable documents.

## Open the workbench

Use one workbench per worktree. If one is already running, reuse it or stop it before switching launch methods. The workbench opens at `/` in the integrated browser.

| Launch | Open | Stop |
| --- | --- | --- |
| **Environment action** (recommended with approval-based permissions) | In a local chat, press **⌘K**, search for **Open SpecTorque workbench** and select **Run: Open SpecTorque workbench** under **Project**. Click the printed URL in the integrated terminal. The action runs in that terminal outside the model sandbox and takes no model turn. | Press **Ctrl+C** in the action's terminal, close its terminal tab, or archive the chat. |
| **Optional skill** (convenient with **Full access**) | In a local chat invoke `$spec-workbench`. It takes one model turn and opens the URL with `@Browser` when available. Under **Ask for approval**, the sandbox can deny the listener and Desktop can offer **Allow once**. If it finds an existing workbench for this worktree, it asks before reusing it. | For a skill-launched process, verify its command and worktree with `ps -p <PID> -o command=`, then run `kill -TERM <PID>`. When reusing a process, follow the original launcher's stop method. |

In the tested Desktop version the action needed a click on the terminal URL, and no action button appeared in the header. Switching chats left the action running. Closing the Desktop window with the server active was untested. [Desktop qualification](../../docs/codex-desktop-probe.md#workbench-launch-in-codex-desktop-2026-11-28-issue-116)

## Review and export

Open **Preview a change**, enter the proposed line and inspect the exact diff. For a proposal from the inline viewer, open the running workbench’s loopback URL with `?review=1` in the integrated browser. Copy the data from **Review in local workbench**. Paste it, verify the review and explicitly approve or reject the displayed change. Refresh the original scope in Codex after approval. A stale or different worktree review is rejected.

Use **Export in local workbench** to select the scope data and paste it into the same loopback URL with `?export=1`. Download JSON or ZIP there. Export checks the worktree and revision. Refresh and copy a new selection if the revision changed.

## Update and remove

On update, run `codex plugin marketplace upgrade spectorque` and reinstall the plugin (offline: verify and extract the replacement ZIP into the marketplace source and reinstall). Re-run setup against the new installed path, replace the MCP block and action command for each worktree, and start a new local chat. To remove the integration for a worktree, stop the workbench using the method in the table, remove its `spectorque-workspace` block and **Open SpecTorque workbench** action, and open a new chat. When the plugin is no longer needed, run `codex plugin remove spectorque@spectorque` and `codex plugin marketplace remove spectorque` (offline: `spectorque@spectorque-local` and `spectorque-local`).
