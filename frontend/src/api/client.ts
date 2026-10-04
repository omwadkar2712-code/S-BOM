import type { BulkScanItemView, Ecosystem, LicenseType, SBOMComponent, ScanEventView, ScanJob, ScanStatus, Severity, Vulnerability } from '../types';

const BASE = import.meta.env.VITE_API_BASE || '';

export class ApiError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.code = code;
  }
}

interface Envelope<T> {
  success: boolean;
  data: T;
  error?: { code: string; message: string };
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set('X-Organization-Id', 'default');
  if (init.body && !(init.body instanceof FormData) && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  const res = await fetch(`${BASE}${path}`, { ...init, headers });
  const text = await res.text();
  let body: Envelope<T> | null = null;
  if (text) {
    try {
      body = JSON.parse(text) as Envelope<T>;
    } catch {
      throw new ApiError('INVALID_RESPONSE', 'The scan API returned a non-JSON response.');
    }
  }
  if (!res.ok || body?.success === false) {
    throw new ApiError(body?.error?.code || 'REQUEST_FAILED', body?.error?.message || res.statusText);
  }
  return body?.data as T;
}

export interface ApiScan {
  id: string;
  project_id: string;
  application_name: string;
  application_version: string;
  source_type: string;
  status: string;
  stage: string;
  created_at: string;
  completed_at?: string;
  snapshot_id?: string;
  error_code?: string;
  error_message?: string;
  bulk_scan_id?: string;
  bulk_row?: number;
  started_at?: string;
  completed_at?: string;
  file_name?: string;
  repository_url?: string;
  branch?: string;
}

export interface ApiScanStatus {
  status: string;
  stage: string;
  error_code?: string;
  error_message?: string;
  started_at?: string;
  completed_at?: string;
  source_type?: string;
  file_name?: string;
  repository_url?: string;
  branch?: string;
}

export interface ApiComponent {
  id: string;
  name: string;
  version: string;
  ecosystem: string;
  purl: string;
  license?: string;
  direct: boolean;
  source_manifest?: string;
  scope?: string;
}

export interface ApiVulnMatch {
  component_id: string;
  vulnerability_id: string;
  source?: string;
  severity?: string;
  cvss_score?: number;
  cvss_vector?: string;
  description?: string;
  fixed_version?: string;
}

export interface ApiEvent {
  id: string;
  stage: string;
  message: string;
  created_at: string;
}

export function healthReady(): Promise<{ status: string }> {
  return request('/health/ready');
}

export async function listScans(): Promise<ApiScan[]> {
  return (await request<ApiScan[] | null>('/api/v1/scans')) || [];
}

export function scanStatus(id: string): Promise<ApiScanStatus> {
  return request(`/api/v1/scans/${id}/status`);
}

export function rescanScan(id: string): Promise<{ scan_id: string; status: string; stage: string }> {
  return request(`/api/v1/scans/${id}/rescan`, { method: 'POST' });
}

export function cancelScan(id: string): Promise<{ scan_id: string; status: string; stage: string }> {
  return request(`/api/v1/scans/${id}/cancel`, { method: 'POST' });
}

export async function scanEvents(id: string): Promise<ApiEvent[]> {
  return (await request<ApiEvent[] | null>(`/api/v1/scans/${id}/events`)) || [];
}

export async function scanComponents(id: string): Promise<ApiComponent[]> {
  return (await request<ApiComponent[] | null>(`/api/v1/scans/${id}/components`)) || [];
}

export function scanVulnerabilities(id: string): Promise<ApiVulnMatch[] | null> {
  return request(`/api/v1/scans/${id}/vulnerabilities`);
}

export function createLocalScan(
  source: { file?: File | null; folderFiles?: { file: File; relativePath: string }[] },
  project: string,
  application: string,
  version: string,
): Promise<{ scan_id: string; status?: string; stage?: string }> {
  const body = new FormData();
  if (source.folderFiles && source.folderFiles.length > 0) {
    for (const item of source.folderFiles) {
      const rel = item.relativePath.replace(/\\/g, '/');
      const base = rel.split('/').pop() || item.file.name;
      body.append('files', item.file, base);
      body.append('paths', rel);
    }
  } else if (source.file) {
    body.append('file', source.file);
  } else {
    throw new ApiError('INVALID_INPUT', 'Choose a folder, a zip archive, or a manifest file.');
  }
  body.append('project_name', project);
  body.append('application_name', application);
  body.append('version', version || 'UNKNOWN');
  return request('/api/v1/scans/local', { method: 'POST', body });
}

export function createGitHubScan(input: {
  repositoryUrl: string;
  project: string;
  application: string;
  version: string;
  branch: string;
  credentialId?: string;
}): Promise<{ scan_id: string; status?: string; stage?: string }> {
  return request('/api/v1/scans/github', {
    method: 'POST',
    body: JSON.stringify({
      repository_url: input.repositoryUrl,
      project_name: input.project,
      application_name: input.application,
      version: input.version || 'UNKNOWN',
      branch: input.branch,
      authentication: input.credentialId ? { type: 'GITHUB_FINE_GRAINED_PAT', credential_id: input.credentialId } : undefined,
    }),
  });
}

export interface ApiBulkItem {
  id?: string;
  row_number?: number;
  scan_id?: string;
  project_name?: string;
  application_name?: string;
  version?: string;
  repository_url?: string;
  status: string;
  error_code?: string;
  error_message?: string;
}

export interface ApiBulk {
  id: string;
  project_id?: string;
  status: string;
  filename?: string;
  total_rows: number;
  queued_rows?: number;
  invalid_rows: number;
  created_at?: string;
  completed_at?: string;
  items?: ApiBulkItem[];
  validation_errors?: { row?: number; code?: string; message: string }[];
}

export function createBulkScan(file: File, project: string): Promise<ApiBulk> {
  const body = new FormData();
  body.append('file', file);
  body.append('project_name', project);
  return request('/api/v1/scans/bulk', { method: 'POST', body });
}

export function getBulkScan(id: string): Promise<ApiBulk> {
  return request(`/api/v1/bulk-scans/${id}`);
}

export async function createGitHubPat(name: string, token: string): Promise<string> {
  const created = await request<{ id?: string; ID?: string }>('/api/v1/credentials/github', {
    method: 'POST',
    body: JSON.stringify({
      type: 'GITHUB_FINE_GRAINED_PAT',
      name,
      token,
    }),
  });
  const id = created.id || created.ID;
  if (!id) throw new ApiError('CREDENTIAL_FAILED', 'Credential was stored but no id was returned.');
  return id;
}

export async function scanPackageTotals(scanId: string): Promise<{
  componentsFound: number;
  cvesFound: number;
  criticals: number;
  highs: number;
}> {
  const [comps, vulns] = await Promise.all([
    scanComponents(scanId),
    scanVulnerabilities(scanId).catch(() => [] as ApiVulnMatch[] | null),
  ]);
  const rows = Array.isArray(vulns) ? vulns : [];
  return {
    componentsFound: comps.length,
    cvesFound: rows.length,
    criticals: rows.filter((v) => (v.severity || '').toUpperCase() === 'CRITICAL').length,
    highs: rows.filter((v) => (v.severity || '').toUpperCase() === 'HIGH').length,
  };
}

export function exportUrl(scanId: string, format: 'spdx-json' | 'cyclonedx-json' | 'csv' | 'xlsx'): string {
  return `${BASE}/api/v1/scans/${scanId}/export?format=${format}`;
}

export function sourceLabel(scan: {
  source_type?: string;
  file_name?: string;
  repository_url?: string;
  branch?: string;
}): string {
  if (scan.repository_url) {
    return scan.branch ? `${scan.repository_url} (${scan.branch})` : scan.repository_url;
  }
  if (scan.file_name) return scan.file_name;
  if (scan.source_type === 'GITHUB') return 'GitHub repository';
  if (scan.source_type === 'LOCAL') return 'Local upload';
  return scan.source_type || 'Scan';
}

export function mapScan(scan: ApiScan): ScanJob {
  const bulkId = scan.bulk_scan_id || undefined;
  return {
    id: scan.id,
    targetProject: scan.project_id || scan.application_name,
    appService: scan.application_name,
    releaseTag: scan.application_version,
    scanType: bulkId ? 'Bulk Scan' : scan.source_type === 'GITHUB' ? 'Remote Git' : 'Local Source',
    source: sourceLabel(scan),
    status: mapStatus(scan.status, scan.stage),
    stage: scan.stage,
    progress: progressFor(scan.stage, scan.status),
    timestamp: (scan.created_at || '').replace('T', ' ').substring(0, 19),
    componentsFound: 0,
    cvesFound: 0,
    criticals: 0,
    highs: 0,
    logMessages: scan.error_message ? [scan.error_message] : [`Stage ${scan.stage || scan.status}`],
    snapshotId: scan.snapshot_id,
    errorCode: scan.error_code || undefined,
    errorMessage: scan.error_message || undefined,
    bulkId,
    bulkRow: scan.bulk_row || undefined,
    startedAt: scan.started_at,
    completedAt: scan.completed_at,
  };
}

export function mapBulkItem(item: ApiBulkItem): BulkScanItemView {
  return {
    rowNumber: item.row_number || 0,
    scanId: item.scan_id || undefined,
    projectName: item.project_name || '',
    applicationName: item.application_name || '',
    version: item.version || '',
    repositoryUrl: item.repository_url || '',
    status: item.status,
    errorCode: item.error_code || undefined,
    errorMessage: item.error_message || undefined,
  };
}

export function mapBulkStatus(status: string): ScanStatus {
  if (status === 'COMPLETED' || status === 'COMPLETED_WITH_ERRORS') return 'completed';
  if (status === 'FAILED') return 'failed';
  if (status === 'CANCELLED') return 'cancelled';
  if (status === 'PROCESSING') return 'running';
  return 'queued';
}

export function bulkProgress(items: { status: string }[], totalRows: number): number {
  if (!totalRows) return 0;
  const settled = items.filter((item) =>
    ['COMPLETED', 'FAILED', 'SKIPPED', 'DEAD_LETTER', 'CANCELLED'].includes(item.status),
  ).length;
  return Math.min(100, Math.round((settled / totalRows) * 100));
}

export function mapBulkAggregate(bulk: ApiBulk): ScanJob {
  const items = (bulk.items || []).map(mapBulkItem);
  const status = mapBulkStatus(bulk.status);
  const completed = items.filter((item) => item.status === 'COMPLETED').length;
  const failed = items.filter((item) => item.status === 'FAILED' || item.status === 'DEAD_LETTER').length;
  const skipped = items.filter((item) => item.status === 'SKIPPED').length;
  const firstError = bulk.validation_errors?.find((err) => err.message)?.message;
  return {
    id: bulk.id,
    targetProject: bulk.project_id || 'Bulk scan',
    appService: 'Batch',
    releaseTag: `${bulk.total_rows} rows`,
    scanType: 'Bulk Scan',
    source: bulk.filename || 'Bulk spreadsheet',
    status,
    stage: bulk.status,
    progress: status === 'completed' || status === 'failed' ? 100 : Math.max(status === 'running' ? 8 : 0, bulkProgress(items, bulk.total_rows)),
    timestamp: (bulk.created_at || '').replace('T', ' ').substring(0, 19),
    componentsFound: 0,
    cvesFound: 0,
    criticals: 0,
    highs: 0,
    logMessages: [`${completed} completed, ${failed} failed, ${skipped} skipped, ${bulk.total_rows} total`],
    isBulkAggregate: true,
    bulkId: bulk.id,
    bulkItems: items,
    startedAt: bulk.created_at,
    completedAt: bulk.completed_at,
    errorMessage: status === 'failed' ? (firstError || 'Bulk scan failed') : undefined,
  };
}

export function childJobsFromBulk(bulk: ApiBulk): ScanJob[] {
  return (bulk.items || []).filter((item) => item.scan_id).map((item) => ({
    id: item.scan_id as string,
    targetProject: item.project_name || bulk.project_id || 'Bulk scan',
    appService: item.application_name || '',
    releaseTag: item.version || 'UNKNOWN',
    scanType: 'Bulk Scan' as const,
    source: item.repository_url || 'GitHub repository',
    status: mapStatus(item.status, item.status),
    stage: item.status,
    progress: progressFor(item.status === 'QUEUED' || item.status === 'PENDING' ? 'QUEUED' : item.status, item.status),
    timestamp: (bulk.created_at || '').replace('T', ' ').substring(0, 19),
    componentsFound: 0,
    cvesFound: 0,
    criticals: 0,
    highs: 0,
    logMessages: item.error_message ? [item.error_message] : [`${item.status}`],
    bulkId: bulk.id,
    bulkRow: item.row_number,
    errorCode: item.error_code || undefined,
    errorMessage: item.error_message || undefined,
  }));
}

function lastWorkStage(events: { stage: string }[], stage: string): string {
  if (stage && stage !== 'FAILED' && stage !== 'CANCELLED') return stage;
  for (let i = events.length - 1; i >= 0; i -= 1) {
    const name = events[i].stage;
    if (name && name !== 'FAILED' && name !== 'CANCELLED') return name;
  }
  return stage;
}

export function applyScanUpdate(job: ScanJob, status: ApiScanStatus, events: ApiEvent[] = []): ScanJob {
  const mapped = mapStatus(status.status, status.stage);
  const workStage = lastWorkStage(events, status.stage);
  const eventViews: ScanEventView[] = events.map((event) => ({
    id: event.id,
    stage: event.stage,
    message: event.message,
    createdAt: event.created_at,
  }));
  let source = job.source;
  if (status.repository_url) {
    source = status.branch ? `${status.repository_url} (${status.branch})` : status.repository_url;
  } else if (status.file_name) {
    source = status.file_name;
  }
  const open = mapped === 'queued' || mapped === 'running' || mapped === 'analyzing';
  return {
    ...job,
    status: mapped,
    stage: status.stage,
    progress: progressFor(status.stage, status.status, workStage),
    source,
    errorCode: status.error_code || (open ? undefined : job.errorCode),
    errorMessage: status.error_message || (open ? undefined : job.errorMessage),
    startedAt: status.started_at || job.startedAt,
    completedAt: status.completed_at || (open ? undefined : job.completedAt),
    events: eventViews.length ? eventViews : job.events,
    logMessages: eventViews.length ? eventViews.map((event) => `${event.stage}: ${event.message}`) : job.logMessages,
  };
}

export function mapStatus(status: string, stage: string): ScanStatus {
  if (status === 'COMPLETED') return 'completed';
  if (status === 'CANCELLED') return 'cancelled';
  if (status === 'FAILED' || status === 'DEAD_LETTER') return 'failed';
  if (stage === 'ANALYZING_VULNERABILITIES' || stage === 'GENERATING_SBOM' || stage === 'GENERATING_EXPORT') return 'analyzing';
  if (status === 'RUNNING') return 'running';
  if ((status === 'PENDING' || status === 'QUEUED') && stage && stage !== 'QUEUED') return 'running';
  return 'queued';
}

export function progressFor(stage: string, status: string, fallbackStage = ''): number {
  const table: Record<string, number> = {
    QUEUED: 8,
    PENDING: 8,
    VALIDATING: 18,
    EXTRACTING: 32,
    DETECTING_MANIFESTS: 46,
    PARSING: 55,
    RESOLVING_DEPENDENCIES: 66,
    NORMALIZING: 74,
    ANALYZING_VULNERABILITIES: 86,
    GENERATING_SBOM: 94,
    GENERATING_EXPORT: 97,
    COMPLETED: 100,
  };
  if (status === 'COMPLETED' || stage === 'COMPLETED') return 100;
  const terminal = status === 'FAILED' || status === 'CANCELLED' || status === 'DEAD_LETTER' || stage === 'FAILED' || stage === 'CANCELLED';
  if (terminal) {
    const key = table[stage] != null && stage !== 'FAILED' && stage !== 'CANCELLED' ? stage : fallbackStage;
    return table[key] ?? 12;
  }
  return table[stage] ?? 12;
}

const ecosystems: Record<string, Ecosystem> = {
  npm: 'npm',
  pypi: 'PyPI',
  maven: 'Maven',
  go: 'Go',
  cargo: 'Cargo',
  rubygems: 'RubyGems',
  nuget: 'NuGet',
  composer: 'Packagist',
  packagist: 'Packagist',
};

const knownLicenses = new Set<LicenseType>(['MIT', 'Apache-2.0', 'BSD-3-Clause', 'GPL-3.0', 'LGPL-3.0', 'MPL-2.0', 'ISC', 'Commercial', 'Unknown']);

function mapLicense(value?: string): LicenseType {
  if (value && knownLicenses.has(value as LicenseType)) return value as LicenseType;
  return 'Unknown';
}

export function mapComponent(c: ApiComponent, project: string, application = ''): SBOMComponent {
  const eco = ecosystems[c.ecosystem] || 'npm';
  return {
    id: c.id,
    name: c.name,
    version: c.version,
    project,
    projectApplication: application,
    license: mapLicense(c.license),
    trustScore: 80,
    risk: 'Safe',
    cves: 0,
    patchAvailable: false,
    vex: 'not_affected',
    eol: false,
    ecosystem: eco,
    criticality: c.direct ? 'High' : 'Low',
    directDependency: c.direct,
    supplier: '',
    purl: c.purl,
    compliance: 0,
  };
}

function titleSeverity(s?: string): Severity {
  switch ((s || '').toUpperCase()) {
    case 'CRITICAL':
      return 'Critical';
    case 'HIGH':
      return 'High';
    case 'MEDIUM':
      return 'Medium';
    case 'LOW':
      return 'Low';
    default:
      return 'Medium';
  }
}

export function mapVulns(matches: ApiVulnMatch[] | null, components: ApiComponent[], project: string): Vulnerability[] {
  const byId = new Map(components.map((c) => [c.id, c]));
  const rows = Array.isArray(matches) ? matches : [];
  return rows.map((m, i) => {
    const comp = byId.get(m.component_id);
    return {
      id: `${m.vulnerability_id}-${i}`,
      cve: m.vulnerability_id,
      package: comp?.name || m.component_id,
      version: comp?.version || '',
      project,
      cvss: m.cvss_score || 0,
      epss: 0,
      severity: titleSeverity(m.severity),
      status: 'Open',
      fixVersion: m.fixed_version,
      age: '',
      description: m.description || '',
      cwe: '',
      publishedDate: '',
      vexStatus: 'affected',
      vectorString: m.cvss_vector,
      exploitAvailable: false,
      affectedVersions: comp?.version || '',
      ecosystem: ecosystems[comp?.ecosystem || ''] || 'npm',
    };
  });
}
