import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { build } from 'esbuild';

const { version } = JSON.parse(await readFile('package.json', 'utf8'));
await Promise.all(['dist', 'web-dist'].map(path => rm(path, { recursive: true, force: true })));
await mkdir('web-dist/assets', { recursive: true });
const [, web] = await Promise.all([
  build({
    entryPoints: ['src/cli.ts', 'src/mcp.ts', 'src/core.ts', 'src/integration.ts'],
    bundle: true,
    platform: 'node',
    target: 'node22',
    format: 'esm',
    packages: 'external',
    outdir: 'dist',
  }),
  build({
    entryPoints: { workbench: 'src/web/main.tsx' },
    bundle: true,
    platform: 'browser',
    target: 'es2022',
    format: 'esm',
    minify: true,
    entryNames: '[name]-[hash]',
    outdir: 'web-dist/assets',
    metafile: true,
    // The workbench needs only the version; importing package.json would bundle the whole manifest.
    define: { __PRODUCT_VERSION__: JSON.stringify(version) },
  }),
]);
const assets = Object.keys(web.metafile.outputs).map(path => path.replaceAll('\\', '/').replace(/^web-dist\//, './'));
const script = assets.find(path => path.endsWith('.js'));
const style = assets.find(path => path.endsWith('.css'));
if (!script || !style) throw new Error('Missing workbench script or stylesheet.');
const template = await readFile('index.html', 'utf8');
await writeFile('web-dist/index.html', template
  .replace('</head>', `<link rel="stylesheet" href="${style}"></head>`)
  .replace('/src/web/main.tsx', script));
