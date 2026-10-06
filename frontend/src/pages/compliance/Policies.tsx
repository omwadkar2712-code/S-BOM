import React, { useState } from 'react';
import {
  ShieldCheck,
  ShieldAlert,
  Info,
  Key,
  CreditCard,
  Sliders,
  CheckCircle2,
  Folder,
  Save,
  BookOpen,
  Award,
  AlertTriangle,
} from 'lucide-react';
import { useAppState } from '../../context/AppStateContext';

export const Policies: React.FC = () => {
  const { addToast } = useAppState();

  // Shared Chrome Context Filter
  const [scopedProject, setScopedProject] = useState<string>('all');

  // Component 3: License Entitlements State
  const entitlements = {
    plan: 'Enterprise Ultimate (Multi-BOM Tier)',
    status: 'Active & Verified',
    expiry: '2027-12-31',
    seatsUsed: 14,
    seatsTotal: 50,
    scansMonthUsed: 142,
    scansMonthTotal: 1000,
    storageUsedGB: 18.4,
    storageTotalGB: 100.0,
    features: [
      { name: 'Automated Scheduled Scans (Cron)', enabled: true },
      { name: 'NIST P-256 Cryptographic Signing & Attestation', enabled: true },
      { name: 'CERT-In 28-Column Dossier Generator', enabled: true },
      { name: 'Quantum Readiness (QBOM) & Cryptographic (CBOM) Engines', enabled: true },
      { name: 'AI Remediation via xAI Grok Engine', enabled: true },
      { name: 'Continuous eBPF Runtime Behavioral Monitor', enabled: true },
    ],
  };

  const handleSavePolicies = () => {
    addToast({
      type: 'success',
      title: 'Security Policies Saved',
      message: `Enforced updated policy gates and scoring criteria for ${scopedProject === 'all' ? 'all projects' : scopedProject}.`,
    });
  };

  return (
    <div className="space-y-6 animate-fadeIn pb-12">
      {/* Policy Scope & Action Bar */}
      <div className="bg-white dark:bg-[#111827] border border-gray-200 dark:border-gray-800 rounded-xl p-4 sm:p-5 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-[11px] font-bold bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400">
              <ShieldCheck className="w-3.5 h-3.5" />
              Organizational Rules & Governance
            </span>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap">
            {/* Project Context Filter */}
            <div className="flex items-center gap-1.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg px-2.5 py-1.5">
              <Folder className="w-3.5 h-3.5 text-gray-400" />
              <select
                value={scopedProject}
                onChange={(e) => setScopedProject(e.target.value)}
                className="text-xs font-semibold bg-transparent text-gray-800 dark:text-gray-200 focus:outline-none cursor-pointer"
              >
                <option value="all">Global Organization Defaults</option>
              </select>
            </div>

            {/* Primary Action Button */}
            <button
              onClick={handleSavePolicies}
              className="px-3.5 py-1.5 text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-lg shadow-xs flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Save className="w-3.5 h-3.5" />
              <span>Save Policy Settings</span>
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Component 1 (Methodology Reference) & Component 2 (Org Settings Form) */}
        <div className="lg:col-span-7 space-y-6">
          {/* Component 1: Methodology Reference */}
          <div className="bg-white dark:bg-[#111827] border border-gray-200 dark:border-gray-800 rounded-xl p-5 shadow-xs space-y-4">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-blue-100 dark:bg-blue-900/40 text-blue-600 flex items-center justify-center">
                <BookOpen className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-gray-900 dark:text-white">
                  Deterministic Scoring & Evaluation Methodology
                </h2>
                <p className="text-xs text-gray-500">Official formula specifications used by SQUAD1 multi-BOM engines.</p>
              </div>
            </div>

            <div className="space-y-3 text-xs">
              <div className="p-3 bg-gray-50 dark:bg-gray-800/40 rounded-lg space-y-1">
                <span className="font-bold text-gray-900 dark:text-white block">1. Security Risk Score (0–10 Scale)</span>
                <p className="text-gray-600 dark:text-gray-300 text-[11px] leading-relaxed">
                  Composite index combining base CVSS v3.1 severity, EPSS (Exploit Prediction Scoring System) percentage, and direct vs transitive dependency graph depth:
                </p>
                <div className="p-2 bg-gray-900 text-emerald-400 font-mono text-[10px] rounded mt-1">
                  RiskIndex = min(10.0, ∑ [CVSS × (1.0 + EPSS) × ScopeMultiplier] / log2(TotalComponents + 2))
                </div>
              </div>

              <div className="p-3 bg-gray-50 dark:bg-gray-800/40 rounded-lg space-y-1">
                <span className="font-bold text-gray-900 dark:text-white block">2. Component Criticality Classifier</span>
                <p className="text-gray-600 dark:text-gray-300 text-[11px] leading-relaxed">
                  Components are marked <strong>High Criticality</strong> if they handle network I/O, cryptographic primitives, or user authentication; <strong>Medium</strong> if transitive runtime dependencies; <strong>Low</strong> if build/test dependencies.
                </p>
              </div>

              <div className="p-3 bg-gray-50 dark:bg-gray-800/40 rounded-lg space-y-1">
                <span className="font-bold text-gray-900 dark:text-white block">3. Open Source License Risk Policy</span>
                <p className="text-gray-600 dark:text-gray-300 text-[11px] leading-relaxed">
                  Strict copyleft licenses (GPL-3.0, AGPL-3.0) trigger commercial compliance blocks. Permissive licenses (MIT, Apache-2.0, BSD-3-Clause) are whitelisted automatically.
                </p>
              </div>

              <div className="p-3 bg-gray-50 dark:bg-gray-800/40 rounded-lg space-y-1">
                <span className="font-bold text-gray-900 dark:text-white block">4. EOL Proximity Calculation</span>
                <p className="text-gray-600 dark:text-gray-300 text-[11px] leading-relaxed">
                  Packages older than 730 days without upstream commits, or officially marked End-Of-Life on endoflife.date, are penalized +2.0 points on the risk index.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Component 3 (License Entitlements) */}
        <div className="lg:col-span-5 space-y-6">
          <div className="bg-white dark:bg-[#111827] border border-gray-200 dark:border-gray-800 rounded-xl p-5 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 flex items-center justify-center">
                  <CreditCard className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-gray-900 dark:text-white">License Entitlements</h2>
                  <p className="text-xs text-gray-500">Plan features and capacity usage</p>
                </div>
              </div>
              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700">
                ACTIVE
              </span>
            </div>

            {/* Plan Overview */}
            <div className="p-3.5 bg-gray-50 dark:bg-gray-800/40 rounded-xl space-y-2">
              <div className="flex justify-between text-xs">
                <span className="text-gray-500">Plan Tier:</span>
                <span className="font-bold text-gray-900 dark:text-white">{entitlements.plan}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-gray-500">Valid Until:</span>
                <span className="font-mono font-semibold text-gray-900 dark:text-white">{entitlements.expiry}</span>
              </div>
            </div>

            {/* Quota Bars */}
            <div className="space-y-3 text-xs">
              <div>
                <div className="flex justify-between text-[11px] mb-1">
                  <span className="text-gray-500">Monthly Scans Quota</span>
                  <span className="font-mono font-bold">0 / 0</span>
                </div>
                <div className="w-full bg-gray-100 dark:bg-gray-800 rounded-full h-1.5 overflow-hidden">
                  <div
                    className="bg-blue-600 h-full rounded-full"
                    style={{ width: '0%' }}
                  />
                </div>
              </div>

              <div>
                <div className="flex justify-between text-[11px] mb-1">
                  <span className="text-gray-500">Active Seats Allocated</span>
                  <span className="font-mono font-bold">0 / 0 Seats</span>
                </div>
                <div className="w-full bg-gray-100 dark:bg-gray-800 rounded-full h-1.5 overflow-hidden">
                  <div
                    className="bg-blue-600 h-full rounded-full"
                    style={{ width: '0%' }}
                  />
                </div>
              </div>

              <div>
                <div className="flex justify-between text-[11px] mb-1">
                  <span className="text-gray-500">Artifact Storage Cloud</span>
                  <span className="font-mono font-bold">0 GB / 0 GB</span>
                </div>
                <div className="w-full bg-gray-100 dark:bg-gray-800 rounded-full h-1.5 overflow-hidden">
                  <div
                    className="bg-emerald-600 h-full rounded-full"
                    style={{ width: '0%' }}
                  />
                </div>
              </div>
            </div>

            {/* Features Checklist */}
            <div className="pt-2 border-t border-gray-100 dark:border-gray-800 space-y-2">
              <h3 className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                UNLOCKED CAPABILITIES
              </h3>
              <div className="space-y-1.5">
                {entitlements.features.map((feat) => (
                  <div key={feat.name} className="flex items-center gap-2 text-xs text-gray-700 dark:text-gray-300">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                    <span>{feat.name}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Policies;
