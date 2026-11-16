# SpecTorque for OpenCode

Build and package the repository, then add this directory to `cli.json`: `{"plugins":["/absolute/spectorque/integrations/opencode"]}`. The public V2 TUI entry exports `/spectorque` for scores and `/spectorque-review` for evidence and reviewed refinements. The active-session panel and home-screen dialog share the same engine. No model call is needed. Consult the repository's compatibility matrix for exercised client versions and remaining acceptance checks.
