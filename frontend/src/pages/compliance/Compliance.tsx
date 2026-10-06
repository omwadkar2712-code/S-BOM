import React, { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  FileCheck2,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  Folder,
  ExternalLink,
  Award,
  Info,
  Check,
  ChevronDown,
} from 'lucide-react';
import { useAppState } from '../../context/AppStateContext';
import { initialComplianceFrameworks } from '../../data/mockData';

export const Compliance: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { addToast } = useAppState();

  // Shared Chrome Context Filter
  const [scopedProject, setScopedProject] = useState<string>(searchParams.get('project') || 'all');

  // Selected Framework for Scorecards
  const [selectedFramework, setSelectedFramework] = useState<string>('fw-cert-in');
  const currentFw = initialComplianceFrameworks.find((f) => f.id === selectedFramework) || initialComplianceFrameworks[0];

  // Coverage Matrix Controls (Middle Section)
  const complianceControls: Array<{ id: string; title: string; mandate: string; coverage: string; status: string }> = [];

  return (
    <div className="space-y-6 animate-fadeIn pb-12">
      {/* Project Context Filter Bar */}
      <div className="bg-white dark:bg-[#111827] border border-gray-200 dark:border-gray-800 rounded-xl p-4 sm:p-5 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-2 flex-wrap">
            <div className="relative group/auditor inline-block">
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded text-[11px] font-bold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 cursor-help border border-emerald-200/60 dark:border-emerald-900/40 hover:bg-emerald-100/70 dark:hover:bg-emerald-900/50 transition-colors">
                <FileCheck2 className="w-3.5 h-3.5" />
                <span>Auditor Certified Compliance Framework</span>
              </span>
              {/* Tooltip Popover on Hover */}
              <div className="absolute left-0 top-full mt-2 opacity-0 invisible group-hover/auditor:opacity-100 group-hover/auditor:visible transition-all duration-150 w-72 sm:w-80 p-3 bg-gray-900 dark:bg-gray-800 text-white text-[11px] font-normal rounded-xl shadow-xl z-50 pointer-events-none border border-gray-700/80 leading-relaxed">
                <div className="flex items-center gap-1.5 font-bold text-emerald-400 mb-1">
                  <FileCheck2 className="w-3.5 h-3.5" />
                  <span>Auditor Certified Compliance</span>
                </div>
                <p className="text-gray-300">
                  Validated for external regulatory audits. Proves continuous compliance mapping against CERT-In 28-column cybersecurity mandate, NIST SP 800-218 (SSDF), ISO/IEC 27001, and SOC 2 Type II controls.
                </p>
                <div className="absolute bottom-full left-4 border-4 border-transparent border-b-gray-900 dark:border-b-gray-800" />
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2.5 shrink-0 flex-nowrap">
            {/* Project Context Filter */}
            <div className="relative inline-flex items-center bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-2xs hover:border-gray-300 dark:hover:border-gray-600 transition-colors">
              <Folder className="w-3.5 h-3.5 text-gray-500 dark:text-gray-400 absolute left-2.5 pointer-events-none" />
              <select
                value={scopedProject}
                onChange={(e) => setScopedProject(e.target.value)}
                className="appearance-none pl-8 pr-7 py-2 text-xs font-semibold bg-transparent text-gray-800 dark:text-gray-200 focus:outline-none cursor-pointer whitespace-nowrap"
              >
                <option value="all">All Projects (Org Scope)</option>
              </select>
              <ChevronDown className="w-3.5 h-3.5 text-gray-400 absolute right-2 pointer-events-none" />
            </div>
          </div>
        </div>

        {/* Framework Scorecards on Top */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 mt-4 pt-3 border-t border-gray-100 dark:border-gray-800">
          <div
            onClick={() => setSelectedFramework('fw-cert-in')}
            className={`p-3 rounded-lg border cursor-pointer transition-all ${
              selectedFramework === 'fw-cert-in'
                ? 'border-blue-600 bg-blue-50/50 dark:bg-blue-950/30 ring-1 ring-blue-500/30'
                : 'border-gray-200 dark:border-gray-800 hover:border-gray-300'
            }`}
          >
            <div className="flex items-center justify-between text-[10px] font-bold uppercase text-gray-400 mb-1">
              <span>CERT-IN MANDATE</span>
              <Award className="w-3 h-3 text-blue-600 dark:text-blue-400" />
            </div>
            <div className="text-xl font-black font-mono text-gray-900 dark:text-white">0.0%</div>
            <div className="text-[10px] text-gray-400 font-semibold mt-0.5">0 / 0 Controls Compliant</div>
          </div>

          <div
            onClick={() => setSelectedFramework('fw-iso-27001')}
            className={`p-3 rounded-lg border cursor-pointer transition-all ${
              selectedFramework === 'fw-iso-27001'
                ? 'border-blue-600 bg-blue-50/50 dark:bg-blue-950/30 ring-1 ring-blue-500/30'
                : 'border-gray-200 dark:border-gray-800 hover:border-gray-300'
            }`}
          >
            <div className="flex items-center justify-between text-[10px] font-bold uppercase text-gray-400 mb-1">
              <span>ISO 27001 A.8.28</span>
              <ShieldCheck className="w-3 h-3 text-emerald-600" />
            </div>
            <div className="text-xl font-black font-mono text-gray-900 dark:text-white">0.0%</div>
            <div className="text-[10px] text-gray-400 font-semibold mt-0.5">0 / 0 Controls Compliant</div>
          </div>

          <div
            onClick={() => setSelectedFramework('fw-soc2')}
            className={`p-3 rounded-lg border cursor-pointer transition-all ${
              selectedFramework === 'fw-soc2'
                ? 'border-blue-600 bg-blue-50/50 dark:bg-blue-950/30 ring-1 ring-blue-500/30'
                : 'border-gray-200 dark:border-gray-800 hover:border-gray-300'
            }`}
          >
            <div className="flex items-center justify-between text-[10px] font-bold uppercase text-gray-400 mb-1">
              <span>SOC 2 TYPE II</span>
              <CheckCircle2 className="w-3 h-3 text-teal-600" />
            </div>
            <div className="text-xl font-black font-mono text-gray-900 dark:text-white">0.0%</div>
            <div className="text-[10px] text-gray-400 font-semibold mt-0.5">0 / 0 Controls Compliant</div>
          </div>

          <div
            onClick={() => setSelectedFramework('fw-nist')}
            className={`p-3 rounded-lg border cursor-pointer transition-all ${
              selectedFramework === 'fw-nist'
                ? 'border-blue-600 bg-blue-50/50 dark:bg-blue-950/30 ring-1 ring-blue-500/30'
                : 'border-gray-200 dark:border-gray-800 hover:border-gray-300'
            }`}
          >
            <div className="flex items-center justify-between text-[10px] font-bold uppercase text-gray-400 mb-1">
              <span>NIST SP 800-218</span>
              <ShieldCheck className="w-3 h-3 text-blue-600" />
            </div>
            <div className="text-xl font-black font-mono text-gray-900 dark:text-white">0.0%</div>
            <div className="text-[10px] text-gray-400 font-semibold mt-0.5">0 / 0 Controls Compliant</div>
          </div>
        </div>
      </div>

      {/* Middle Section: Live Coverage Matrix */}
      <div className="bg-white dark:bg-[#111827] border border-gray-200 dark:border-gray-800 rounded-xl shadow-xs overflow-hidden">
        <div className="p-4 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-bold text-gray-900 dark:text-white">
              Live Regulatory Coverage Matrix
            </h2>
            <p className="text-xs text-gray-500">
              Active control evaluations mapped directly to continuous multi-BOM pipeline telemetries.
            </p>
          </div>
          <span className="text-xs font-mono font-bold text-gray-400">0 Controls</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-gray-50 dark:bg-gray-800 text-[10px] font-bold text-gray-400 uppercase tracking-wider border-b border-gray-200 dark:border-gray-800">
              <tr>
                <th className="p-3">Control Identifier</th>
                <th className="p-3">Security Mandate Requirement</th>
                <th className="p-3">Governing Standard</th>
                <th className="p-3">Coverage %</th>
                <th className="p-3 text-right">Audit Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800/60">
              {complianceControls.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-gray-400">
                    No compliance data available yet.
                  </td>
                </tr>
              ) : (
                complianceControls.map((ctrl) => (
                  <tr key={ctrl.id} className="hover:bg-gray-50/70 dark:hover:bg-gray-800/40 transition-colors">
                    <td className="p-3 font-mono font-bold text-gray-700 dark:text-gray-300">{ctrl.id}</td>
                    <td className="p-3 font-semibold text-gray-900 dark:text-white">{ctrl.title}</td>
                    <td className="p-3 font-mono text-gray-500 text-[11px]">{ctrl.mandate}</td>
                    <td className="p-3 font-mono font-bold text-gray-800 dark:text-gray-200">{ctrl.coverage}</td>
                    <td className="p-3 text-right">
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold ${
                          ctrl.status === 'Compliant'
                            ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300'
                            : 'bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300'
                        }`}
                      >
                        {ctrl.status === 'Compliant' ? (
                          <Check className="w-3 h-3 text-emerald-600" />
                        ) : (
                          <AlertCircle className="w-3 h-3 text-amber-600" />
                        )}
                        {ctrl.status}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default Compliance;
