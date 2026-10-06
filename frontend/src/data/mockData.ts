import {
  Project,
  Vulnerability,
  SBOMComponent,
  RemediationTicket,
  PolicyRule,
  ComplianceFramework,
  TimelineEvent,
  IntegrationService,
  ScanJob,
  UserAccount,
} from '../types';

export const initialProjects: Project[] = [];

export const initialVulnerabilities: Vulnerability[] = [];

export const initialComponents: SBOMComponent[] = [
  {
    id: 'comp-react',
    name: 'react',
    version: '18.3.1',
    project: 'Payments Gateway API',
    fieldType: 'Library',
    compliance: 100,
    license: 'MIT',
    trustScore: 98,
    risk: 'Safe',
    cves: 0,
    patchAvailable: false,
    vex: 'not_affected',
    eol: false,
    ecosystem: 'npm',
    criticality: 'High',
    directDependency: true,
    supplier: 'Meta Platforms, Inc.',
    purl: 'pkg:npm/react@18.3.1',
  },
  {
    id: 'comp-express',
    name: 'express',
    version: '4.19.2',
    project: 'Payments Gateway API',
    fieldType: 'Framework',
    compliance: 95,
    license: 'MIT',
    trustScore: 92,
    risk: 'Safe',
    cves: 0,
    patchAvailable: false,
    vex: 'not_affected',
    eol: false,
    ecosystem: 'npm',
    criticality: 'High',
    directDependency: true,
    supplier: 'OpenJS Foundation',
    purl: 'pkg:npm/express@4.19.2',
  },
  {
    id: 'comp-lodash',
    name: 'lodash',
    version: '4.17.21',
    project: 'Auth & Identity Gateway',
    fieldType: 'Library',
    compliance: 90,
    license: 'MIT',
    trustScore: 88,
    risk: 'Safe',
    cves: 0,
    patchAvailable: false,
    vex: 'not_affected',
    eol: false,
    ecosystem: 'npm',
    criticality: 'Medium',
    directDependency: false,
    supplier: 'John-David Dalton',
    purl: 'pkg:npm/lodash@4.17.21',
  },
  {
    id: 'comp-axios',
    name: 'axios',
    version: '1.6.8',
    project: 'Analytics & Reporting ETL',
    fieldType: 'Library',
    compliance: 92,
    license: 'MIT',
    trustScore: 94,
    risk: 'High',
    cves: 1,
    patchAvailable: true,
    vex: 'affected',
    eol: false,
    ecosystem: 'npm',
    criticality: 'High',
    directDependency: true,
    supplier: 'Axios Community',
    purl: 'pkg:npm/axios@1.6.8',
  },
];

export const initialTickets: RemediationTicket[] = [];

export const initialPolicies: PolicyRule[] = [];

export const initialComplianceFrameworks: ComplianceFramework[] = [];

export const initialTimelineEvents: TimelineEvent[] = [];

export const initialIntegrations: IntegrationService[] = [
  {
    id: 'int-github',
    name: 'GitHub Enterprise',
    category: 'SCM',
    description: 'Automated PR checks, branch scanning, Dependabot sync, and security action gating.',
    connected: false,
    statusText: 'Not configured',
    icon: 'github',
  },
  {
    id: 'int-gitlab',
    name: 'GitLab CI / CD',
    category: 'SCM',
    description: 'Pipeline security scanners, CycloneDX reports ingestion, and merge request approvals.',
    connected: false,
    statusText: 'Not configured',
    icon: 'gitlab',
  },
  {
    id: 'int-bitbucket',
    name: 'Bitbucket Server',
    category: 'SCM',
    description: 'Repository mirroring, vulnerability annotations, and pull request commit status.',
    connected: false,
    statusText: 'Not configured',
    icon: 'bitbucket',
  },
  {
    id: 'int-jenkins',
    name: 'Jenkins CI',
    category: 'CI/CD',
    description: 'Jenkins pipeline plugin for step-level SBOM generation and gating rules.',
    connected: false,
    statusText: 'Not configured',
    icon: 'jenkins',
  },
  {
    id: 'int-jira',
    name: 'Jira Software',
    category: 'Issue Tracker',
    description: 'Auto-sync vulnerability remediation tickets, assignees, and SLA states.',
    connected: false,
    statusText: 'Not configured',
    icon: 'jira',
  },
  {
    id: 'int-slack',
    name: 'Slack Alerts',
    category: 'Messaging',
    description: 'Instant notification channel for critical CVE alerts, blocked builds, and compliance alerts.',
    connected: false,
    statusText: 'Not configured',
    icon: 'slack',
  },
];

