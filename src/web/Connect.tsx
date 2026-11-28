import type { Language } from '../core/types.js';

type Host = { name: string; surface: [string, string]; install: string[]; then: [string, string] };

// Install routes documented in README.md#install and docs/integrations.md. The version comes from the
// package manifest so the cards never drift from the release they ship in.
const PRODUCT_VERSION = __PRODUCT_VERSION__;
const hosts: Host[] = [
  { name: 'Claude Code', surface: ['Plugin + native Mod', 'Plugin + Mod nativo'],
    install: ['claude plugin marketplace add jayanez/spec-torque', 'claude plugin install spectorque@spectorque'],
    then: ['Run /spectorque', 'Ejecuta /spectorque'] },
  { name: 'Codex', surface: ['Plugin + inline viewer', 'Plugin + visor integrado'],
    install: ['codex plugin marketplace add jayanez/spec-torque', 'codex plugin add spectorque@spectorque'],
    then: [
      'Trust the local worktree, choose $spec-setup from the $ menu, confirm the root and approve the protected write. Open a new local chat for $spec-view.',
      'Confía en el worktree local, elige $spec-setup en el menú $, confirma la raíz y autoriza la escritura protegida. Abre un chat local nuevo para $spec-view.',
    ] },
  { name: 'OpenCode', surface: ['Tools + terminal panel', 'Herramientas + panel de terminal'],
    install: [JSON.stringify({ plugins: ['opencode-spectorque@' + PRODUCT_VERSION] })],
    then: ['Add the entry to plugins in ~/.config/opencode/cli.json, restart OpenCode, then /spectorque', 'Añade la entrada a plugins en ~/.config/opencode/cli.json, reinicia OpenCode y luego /spectorque'] },
  { name: 'Pi / ThinkRail', surface: ['Commands + widgets', 'Comandos + widgets'],
    install: ['pi install npm:pi-spectorque@' + PRODUCT_VERSION],
    then: ['Or install pi-spectorque from ThinkRail’s extensions; then /spectorque', 'O instala pi-spectorque desde las extensiones de ThinkRail; luego /spectorque'] },
  { name: 'VS Code', surface: ['Extension + workbench panel', 'Extensión + banco de trabajo'],
    install: ['code --install-extension jayanez.spectorque --pre-release'],
    then: ['Run SpecTorque: Open Specification Workbench', 'Ejecuta SpecTorque: Open Specification Workbench'] },
];

const slug = (name: string) => name.toLowerCase().replace(/[^a-z]+/g, '-');

const mcp = (command: string, args: string[], env?: Record<string, string>) =>
  JSON.stringify({ mcpServers: { spectorque: { command, args, ...(env ? { env } : {}) } } }, null, 2);

export function Connect({ language }: { language: Language }) {
  const es = language === 'es';
  const pick = ([en, sp]: [string, string]) => es ? sp : en;
  return <main className="single">
    <h1>{es ? 'El mismo motor, en tu entorno' : 'One engine, in your environment'}</h1>
    <p>{es ? `Las integraciones comparten análisis y evidencias. SpecTorque ${PRODUCT_VERSION} es una versión preliminar; consulta la matriz de versiones probadas antes de instalar.` : `Integrations share the same analysis and evidence. SpecTorque ${PRODUCT_VERSION} is a prerelease; consult the tested-version matrix before installing.`}</p>
    <div className="integration-grid">{hosts.map(host => <article key={host.name} aria-labelledby={'connect-' + slug(host.name)}>
      <h2 id={'connect-' + slug(host.name)}>{host.name}</h2>
      <p>{pick(host.surface)}</p>
      <pre>{host.install.join('\n')}</pre>
      <p className="integration-then">{pick(host.then)}</p>
    </article>)}</div>
    <h2>{es ? 'Servidor MCP' : 'MCP server'}</h2>
    <p>{es ? 'Desde npm, en cualquier cliente MCP:' : 'From npm, in any MCP client:'}</p>
    <pre>{mcp('npx', ['-y', 'spectorque@' + PRODUCT_VERSION, 'mcp'])}</pre>
    <p>{es ? 'Desde una copia local del repositorio:' : 'From a local checkout:'}</p>
    <pre>{mcp('node', ['/absolute/path/to/spectorque/dist/mcp.js'], { SPECTORQUE_ROOT: '/absolute/path/to/your/project' })}</pre>
    <p>{es ? 'Las propuestas no escriben archivos a través de MCP. Revisa y aplica en el banco de trabajo o con las herramientas de edición de tu agente.' : 'MCP proposals do not write files. Review and apply in the workbench or through your agent’s own editing tools.'}</p>
  </main>;
}
