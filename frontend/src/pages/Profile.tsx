import React, { useState } from 'react';
import {
  User,
  Mail,
  Shield,
  Building,
  KeyRound,
  Smartphone,
  Lock,
  CheckCircle2,
  AlertCircle,
  Save,
} from 'lucide-react';
import { useAppState } from '../context/AppStateContext';

export const Profile: React.FC = () => {
  const { addToast } = useAppState();

  const [name, setName] = useState('Asha Mehta');
  const [email, setEmail] = useState('asha@talakunchi.com');
  const [role, setRole] = useState('Security Admin');
  const [org, setOrg] = useState('Talakunchi Security Operations');
  const [twoFactor, setTwoFactor] = useState(true);

  // Workspace & Governance Settings State (Migrated from Security Policies)
  const [orgName, setOrgName] = useState<string>('SQUAD1 Defense Technologies Inc.');
  const [adminEmail, setAdminEmail] = useState<string>('security-admin@squad1.io');
  const [defaultSeverityGate, setDefaultSeverityGate] = useState<'Critical' | 'High' | 'Medium'>('High');
  const [retentionDays, setRetentionDays] = useState<number>(180);
  const [autoQuarantine, setAutoQuarantine] = useState<boolean>(true);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    addToast({
      type: 'success',
      title: 'Profile Updated',
      message: 'Account details and security preferences saved successfully.',
    });
  };

  const handleSaveGovernance = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    addToast({
      type: 'success',
      title: 'Workspace & Governance Saved',
      message: `Updated workspace configuration and build quarantine gates for ${orgName}.`,
    });
  };

  return (
    <div className="space-y-6 animate-fadeIn pb-12 max-w-4xl">
      {/* Profile Overview Card */}
      <div className="bg-white dark:bg-[#111827] border border-gray-200 dark:border-gray-800 rounded-xl p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center gap-5">
          <div className="w-16 h-16 rounded-full bg-blue-600 text-white flex items-center justify-center font-black text-xl shadow-md">
            AM
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-gray-900 dark:text-white">{name}</h2>
              <span className="px-2 py-0.5 rounded text-xs font-semibold bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300">
                {role}
              </span>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              Primary Security Administrator · Organization: {org}
            </p>
          </div>
        </div>
      </div>

      {/* Details Form */}
      <form onSubmit={handleSave} className="bg-white dark:bg-[#111827] border border-gray-200 dark:border-gray-800 rounded-xl p-6 shadow-sm space-y-5">
        <h3 className="text-sm font-bold text-gray-900 dark:text-white border-b border-gray-100 dark:border-gray-800 pb-3">
          User Information
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold text-gray-600 dark:text-gray-300 uppercase tracking-wider mb-1.5">
              Full Name
            </label>
            <div className="relative">
              <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                className="w-full px-3.5 py-2 pl-9 text-sm bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <User className="w-4 h-4 text-gray-400 absolute left-3 top-2.5" />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-600 dark:text-gray-300 uppercase tracking-wider mb-1.5">
              Email Address
            </label>
            <div className="relative">
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="w-full px-3.5 py-2 pl-9 text-sm bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <Mail className="w-4 h-4 text-gray-400 absolute left-3 top-2.5" />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-600 dark:text-gray-300 uppercase tracking-wider mb-1.5">
              Role
            </label>
            <div className="relative">
              <input
                type="text"
                disabled
                value={role}
                className="w-full px-3.5 py-2 pl-9 text-sm bg-gray-100 dark:bg-gray-850 border border-gray-200 dark:border-gray-700 rounded-lg text-gray-500 dark:text-gray-400"
              />
              <Shield className="w-4 h-4 text-gray-400 absolute left-3 top-2.5" />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-600 dark:text-gray-300 uppercase tracking-wider mb-1.5">
              Organization
            </label>
            <div className="relative">
              <input
                type="text"
                value={org}
                onChange={e => setOrg(e.target.value)}
                className="w-full px-3.5 py-2 pl-9 text-sm bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <Building className="w-4 h-4 text-gray-400 absolute left-3 top-2.5" />
            </div>
          </div>
        </div>

        {/* Security & Authentication */}
        <h3 className="text-sm font-bold text-gray-900 dark:text-white border-b border-gray-100 dark:border-gray-800 pb-3 pt-3">
          Security & Multi-Factor Authentication
        </h3>

        <div className="space-y-3">
          <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800/60 rounded-xl border border-gray-200 dark:border-gray-700">
            <div className="flex items-center gap-3">
              <Smartphone className="w-5 h-5 text-emerald-600" />
              <div>
                <h4 className="text-xs font-bold text-gray-900 dark:text-white">Two-Factor Authentication (TOTP)</h4>
                <p className="text-[11px] text-gray-500">Hardware token or Authenticator app (Google Authenticator / YubiKey)</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                setTwoFactor(!twoFactor);
                addToast({
                  type: 'info',
                  title: '2FA Setting Changed',
                  message: `Two-factor authentication ${!twoFactor ? 'enabled' : 'disabled'}.`,
                });
              }}
              className={`px-3 py-1 text-xs font-semibold rounded-lg border transition-colors ${
                twoFactor
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-300 dark:bg-emerald-950 dark:border-emerald-800'
                  : 'bg-gray-100 text-gray-600 border-gray-300 dark:bg-gray-800'
              }`}
            >
              {twoFactor ? 'Enabled' : 'Disabled'}
            </button>
          </div>

          <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800/60 rounded-xl border border-gray-200 dark:border-gray-700">
            <div className="flex items-center gap-3">
              <KeyRound className="w-5 h-5 text-blue-600" />
              <div>
                <h4 className="text-xs font-bold text-gray-900 dark:text-white">Active API Keys</h4>
                <p className="text-[11px] text-gray-500 font-mono">sq1_live_9f83a... (Full Scan & Ingestion Permissions)</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                addToast({
                  type: 'success',
                  title: 'API Token Rotated',
                  message: 'Generated new cryptographic API token for Asha Mehta.',
                });
              }}
              className="px-3 py-1 text-xs font-semibold rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 hover:bg-gray-100"
            >
              Rotate Key
            </button>
          </div>
        </div>

        <div className="pt-3 flex justify-end">
          <button
            type="submit"
            className="px-5 py-2 text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-lg shadow-sm flex items-center gap-1.5 cursor-pointer"
          >
            <Save className="w-4 h-4" />
            Save Profile Changes
          </button>
        </div>
      </form>

      {/* Workspace & Governance Settings Section */}
      <div className="bg-white dark:bg-[#111827] border border-gray-200 dark:border-gray-800 rounded-xl p-6 shadow-sm space-y-5">
        <div className="flex items-center gap-2.5 border-b border-gray-100 dark:border-gray-800 pb-3">
          <div className="w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-900/40 text-blue-600 flex items-center justify-center">
            <Building className="w-4.5 h-4.5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-gray-900 dark:text-white">Workspace & Governance Settings</h3>
            <p className="text-xs text-gray-500 dark:text-gray-400">Global organization parameters, severity release gates, and compliance retention.</p>
          </div>
        </div>

        <form onSubmit={handleSaveGovernance} className="space-y-4 text-xs">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-gray-600 dark:text-gray-300 uppercase tracking-wider mb-1.5">
                Organization Entity Name *
              </label>
              <input
                type="text"
                value={orgName}
                onChange={(e) => setOrgName(e.target.value)}
                className="w-full px-3.5 py-2 text-sm bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-600 dark:text-gray-300 uppercase tracking-wider mb-1.5">
                Security Operations Contact Email *
              </label>
              <input
                type="email"
                value={adminEmail}
                onChange={(e) => setAdminEmail(e.target.value)}
                className="w-full px-3.5 py-2 text-sm bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-gray-600 dark:text-gray-300 uppercase tracking-wider mb-1.5">
                CI/CD Severity Gate
              </label>
              <select
                value={defaultSeverityGate}
                onChange={(e) => setDefaultSeverityGate(e.target.value as any)}
                className="w-full px-3.5 py-2 text-sm bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="Critical">Block on Critical (&gt;9.0)</option>
                <option value="High">Block on High or Critical (&gt;7.0)</option>
                <option value="Medium">Block on Medium or Higher (&gt;4.0)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-600 dark:text-gray-300 uppercase tracking-wider mb-1.5">
                Audit Log Retention (Days)
              </label>
              <input
                type="number"
                value={retentionDays}
                onChange={(e) => setRetentionDays(Number(e.target.value))}
                className="w-full px-3.5 py-2 text-sm bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
              />
            </div>
          </div>

          <div className="flex items-center justify-between p-3.5 bg-gray-50 dark:bg-gray-800/40 rounded-xl border border-gray-200 dark:border-gray-700">
            <div>
              <span className="font-bold text-gray-800 dark:text-gray-200 block text-xs">
                Automatic Quarantine on Malicious Upstream
              </span>
              <span className="text-[11px] text-gray-500 dark:text-gray-400">
                Immediately mark packages in active tickets as quarantined if flagged by OSV malicious feeds.
              </span>
            </div>
            <input
              type="checkbox"
              checked={autoQuarantine}
              onChange={(e) => setAutoQuarantine(e.target.checked)}
              className="w-4 h-4 accent-blue-600 cursor-pointer"
            />
          </div>

          <div className="flex justify-end pt-2">
            <button
              type="submit"
              className="px-5 py-2 text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-lg shadow-sm flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Save className="w-4 h-4" />
              Save Governance Settings
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
