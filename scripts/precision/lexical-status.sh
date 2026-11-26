#!/usr/bin/env bash
# Count P2.2 and P1.4 statuses over the local fixture feature sets (docs/research.md).
# Run from the repository root: bash scripts/precision/lexical-status.sh
set -euo pipefail
for w in fixtures/calibration/*/*/ fixtures/en-complete fixtures/en-draft fixtures/es-draft; do
  node --import tsx src/cli.ts discover "$w" --json |
    node -e 'const d=JSON.parse(require("fs").readFileSync(0));const f=[...new Set(d.artifacts.filter(a=>a.role==="spec"&&!a.archived).map(a=>a.featureId))];console.log(f.length>1?f.join("\n"):"")' |
    while read -r f; do node --import tsx src/cli.ts analyze "$w" --json ${f:+--feature "$f"}; echo; done
done | node -e 'const r=require("fs").readFileSync(0,"utf8").split(/\n(?=\{)/).filter(s=>s.trim()).map(JSON.parse);const c={};for(const a of r)for(const p of a.practices)if(["P2.2","P1.4"].includes(p.practiceId??p.id)){const k=(p.practiceId??p.id)+" "+p.status;c[k]=(c[k]||0)+1};console.log(r.length,c)'
