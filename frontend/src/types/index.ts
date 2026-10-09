export type Severity = 'Critical' | 'High' | 'Medium' | 'Low';
export type Ecosystem = 'npm' | 'PyPI' | 'Maven' | 'Go' | 'Cargo' | 'RubyGems' | 'NuGet' | 'Packagist';
export type ScanStatus = 'idle' | 'queued' | 'running' | 'analyzing' | 'completed' | 'failed' | 'cancelled';
export type ComplianceStatus = 'Compliant' | 'Needs Review' | 'Non-Compliant' | 'Exempt';
export type LicenseType = 'MIT' | 'Apache-2.0' | 'BSD-3-Clause' | 'GPL-3.0' | 'LGPL-3.0' | 'MPL-2.0' | 'ISC' | 'Commercial' | 'Unknown';
export type VexStatus = 'not_affected' | 'affected' | 'fixed' | 'under_investigation';

export interface Project {
  id: string;
  name: string;
  component: string;
  version: string;
  riskScore: number; // 0-10
  riskLevel: Severity;
  complianceScore: number; // 0-100%
  dossierUrl: string;
  componentsCount: number;
  criticalCount: number;
  highCount: number;
  mediumCount: number;
  lowCount: number;
  lastScanned: string;
  repoUrl?: string;
  branch?: string;
  tags?: string[];
  status: 'Audited' | 'Scan Pending' | 'Blocked';
}

export interface Vulnerability {
  id: string;
  cve: string;
  name?: string;
  package: string;
  version: string;
  project: string;
  application?: string;
  cvss: number; // 0.0 - 10.0
  epss: number; // 0.0 - 1.0 (exploit prediction scoring system)
  severity: Severity;
  status: 'Open' | 'In Progress' | 'Resolved' | 'Wont Fix' | 'Mitigated' | 'Fixed' | 'Risk Accepted' | 'Closed';
  fixVersion?: string;
  age: string; // e.g. "4d ago"
  description: string;
  cwe: string;
  publishedDate: string;
  vexStatus: VexStatus;
  vectorString?: string;
  exploitAvailable: boolean;
  affectedVersions: string;
  patchRecommendation?: string;
  patchCommand?: string;
  ecosystem: Ecosystem;
  purl?: string;
  direct?: boolean;
  dependencyPath?: string;
  source?: string;
  ticketId?: string;
  firstDetected?: string;
  lastDetected?: string;
  scanVersion?: string;
  sbomVersion?: string;
  statusChanges?: string;
}

export type ComponentFieldType =
  | 'Library'
  | 'Application'
  | 'Framework'
  | 'Container'
  | 'Service'
  | 'Operating System'
  | 'Device / Firmware'
  | 'File';

export interface SBOMComponent {
  id: string;
  name: string;
  version: string;
  project: string;
  projectId?: string;
  projectApplication?: string;
  applicationId?: string;
  packageName?: string;
  fieldType?: ComponentFieldType;
  fileName?: string;
  createdBy?: string;
  compliance: number; // 0 - 100%
  license: LicenseType;
  trustScore: number; // 0-100
  risk: Severity | 'Safe';
  cves: number;
  patchAvailable: boolean;
  vex: VexStatus;
  eol: boolean;
  ecosystem: Ecosystem;
  criticality: 'High' | 'Medium' | 'Low';
  directDependency: boolean;
  supplier: string;
  purl: string;
  sha256?: string;
  reposCount?: number;
}

export interface RemediationTicket {
  id: string;
  ticketNumber: string;
  cve: string;
  package: string;
  project: string;
  priority: 'P0 - Blocker' | 'P1 - High' | 'P2 - Medium' | 'P3 - Low';
  assignee: string;
  assigneeAvatar?: string;
  dueDate: string;
  status: 'Open' | 'In Progress' | 'Review' | 'Resolved' | 'Overdue';
  slaDaysRemaining: number;
  createdAt: string;
}

export interface PolicyRule {
  id: string;
  name: string;
  description: string;
  scope: 'All Projects' | 'Production' | 'Staging' | 'Custom';
  action: 'Block' | 'Warn' | 'Audit';
  status: 'Active' | 'Draft' | 'Disabled';
  hits: number;
  iconType: 'shield-alert' | 'shield-x' | 'file-warning' | 'key' | 'bug';
}

export interface ComplianceFramework {
  id: string;
  name: string;
  version: string;
  overallScore: number; // 0 - 100
  totalControls: number;
  passedControls: number;
  failedControls: number;
  exceptions: number;
  mandatoryFieldsCoverage: number;
  status: 'Compliant' | 'At Risk' | 'Action Required';
}

export interface TimelineEvent {
  id: string;
  title: string;
  description?: string;
  timestamp: string;
  timeAgo: string;
  project: string;
  category: 'Vulnerabilities' | 'Policies' | 'SBOM' | 'Scans' | 'Compliance' | 'Supply Chain' | 'License';
  severity?: Severity | 'Info' | 'Success';
  actor?: string;
}

export interface RiskHeatmapRow {
  project: string;
  critical: number;
  high: number;
  medium: number;
  low: number;
}

export interface VulnerabilityAgingBucket {
  range: string;
  count: number;
  highlight?: boolean;
}

export interface SBOMCoverageData {
  totalRepos: number;
  coveredRepos: number;
  percentage: number;
  fresh: number;
  stale: number;
  missing: number;
}

export interface IntegrationService {
  id: string;
  name: string;
  category: 'SCM' | 'CI/CD' | 'Container & K8s' | 'Issue Tracker' | 'Messaging';
  description: string;
  connected: boolean;
  lastSync?: string;
  statusText?: string;
  icon: string;
}

export interface ScanEventView {
  id: string;
  stage: string;
  message: string;
  createdAt: string;
}

export interface BulkScanItemView {
  rowNumber: number;
  scanId?: string;
  projectName: string;
  applicationName: string;
  version: string;
  repositoryUrl: string;
  status: string;
  errorCode?: string;
  errorMessage?: string;
}

export interface ScanJob {
  id: string;
  targetProject: string;
  appService: string;
  releaseTag?: string;
  scanType: 'Local Source' | 'Remote Git' | 'Batch Multi-Project' | 'Bulk Scan';
  source: string;
  status: ScanStatus;
  stage?: string;
  progress: number;
  timestamp: string;
  componentsFound: number;
  cvesFound: number;
  criticals: number;
  highs: number;
  mediums: number;
  lows: number;
  duration?: string;
  logMessages: string[];
  events?: ScanEventView[];
  snapshotId?: string;
  errorCode?: string;
  errorMessage?: string;
  bulkId?: string;
  bulkRow?: number;
  isBulkAggregate?: boolean;
  bulkItems?: BulkScanItemView[];
  startedAt?: string;
  completedAt?: string;
}

export interface UserAccount {
  id: string;
  name: string;
  email: string;
  role: 'Admin' | 'Security Admin' | 'Security Analyst' | 'Developer' | 'Viewer';
  status: 'Active' | 'Invited' | 'Suspended';
  lastActive: string;
  avatarText: string;
  twoFactorEnabled: boolean;
}

