import React, { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  ShieldAlert,
  Search,
  Filter,
  ExternalLink,
  Ticket,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  X,
  Layers,
  ArrowRight,
  Info,
  ChevronRight,
  Folder,
} from 'lucide-react';
import { useAppState } from '../../context/AppStateContext';
import { Severity, VexStatus } from '../../types';
import { SeverityBadge } from '../../components/common/Badge';

export const Vulnerabilities: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { vulnerabilities, projects, setSelectedVulnerability, addToast } = useAppState();

  // Shared Chrome Context Filter
  const [projectFilter, setProjectFilter] = useState<string>(searchParams.get('project') || 'all');
  const [searchQuery, setSearchQuery] = useState<string>(searchParams.get('search') || '');

  // Component 1: Severity KPI Chips filter
  const [selectedSeverity, setSelectedSeverity] = useState<string>(searchParams.get('severity') || 'All');

  // Component 3: CVE Detail in Inspector Drawer / Modal
  const [inspectingCve, setInspectingCve] = useState<any | null>(null);

  // Filtered Vulnerabilities
  const filtered = vulnerabilities.filter((v) => {
    const q = searchQuery.toLowerCase();
    const matchesSearch =
      !q ||
      v.cve.toLowerCase().includes(q) ||
      v.package.toLowerCase().includes(q) ||
      v.description.toLowerCase().includes(q);

    const matchesSeverity = selectedSeverity === 'All' || v.severity.toLowerCase() === selectedSeverity.toLowerCase();
    const matchesProject = projectFilter === 'all' || v.project === projectFilter;

    return matchesSearch && matchesSeverity && matchesProject;
  });

  // Severity counts for Component 1 KPI chips
  const criticalCount = vulnerabilities.filter((v) => v.severity === 'Critical').length;
  const highCount = vulnerabilities.filter((v) => v.severity === 'High').length;
  const mediumCount = vulnerabilities.filter((v) => v.severity === 'Medium').length;
  const lowCount = vulnerabilities.filter((v) => v.severity === 'Low').length;



  // Component 4: VEX Badge Renderer helper
  const renderVexBadge = (vex: VexStatus) => {
    switch (vex) {
      case 'affected':
        return (
          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-red-50 text-red-700 dark:bg-red-950/60 dark:text-red-300">
            affected
          </span>
        );
      case 'not_affected':
        return (
          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300">
            not_affected
          </span>
        );
      case 'fixed':
        return (
          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-sky-50 text-sky-700 dark:bg-sky-950/60 dark:text-sky-300 border border-sky-200 dark:border-sky-800">
            fixed
          </span>
        );
      case 'under_investigation':
      default:
        return (
          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300">
            under_investigation
          </span>
        );
    }
  };

  return (
    <div className="space-y-6 animate-fadeIn pb-12">
      {/* Shared Chrome: Page Title + Subtitle + Project Filter + Primary Action */}
      <div className="bg-white dark:bg-[#111827] border border-gray-200 dark:border-gray-800 rounded-xl p-4 sm:p-5 shadow-xs">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <div className="relative group/triage inline-block">
                {/* Tooltip Popover on Hover */}
                <div className="absolute left-0 top-full mt-2 opacity-0 invisible group-hover/triage:opacity-100 group-hover/triage:visible transition-all duration-150 w-72 p-3 bg-gray-900 dark:bg-gray-800 text-white text-[11px] font-normal rounded-xl shadow-xl z-50 pointer-events-none border border-gray-700/80 leading-relaxed">
                  <div className="flex items-center gap-1.5 font-bold text-red-400 mb-1">
                    <ShieldAlert className="w-3.5 h-3.5" />
                    <span>Active CVE Triage Queue</span>
                  </div>
                  <p className="text-gray-300">
                    Dedicated queue for Common Vulnerabilities &amp; Exposures (CVEs). Review VEX justifications, analyze exploitability, and raise remediation tickets directly into Jira or GitHub.
                  </p>
                  <div className="absolute bottom-full left-4 border-4 border-transparent border-b-gray-900 dark:border-b-gray-800" />
                </div>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap">
            {/* Project Context Filter */}
            <div className="flex items-center gap-1.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg px-2.5 py-1.5">
              <Folder className="w-3.5 h-3.5 text-gray-400" />
              <select
                value={projectFilter}
                onChange={(e) => setProjectFilter(e.target.value)}
                className="text-xs font-semibold bg-transparent text-gray-800 dark:text-gray-200 focus:outline-none cursor-pointer"
              >
                <option value="all">All Projects (Org Scope)</option>
                <option value="Payments API">Payments API</option>
                <option value="Customer Portal">Customer Portal</option>
                <option value="Checkout Service">Checkout Service</option>
                <option value="Mobile App Backend">Mobile App Backend</option>
                <option value="Admin Portal">Admin Portal</option>
              </select>
            </div>
          </div>
        </div>

        {/* Component 1: Severity KPI Chips (Click filters table) */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5 mt-4 pt-3 border-t border-gray-100 dark:border-gray-800">
          <div
            onClick={() => setSelectedSeverity('All')}
            className={`p-2.5 rounded-lg border cursor-pointer transition-all ${selectedSeverity === 'All'
              ? 'border-gray-900 dark:border-white bg-gray-100 dark:bg-gray-800 shadow-xs'
              : 'border-gray-200 dark:border-gray-800 bg-gray-50/40 dark:bg-gray-800/30 hover:border-gray-300 dark:hover:border-gray-700'
              }`}
          >
            <div className="flex items-center gap-1.5 mb-1">
              <span className="w-1.5 h-1.5 rounded-full bg-gray-400 dark:bg-gray-500" />
              <span className="text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider block">ALL SEVERITIES</span>
            </div>
            <span className="text-xl font-black text-gray-900 dark:text-white font-mono">{vulnerabilities.length}</span>
          </div>

          <div
            onClick={() => setSelectedSeverity('Critical')}
            className={`p-2.5 rounded-lg border cursor-pointer transition-all ${selectedSeverity === 'Critical'
              ? 'border-red-600 bg-red-100/90 dark:bg-red-950/60 ring-1 ring-red-500/30 shadow-xs'
              : 'border-red-200 dark:border-red-900/50 bg-red-50/40 dark:bg-red-950/20 hover:border-red-400 dark:hover:border-red-800'
              }`}
          >
            <div className="flex items-center gap-1.5 mb-1">
              <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
              <span className="text-[10px] font-bold text-red-600 dark:text-red-400 uppercase tracking-wider block">CRITICAL</span>
            </div>
            <span className="text-xl font-black text-red-600 dark:text-red-400 font-mono">{criticalCount}</span>
          </div>

          <div
            onClick={() => setSelectedSeverity('High')}
            className={`p-2.5 rounded-lg border cursor-pointer transition-all ${selectedSeverity === 'High'
              ? 'border-orange-600 bg-orange-100/90 dark:bg-orange-950/60 ring-1 ring-orange-500/30 shadow-xs'
              : 'border-orange-200 dark:border-orange-900/50 bg-orange-50/40 dark:bg-orange-950/20 hover:border-orange-400 dark:hover:border-orange-800'
              }`}
          >
            <div className="flex items-center gap-1.5 mb-1">
              <span className="w-1.5 h-1.5 rounded-full bg-orange-500" />
              <span className="text-[10px] font-bold text-orange-600 dark:text-orange-400 uppercase tracking-wider block">HIGH</span>
            </div>
            <span className="text-xl font-black text-orange-600 dark:text-orange-400 font-mono">{highCount}</span>
          </div>

          <div
            onClick={() => setSelectedSeverity('Medium')}
            className={`p-2.5 rounded-lg border cursor-pointer transition-all ${selectedSeverity === 'Medium'
              ? 'border-amber-600 bg-amber-100/90 dark:bg-amber-950/60 ring-1 ring-amber-500/30 shadow-xs'
              : 'border-amber-200 dark:border-amber-900/50 bg-amber-50/40 dark:bg-amber-950/20 hover:border-amber-400 dark:hover:border-amber-800'
              }`}
          >
            <div className="flex items-center gap-1.5 mb-1">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
              <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wider block">MEDIUM</span>
            </div>
            <span className="text-xl font-black text-amber-600 dark:text-amber-400 font-mono">{mediumCount}</span>
          </div>

          <div
            onClick={() => setSelectedSeverity('Low')}
            className={`p-2.5 rounded-lg border cursor-pointer transition-all ${selectedSeverity === 'Low'
              ? 'border-sky-600 bg-sky-100/90 dark:bg-sky-950/60 ring-1 ring-sky-500/30 shadow-xs'
              : 'border-sky-200 dark:border-sky-900/50 bg-sky-50/40 dark:bg-sky-950/20 hover:border-sky-400 dark:hover:border-sky-800'
              }`}
          >
            <div className="flex items-center gap-1.5 mb-1">
              <span className="w-1.5 h-1.5 rounded-full bg-sky-500" />
              <span className="text-[10px] font-bold text-sky-600 dark:text-sky-400 uppercase tracking-wider block">LOW</span>
            </div>
            <span className="text-xl font-black text-sky-600 dark:text-sky-400 font-mono">{lowCount}</span>
          </div>
        </div>
      </div>

      {/* Main Vulnerability CVE Table (Full Width) */}
      <div className="space-y-3">
        {/* Filter Bar */}
        <div className="bg-white dark:bg-[#111827] border border-gray-200 dark:border-gray-800 rounded-xl p-3.5 shadow-xs flex items-center justify-between gap-3">
          <div className="relative flex-1">
            <Search className="w-3.5 h-3.5 text-gray-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search CVE identifier, affected package, or description..."
              className="w-full text-xs pl-8 pr-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none"
            />
          </div>
          <div className="text-xs text-gray-500 shrink-0">
            Showing <span className="font-bold text-gray-900 dark:text-white">{filtered.length}</span> CVEs
          </div>
        </div>

        {/* Table Card */}
        <div className="bg-white dark:bg-[#111827] border border-gray-200 dark:border-gray-800 rounded-xl shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-gray-50 dark:bg-gray-800 text-[10px] font-bold text-gray-400 uppercase tracking-wider border-b border-gray-200 dark:border-gray-800">
                <tr>
                  <th className="p-3">CVE ID</th>
                  <th className="p-3">Severity</th>
                  <th className="p-3">CVSS</th>
                  <th className="p-3">Affected Component</th>
                  <th className="p-3">Project</th>
                  <th className="p-3">VEX Status</th>
                  <th className="p-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800/60">
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="p-12 text-center">
                      <div className="flex flex-col items-center justify-center max-w-sm mx-auto space-y-3">
                        <div className="w-12 h-12 rounded-full bg-emerald-50 dark:bg-emerald-950/50 flex items-center justify-center text-emerald-500 border border-emerald-200 dark:border-emerald-800">
                          <CheckCircle2 className="w-6 h-6" />
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-gray-900 dark:text-white">No Vulnerabilities Found</p>
                          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                            All monitored components are secure, or no vulnerability findings have been recorded yet.
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => navigate('/security-scans/new')}
                          className="px-3 py-1.5 text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors cursor-pointer inline-flex items-center gap-1.5 shadow-2xs"
                        >
                          <span>Run Security Scan</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                ) : (
                  filtered.map((v) => (
                    <tr
                      key={v.id}
                      onClick={() => setInspectingCve(v)}
                      className="hover:bg-gray-50/70 dark:hover:bg-gray-800/40 transition-colors cursor-pointer"
                    >
                      <td className="p-3 font-mono font-bold text-sky-700 dark:text-sky-300 hover:underline">
                        {v.cve}
                      </td>
                      <td className="p-3">
                        <SeverityBadge severity={v.severity} size="xs" />
                      </td>
                      <td className="p-3 font-mono font-bold text-gray-800 dark:text-gray-200">{v.cvss}</td>
                      <td className="p-3 font-mono text-gray-700 dark:text-gray-300">{v.package}</td>
                      <td className="p-3 text-gray-600 dark:text-gray-400 text-[11px]">{v.project}</td>
                      <td className="p-3">{renderVexBadge(v.vexStatus)}</td>
                      <td className="p-3 text-right" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={() => {
                            setSelectedVulnerability(v);
                            navigate(`/remediation?raiseTicket=true&project=${encodeURIComponent(v.project)}&cve=${encodeURIComponent(v.cve)}&pkg=${encodeURIComponent(v.package)}`);
                          }}
                          className="px-2.5 py-1 text-[11px] font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded cursor-pointer transition-colors shadow-2xs inline-flex items-center gap-1"
                        >
                          <Ticket className="w-3 h-3" />
                          <span>Raise Ticket</span>
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Component 3: CVE Detail in Inspector Drawer / Modal */}
      {inspectingCve && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4 backdrop-blur-xs animate-fadeIn">
          <div className="bg-white dark:bg-[#111827] border border-gray-200 dark:border-gray-800 rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden">
            <div className="p-5 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="font-mono text-base font-bold text-gray-900 dark:text-white">{inspectingCve.cve}</span>
                <SeverityBadge severity={inspectingCve.severity} size="xs" />
                <span className="font-mono text-xs font-bold text-gray-800 dark:text-gray-200">
                  CVSS {inspectingCve.cvss}
                </span>
              </div>
              <button
                onClick={() => setInspectingCve(null)}
                className="p-1 rounded-lg text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-4 text-xs">
              <div>
                <span className="text-[10px] text-gray-400 uppercase font-bold tracking-wider block mb-1">
                  DESCRIPTION
                </span>
                <p className="text-gray-700 dark:text-gray-300 leading-relaxed">
                  {inspectingCve.description}
                </p>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 p-3 bg-gray-50 dark:bg-gray-800/40 rounded-xl font-mono">
                <div>
                  <span className="text-[10px] text-gray-400 uppercase font-bold block">AFFECTED PACKAGE</span>
                  <span className="text-gray-900 dark:text-white font-semibold">{inspectingCve.package}</span>
                </div>
                <div>
                  <span className="text-[10px] text-gray-400 uppercase font-bold block">AFFECTED VERSION</span>
                  <span className="text-red-600 font-semibold">{inspectingCve.affectedVersions || inspectingCve.version}</span>
                </div>
                <div>
                  <span className="text-[10px] text-gray-400 uppercase font-bold block">RECOMMENDED FIX</span>
                  <span className="text-emerald-600 font-semibold">{inspectingCve.fixVersion || 'v1.13.0'}</span>
                </div>
                <div>
                  <span className="text-[10px] text-gray-400 uppercase font-bold block">CWE CLASSIFIER</span>
                  <span className="text-sky-600 dark:text-sky-400 font-semibold font-mono">{inspectingCve.cwe || 'CWE-502'}</span>
                </div>
              </div>

              <div>
                <span className="text-[10px] text-gray-400 uppercase font-bold tracking-wider block mb-1">
                  VEX JUSTIFICATION
                </span>
                <div className="p-3 rounded-lg border border-gray-200 dark:border-gray-700 text-[11px] flex items-center justify-between">
                  <span>Current VEX: <strong>{inspectingCve.vexStatus}</strong></span>
                  <button
                    onClick={() => {
                      addToast({ type: 'info', title: 'VEX Updated', message: 'VEX justification recorded.' });
                    }}
                    className="text-blue-600 hover:underline font-semibold"
                  >
                    Edit Justification →
                  </button>
                </div>
              </div>
            </div>

            <div className="p-4 border-t border-gray-100 dark:border-gray-800 flex items-center justify-between bg-gray-50/50 dark:bg-gray-800/20">
              <button
                onClick={() => setInspectingCve(null)}
                className="px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-100 rounded-lg"
              >
                Close
              </button>
              <button
                onClick={() => {
                  setSelectedVulnerability(inspectingCve);
                  setInspectingCve(null);
                  navigate(`/remediation?raiseTicket=true&project=${encodeURIComponent(inspectingCve.project)}&cve=${encodeURIComponent(inspectingCve.cve)}&pkg=${encodeURIComponent(inspectingCve.package)}`);
                }}
                className="px-4 py-1.5 text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white rounded-lg shadow-sm inline-flex items-center gap-1.5"
              >
                <Ticket className="w-3.5 h-3.5" />
                <span>Raise Remediation Ticket</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Vulnerabilities;
