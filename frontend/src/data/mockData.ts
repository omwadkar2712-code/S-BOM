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

export const initialComponents: SBOMComponent[] = [];

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

export const initialScansHistory: ScanJob[] = [];

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

