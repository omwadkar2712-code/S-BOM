import React, { useState } from 'react';
import {
  Info,
  CheckCircle2,
  Plus,
  Key,
  X,
  RefreshCw,
  Search,
  ExternalLink,
  ShieldCheck,
  AlertCircle,
  Unplug,
  Boxes,
  Layers,
  Settings,
} from 'lucide-react';
import { useAppState } from '../context/AppStateContext';

interface IntegrationItem {
  id: string;
  name: string;
  category: 'CI/CD' | 'Ticketing' | 'Alerting' | 'Intel' | 'Runtime' | 'Signing';
  avatarText: string;
  subtitle: string;
  status: 'Connected' | 'Available';
  description: string;
  endpoint?: string;
  lastSync?: string;
}

interface CategoryGroup {
  id: string;
  title: string;
  info: string;
  items: IntegrationItem[];
}

const IntegrationIcon: React.FC<{ id: string; className?: string }> = ({ id, className = 'w-10 h-10' }) => {
  switch (id) {
    case 'github-actions':
    case 'BB':
      return (
        <div className={`${className} rounded-lg bg-gray-900 dark:bg-gray-800 text-white flex items-center justify-center p-2.5 shrink-0 shadow-2xs border border-gray-700/60`}>
          <svg className="w-full h-full fill-current" viewBox="0 0 24 24">
            <path fillRule="evenodd" clipRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" />
          </svg>
        </div>
      );
    case 'gitlab-ci':
      return (
        <div className={`${className} rounded-lg bg-[#fc6d26]/10 dark:bg-[#fc6d26]/20 border border-[#fc6d26]/30 flex items-center justify-center p-2.5 shrink-0 shadow-2xs`}>
          <svg className="w-full h-full text-[#fc6d26] fill-current" viewBox="0 0 24 24">
            <path d="M23.955 13.587l-1.342-4.135-2.664-8.189c-.135-.423-.73-.423-.867 0L16.418 9.45H7.582L4.918 1.263c-.136-.423-.732-.423-.867 0L1.387 9.452.045 13.587c-.29.897.026 1.884.78 2.438L12 23.955l11.175-7.93c.754-.554 1.07-1.541.78-2.438z" />
          </svg>
        </div>
      );
    case 'jenkins':
      return (
        <div className={`${className} rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center p-2 shrink-0 shadow-2xs`}>
          <Layers className="w-5 h-5 text-slate-700 dark:text-slate-300" />
        </div>
      );
    case 'jira':
    case 'SN':
      return (
        <div className={`${className} rounded-lg bg-blue-50 dark:bg-blue-950/50 border border-blue-200/80 dark:border-blue-800/60 flex items-center justify-center p-2.5 shrink-0 shadow-2xs`}>
          <svg className="w-full h-full text-[#0052cc] dark:text-blue-400 fill-current" viewBox="0 0 24 24">
            <path d="M11.571 11.514H.429a11.571 11.571 0 0011.571 11.572V11.514zM12.429.429v11.085h11.142A11.571 11.571 0 0012.429.429z" />
            <path d="M11.571.429A11.571 11.571 0 000 12h11.571V.429z" opacity="0.7" />
          </svg>
        </div>
      );
    case 'slack':
    case 'PD':
      return (
        <div className={`${className} rounded-lg bg-purple-50 dark:bg-purple-950/50 border border-purple-200/80 dark:border-purple-800/60 flex items-center justify-center p-2.5 shrink-0 shadow-2xs`}>
          <svg className="w-full h-full" viewBox="0 0 24 24">
            <path d="M6 15a2 2 0 100-4 2 2 0 000 4z" fill="#E01E5A"/>
            <path d="M7 15a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H9a2 2 0 01-2-2v-2z" fill="#E01E5A"/>
            <path d="M9 6a2 2 0 10-4 0 2 2 0 004 0z" fill="#36C5F0"/>
            <path d="M9 7a2 2 0 012 2v2a2 2 0 01-2 2H7a2 2 0 01-2-2V9a2 2 0 012-2h2z" fill="#36C5F0"/>
            <path d="M18 9a2 2 0 100 4 2 2 0 000-4z" fill="#2EB67D"/>
            <path d="M17 9a2 2 0 01-2 2h-2a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2v2z" fill="#2EB67D"/>
            <path d="M15 18a2 2 0 104 0 2 2 0 00-4 0z" fill="#ECB22E"/>
            <path d="M15 17a2 2 0 01-2-2v-2a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2z" fill="#ECB22E"/>
          </svg>
        </div>
      );
    case 'ms-teams':
      return (
        <div className={`${className} rounded-lg bg-indigo-50 dark:bg-indigo-950/50 border border-indigo-200/80 dark:border-indigo-800/60 flex items-center justify-center p-2.5 shrink-0 shadow-2xs`}>
          <svg className="w-full h-full text-[#5059c9] dark:text-indigo-400 fill-current" viewBox="0 0 24 24">
            <path d="M19.5 7.5a2.5 2.5 0 100-5 2.5 2.5 0 000 5zm-11 2a3.5 3.5 0 100-7 3.5 3.5 0 000 7zm11 1h-3a3 3 0 011 2.2V16h5v-3.5a2 2 0 00-3-2zm-8 1H7a4 4 0 00-4 4V19h11v-3.5a4 4 0 00-2.5-3.5z" />
          </svg>
        </div>
      );
    case 'nvd-osv':
    case 'SK':
      return (
        <div className={`${className} rounded-lg bg-teal-50 dark:bg-teal-950/50 border border-teal-200/80 dark:border-teal-800/60 flex items-center justify-center p-2 shrink-0 shadow-2xs`}>
          <ShieldCheck className="w-5 h-5 text-teal-600 dark:text-teal-400" />
        </div>
      );
    case 'container-registries':
    case 'HB':
      return (
        <div className={`${className} rounded-lg bg-sky-50 dark:bg-sky-950/50 border border-sky-200/80 dark:border-sky-800/60 flex items-center justify-center p-2 shrink-0 shadow-2xs`}>
          <Boxes className="w-5 h-5 text-sky-600 dark:text-sky-400" />
        </div>
      );
    case 'sigstore-cosign':
    case 'VT':
      return (
        <div className={`${className} rounded-lg bg-amber-50 dark:bg-amber-950/50 border border-amber-200/80 dark:border-amber-800/60 flex items-center justify-center p-2 shrink-0 shadow-2xs`}>
          <Key className="w-5 h-5 text-amber-600 dark:text-amber-400" />
        </div>
      );
    default:
      return (
        <div className={`${className} rounded-lg bg-blue-50 dark:bg-blue-950/50 border border-blue-200/80 dark:border-blue-800/60 flex items-center justify-center p-2 shrink-0 shadow-2xs`}>
          <ShieldCheck className="w-5 h-5 text-blue-600 dark:text-blue-400" />
        </div>
      );
  }
};

