# R2 reviewer image for the #57 rehearsal: codex-cli pinned, tools and remote apps disabled.
FROM node:22.20.0-bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates && rm -rf /var/lib/apt/lists/* \
 && npm install -g @openai/codex@0.170.0 && npm cache clean --force
COPY reviewer-config.toml /etc/reviewer-config.toml
RUN useradd -m reviewer && mkdir -p /work /in /out && chown reviewer /work /out
USER reviewer
WORKDIR /work
ENTRYPOINT ["/bin/sh", "-c", "mkdir -p \"$CODEX_HOME\" && cp /secrets/auth.json \"$CODEX_HOME/auth.json\" && cp /etc/reviewer-config.toml \"$CODEX_HOME/config.toml\" && exec codex exec --strict-config -s read-only -m gpt-6-luna -c model_reasoning_effort=\"medium\" --skip-git-repo-check -C /work -o /out/answer.txt - < /in/item.txt"]