export const initialScansHistory: ScanJob[] = [
  {
    id: 'scan-08f2a1b9',
    targetProject: 'Payments Gateway API',
    appService: 'payments-api',
    releaseTag: 'v2.4.1',
    scanType: 'Remote Git',
    source: 'https://github.com/talakunchi/payments-api',
    status: 'completed',
    stage: 'complete',
    progress: 100,
    timestamp: '2026-10-06 10:30:15',
    componentsFound: 48,
    cvesFound: 2,
    criticals: 0,
    highs: 2,
    duration: '42s',
    logMessages: [
      'Repository cloned successfully',
      'Dependency manifests parsed: package.json, package-lock.json',
      'Identified 48 direct and transitive packages',
      'Cross-referenced with OSV & NVD databases: 2 vulnerabilities identified',
      'Generated SPDX 2.3 & CycloneDX 1.5 documents',
      'Scan analysis complete.'
    ],
    startedAt: '2026-10-06T10:29:33Z',
    completedAt: '2026-10-06T10:30:15Z',
  },
  {
    id: 'scan-4c91d8e2',
    targetProject: 'Auth & Identity Gateway',
    appService: 'auth-service',
    releaseTag: 'v3.1.0',
    scanType: 'Local Source',
    source: '/srv/services/auth-gateway',
    status: 'completed',
    stage: 'complete',
    progress: 100,
    timestamp: '2026-10-06 09:14:20',
    componentsFound: 32,
    cvesFound: 0,
    criticals: 0,
    highs: 0,
    duration: '28s',
    logMessages: [
      'Local directory scanned',
      'Discovered 32 components',
      'Zero known CVEs detected',
      'Scan completed successfully.'
    ],
    startedAt: '2026-10-06T09:13:52Z',
    completedAt: '2026-10-06T09:14:20Z',
  },
  {
    id: 'scan-7e103f5a',
    targetProject: 'Analytics & Reporting ETL',
    appService: 'analytics-worker',
    releaseTag: 'v1.8.4',
    scanType: 'Bulk Scan',
    source: 'analytics-batch-manifest.csv',
    status: 'completed',
    stage: 'complete',
    progress: 100,
    timestamp: '2026-10-05 18:22:10',
    componentsFound: 64,
    cvesFound: 3,
    criticals: 1,
    highs: 2,
    duration: '1m 15s',
    logMessages: [
      'Batch manifest imported',
      '64 dependencies verified',
      'Found 1 Critical (CVE-2024-21538), 2 High vulnerabilities',
      'SBOM compliance verification passed.'
    ],
    startedAt: '2026-10-05T18:20:55Z',
    completedAt: '2026-10-05T18:22:10Z',
  },
  {
    id: 'scan-11a5bc93',
    targetProject: 'Cloud Ingress Proxy',
    appService: 'gateway-proxy',
    releaseTag: 'v1.0.8',
    scanType: 'Remote Git',
    source: 'https://github.com/talakunchi/gateway-proxy',
    status: 'running',
    stage: 'vulnerability_scan',
    progress: 68,
    timestamp: '2026-10-06 11:32:00',
    componentsFound: 24,
    cvesFound: 1,
    criticals: 0,
    highs: 1,
    duration: '35s',
    logMessages: [
      'Cloning repository main branch',
      'Detecting packages: 24 found',
      'Querying vulnerability databases...'
    ],
    startedAt: '2026-10-06T11:31:25Z',
  },
];

export const initialUsers: UserAccount[] = [];

export const licenseDistributionData: Array<{ name: string; value: number; color: string }> = [];

export const vulnerabilityTrend7d: Array<Record<string, any>> = [];

export const vulnerabilityTrend30d: Array<Record<string, any>> = [];

export const vulnerabilityTrend90d: Array<Record<string, any>> = [];

export const vulnerabilityTrendData = vulnerabilityTrend30d;

export const riskHeatmapData: { project: string; critical: number; high: number; medium: number; low: number }[] = [];

export const topRiskProjectsData: any[] = [];

export const vulnerabilityAgingData: any[] = [];

export const sbomCoverageData = {
  totalRepos: 0,
  coveredRepos: 0,
  percentage: 0,
  fresh: 0,
  stale: 0,
  missing: 0,
};

