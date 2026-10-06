import React, { useState } from 'react';
import {
  Building,
  Shield,
  FileCode,
  Bell,
  Sliders,
  Database,
  Key,
  Save,
  CheckCircle2,
  Info,
} from 'lucide-react';
import { useAppState } from '../../context/AppStateContext';

export const Settings: React.FC = () => {
  const { addToast } = useAppState();

  const [orgName, setOrgName] = useState('Talakunchi Security Operations');
  const [primaryDomain, setPrimaryDomain] = useState('talakunchi.com');
  const [retentionDays, setRetentionDays] = useState('365');
  const [autoScanPRs, setAutoScanPRs] = useState(true);
  const [failBuildsOnCritical, setFailBuildsOnCritical] = useState(true);
  const [slackAlerts, setSlackAlerts] = useState(true);
  const [emailDigest, setEmailDigest] = useState(true);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    addToast({
      type: 'success',
      title: 'Settings Saved',
      message: 'Organization configuration updated across all scanning engines.',
    });
  };

  return (
    <div className="space-y-6 animate-fadeIn pb-12 max-w-4xl">

      <form onSubmit={handleSave} className="space-y-6">
        {/* Section 1: Organization Taxonomy */}
        <div className="bg-white dark:bg-[#111827] border border-gray-200 dark:border-gray-800 rounded-xl p-6 shadow-sm space-y-4">
          <div className="flex items-center gap-2 border-b border-gray-100 dark:border-gray-800 pb-3">
            <Building className="w-4 h-4 text-blue-600" />
            <h3 className="text-sm font-bold text-gray-900 dark:text-white">Organization Profile</h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-gray-600 dark:text-gray-300 uppercase tracking-wider mb-1.5">
                Organization Display Name
              </label>
              <input
                type="text"
                value={orgName}
                onChange={e => setOrgName(e.target.value)}
                className="w-full px-3.5 py-2 text-sm bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-600 dark:text-gray-300 uppercase tracking-wider mb-1.5">
                Primary Corporate Domain
              </label>
              <input
                type="text"
                value={primaryDomain}
                onChange={e => setPrimaryDomain(e.target.value)}
                className="w-full px-3.5 py-2 text-sm bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
        </div>

        {/* Section 2: Scanning & CI/CD Engine */}
        <div className="bg-white dark:bg-[#111827] border border-gray-200 dark:border-gray-800 rounded-xl p-6 shadow-sm space-y-4">
          <div className="flex items-center gap-2 border-b border-gray-100 dark:border-gray-800 pb-3">
            <Sliders className="w-4 h-4 text-blue-600" />
            <h3 className="text-sm font-bold text-gray-900 dark:text-white">Automated Scan Engine Policies</h3>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800/60 rounded-lg border border-gray-200 dark:border-gray-700">
              <div>
                <span className="text-xs font-bold text-gray-900 dark:text-white block">
                  Automatic PR / Merge Request Multi-BOM Extraction
                </span>
                <span className="text-[11px] text-gray-500">
                  Runs SBOM scanning automatically upon every code commit in monitored repositories.
                </span>
              </div>
              <input
                type="checkbox"
                checked={autoScanPRs}
                onChange={e => setAutoScanPRs(e.target.checked)}
                className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
            </div>

            <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800/60 rounded-lg border border-gray-200 dark:border-gray-700">
              <div>
                <span className="text-xs font-bold text-gray-900 dark:text-white block">
                  Fail CI/CD Builds on Unmitigated Critical CVEs (CVSS &gt;= 9.0)
                </span>
                <span className="text-[11px] text-gray-500">
                  Halts release pipelines until security team approves exception or merges fix.
                </span>
              </div>
              <input
                type="checkbox"
                checked={failBuildsOnCritical}
                onChange={e => setFailBuildsOnCritical(e.target.checked)}
                className="h-4 w-4 rounded border-gray-300 text-red-600 focus:ring-red-500"
              />
            </div>
          </div>
        </div>

        {/* Section 3: Data Retention & Compliance Archiving */}
        <div className="bg-white dark:bg-[#111827] border border-gray-200 dark:border-gray-800 rounded-xl p-6 shadow-sm space-y-4">
          <div className="flex items-center gap-2 border-b border-gray-100 dark:border-gray-800 pb-3">
            <Database className="w-4 h-4 text-emerald-600" />
            <h3 className="text-sm font-bold text-gray-900 dark:text-white">Data Retention & Audit Logs</h3>
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-600 dark:text-gray-300 uppercase tracking-wider mb-1.5">
              Historical SBOM Snapshot Retention Period
            </label>
            <select
              value={retentionDays}
              onChange={e => setRetentionDays(e.target.value)}
              className="w-full px-3.5 py-2 text-sm bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="90">90 Days (Minimum)</option>
              <option value="180">180 Days (CERT-In Recommended)</option>
              <option value="365">365 Days (1 Year - Standard)</option>
              <option value="1825">5 Years (ISO 27001 / SOC 2 Type II)</option>
            </select>
          </div>
        </div>

        {/* Section 4: Notifications */}
        <div className="bg-white dark:bg-[#111827] border border-gray-200 dark:border-gray-800 rounded-xl p-6 shadow-sm space-y-4">
          <div className="flex items-center gap-2 border-b border-gray-100 dark:border-gray-800 pb-3">
            <Bell className="w-4 h-4 text-amber-500" />
            <h3 className="text-sm font-bold text-gray-900 dark:text-white">Alert Routing & Incident Webhooks</h3>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800/60 rounded-lg border border-gray-200 dark:border-gray-700">
              <div>
                <span className="text-xs font-bold text-gray-900 dark:text-white block">Slack Channel Broadcasts (#security-alerts)</span>
                <span className="text-[11px] text-gray-500">Real-time alerts for zero-days and blocked builds.</span>
              </div>
              <input
                type="checkbox"
                checked={slackAlerts}
                onChange={e => setSlackAlerts(e.target.checked)}
                className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
            </div>

            <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800/60 rounded-lg border border-gray-200 dark:border-gray-700">
              <div>
                <span className="text-xs font-bold text-gray-900 dark:text-white block">Weekly Security Posture Email Digest</span>
                <span className="text-[11px] text-gray-500">Summary sent to executive leadership every Monday 09:00 UTC.</span>
              </div>
              <input
                type="checkbox"
                checked={emailDigest}
                onChange={e => setEmailDigest(e.target.checked)}
                className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
            </div>
          </div>
        </div>

        <div className="flex justify-end pt-2">
          <button
            type="submit"
            className="px-5 py-2.5 text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white rounded-lg shadow-sm flex items-center gap-2"
          >
            <Save className="w-4 h-4" />
            Save Organization Settings
          </button>
        </div>
      </form>
    </div>
  );
};
