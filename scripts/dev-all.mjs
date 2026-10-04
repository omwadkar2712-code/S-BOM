import { execFileSync, spawn, spawnSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const backend = path.join(root, 'backend');
const frontend = path.join(root, 'frontend');
const venvPython = process.platform === 'win32'
  ? path.join(backend, '.venv', 'Scripts', 'python.exe')
  : path.join(backend, '.venv', 'bin', 'python');
const python = existsSync(venvPython) ? venvPython : (process.platform === 'win32' ? 'python' : 'python3');

const env = { ...process.env };
if (!env.CREDENTIAL_KEK) {
  env.CREDENTIAL_KEK = randomBytes(32).toString('base64');
}
env.DATABASE_URL = env.DATABASE_URL || 'postgresql://sbom:sbom@127.0.0.1:5432/sbom';
env.OBJECT_STORAGE_URL = env.OBJECT_STORAGE_URL || 'local://./data/objects';
env.API_ADDR = env.API_ADDR || '127.0.0.1:8080';
env.API_ALLOW_ORIGINS = env.API_ALLOW_ORIGINS || 'http://localhost:5173,http://127.0.0.1:5173';
env.CREDENTIAL_STORE = env.CREDENTIAL_STORE || 'env';
env.VULN_PROVIDER = env.VULN_PROVIDER || 'mitre';
env.PYTHONUNBUFFERED = '1';

const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const uiPort = 5173;

function apiPort() {
  const raw = env.API_ADDR || '127.0.0.1:8080';
  const port = Number(raw.slice(raw.lastIndexOf(':') + 1));
  return Number.isInteger(port) && port > 0 ? port : 8080;
}

function sleep(ms) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

function listProcesses() {
  if (process.platform === 'win32') {
    const script = 'Get-CimInstance Win32_Process | Select-Object ProcessId,ParentProcessId,CommandLine | ConvertTo-Json -Compress';
    const out = execFileSync('powershell.exe', ['-NoProfile', '-Command', script], {
      encoding: 'utf8',
      windowsHide: true,
      maxBuffer: 16 * 1024 * 1024,
    });
    const jsonStart = out.search(/[\[{]/);
    const parsed = JSON.parse(jsonStart >= 0 ? out.slice(jsonStart) : '[]');
    const rows = Array.isArray(parsed) ? parsed : [parsed];
    return rows.filter((row) => row && row.ProcessId).map((row) => ({
      pid: Number(row.ProcessId),
      ppid: Number(row.ParentProcessId) || 0,
      command: String(row.CommandLine || ''),
    }));
  }

  const out = execFileSync('ps', ['-ax', '-o', 'pid=,ppid=,command='], { encoding: 'utf8' });
  return out.split('\n').flatMap((line) => {
    const match = line.trim().match(/^(\d+)\s+(\d+)\s+(.*)$/);
    return match ? [{ pid: Number(match[1]), ppid: Number(match[2]), command: match[3] }] : [];
  });
}

function listeningPids(port) {
  const pids = new Set();
  if (process.platform === 'win32') {
    const out = execFileSync('netstat', ['-ano', '-p', 'tcp'], { encoding: 'utf8', windowsHide: true });
    for (const line of out.split(/\r?\n/)) {
      const parts = line.trim().split(/\s+/);
      const localPort = Number(parts[1]?.match(/:(\d+)$/)?.[1]);
      if (parts[0] !== 'TCP' || parts[3] !== 'LISTENING' || localPort !== port) continue;
      const pid = Number(parts[4]);
      if (pid) pids.add(pid);
    }
    return pids;
  }

  try {
    const out = execFileSync('lsof', ['-nP', `-iTCP:${port}`, '-sTCP:LISTEN', '-t'], { encoding: 'utf8' });
    for (const token of out.split(/\s+/)) {
      const pid = Number(token);
      if (pid) pids.add(pid);
    }
  } catch {
    // lsof exits non-zero when nothing is listening.
  }
  return pids;
}

function isProjectServer(command) {
  const normalized = command.replaceAll('\\', '/').toLowerCase();
  const rootNorm = root.replaceAll('\\', '/').toLowerCase();
  if (!normalized.includes(rootNorm)) return false;
  return normalized.includes('-m app.main')
    || normalized.includes('-m app.worker')
    || normalized.includes('/vite/bin/vite.js');
}

function commandInvocation(command, args) {
  const needsCmd = process.platform === 'win32' && /\.(cmd|bat)$/i.test(command);
  if (!needsCmd) return { command, args };
  return {
    command: process.env.ComSpec || 'cmd.exe',
    args: ['/d', '/s', '/c', command, ...args],
  };
}

function killTree(pid) {
  if (!pid || pid === process.pid) return;
  if (process.platform === 'win32') {
    spawnSync('taskkill', ['/pid', String(pid), '/t', '/f'], { stdio: 'ignore', windowsHide: true });
    return;
  }
  try {
    process.kill(pid, 'SIGTERM');
  } catch {
    // Already gone.
  }
}

function ancestorDevAll(proc, byPid, skip) {
  let current = proc;
  let devAllPid = 0;
  const seen = new Set();
  while (current && !seen.has(current.pid) && !skip.has(current.pid)) {
    seen.add(current.pid);
    if (current.command.includes('dev-all.mjs')) devAllPid = current.pid;
    current = byPid.get(current.ppid);
  }
  return devAllPid;
}

function reclaimStaleDevProcesses() {
  const ports = [apiPort(), uiPort];
  let processes;
  try {
    processes = listProcesses();
  } catch (err) {
    console.log(`[dev:all] could not inspect running processes (${err.message})`);
    return;
  }

  const byPid = new Map(processes.map((proc) => [proc.pid, proc]));
  const skip = new Set([process.pid, process.ppid]);
  const servers = processes.filter((proc) => !skip.has(proc.pid) && isProjectServer(proc.command));
  const serverPids = new Set(servers.map((proc) => proc.pid));
  const killPids = new Set();
  for (const proc of servers) {
    killPids.add(ancestorDevAll(proc, byPid, skip) || proc.pid);
  }

  for (const port of ports) {
    let listeners;
    try {
      listeners = listeningPids(port);
    } catch {
      continue;
    }
    for (const pid of listeners) {
      if (skip.has(pid) || serverPids.has(pid) || killPids.has(pid)) continue;
      const command = byPid.get(pid)?.command || 'unknown process';
      console.error(`[dev:all] port ${port} is already used by pid ${pid}: ${command}`);
      console.error('[dev:all] stop that process, or choose another API_ADDR / Vite port.');
      process.exit(1);
    }
  }

  if (killPids.size === 0) return;
  console.log('[dev:all] stopping leftover dev processes from a previous run');
  for (const pid of killPids) killTree(pid);

  const deadline = Date.now() + 8000;
  while (Date.now() < deadline) {
    const stillListening = ports.some((port) => {
      try {
        for (const pid of listeningPids(port)) {
          if (!skip.has(pid)) return true;
        }
      } catch {
        return false;
      }
      return false;
    });
    if (!stillListening) {
      sleep(300);
      return;
    }
    sleep(200);
  }
}

if (!existsSync(path.join(frontend, 'node_modules'))) {
  console.log('[dev:all] installing frontend dependencies');
  const installCommand = commandInvocation(npm, ['install']);
  const install = spawnSync(installCommand.command, installCommand.args, {
    cwd: frontend,
    env,
    stdio: 'inherit',
  });
  if (install.status !== 0) {
    process.exit(install.status || 1);
  }
}

if (!existsSync(venvPython)) {
  console.log('[dev:all] creating Python virtualenv');
  const venv = spawnSync(python, ['-m', 'venv', path.join(backend, '.venv')], {
    cwd: backend,
    env,
    stdio: 'inherit',
  });
  if (venv.status !== 0) {
    process.exit(venv.status || 1);
  }
}

const pip = spawnSync(existsSync(venvPython) ? venvPython : python, ['-m', 'pip', 'install', '-r', 'requirements.txt'], {
  cwd: backend,
  env,
  stdio: 'inherit',
});
if (pip.status !== 0) {
  process.exit(pip.status || 1);
}

const py = existsSync(venvPython) ? venvPython : python;

console.log(`[dev:all] API    http://127.0.0.1:${apiPort()}`);
console.log(`[dev:all] UI     http://127.0.0.1:${uiPort}`);
console.log(`[dev:all] DB     ${env.DATABASE_URL}`);

reclaimStaleDevProcesses();

const children = [];
let stopping = false;

function prefix(name, stream) {
  let buffer = '';
  stream.on('data', (chunk) => {
    buffer += chunk.toString();
    const lines = buffer.split(/\r?\n/);
    buffer = lines.pop() || '';
    for (const line of lines) {
      if (line.length) console.log(`[${name}] ${line}`);
    }
  });
}

function start(name, command, args, cwd) {
  const invocation = commandInvocation(command, args);
  const child = spawn(invocation.command, invocation.args, {
    cwd,
    env,
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
  });
  prefix(name, child.stdout);
  prefix(name, child.stderr);
  child.on('exit', (code, signal) => {
    if (stopping) return;
    console.log(`[dev:all] ${name} exited (${signal || code})`);
    stop(code || 1);
  });
  children.push(child);
  return child;
}

function stop(code = 0) {
  if (stopping) return;
  stopping = true;
  for (const child of children) killTree(child.pid);
  setTimeout(() => process.exit(code), 400);
}

process.on('SIGINT', () => stop(0));
process.on('SIGTERM', () => stop(0));
if (process.platform === 'win32') process.on('SIGBREAK', () => stop(0));
else process.on('SIGHUP', () => stop(0));

try {
  start('api', py, ['-m', 'app.main'], backend);
  start('worker', py, ['-m', 'app.worker'], backend);
  start('web', npm, ['run', 'dev'], frontend);
} catch (err) {
  console.error(`[dev:all] failed to start: ${err.message}`);
  stop(1);
}
