import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const backend = path.join(root, 'backend');
const venvPython = process.platform === 'win32'
  ? path.join(backend, '.venv', 'Scripts', 'python.exe')
  : path.join(backend, '.venv', 'bin', 'python');

let python = existsSync(venvPython) ? venvPython : (process.platform === 'win32' ? 'py' : 'python3');

const action = process.argv[2];
const scriptName = action === 'import' ? 'import_db.py' : 'export_db.py';
const scriptPath = path.join(root, 'scripts', scriptName);

const env = { ...process.env };
env.DATABASE_URL = env.DATABASE_URL || 'postgresql://sbom:123456789@127.0.0.1:5432/S-BOM';
env.PGPASSWORD = env.PGPASSWORD || '123456789';
env.PGDATABASE = env.PGDATABASE || 'S-BOM';
env.PGUSER = env.PGUSER || 'sbom';

const result = spawnSync(python, [scriptPath], {
  cwd: root,
  stdio: 'inherit',
  env,
});

process.exit(result.status ?? 0);
