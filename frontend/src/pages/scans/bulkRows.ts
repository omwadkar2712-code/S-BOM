export type BulkRowStatus = 'ready' | 'duplicate' | 'invalid';

export interface ClassifiedBulkRow {
  id: string;
  rowNumber: number;
  project: string;
  name: string;
  version: string;
  source: string;
  branch: string;
  ecosystem: string;
  rowStatus: BulkRowStatus;
  rowMessage: string;
}

export interface ClassifiedBulkFile {
  rows: ClassifiedBulkRow[];
  fileError: string;
}

const REQUIRED = ['project_name', 'application_name', 'version', 'repository_url'] as const;

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  const source = text.replace(/^\uFEFF/, '');
  for (let i = 0; i < source.length; i += 1) {
    const char = source[i];
    if (quoted) {
      if (char === '"') {
        if (source[i + 1] === '"') {
          cell += '"';
          i += 1;
        } else {
          quoted = false;
        }
      } else {
        cell += char;
      }
      continue;
    }
    if (char === '"') {
      quoted = true;
    } else if (char === ',') {
      row.push(cell.trim());
      cell = '';
    } else if (char === '\n') {
      row.push(cell.trim());
      rows.push(row);
      row = [];
      cell = '';
    } else if (char !== '\r') {
      cell += char;
    }
  }
  if (cell.length > 0 || row.length > 0) {
    row.push(cell.trim());
    rows.push(row);
  }
  return rows;
}

function canonicalGithub(raw: string): string | null {
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    return null;
  }
  if (url.protocol !== 'https:' || url.hostname.toLowerCase() !== 'github.com') return null;
  const parts = url.pathname.split('/').filter(Boolean);
  if (parts.length !== 2) return null;
  let repo = parts[1];
  if (repo.toLowerCase().endsWith('.git')) repo = repo.slice(0, -4);
  if (!parts[0] || !repo) return null;
  return `https://github.com/${parts[0]}/${repo}`;
}

function projectKey(repositoryUrl: string, branch: string): string {
  const canonical = canonicalGithub(repositoryUrl);
  if (!canonical) return `${repositoryUrl.toLowerCase()}|${branch}`;
  const parts = new URL(canonical).pathname.split('/').filter(Boolean);
  return `${parts[0].toLowerCase()}/${parts[1].toLowerCase()}|${branch}`;
}

export function classifyBulkCsv(text: string): ClassifiedBulkFile {
  const table = parseCsv(text);
  if (table.length === 0) {
    return { rows: [], fileError: 'The spreadsheet is empty.' };
  }
  const header = table[0].map((cell) => cell.toLowerCase());
  const missing = REQUIRED.filter((name) => !header.includes(name));
  if (missing.length > 0) {
    return {
      rows: [],
      fileError: `Missing required column: ${missing[0]}. Use project_name, application_name, version, and repository_url.`,
    };
  }
  const col = (name: string) => header.indexOf(name);
  const seen = new Map<string, number>();
  const rows: ClassifiedBulkRow[] = [];
  table.slice(1).forEach((cells, offset) => {
    if (!cells.some((value) => value !== '')) return;
    const rowNumber = offset + 2;
    const project = cells[col('project_name')] || '';
    const name = cells[col('application_name')] || '';
    const version = cells[col('version')] || '';
    const source = cells[col('repository_url')] || '';
    const branch = col('branch') >= 0 ? cells[col('branch')] || '' : '';
    const scanType = (col('scan_type') >= 0 ? cells[col('scan_type')] || '' : '').toUpperCase() || 'GITHUB';
    const problems: string[] = [];
    if (!project) problems.push('project_name is required');
    if (!name) problems.push('application_name is required');
    const canonical = source ? canonicalGithub(source) : null;
    if (!source) problems.push('repository_url is required');
    else if (!canonical) problems.push('repository_url must be https://github.com/{owner}/{repo}');
    if (scanType !== 'GITHUB') problems.push('only GITHUB is supported for bulk');
    let rowStatus: BulkRowStatus = 'ready';
    let rowMessage = 'This row will be scanned.';
    if (problems.length > 0) {
      rowStatus = 'invalid';
      rowMessage = problems.join('. ');
    } else if (canonical) {
      const key = projectKey(canonical, branch);
      const first = seen.get(key);
      if (first) {
        rowStatus = 'duplicate';
        rowMessage = `Duplicate project of row ${first}. ${canonical} is already in this file, so this row will be skipped.`;
      } else {
        seen.set(key, rowNumber);
      }
    }
    rows.push({
      id: String(rowNumber),
      rowNumber,
      project: project || name || `row ${rowNumber}`,
      name: name || project,
      version: version || 'UNKNOWN',
      source: canonical || source,
      branch: branch || 'default',
      ecosystem: 'detected',
      rowStatus,
      rowMessage,
    });
  });
  if (rows.length === 0) {
    return { rows: [], fileError: 'The spreadsheet has no data rows.' };
  }
  return { rows, fileError: '' };
}
