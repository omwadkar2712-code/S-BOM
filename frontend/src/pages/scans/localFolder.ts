export interface FolderFile {
  file: File;
  relativePath: string;
}

const SKIP_DIRS = new Set([
  '.git', 'node_modules', 'vendor', 'venv', '.venv', 'dist', 'target', 'build',
  '__pycache__', '.gradle',
]);

const MANIFEST_NAMES = new Set([
  'package.json', 'package-lock.json', 'npm-shrinkwrap.json', 'yarn.lock', 'pnpm-lock.yaml', 'bun.lock',
  'requirements.txt', 'constraints.txt', 'pyproject.toml', 'poetry.lock', 'uv.lock', 'pdm.lock',
  'pipfile', 'pipfile.lock',
  'pom.xml', 'go.mod', 'go.sum', 'cargo.toml', 'cargo.lock',
  'packages.config', 'packages.lock.json', 'directory.packages.props',
  'composer.json', 'composer.lock',
  'gemfile', 'gemfile.lock', 'build.gradle', 'build.gradle.kts',
  'settings.gradle', 'settings.gradle.kts', 'gradle.lockfile',
  'pubspec.yaml', 'pubspec.lock', 'mix.exs', 'mix.lock',
  'package.swift', 'package.resolved', 'conanfile.txt', 'conan.lock',
  'description', 'cabal.project',
]);

const MANIFEST_EXTENSIONS = ['.csproj', '.vbproj', '.fsproj', '.opam', '.cabal'];

/** Short hint for toasts and the local-scan drop zone. */
export const SUPPORTED_MANIFEST_HINT =
  'package.json, requirements.txt, pom.xml, build.gradle, go.mod, Cargo.toml, *.csproj, composer.json, Gemfile, pubspec.yaml, mix.exs, Package.swift, conanfile.txt, DESCRIPTION, *.opam, *.cabal, or a .zip';

export function isManifestRelativePath(rel: string): boolean {
  const base = rel.split('/').filter(Boolean).pop() || '';
  const lower = base.toLowerCase();
  if (MANIFEST_NAMES.has(lower)) return true;
  return MANIFEST_EXTENSIONS.some((ext) => lower.endsWith(ext));
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

export function ecosystemsIn(items: FolderFile[]): string[] {
  const ecosystems = new Set<string>();
  for (const item of items) {
    const base = (item.relativePath.replace(/\\/g, '/').split('/').pop() || '').toLowerCase();
    if (['package.json', 'package-lock.json', 'npm-shrinkwrap.json', 'yarn.lock', 'pnpm-lock.yaml', 'bun.lock'].includes(base)) {
      ecosystems.add('npm');
    } else if (['requirements.txt', 'constraints.txt', 'pyproject.toml', 'poetry.lock', 'uv.lock', 'pdm.lock', 'pipfile', 'pipfile.lock'].includes(base)) {
      ecosystems.add('PyPI');
    } else if (['pom.xml', 'build.gradle', 'build.gradle.kts', 'settings.gradle', 'settings.gradle.kts', 'gradle.lockfile'].includes(base)) {
      ecosystems.add('Maven');
    } else if (['go.mod', 'go.sum'].includes(base)) {
      ecosystems.add('Go');
    } else if (['cargo.toml', 'cargo.lock'].includes(base)) {
      ecosystems.add('Cargo');
    } else if (
      ['packages.config', 'packages.lock.json', 'directory.packages.props'].includes(base) ||
      base.endsWith('.csproj') ||
      base.endsWith('.vbproj') ||
      base.endsWith('.fsproj')
    ) {
      ecosystems.add('NuGet');
    } else if (['composer.json', 'composer.lock'].includes(base)) {
      ecosystems.add('Packagist');
    } else if (['gemfile', 'gemfile.lock'].includes(base)) {
      ecosystems.add('RubyGems');
    } else if (['pubspec.yaml', 'pubspec.lock'].includes(base)) {
      ecosystems.add('Pub');
    } else if (['mix.exs', 'mix.lock'].includes(base)) {
      ecosystems.add('Hex');
    } else if (['package.swift', 'package.resolved'].includes(base)) {
      ecosystems.add('Swift');
    } else if (['conanfile.txt', 'conan.lock'].includes(base)) {
      ecosystems.add('Conan');
    } else if (base === 'description') {
      ecosystems.add('CRAN');
    } else if (base.endsWith('.opam')) {
      ecosystems.add('opam');
    } else if (base === 'cabal.project' || base.endsWith('.cabal')) {
      ecosystems.add('Hackage');
    }
  }
  return [...ecosystems].sort();
}

export function folderTypeLabel(all: FolderFile[], manifests: FolderFile[]): string {
  const root = all[0]?.relativePath.replace(/\\/g, '/').split('/')[0] || 'folder';
  const ecosystems = ecosystemsIn(manifests);
  const ecoPreview = ecosystems.slice(0, 8).join(', ');
  const ecoMore = ecosystems.length > 8 ? ` +${ecosystems.length - 8} more` : '';
  const types = fileTypesIn(all);
  const typePreview = types.slice(0, 10).join(', ');
  const typeMore = types.length > 10 ? ` +${types.length - 10} more` : '';
  const manifestNoun = manifests.length === 1 ? 'manifest' : 'manifests';
  const ecoNoun = ecosystems.length === 1 ? 'ecosystem' : 'ecosystems';
  if (ecosystems.length > 0) {
    return `${root} (${manifests.length} ${manifestNoun} · ${ecosystems.length} ${ecoNoun}: ${ecoPreview}${ecoMore})`;
  }
  return `${root} (${manifests.length} ${manifestNoun} · file types: ${typePreview}${typeMore})`;
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
