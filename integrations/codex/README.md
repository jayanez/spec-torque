# SpecTorque in Codex Desktop

The package includes the inline viewer, project MCP server, review skills and local workbench. Use Node 22.20 or later. The desktop scenario uses a local project or worktree.

## Install and bind a worktree

1. Verify the ZIP against the supplied SHA-256 and extract it into a local marketplace directory, for example as `plugins/spectorque`. Create `.agents/plugins/marketplace.json` at the marketplace root:

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

2. From that marketplace root, run `codex plugin marketplace add .` and `codex plugin add spectorque@spectorque-local --json`. Use the emitted `installedPath` in the next step. The marketplace supplies the skills. The MCP connection comes from the trusted project.
3. Run `node /path/to/installed/plugin/setup-workspace.mjs /path/to/trusted/worktree`, quoting paths as needed. Merge its MCP block into that worktree’s `.codex/config.toml`. Replace any previous SpecTorque block for this server so the key is declared once. For a linked worktree, run this step with its own path. The script also prints the command to start the corresponding workbench.
4. Open a new local chat in the trusted project in Codex Desktop. Invoke `open_spectorque` from the local `spectorque-workspace` server. The inline viewer opens with **All documents** and supports feature selection and exact source evidence. Testing the opening turn uses disposable documents.

## Review and export

Open **Preview a change**, enter the proposed line and inspect the exact diff. To apply, start the workbench using the generated command and open its printed loopback URL plus `?review=1` in the integrated browser. Copy the data from **Review in local workbench**. Paste it, verify the review and explicitly approve or reject the displayed change. Refresh the original scope in Codex after approval. A stale or different worktree review is rejected.

Use **Export in local workbench** to select the scope data and paste it into the same loopback URL with `?export=1`. Download JSON or ZIP there. Export checks the worktree and revision. Refresh and copy a new selection if the revision changed.

## Update and remove

On update, verify and extract the replacement ZIP into the marketplace source and refresh or reinstall the plugin. Re-run setup against the new installed path and start a new local chat. To disable the viewer for a worktree, remove its `spectorque-workspace` block and open a new chat. Stop the workbench from the terminal that launched it. When the plugin is no longer needed, run `codex plugin remove spectorque@spectorque-local` and remove this dedicated marketplace using `codex plugin marketplace remove spectorque-local`.
