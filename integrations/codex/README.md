# SpecTorque in Codex Desktop

The package includes the inline viewer, project MCP server, review skills and local workbench. Use Node 22.20 or later. The desktop scenario uses a local project or worktree.

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
3. Run `node /path/to/installed/plugin/setup-workspace.mjs /path/to/trusted/worktree [feature-id]`, quoting paths as needed. Merge its MCP block into that worktree’s `.codex/config.toml`. Replace any previous SpecTorque block for this server so the key is declared once. For a linked worktree, run this step with its own path. The script also prints the command to start the corresponding workbench, with `--feature` when you pass a feature; the workbench loads that feature, or the whole work tree when it fits, as soon as it opens.
4. Open a new local chat in the trusted project in Codex Desktop. Invoke `open_spectorque` from the local `spectorque-workspace` server. The inline viewer opens with **All documents** and supports feature selection and exact source evidence. Testing the opening turn uses disposable documents.

## Review and export

Open **Preview a change**, enter the proposed line and inspect the exact diff. To apply, start the workbench using the generated command and open its printed loopback URL plus `?review=1` in the integrated browser. Copy the data from **Review in local workbench**. Paste it, verify the review and explicitly approve or reject the displayed change. Refresh the original scope in Codex after approval. A stale or different worktree review is rejected.

Use **Export in local workbench** to select the scope data and paste it into the same loopback URL with `?export=1`. Download JSON or ZIP there. Export checks the worktree and revision. Refresh and copy a new selection if the revision changed.

## Update and remove

On update, run `codex plugin marketplace upgrade spectorque` and reinstall the plugin (offline: verify and extract the replacement ZIP into the marketplace source and reinstall). Re-run setup against the new installed path and start a new local chat. To disable the viewer for a worktree, remove its `spectorque-workspace` block and open a new chat. Stop the workbench from the terminal that launched it. When the plugin is no longer needed, run `codex plugin remove spectorque@spectorque` and `codex plugin marketplace remove spectorque` (offline: `spectorque@spectorque-local` and `spectorque-local`).
