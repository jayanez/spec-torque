import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
const result = spawnSync(process.execPath, [resolve('node_modules/@vscode/vsce/vsce'), 'package', '--no-dependencies', '--out', resolve('artifacts/spectorque-0.1.0.vsix')], { cwd: resolve('integrations/vscode'), stdio: 'inherit' });
if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
