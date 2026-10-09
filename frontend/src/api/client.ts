import type { BulkScanItemView, ComponentFieldType, Ecosystem, LicenseType, SBOMComponent, ScanEventView, ScanJob, ScanStatus, Severity, Vulnerability } from '../types';

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
  let res: Response;
  try {
    res = await fetch(`${BASE}${path}`, { ...init, headers });
  } catch (error) {
    if (init.signal?.aborted || (error instanceof DOMException && error.name === 'AbortError')) {
      throw error;
    }
    throw error;
  }
  const text = await res.text();
  let body: (Envelope<T> & { detail?: string }) | null = null;
  if (text) {
    try {
      body = JSON.parse(text) as Envelope<T> & { detail?: string };
    } catch {
      throw new ApiError('INVALID_RESPONSE', 'The scan API returned a non-JSON response.');
    }
  }
  if (!res.ok || body?.success === false) {
    const message = body?.error?.message || body?.detail || res.statusText || 'Request failed';
    throw new ApiError(body?.error?.code || 'REQUEST_FAILED', message);
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
  started_at?: string;
  completed_at?: string;
  snapshot_id?: string;
  error_code?: string;
  error_message?: string;
  bulk_scan_id?: string;
  bulk_row?: number;
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

export interface ApiInventoryComponent {
  id: string;
  name: string;
  package_name: string;
  version: string;
  project: string;
  project_application: string;
  field_type: ComponentFieldType;
  license: string;
  cves: number;
  purl: string;
  risk: Severity | 'Safe';
  ecosystem: Ecosystem;
  direct: boolean;
  supplier: string;
  file_name?: string;
  created_by?: string;
}

export interface InventoryComponentInput {
  project: string;
  project_application: string;
  project_id?: string;
  application_id?: string;
  name: string;
  package_name?: string;
  version: string;
  field_type?: ComponentFieldType;
  license?: string;
  cves?: number;
  ecosystem?: Ecosystem;
  risk?: Severity | 'Safe';
  purl?: string;
  direct_dependency?: boolean;
  supplier?: string;
  file_name?: string;
  created_by?: string;
}

export interface CatalogRecord {
  id: string;
  name: string;
  project_id?: string;
}

export interface CatalogPage {
  items: CatalogRecord[];
  next_cursor: string | null;
}

export function listCatalogProjects(params?: { q?: string; limit?: number; cursor?: string; signal?: AbortSignal }): Promise<CatalogPage> {
  const query = new URLSearchParams({ limit: String(params?.limit || 50) });
  if (params?.q) query.set('q', params.q);
  if (params?.cursor) query.set('cursor', params.cursor);
  return request(`/api/v1/catalog/projects?${query.toString()}`, { signal: params?.signal });
}

export function listCatalogApplications(
  projectId: string,
  params?: { q?: string; limit?: number; cursor?: string; signal?: AbortSignal },
): Promise<CatalogPage> {
  const query = new URLSearchParams({ limit: String(params?.limit || 50) });
  if (params?.q) query.set('q', params.q);
  if (params?.cursor) query.set('cursor', params.cursor);
  return request(`/api/v1/catalog/projects/${encodeURIComponent(projectId)}/applications-services?${query.toString()}`, {
    signal: params?.signal,
  });
}

export function createCatalogProject(input: {
  name: string;
  applications?: string[] | { name: string }[];
}): Promise<{ id: string; name: string; applications: CatalogRecord[] }> {
  return request('/api/v1/catalog/projects', {
    method: 'POST',
    body: JSON.stringify({
      name: input.name,
      applications: input.applications || [],
    }),
  });
}

export function createCatalogApplication(projectId: string, name: string): Promise<CatalogRecord> {
  return request(`/api/v1/catalog/projects/${encodeURIComponent(projectId)}/applications-services`, {
    method: 'POST',
    body: JSON.stringify({ name }),
  });
}

interface InventoryPage {
  items: ApiInventoryComponent[];
  next_cursor: string | null;
}

export async function listInventoryComponents(): Promise<ApiInventoryComponent[]> {
  const items: ApiInventoryComponent[] = [];
  let cursor = '';
  for (let page = 0; page < 1000; page += 1) {
    const query = new URLSearchParams({ limit: '500' });
    if (cursor) query.set('cursor', cursor);
    const data = await request<InventoryPage>(`/api/v1/inventory/components?${query.toString()}`);
    items.push(...(data?.items || []));
    if (!data?.next_cursor) break;
    cursor = data.next_cursor;
  }
  return items;
}

export function createInventoryComponents(components: InventoryComponentInput[]): Promise<ApiInventoryComponent[]> {
  return request<ApiInventoryComponent[]>('/api/v1/inventory/components', {
    method: 'POST',
    body: JSON.stringify({ components }),
  });
}

export function mapInventoryComponent(row: ApiInventoryComponent): SBOMComponent {
  return {
    id: row.id,
    name: row.name,
    packageName: row.package_name || row.name,
    version: row.version,
    project: row.project,
    projectApplication: row.project_application,
    fieldType: row.field_type || 'Library',
    license: mapLicense(row.license),
    trustScore: 90,
    risk: row.risk || 'Safe',
    cves: row.cves || 0,
    patchAvailable: false,
    vex: 'not_affected',
    eol: false,
    ecosystem: row.ecosystem || 'npm',
    criticality: row.direct ? 'High' : 'Low',
    directDependency: Boolean(row.direct),
    supplier: row.supplier || '',
    purl: row.purl,
    fileName: row.file_name || undefined,
    createdBy: row.created_by || undefined,
    compliance: 95,
  };
}

export function healthReady(): Promise<{ status: string }> {
  return request('/health/ready');
}

export async function listScans(): Promise<ApiScan[]> {
  return (await request<ApiScan[] | null>('/api/v1/scans')) || [];
}

export interface ApiProjectSummary {
  project_count: number;
  active_projects: number;
  avg_compliance_pct: number;
  compliant_count: number;
  total_count: number;
  total_scans: number;
  sbom_files: number;
}

export interface ApiProjectRow {
  id: string;
  name: string;
  classifier: string;
  risk: 'Healthy' | 'Needs Attention' | 'High Risk';
  compliance: string;
  compliance_pct: number;
  vulns: number;
  scans: number;
  tags: string[];
  last_scanned_at: string;
  latest_scan_id?: string;
  latest_snapshot_id?: string;
  source_types?: string[];
}

export interface ApiProjectsDashboard {
  summary: ApiProjectSummary;
  projects: ApiProjectRow[];
}

export function listProjects(params?: { q?: string; status?: string }): Promise<ApiProjectsDashboard> {
  const query = new URLSearchParams();
  if (params?.q) query.set('q', params.q);
  if (params?.status && params.status !== 'All Statuses') query.set('status', params.status);
  const suffix = query.toString() ? `?${query}` : '';
  return request(`/api/v1/projects${suffix}`);
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
  ids?: { projectId?: string; applicationId?: string },
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
  if (ids?.projectId) body.append('project_id', ids.projectId);
  if (ids?.applicationId) body.append('application_id', ids.applicationId);
  return request('/api/v1/scans/local', { method: 'POST', body });
}

export function createGitHubScan(input: {
  repositoryUrl: string;
  project: string;
  application: string;
  version: string;
  branch: string;
  credentialId?: string;
  projectId?: string;
  applicationId?: string;
}): Promise<{ scan_id: string; status?: string; stage?: string }> {
  return request('/api/v1/scans/github', {
    method: 'POST',
    body: JSON.stringify({
      repository_url: input.repositoryUrl,
      project_name: input.project,
      application_name: input.application,
      project_id: input.projectId || '',
      application_id: input.applicationId || '',
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

export function severityCounts(rows: Array<{ severity?: string }>): {
  criticals: number;
  highs: number;
  mediums: number;
  lows: number;
} {
  const upper = (value?: string) => (value || '').toUpperCase();
  return {
    criticals: rows.filter((row) => upper(row.severity) === 'CRITICAL').length,
    highs: rows.filter((row) => upper(row.severity) === 'HIGH').length,
    mediums: rows.filter((row) => upper(row.severity) === 'MEDIUM').length,
    lows: rows.filter((row) => upper(row.severity) === 'LOW').length,
  };
}

export async function scanPackageTotals(scanId: string): Promise<{
  componentsFound: number;
  cvesFound: number;
  criticals: number;
  highs: number;
  mediums: number;
  lows: number;
}> {
  const [comps, vulns] = await Promise.all([
    scanComponents(scanId),
    scanVulnerabilities(scanId).catch(() => [] as ApiVulnMatch[] | null),
  ]);
  const rows = Array.isArray(vulns) ? vulns : [];
  return {
    componentsFound: comps.length,
    cvesFound: rows.length,
    ...severityCounts(rows),
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
    mediums: 0,
    lows: 0,
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
    mediums: 0,
    lows: 0,
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
    mediums: 0,
    lows: 0,
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

export function mapVulns(
  matches: ApiVulnMatch[] | null,
  components: ApiComponent[],
  project: string,
  application = '',
  scanId = '',
): Vulnerability[] {
  const byId = new Map(components.map((c) => [c.id, c]));
  const rows = Array.isArray(matches) ? matches : [];
  return rows.map((m, i) => {
    const comp = byId.get(m.component_id);
    const desc = m.description || '';
    const cleanName = desc ? (desc.split(/[.\n]/)[0].trim() || m.vulnerability_id) : m.vulnerability_id;
    const now = new Date();
    const formattedDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const hash = Math.abs((m.vulnerability_id + project).split('').reduce((acc, char) => ((acc << 5) - acc + char.charCodeAt(0)) | 0, 0));
    return {
      id: `${m.vulnerability_id}-${i}`,
      cve: m.vulnerability_id,
      name: cleanName,
      package: comp?.name || m.component_id,
      version: comp?.version || '',
      project,
      application: application || project,
      cvss: m.cvss_score || 0,
      epss: 0,
      severity: titleSeverity(m.severity),
      status: 'Open',
      fixVersion: m.fixed_version,
      age: 'Just now',
      description: desc || 'Vulnerability detected during software component composition analysis.',
      cwe: 'CWE-20',
      publishedDate: formattedDate,
      vexStatus: 'affected',
      vectorString: m.cvss_vector || 'CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H',
      exploitAvailable: false,
      affectedVersions: comp?.version || '',
      ecosystem: ecosystems[comp?.ecosystem || ''] || 'npm',
      purl: comp?.purl || `pkg:${(comp?.ecosystem || 'generic').toLowerCase()}/${comp?.name || m.component_id}@${comp?.version || '0.0.0'}`,
      direct: comp?.direct ?? true,
      dependencyPath: `${project} > ${comp?.name || m.component_id}`,
      source: m.source || 'NVD',
      ticketId: `SEC-${(hash % 9000) + 1000}`,
      firstDetected: `${formattedDate} 10:00 AM`,
      lastDetected: `${formattedDate} 10:00 AM`,
      sbomVersion: 'sbom-1.4.2',
      scanVersion: scanId ? `scan-${scanId.substring(0, 8)}` : 'scan-3.7.1',
      statusChanges: 'Open',
    };
  });
}
