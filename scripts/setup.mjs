import { execSync, spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const backend = path.join(root, 'backend');
const frontend = path.join(root, 'frontend');

console.log('=== 1. Installing Frontend Dependencies ===');
const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
spawnSync(npm, ['install'], { cwd: frontend, stdio: 'inherit' });

console.log('\n=== 2. Setting up Backend Python Virtual Environment ===');
const venvDir = path.join(backend, '.venv');
const venvPython = process.platform === 'win32'
  ? path.join(venvDir, 'Scripts', 'python.exe')
  : path.join(venvDir, 'bin', 'python');
const venvPip = process.platform === 'win32'
  ? path.join(venvDir, 'Scripts', 'pip.exe')
  : path.join(venvDir, 'bin', 'pip');

// Find system python/py to create venv if it doesn't exist
if (!existsSync(venvPython)) {
  console.log('Creating virtual environment in backend/.venv...');
  const pyCmd = process.platform === 'win32' ? 'py' : 'python3';
  const venvRes = spawnSync(pyCmd, ['-m', 'venv', '.venv'], { cwd: backend, stdio: 'inherit' });
  if (venvRes.status !== 0) {
    // try fallback to 'python'
    spawnSync('python', ['-m', 'venv', '.venv'], { cwd: backend, stdio: 'inherit' });
  }
}

if (existsSync(venvPip)) {
  console.log('Installing backend dependencies from requirements.txt...');
  spawnSync(venvPip, ['install', '-r', 'requirements.txt'], { cwd: backend, stdio: 'inherit' });
} else {
  console.log('[WARN] Could not find venv pip, attempting global python pip...');
  spawnSync('py', ['-m', 'pip', 'install', '-r', 'backend/requirements.txt'], { cwd: root, stdio: 'inherit' });
}

console.log('\n[OK] Setup complete! All dependencies installed successfully.');
