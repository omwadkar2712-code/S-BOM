import React, { useState } from 'react';
import {
  GitFork,
  ShieldCheck,
  ShieldAlert,
  Search,
  CheckCircle2,
  AlertTriangle,
  Folder,
  Layers,
  Lock,
  ExternalLink,
  History,
  Info,
  Clock,
  Fingerprint,
  RotateCcw,
  ChevronDown,
} from 'lucide-react';
import { useAppState } from '../../context/AppStateContext';

export const SupplyChain: React.FC = () => {
  const { addToast } = useAppState();

  // Shared Chrome Context Filter
  const [scopedProject, setScopedProject] = useState<string>('all');

  // Search PURL field
  const [searchPurl, setSearchPurl] = useState<string>('pkg:npm/axios@1.12.2');
  const [activePurl, setActivePurl] = useState<string>('pkg:npm/axios@1.12.2');

  // Sample PURL options
  const samplePurls = [
    'pkg:npm/axios@1.12.2',
    'pkg:npm/lodash@4.17.21',
    'pkg:maven/org.apache.logging.log4j/log4j-core@2.14.0',
    'pkg:pypi/cryptography@39.0.1',
  ];

  // Component 1: Evidence Matrix
  const evidenceMatrix = {
    declared: '^1.12.0 in package.json',
    installed: '1.12.2 in package-lock.json',
    resolvedSyft: '1.12.2 (Confidence: High)',
    resolvedTrivy: '1.12.2 (Integrity verified)',
    hashMatch: true,
  };

  // Component 2: Supplier & Hash Fields
  const supplierDetails = {
    maintainer: 'Axios Team (Matt Zabriskie & Contributors)',
    verifiedDomain: 'axios-http.com',
    spdxLicense: 'MIT',
    sha256: '9f8337a83e20e8b2b1842095f939e6a9787e742861e61284d72023d8c1e847ad',
    sha1: '3f82029581029482019482019284019284019284',
    downloadLocation: 'https://registry.npmjs.org/axios/-/axios-1.12.2.tgz',
    registryTimestamp: '2023-10-18T14:22:01Z',
    supplierConfidenceScore: 94, // 0-100
  };


  // Component 4: Version History (Installed vs latest vs recommended, EOL, vuln_count per version)
  const versionHistory = [
    { version: '1.12.2', status: 'Installed (Vulnerable)', eol: false, cves: 3, releaseDate: 'Oct 2023', isInstalled: true },
    { version: '1.13.0', status: 'Recommended Patch', eol: false, cves: 0, releaseDate: 'Jan 2024', isRecommended: true },
    { version: '1.14.1', status: 'Latest Stable Clean', eol: false, cves: 0, releaseDate: 'May 2024', isLatest: true },
    { version: '0.21.1', status: 'Legacy (End of Life)', eol: true, cves: 7, releaseDate: '2020', isEol: true },
  ];

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchPurl.trim()) return;
    setActivePurl(searchPurl);
    addToast({
      type: 'info',
      title: 'PURL Provenance Queried',
      message: `Loaded cryptographic verification for ${searchPurl}`,
    });
  };

  return (
    <div className="space-y-6 animate-fadeIn pb-12">
      {/* Context & Scope Filter Bar */}
      <div className="bg-white dark:bg-[#111827] border border-gray-200 dark:border-gray-800 rounded-xl p-4 sm:p-5 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="relative group/trust inline-block">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-[11px] font-bold bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 cursor-help border border-indigo-200/60 dark:border-indigo-900/40 hover:bg-indigo-100/70 dark:hover:bg-indigo-900/50 transition-colors">
                <GitFork className="w-3.5 h-3.5" />
                <span>Cryptographic Trust Verification</span>
              </span>
              {/* Tooltip Popover on Hover */}
              <div className="absolute left-0 top-full mt-2 opacity-0 invisible group-hover/trust:opacity-100 group-hover/trust:visible transition-all duration-150 w-72 sm:w-80 p-3 bg-gray-900 dark:bg-gray-800 text-white text-[11px] font-normal rounded-xl shadow-xl z-50 pointer-events-none border border-gray-700/80 leading-relaxed">
                <div className="flex items-center gap-1.5 font-bold text-indigo-400 mb-1">
                  <GitFork className="w-3.5 h-3.5" />
                  <span>Cryptographic Trust Verification</span>
                </div>
                <p className="text-gray-300">
                  Establishes software bill of materials pedigree by cross-referencing maintainer signatures, cryptographic checksums (SHA-256), and multi-scanner consensus across build pipelines.
                </p>
                <div className="absolute bottom-full left-4 border-4 border-transparent border-b-gray-900 dark:border-b-gray-800" />
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2.5 shrink-0 flex-nowrap">
            {/* Context Filter - Proper Button with Custom Chevron */}
            <div className="relative inline-flex items-center bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-2xs hover:border-gray-300 dark:hover:border-gray-600 transition-colors">
              <Folder className="w-3.5 h-3.5 text-gray-500 dark:text-gray-400 absolute left-2.5 pointer-events-none" />
              <select
                value={scopedProject}
                onChange={(e) => setScopedProject(e.target.value)}
                className="appearance-none pl-8 pr-7 py-1.5 text-xs font-semibold bg-transparent text-gray-800 dark:text-gray-200 focus:outline-none cursor-pointer whitespace-nowrap"
              >
                <option value="all">All Projects (Org Graph)</option>
                <option value="Payments API">Payments API Scope</option>
                <option value="Customer Portal">Customer Portal Scope</option>
                <option value="Checkout Service">Checkout Service Scope</option>
                <option value="Mobile App Backend">Mobile App Backend Scope</option>
                <option value="Admin Portal">Admin Portal Scope</option>
              </select>
              <ChevronDown className="w-3.5 h-3.5 text-gray-400 absolute right-2 pointer-events-none" />
            </div>

            {/* Component 5: Signature Badge on Exports */}
            <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/60 text-emerald-700 dark:text-emerald-300 text-xs font-bold whitespace-nowrap shadow-2xs">
              <Lock className="w-3.5 h-3.5 text-emerald-600" />
              <span>NIST P-256 Cryptographic Signature: VALID</span>
            </div>
          </div>
        </div>

        {/* PURL Search Bar */}
        <form onSubmit={handleSearchSubmit} className="mt-4 pt-3 border-t border-gray-100 dark:border-gray-800 flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="w-3.5 h-3.5 text-gray-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchPurl}
              onChange={(e) => setSearchPurl(e.target.value)}
              placeholder="Query Package URL (PURL), e.g. pkg:npm/axios@1.12.2"
              className="w-full text-xs pl-8 pr-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white font-mono"
            />
          </div>
          <button
            type="submit"
            className="px-4 py-2 text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white rounded-lg shadow-xs cursor-pointer"
          >
            Verify PURL
          </button>
        </form>

        {/* Sample PURLs */}
        <div className="flex items-center gap-1.5 mt-2 flex-wrap">
          <span className="text-[10px] text-gray-400 font-bold uppercase">SAMPLES:</span>
          {samplePurls.map((sample) => (
            <button
              key={sample}
              type="button"
              onClick={() => {
                setSearchPurl(sample);
                setActivePurl(sample);
              }}
              className="px-2 py-0.5 rounded text-[10px] font-mono bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300"
            >
              {sample}
            </button>
          ))}
        </div>
      </div>

      {/* Component 1: Multi-Scanner Evidence Matrix (Full Width) */}
      <div className="bg-white dark:bg-[#111827] border border-gray-200 dark:border-gray-800 rounded-xl p-5 shadow-xs space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 flex items-center justify-center shrink-0">
              <Fingerprint className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-gray-900 dark:text-white">
                Multi-Scanner Evidence Matrix
              </h2>
              <p className="text-xs text-gray-500 font-mono">{activePurl}</p>
            </div>
          </div>
          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
            100% CORRELATED
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-2 text-xs">
          <div className="p-3 bg-gray-50 dark:bg-gray-800/40 rounded-xl space-y-1">
            <span className="text-[10px] text-gray-400 font-bold uppercase block">DECLARED IN MANIFEST</span>
            <span className="font-mono font-bold text-gray-900 dark:text-white block">{evidenceMatrix.declared}</span>
            <span className="text-[10px] text-gray-500">Root manifest dependency constraint</span>
          </div>

          <div className="p-3 bg-gray-50 dark:bg-gray-800/40 rounded-xl space-y-1">
            <span className="text-[10px] text-gray-400 font-bold uppercase block">INSTALLED IN LOCKFILE</span>
            <span className="font-mono font-bold text-gray-900 dark:text-white block">{evidenceMatrix.installed}</span>
            <span className="text-[10px] text-gray-500">Resolved tree pinned in package-lock</span>
          </div>

          <div className="p-3 bg-gray-50 dark:bg-gray-800/40 rounded-xl space-y-1">
            <span className="text-[10px] text-gray-400 font-bold uppercase block">RESOLVED BY SYFT BOM</span>
            <span className="font-mono font-bold text-emerald-600 block">{evidenceMatrix.resolvedSyft}</span>
            <span className="text-[10px] text-gray-500">AST inspection match</span>
          </div>

          <div className="p-3 bg-gray-50 dark:bg-gray-800/40 rounded-xl space-y-1">
            <span className="text-[10px] text-gray-400 font-bold uppercase block">RESOLVED BY TRIVY SCAN</span>
            <span className="font-mono font-bold text-emerald-600 block">{evidenceMatrix.resolvedTrivy}</span>
            <span className="text-[10px] text-gray-500">Binary digest match</span>
          </div>
        </div>
      </div>

      {/* Balanced 2-Column Grid: Supplier Pedigree & Hashes + Version History & Upgrades */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Component 2: Supplier & Cryptographic Hash Fields */}
        <div className="bg-white dark:bg-[#111827] border border-gray-200 dark:border-gray-800 rounded-xl p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-gray-900 dark:text-white">
              Supplier Pedigree & Cryptographic Hashes
            </h2>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
              Confidence {supplierDetails.supplierConfidenceScore}%
            </span>
          </div>

          <div className="space-y-3 text-xs">
            <div className="flex justify-between p-2.5 bg-gray-50 dark:bg-gray-800/40 rounded-lg">
              <span className="text-gray-500">Maintainer Entity:</span>
              <span className="font-semibold text-gray-900 dark:text-white">{supplierDetails.maintainer}</span>
            </div>

            <div className="flex justify-between p-2.5 bg-gray-50 dark:bg-gray-800/40 rounded-lg">
              <span className="text-gray-500">Verified Domain:</span>
              <span className="font-mono text-blue-600">{supplierDetails.verifiedDomain}</span>
            </div>

            <div className="flex justify-between p-2.5 bg-gray-50 dark:bg-gray-800/40 rounded-lg">
              <span className="text-gray-500">Declared SPDX License:</span>
              <span className="font-mono font-bold text-gray-900 dark:text-white">{supplierDetails.spdxLicense}</span>
            </div>

            <div className="p-2.5 bg-gray-50 dark:bg-gray-800/40 rounded-lg space-y-1">
              <span className="text-gray-500 block text-[10px] uppercase font-bold">SHA-256 CRYPTOGRAPHIC DIGEST</span>
              <div className="font-mono text-[11px] text-gray-800 dark:text-gray-200 break-all bg-white dark:bg-gray-900 p-2 rounded border border-gray-200 dark:border-gray-700">
                {supplierDetails.sha256}
              </div>
            </div>

            <div className="flex justify-between p-2.5 bg-gray-50 dark:bg-gray-800/40 rounded-lg">
              <span className="text-gray-500">Download Registry URL:</span>
              <span className="font-mono text-[11px] text-gray-700 dark:text-gray-300 truncate max-w-xs">
                {supplierDetails.downloadLocation}
              </span>
            </div>
          </div>
        </div>

        {/* Component 3: Version History & Upgrades */}
        <div className="bg-white dark:bg-[#111827] border border-gray-200 dark:border-gray-800 rounded-xl p-5 shadow-xs space-y-4">
          <div>
            <h2 className="text-sm font-bold text-gray-900 dark:text-white">Version History & Upgrades</h2>
            <p className="text-xs text-gray-500 mt-0.5">Telemetry comparison across release versions and EOL milestones.</p>
          </div>

          <div className="space-y-2.5 text-xs">
            {versionHistory.map((ver) => (
              <div
                key={ver.version}
                className={`p-3 rounded-xl border flex items-center justify-between ${
                  ver.isInstalled
                    ? 'border-red-200 dark:border-red-900/60 bg-red-50/30 dark:bg-red-950/20'
                    : ver.isRecommended
                    ? 'border-emerald-200 dark:border-emerald-900/60 bg-emerald-50/30 dark:bg-emerald-950/20'
                    : 'border-gray-200 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/30'
                }`}
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-gray-900 dark:text-white">v{ver.version}</span>
                    <span
                      className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                        ver.isInstalled
                          ? 'bg-red-100 text-red-700 dark:bg-red-950/80 dark:text-red-300'
                          : ver.isRecommended
                          ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/80 dark:text-emerald-300'
                          : 'bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-300'
                      }`}
                    >
                      {ver.status}
                    </span>
                  </div>
                  <div className="text-[10px] text-gray-400 mt-1">Released: {ver.releaseDate}</div>
                </div>

                <div className="text-right font-mono">
                  <span
                    className={`text-xs font-bold block ${
                      ver.cves > 0 ? 'text-red-600 dark:text-red-400' : 'text-emerald-600 dark:text-emerald-400'
                    }`}
                  >
                    {ver.cves} CVEs
                  </span>
                  <span className="text-[9px] text-gray-400">{ver.eol ? 'EOL Reached' : 'Maintained'}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default SupplyChain;