export const Integrations: React.FC = () => {
  const { addToast } = useAppState();

  // Search Filter
  const [searchQuery, setSearchQuery] = useState('');

  // Modals state
  const [managingItem, setManagingItem] = useState<IntegrationItem | null>(null);
  const [connectingItem, setConnectingItem] = useState<IntegrationItem | null>(null);
  const [patModalOpen, setPatModalOpen] = useState(false);
  const [addModalOpen, setAddModalOpen] = useState(false);

  // Form input states
  const [connectApiKey, setConnectApiKey] = useState('');
  const [connectEndpoint, setConnectEndpoint] = useState('');
  const [gitPatToken, setGitPatToken] = useState('ghp_9f83a8120b4819e92841029482019482');
  const [gitPatMasked, setGitPatMasked] = useState(true);

  // Integrations state matching Screenshot 1 & Screenshot 2
  const [integrationsList, setIntegrationsList] = useState<IntegrationItem[]>([
    // Category: CI/CD
    {
      id: 'github-actions',
      name: 'GitHub Actions',
      category: 'CI/CD',
      avatarText: 'GH',
      subtitle: '12 workflows · release gating on',
      status: 'Connected',
      description: 'Auto-generates CycloneDX & SPDX on every pull request and release tag.',
      endpoint: 'https://api.github.com/repos/enterprise-org/actions/workflows',
      lastSync: '5m ago',
    },
    {
      id: 'gitlab-ci',
      name: 'GitLab CI',
      category: 'CI/CD',
      avatarText: 'GL',
      subtitle: '4 pipelines',
      status: 'Connected',
      description: 'Integrates with GitLab CI runners to upload artifacts directly to catalog.',
      endpoint: 'https://gitlab.com/api/v4/projects/pipelines',
      lastSync: '18m ago',
    },
    {
      id: 'jenkins',
      name: 'Jenkins',
      category: 'CI/CD',
      avatarText: 'JK',
      subtitle: 'Not configured',
      status: 'Available',
      description: 'Deploy Jenkins plugin or webhook step for legacy enterprise builds.',
    },

    // Category: Ticketing
    {
      id: 'jira',
      name: 'Jira',
      category: 'Ticketing',
      avatarText: 'JR',
      subtitle: 'Auto-create issues for Critical CVEs',
      status: 'Connected',
      description: 'Syncs detected CVEs into Jira Software backlog with severity mapping.',
      endpoint: 'https://jira.enterprise.atlassian.net/rest/api/3',
      lastSync: '2m ago',
    },

    // Category: Alerting
    {
      id: 'slack',
      name: 'Slack',
      category: 'Alerting',
      avatarText: 'SL',
      subtitle: '#sec-sbom channel',
      status: 'Connected',
      description: 'Sends real-time audit notifications and CVE alerts to Slack.',
      endpoint: 'https://hooks.slack.com/services/T00/B00/sec-sbom',
      lastSync: 'Just now',
    },
    {
      id: 'ms-teams',
      name: 'Microsoft Teams',
      category: 'Alerting',
      avatarText: 'TM',
      subtitle: 'Not configured',
      status: 'Available',
      description: 'Post webhook notifications into designated Microsoft Teams channel.',
    },

    // Category: Intel
    {
      id: 'nvd-osv',
      name: 'NVD / OSV',
      category: 'Intel',
      avatarText: 'NV',
      subtitle: 'CVE feed · refreshed 12m ago',
      status: 'Connected',
      description: 'Continuous ingestion of NIST NVD 2.0 and Google OSV vulnerability feeds.',
      endpoint: 'https://services.nvd.nist.gov/rest/json/cves/2.0',
      lastSync: '12m ago',
    },

    // Category: Runtime
    {
      id: 'container-registries',
      name: 'Container registries',
      category: 'Runtime',
      avatarText: 'CR',
      subtitle: 'ECR + ACR watchers',
      status: 'Connected',
      description: 'Monitors Amazon ECR and Azure Container Registry for image pushes.',
      endpoint: 'arn:aws:ecr:us-east-1:123456789012:repository/*',
      lastSync: '25m ago',
    },

    // Category: Signing
    {
      id: 'sigstore-cosign',
      name: 'Sigstore / Cosign',
      category: 'Signing',
      avatarText: 'SG',
      subtitle: 'Verify signed SBOMs',
      status: 'Connected',
      description: 'Verifies digital signatures and in-toto attestations before release ingestion.',
      endpoint: 'https://rekor.sigstore.dev',
      lastSync: '1h ago',
    },
  ]);

  // Group into categories
  const categories: CategoryGroup[] = [
    {
      id: 'cicd',
      title: 'CI/CD',
      info: 'Continuous Integration & Deployment pipelines generating continuous SBOMs and enforcing release gates.',
      items: integrationsList.filter((i) => i.category === 'CI/CD'),
    },
    {
      id: 'ticketing',
      title: 'Ticketing',
      info: 'Automated issue tracking and remediation ticket creation for detected CVEs.',
      items: integrationsList.filter((i) => i.category === 'Ticketing'),
    },
    {
      id: 'alerting',
      title: 'Alerting',
      info: 'Real-time notifications for critical vulnerabilities, policy breaches, and SBOM updates.',
      items: integrationsList.filter((i) => i.category === 'Alerting'),
    },
    {
      id: 'intel',
      title: 'Intel',
      info: 'Upstream CVE feeds, EPSS scoring telemetry, and threat intelligence synchronizers.',
      items: integrationsList.filter((i) => i.category === 'Intel'),
    },
    {
      id: 'runtime',
      title: 'Runtime',
      info: 'Container registry watchers, cluster telemetry, and runtime SBOM reconcilers.',
      items: integrationsList.filter((i) => i.category === 'Runtime'),
    },
    {
      id: 'signing',
      title: 'Signing',
      info: 'Cryptographic attestation and SBOM provenance verification with Sigstore & Cosign.',
      items: integrationsList.filter((i) => i.category === 'Signing'),
    },
  ];

  // Filtered categories
  const filteredCategories = categories.map((cat) => ({
    ...cat,
    items: cat.items.filter(
      (item) =>
        item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.subtitle.toLowerCase().includes(searchQuery.toLowerCase())
    ),
  })).filter((cat) => cat.items.length > 0);

  const connectedCount = integrationsList.filter((i) => i.status === 'Connected').length;

  // Handlers
  const handleManage = (item: IntegrationItem) => {
    setManagingItem(item);
  };

  const handleConnect = (item: IntegrationItem) => {
    setConnectingItem(item);
    setConnectApiKey('');
    setConnectEndpoint('');
  };

  const handleDisconnect = (id: string) => {
    setIntegrationsList((prev) =>
      prev.map((item) => (item.id === id ? { ...item, status: 'Available', subtitle: 'Not configured' } : item))
    );
    setManagingItem(null);
    addToast({
      type: 'info',
      title: 'Integration Disconnected',
      message: 'The integration credentials have been revoked and removed.',
    });
  };

  const handleConfirmConnect = (e: React.FormEvent) => {
    e.preventDefault();
    if (!connectingItem) return;

    setIntegrationsList((prev) =>
      prev.map((item) =>
        item.id === connectingItem.id
          ? {
              ...item,
              status: 'Connected',
              subtitle: item.id === 'jenkins' ? '2 pipelines active' : '#sec-alerts channel connected',
              lastSync: 'Just now',
            }
          : item
      )
    );
    addToast({
      type: 'success',
      title: `${connectingItem.name} Connected`,
      message: `Successfully authenticated and configured ${connectingItem.name}.`,
    });
    setConnectingItem(null);
  };

  const handleSavePat = (e: React.FormEvent) => {
    e.preventDefault();
    setPatModalOpen(false);
    addToast({
      type: 'success',
      title: 'Git Token Updated',
      message: 'Updated Personal Access Token for remote scan jobs.',
    });
  };

  return (
    <div className="space-y-6 animate-fadeIn pb-16">
      {/* Filter & Action Controls Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-2.5">
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/60">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            {connectedCount} of {integrationsList.length} Connected
          </span>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2.5 flex-wrap sm:flex-nowrap">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Filter integrations..."
              className="text-xs pl-8 pr-3 py-1.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500 shadow-2xs w-48 sm:w-56"
            />
          </div>

          <button
            onClick={() => setPatModalOpen(true)}
            className="px-3 py-1.5 text-xs font-semibold bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-750 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-700 rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer shadow-2xs shrink-0"
          >
            <Key className="w-3.5 h-3.5 text-blue-500" />
            <span>Git Token Vault</span>
          </button>

          <button
            onClick={() => setAddModalOpen(true)}
            className="px-3.5 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg flex items-center gap-1.5 shadow-2xs transition-colors cursor-pointer shrink-0"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Connection</span>
          </button>
        </div>
      </div>

      {/* Integration Categories with Clean Dividers & Grid */}
      <div className="space-y-6">
        {filteredCategories.map((cat) => (
          <div key={cat.id} className="space-y-3">
            {/* Category Header */}
            <div className="flex items-center justify-between border-b border-gray-200 dark:border-gray-800 pb-2">
              <div className="flex items-center gap-2">
                <h2 className="text-xs font-bold uppercase tracking-wider text-gray-800 dark:text-gray-200">
                  {cat.title}
                </h2>
                <span className="text-[10px] font-bold text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-800 px-2 py-0.5 rounded-full border border-gray-200/60 dark:border-gray-700/60">
                  {cat.items.length}
                </span>
              </div>
              <p className="text-[11px] text-gray-500 dark:text-gray-400 hidden sm:block">
                {cat.info}
              </p>
            </div>

            {/* Grid of Integration Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
              {cat.items.map((item) => (
                <div
                  key={item.id}
                  className="bg-white dark:bg-[#111827] border border-gray-200 dark:border-gray-800 rounded-xl p-4 flex flex-col justify-between hover:border-gray-300 dark:hover:border-gray-700 transition-all shadow-2xs group min-h-[148px]"
                >
                  <div>
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <IntegrationIcon id={item.id} />
                        <div className="min-w-0">
                          <h3 className="text-sm font-bold text-gray-900 dark:text-white truncate">
                            {item.name}
                          </h3>
                          <p className="text-xs text-gray-500 dark:text-gray-400 truncate mt-0.5">
                            {item.subtitle}
                          </p>
                        </div>
                      </div>

                      {/* Status Pill */}
                      {item.status === 'Connected' ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 shrink-0">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                          Connected
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shrink-0">
                          Available
                        </span>
                      )}
                    </div>

                    <p className="text-xs text-gray-600 dark:text-gray-400 line-clamp-2 mt-3 leading-relaxed">
                      {item.description}
                    </p>
                  </div>

                  {/* Bottom Action Button */}
                  {item.status === 'Connected' ? (
                    <button
                      onClick={() => handleManage(item)}
                      className="mt-4 w-full py-1.5 px-3 rounded-lg text-xs font-semibold text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-750 transition-colors cursor-pointer text-center shadow-2xs flex items-center justify-center gap-1.5"
                    >
                      <Settings className="w-3.5 h-3.5 text-gray-400" />
                      Manage
                    </button>
                  ) : (
                    <button
                      onClick={() => handleConnect(item)}
                      className="mt-4 w-full py-1.5 px-3 rounded-lg text-xs font-semibold text-blue-600 dark:text-blue-400 bg-blue-50/70 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800/60 hover:bg-blue-100/70 dark:hover:bg-blue-900/40 transition-colors cursor-pointer text-center shadow-2xs flex items-center justify-center gap-1.5"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      Connect
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* ================================================================= */}
      {/* MODAL 1: MANAGE MODAL                                             */}
      {/* ================================================================= */}
      {managingItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 animate-fadeIn">
          <div className="bg-white dark:bg-[#111827] rounded-xl max-w-lg w-full p-6 shadow-2xl border border-gray-200 dark:border-gray-800 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100 dark:border-gray-800">
              <div className="flex items-center gap-3">
                <IntegrationIcon id={managingItem.id} />
                <div>
                  <h3 className="text-base font-bold text-gray-900 dark:text-white">
                    {managingItem.name}
                  </h3>
                  <p className="text-xs text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Connected & Active
                  </p>
                </div>
              </div>
              <button
                onClick={() => setManagingItem(null)}
                className="p-1 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
                {managingItem.description}
              </p>

              <div className="p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg border border-gray-200 dark:border-gray-700 space-y-2">
                <div className="flex items-center justify-between text-gray-500">
                  <span>Configuration Endpoint:</span>
                  <span className="font-mono text-gray-800 dark:text-gray-200 truncate max-w-[240px]">
                    {managingItem.endpoint || 'Cloud Managed Service'}
                  </span>
                </div>
                <div className="flex items-center justify-between text-gray-500">
                  <span>Last Synchronized:</span>
                  <span className="font-semibold text-gray-800 dark:text-gray-200">
                    {managingItem.lastSync || 'Continuous'}
                  </span>
                </div>
                <div className="flex items-center justify-between text-gray-500">
                  <span>Health Status:</span>
                  <span className="text-emerald-600 font-bold">100% Operational</span>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-gray-100 dark:border-gray-800">
              <button
                type="button"
                onClick={() => handleDisconnect(managingItem.id)}
                className="px-3.5 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <Unplug className="w-3.5 h-3.5" />
                Disconnect
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    addToast({
                      type: 'success',
                      title: 'Telemetry Refreshed',
                      message: `Triggered live sync on ${managingItem.name}.`,
                    });
                    setManagingItem(null);
                  }}
                  className="px-3.5 py-1.5 text-xs font-semibold text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 rounded-lg cursor-pointer"
                >
                  Sync Now
                </button>
                <button
                  type="button"
                  onClick={() => setManagingItem(null)}
                  className="px-4 py-1.5 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-xs cursor-pointer"
                >
                  Done
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ================================================================= */}
      {/* MODAL 2: CONNECT MODAL                                            */}
      {/* ================================================================= */}
      {connectingItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 animate-fadeIn">
          <div className="bg-white dark:bg-[#111827] rounded-xl max-w-lg w-full p-6 shadow-2xl border border-gray-200 dark:border-gray-800 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100 dark:border-gray-800">
              <div className="flex items-center gap-3">
                <IntegrationIcon id={connectingItem.id} />
                <div>
                  <h3 className="text-base font-bold text-gray-900 dark:text-white">
                    Connect {connectingItem.name}
                  </h3>
                  <p className="text-xs text-gray-500">Configure credentials and telemetry hooks</p>
                </div>
              </div>
              <button
                onClick={() => setConnectingItem(null)}
                className="p-1 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleConfirmConnect} className="space-y-3.5 text-xs">
              <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
                {connectingItem.description}
              </p>

              <div>
                <label className="block font-semibold text-gray-700 dark:text-gray-300 mb-1">
                  Webhook URL or Endpoint
                </label>
                <input
                  type="text"
                  required
                  placeholder={connectingItem.id === 'jenkins' ? 'https://jenkins.internal.company.com' : 'https://outlook.office.com/webhook/...'}
                  value={connectEndpoint}
                  onChange={(e) => setConnectEndpoint(e.target.value)}
                  className="w-full text-xs px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 font-mono text-gray-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block font-semibold text-gray-700 dark:text-gray-300 mb-1">
                  API Key or Secret Token
                </label>
                <input
                  type="password"
                  required
                  placeholder="Enter integration token or credential..."
                  value={connectApiKey}
                  onChange={(e) => setConnectApiKey(e.target.value)}
                  className="w-full text-xs px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 font-mono text-gray-900 dark:text-white"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-gray-100 dark:border-gray-800">
                <button
                  type="button"
                  onClick={() => setConnectingItem(null)}
                  className="px-4 py-2 text-xs font-semibold border border-gray-200 dark:border-gray-700 rounded-lg text-gray-600 dark:text-gray-300 hover:bg-gray-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 dark:bg-blue-600 dark:hover:bg-blue-500 rounded-lg shadow-xs cursor-pointer"
                >
                  Authorize & Connect
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================================================================= */}
      {/* MODAL 3: GIT PAT VAULT MODAL                                      */}
      {/* ================================================================= */}
      {patModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 animate-fadeIn">
          <div className="bg-white dark:bg-[#111827] rounded-xl max-w-lg w-full p-6 shadow-2xl border border-gray-200 dark:border-gray-800 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100 dark:border-gray-800">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-950/60 text-blue-600 flex items-center justify-center">
                  <Key className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-gray-900 dark:text-white">
                    Per-Scan Git Token Vault
                  </h3>
                  <p className="text-xs text-gray-500">Default personal access token for cloning remote repos</p>
                </div>
              </div>
              <button
                onClick={() => setPatModalOpen(false)}
                className="p-1 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSavePat} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-semibold text-gray-700 dark:text-gray-300 mb-1">
                  Personal Access Token (GitHub / GitLab / Bitbucket)
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type={gitPatMasked ? 'password' : 'text'}
                    value={gitPatToken}
                    onChange={(e) => setGitPatToken(e.target.value)}
                    className="flex-1 text-xs px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 font-mono text-gray-900 dark:text-white"
                  />
                  <button
                    type="button"
                    onClick={() => setGitPatMasked(!gitPatMasked)}
                    className="px-2.5 py-2 text-xs border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-750 font-semibold"
                  >
                    {gitPatMasked ? 'Show' : 'Hide'}
                  </button>
                </div>
                <p className="text-[11px] text-gray-500 mt-1">
                  Passed to remote scanners to analyze private source trees and lockfiles securely.
                </p>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-gray-100 dark:border-gray-800">
                <button
                  type="button"
                  onClick={() => setPatModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold border border-gray-200 dark:border-gray-700 rounded-lg text-gray-600 dark:text-gray-300 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm"
                >
                  Save Token
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================================================================= */}
      {/* MODAL 4: ADD CONNECTION MODAL                                     */}
      {/* ================================================================= */}
      {addModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 animate-fadeIn">
          <div className="bg-white dark:bg-[#111827] rounded-xl max-w-lg w-full p-6 shadow-2xl border border-gray-200 dark:border-gray-800 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100 dark:border-gray-800">
              <h3 className="text-base font-bold text-gray-900 dark:text-white">
                Add Enterprise Connection
              </h3>
              <button
                onClick={() => setAddModalOpen(false)}
                className="p-1 rounded-lg text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Select a tool to connect to your SBOM and vulnerability management pipeline:
            </p>
            <div className="grid grid-cols-2 gap-2.5 text-xs">
              {[
                { name: 'Bitbucket Pipelines', cat: 'CI/CD', code: 'BB' },
                { name: 'PagerDuty', cat: 'Alerting', code: 'PD' },
                { name: 'ServiceNow', cat: 'Ticketing', code: 'SN' },
                { name: 'Snyk Intel', cat: 'Intel', code: 'SK' },
                { name: 'Harbor Registry', cat: 'Runtime', code: 'HB' },
                { name: 'Vault by HashiCorp', cat: 'Secrets', code: 'VT' },
              ].map((service) => (
                <button
                  key={service.name}
                  onClick={() => {
                    setAddModalOpen(false);
                    addToast({
                      type: 'info',
                      title: 'Connector Setup',
                      message: `Initiating connection flow for ${service.name}.`,
                    });
                  }}
                  className="p-3 border border-gray-200 dark:border-gray-700 rounded-lg hover:border-blue-500 hover:bg-gray-50 dark:hover:bg-gray-800/60 flex items-center gap-2.5 text-left transition-all"
                >
                  <IntegrationIcon id={service.code} className="w-8 h-8" />
                  <div>
                    <div className="font-bold text-gray-900 dark:text-white">{service.name}</div>
                    <div className="text-[10px] text-gray-400">{service.cat}</div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Integrations;
