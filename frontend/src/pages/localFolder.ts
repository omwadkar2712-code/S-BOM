export interface FolderFile {
  file: File;
  relativePath: string;
}

const SKIP_DIRS = new Set([
  '.git', 'node_modules', 'vendor', 'venv', '.venv', 'dist', 'target', 'build',
  '__pycache__', '.gradle',
]);

const MANIFEST_NAMES = new Set([
  'package.json', 'package-lock.json', 'npm-shrinkwrap.json', 'yarn.lock', 'pnpm-lock.yaml',
  'requirements.txt', 'pyproject.toml', 'poetry.lock', 'pipfile', 'pipfile.lock',
  'pom.xml', 'go.mod', 'go.sum', 'cargo.toml', 'cargo.lock',
  'packages.config', 'packages.lock.json', 'composer.json', 'composer.lock',
  'gemfile', 'gemfile.lock', 'build.gradle', 'build.gradle.kts',
  'settings.gradle', 'settings.gradle.kts', 'gradle.lockfile',
]);

export function isManifestRelativePath(rel: string): boolean {
  const base = rel.split('/').filter(Boolean).pop() || '';
  const lower = base.toLowerCase();
  if (MANIFEST_NAMES.has(lower)) return true;
  return lower.endsWith('.csproj') || lower.endsWith('.vbproj') || lower.endsWith('.fsproj');
}

export function isArchiveName(name: string): boolean {
  const lower = name.toLowerCase();
  return lower.endsWith('.zip') || lower.endsWith('.tgz') || lower.endsWith('.tar.gz');
}

export function isInsideSkippedDir(rel: string): boolean {
  const parts = rel.replace(/\\/g, '/').split('/').filter(Boolean);
  return parts.slice(0, -1).some((part) => SKIP_DIRS.has(part.toLowerCase()));
}

export function selectFolderManifests(items: FolderFile[]): FolderFile[] {
  return items.filter((item) => {
    const rel = item.relativePath.replace(/\\/g, '/');
    return rel !== '' && !isInsideSkippedDir(rel) && isManifestRelativePath(rel);
  });
}

export function folderLabel(items: FolderFile[]): string {
  const first = items[0]?.relativePath.replace(/\\/g, '/').split('/')[0] || 'folder';
  const noun = items.length === 1 ? 'manifest' : 'manifests';
  return `${first} (${items.length} ${noun})`;
}

export function fileTypesIn(items: FolderFile[]): string[] {
  const types = new Set<string>();
  for (const item of items) {
    if (isInsideSkippedDir(item.relativePath)) continue;
    const base = item.relativePath.replace(/\\/g, '/').split('/').pop() || '';
    const dot = base.lastIndexOf('.');
    types.add(dot > 0 ? base.slice(dot + 1).toLowerCase() : 'no extension');
  }
  return [...types].sort();
}

export function folderTypeLabel(all: FolderFile[], manifests: FolderFile[]): string {
  const root = all[0]?.relativePath.replace(/\\/g, '/').split('/')[0] || 'folder';
  const types = fileTypesIn(all);
  const preview = types.slice(0, 16).join(', ');
  const more = types.length > 16 ? ` +${types.length - 16} more` : '';
  const manifestNoun = manifests.length === 1 ? 'manifest' : 'manifests';
  const typeNoun = types.length === 1 ? 'file type' : 'file types';
  return `${root} (${manifests.length} ${manifestNoun} · ${types.length} ${typeNoun}: ${preview}${more})`;
}

export async function filesFromDataTransfer(dt: DataTransfer): Promise<FolderFile[]> {
  const entries: FileSystemEntry[] = [];
  for (const item of Array.from(dt.items || [])) {
    const entry = item.webkitGetAsEntry?.();
    if (entry) entries.push(entry);
  }
  if (entries.length === 0) {
    return Array.from(dt.files || []).map((file) => ({ file, relativePath: file.name }));
  }
  const out: FolderFile[] = [];
  for (const entry of entries) {
    await walkEntry(entry, '', out);
  }
  return out;
}

function walkEntry(entry: FileSystemEntry, prefix: string, out: FolderFile[]): Promise<void> {
  if (entry.isFile) {
    return new Promise((resolve, reject) => {
      (entry as FileSystemFileEntry).file((file) => {
        out.push({ file, relativePath: prefix + entry.name });
        resolve();
      }, reject);
    });
  }
  const reader = (entry as FileSystemDirectoryEntry).createReader();
  return readAllEntries(reader).then(async (children) => {
    for (const child of children) {
      await walkEntry(child, prefix + entry.name + '/', out);
    }
  });
}

function readAllEntries(reader: FileSystemDirectoryReader): Promise<FileSystemEntry[]> {
  return new Promise((resolve, reject) => {
    const acc: FileSystemEntry[] = [];
    const next = () => {
      reader.readEntries((batch) => {
        if (batch.length === 0) {
          resolve(acc);
          return;
        }
        acc.push(...batch);
        next();
      }, reject);
    };
    next();
  });
}
