# Privacy and trust boundaries

Default operation is local: browser memory and a Node server bound to 127.0.0.1. No analytics, telemetry, tracking pixel, automatic model calls or stored API keys. Refreshing closes the browser's in-memory history; export before leaving.

Local discovery stays under the explicitly selected root. It skips symlinks, hidden dependency/output folders and secret-like paths, limits depth/file count/size, and reads Markdown candidates only. Reports can contain sensitive source excerpts: inspect them before sharing. The tool is not a secret scanner.

Public GitHub import makes explicit unauthenticated requests to api.github.com, resolves a commit and downloads bounded text blobs. It does not execute repository code, install dependencies or use your GitHub credentials. Private repositories are outside this import flow.

Optional provider rewriting sends the selected source line and bounded supplied context to the chosen endpoint. Ollama uses loopback port 11434; OpenAI uses api.openai.com and the key supplied in that session. Keys are held in browser memory, passed only to the local server and never intentionally logged or saved. Host-model mode exports a prompt for the host; the host's own privacy settings govern processing. No provider is contacted until explicitly requested.

Imported text is untrusted data. It may contain hostile instructions. Prompts label it as source data; no model output is executed. Numbers, identifiers and normative words are mechanically checked, but semantic preservation requires review.

The local API checks Host, Origin and a session token, has request bounds and does not enable CORS. This prevents ordinary cross-origin web access; it is not an authentication boundary against another process running as your user. Do not expose the port publicly. Disk writes require explicit actions, source hashes and path validation. A bounded local undo stack can reject undo if the current file changed.

Editable ZIP exports preserve feature-relative paths and reject unsafe or colliding portable paths. They are bounded to 20 MB of source content; select a single feature for larger workspaces. The selected feature scope also controls the exported source collection.
