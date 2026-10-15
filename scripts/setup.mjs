import { execSync, spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const backend = path.join(root, 'backend');
const frontend = path.join(root, 'frontend');

console.log('=== 1. Installing Frontend Dependencies ===');
const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const feRes = spawnSync(npm, ['install'], {
  cwd: frontend,
  stdio: 'inherit',
  shell: process.platform === 'win32',
});
if (feRes.status !== 0) {
  console.error('\n[ERROR] Frontend installation failed.');
  process.exit(feRes.status ?? 1);
}

console.log('\n=== 2. Setting up Backend Python Virtual Environment ===');
const venvDir = path.join(backend, '.venv');
const venvPython = process.platform === 'win32'
  ? path.join(venvDir, 'Scripts', 'python.exe')
  : path.join(venvDir, 'bin', 'python');
const venvPip = process.platform === 'win32'
  ? path.join(venvDir, 'Scripts', 'pip.exe')
  : path.join(venvDir, 'bin', 'pip');

// Find system python/py/uv to create venv if it doesn't exist
if (!existsSync(venvPython)) {
  console.log('Creating virtual environment in backend/.venv...');
  const pyCandidates = process.platform === 'win32' ? ['python', 'py', 'python3', 'uv'] : ['python3', 'python', 'uv'];
  let created = false;
  for (const candidate of pyCandidates) {
    try {
      const args = candidate === 'uv' ? ['venv', '.venv'] : ['-m', 'venv', '.venv'];
      const res = spawnSync(candidate, args, { cwd: backend, stdio: 'inherit', shell: process.platform === 'win32' });
      if (res.status === 0 && existsSync(venvPython)) {
        created = true;
        break;
      }
    } catch {
      // try next candidate
    }
  }
  if (!created && !existsSync(venvPython)) {
    console.error('\n[ERROR] Could not create virtual environment. Please ensure Python is installed.');
    process.exit(1);
  }
}

if (existsSync(venvPip)) {
  console.log('Installing backend dependencies from requirements.txt...');
  const beRes = spawnSync(venvPip, ['install', '-r', 'requirements.txt'], { cwd: backend, stdio: 'inherit' });
  if (beRes.status !== 0) {
    console.error('\n[ERROR] Backend dependency installation failed.');
    process.exit(beRes.status ?? 1);
  }
} else {
  console.log('[WARN] Could not find venv pip, attempting global python pip...');
  const res = spawnSync('python', ['-m', 'pip', 'install', '-r', path.join(backend, 'requirements.txt')], {
    cwd: root,
    stdio: 'inherit',
    shell: process.platform === 'win32',
  });
  if (res.status !== 0) {
    console.error('\n[ERROR] Backend dependency installation failed.');
    process.exit(res.status ?? 1);
  }
}

console.log('\n[OK] Setup complete! All dependencies installed successfully.');
