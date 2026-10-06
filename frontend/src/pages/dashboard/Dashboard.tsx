import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Folder,
  Play,
  RotateCcw,
  CheckCircle2,
  AlertTriangle,
  ChevronDown,
  ShieldCheck,
  FolderGit2,
  Radar,
  Package,
  Bug,
  Sparkles,
  Activity,
  Layers,
  ArrowUpRight,
  Scan,
  ShieldAlert,
} from 'lucide-react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip as RechartsTooltip,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import { useAppState } from '../../context/AppStateContext';

export const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const { projects, vulnerabilities } = useAppState();

  // Shared Chrome Header State
  const [selectedProject, setSelectedProject] = useState<string>('all');
  const [timeRange, setTimeRange] = useState<'7D' | '30D' | '90D'>('30D');

  // Resilient State: empty, loading, error simulation
  const [isSimulatedEmpty, setIsSimulatedEmpty] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [hasError, setHasError] = useState<boolean>(false);

  // Overall Risk Gauge data
  const overallRiskIndex = '0';
  const riskStatus: 'SECURE' | 'AT RISK' | 'CRITICAL' = 'SECURE';

  // 4 KPIs
  const totalProjectsCount = '0';
  const totalScansCount = '0';
  const vulnerableLibrariesCount = '0';
  const uniqueCvesCount = '0';

  // Threat Severity Donut Data (Critical / High / Medium / Low)
  const severityDonutData: Array<{ name: string; value: number; color: string }> = [];

  // Risk Trend Chart data dynamically switching by Time Range
  const riskTrendData: Array<{ scan: string; date: string; riskIndex: number; vulns: number }> = [];

  // Top 5 Vulnerable Projects
  const top5VulnerableProjects: Array<{ id: string; name: string; riskScore: number; cves: number; apps: number; status: string; color: string }> = [];

  // Project Repository Table Data
  const projectRepositories: Array<{ id: string; name: string; risk: number; apps: number; scans: number; critVulns: number; highVulns: number; lastScan: string }> = [];

  const filteredProjectRepositories = projectRepositories;

  // Error recovery action
  const handleResetState = () => {
    setIsLoading(false);
    setHasError(false);
    setIsSimulatedEmpty(false);
  };

  // Render Loading State
  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-24 space-y-3">
        <div className="w-8 h-8 border-3 border-blue-600 border-t-transparent rounded-full animate-spin" />
        <p className="text-xs font-semibold text-gray-600 dark:text-gray-400">
          Loading executive posture telemetry...
        </p>
      </div>
    );
  }

  // Render Error State with Single Recovery Action
  if (hasError) {
    return (
      <div className="bg-white dark:bg-[#111827] border border-red-200 dark:border-red-900/50 rounded-xl p-6 text-center max-w-md mx-auto my-8 shadow-xs space-y-3">
        <div className="w-10 h-10 bg-red-50 dark:bg-red-950/50 text-red-600 rounded-full flex items-center justify-center mx-auto">
          <AlertTriangle className="w-5 h-5" />
        </div>
        <div>
          <h3 className="text-sm font-bold text-gray-900 dark:text-white">Failed to load Dashboard telemetry</h3>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            An unexpected error occurred while querying telemetry.
          </p>
        </div>
        <button
          onClick={() => window.location.reload()}
          className="px-3.5 py-1.5 text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-lg shadow-xs flex items-center gap-1.5 mx-auto cursor-pointer"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          Retry Connection
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-3.5 lg:space-y-4 animate-fadeIn pb-10">
      {/* Executive Security Status & Scope Controls */}
      <div className="bg-white dark:bg-[#111827] border border-gray-200 dark:border-gray-800 rounded-xl px-5 py-3.5 shadow-2xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3.5">
          <div className="flex items-center gap-2.5">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-[11px] font-bold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              Posture: Secure
            </span>
          </div>

          {/* Controls: Project dropdown + Time range + Launch Scan */}
          <div className="flex items-center gap-2.5 flex-wrap sm:flex-nowrap shrink-0">
            {/* Project Scope */}
            <div className="relative inline-flex items-center bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-2xs hover:border-gray-300 dark:hover:border-gray-600 transition-colors">
              <Folder className="w-3.5 h-3.5 text-gray-500 dark:text-gray-400 absolute left-2.5 pointer-events-none" />
              <select
                value={selectedProject}
                onChange={(e) => setSelectedProject(e.target.value)}
                className="appearance-none pl-8 pr-7 py-1.5 text-xs font-semibold bg-transparent text-gray-800 dark:text-gray-200 focus:outline-none cursor-pointer whitespace-nowrap"
              >
                <option value="all">All Projects</option>
              </select>
              <ChevronDown className="w-3.5 h-3.5 text-gray-400 absolute right-2 pointer-events-none" />
            </div>

            {/* Time range selector */}
            <div className="flex items-center bg-gray-100 dark:bg-gray-800 rounded-lg p-0.5 text-xs font-semibold">
              {(['7D', '30D', '90D'] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTimeRange(t)}
                  className={`px-2.5 py-1 rounded-md transition-all cursor-pointer ${
                    timeRange === t
                      ? 'bg-blue-600 text-white shadow-2xs font-bold'
                      : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>

            <button
              onClick={() => navigate('/security-scans/new')}
              className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 shadow-xs cursor-pointer transition-colors shrink-0"
            >
              <Play className="w-3 h-3 fill-white" />
              <span>Launch Scan</span>
            </button>
          </div>
        </div>
      </div>

      {/* 2. Enterprise Cybersecurity KPI Row */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5">
        {/* Card 1: Overall Risk Gauge - Elevated visual importance */}
        <div className="col-span-2 sm:col-span-1 lg:col-span-1 bg-white dark:bg-[#162238] border border-[#E2E8F0] dark:border-[#243247] rounded-xl p-4 sm:p-4.5 shadow-[0_1px_3px_rgba(0,0,0,0.03)] flex flex-col justify-between min-h-[148px] relative overflow-hidden transition-colors hover:border-[#CBD5E1] dark:hover:border-[#334460]">
          {/* Subtle 2.5px top accent indicator (Green #059669 for Secure) */}
          <div className="absolute top-0 left-0 right-0 h-[2.5px] bg-[#059669]" />

          <div className="flex items-center justify-between gap-1.5">
            <div className="flex items-center gap-1.5 min-w-0">
              <ShieldCheck className="w-4 h-4 text-[#059669] shrink-0" strokeWidth={2} />
              <span className="text-[11px] font-bold uppercase tracking-wider text-[#475569] dark:text-[#CBD5E1] truncate">
                Overall Risk
              </span>
            </div>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-[#ECFDF5] dark:bg-[#064E3B]/50 text-[#059669] dark:text-[#34D399] border border-[#A7F3D0]/70 dark:border-[#065F46]/70 shrink-0">
              <span className="w-1.5 h-1.5 rounded-full bg-[#059669] shrink-0" />
              Secure
            </span>
          </div>

          <div className="flex items-center justify-between gap-2 my-auto pt-1">
            <div className="flex items-baseline gap-1">
              <span className="text-[32px] sm:text-[34px] font-extrabold text-[#0F172A] dark:text-[#F8FAFC] tracking-tight font-sans leading-none">
                0
              </span>
              <span className="text-xs font-semibold text-[#94A3B8]">/ 100</span>
            </div>

            {/* Compact Semicircular Visual Risk Gauge */}
            <div className="flex flex-col items-center shrink-0">
              <svg className="w-11 h-6" viewBox="0 0 44 24" aria-hidden="true">
                <path
                  d="M 4 22 A 18 18 0 0 1 40 22"
                  fill="none"
                  stroke="currentColor"
                  className="text-[#E2E8F0] dark:text-[#243247]"
                  strokeWidth="3.5"
                  strokeLinecap="round"
                />
                <circle cx="22" cy="22" r="2.5" fill="#059669" />
              </svg>
              <span className="text-[9px] font-bold uppercase tracking-wider text-[#059669] -mt-0.5">
                0% Risk
              </span>
            </div>
          </div>

          <div className="flex items-center justify-between text-[11px] text-[#475569] dark:text-[#94A3B8] border-t border-[#F1F5F9] dark:border-[#1E293B] pt-2.5">
            <span className="truncate">0 active risk exposure</span>
            <span className="text-[10px] font-semibold text-[#059669] dark:text-[#34D399] shrink-0">Optimal</span>
          </div>
        </div>

        {/* Card 2: Total Projects */}
        <div className="bg-white dark:bg-[#111C2E] border border-[#E2E8F0] dark:border-[#243247] rounded-xl p-4 sm:p-4.5 shadow-[0_1px_3px_rgba(0,0,0,0.03)] flex flex-col justify-between min-h-[148px] relative overflow-hidden transition-colors hover:border-[#CBD5E1] dark:hover:border-[#334460]">
          {/* Subtle 2.5px top accent indicator (SQUAD1 Blue #2563EB) */}
          <div className="absolute top-0 left-0 right-0 h-[2.5px] bg-[#2563EB]" />

          <div className="flex items-center justify-between gap-1.5">
            <div className="flex items-center gap-1.5 min-w-0">
              <FolderGit2 className="w-4 h-4 text-[#2563EB] shrink-0" strokeWidth={2} />
              <span className="text-[11px] font-bold uppercase tracking-wider text-[#475569] dark:text-[#CBD5E1] truncate">
                Total Projects
              </span>
            </div>
          </div>

          <div className="my-auto pt-1">
            <div className="text-[32px] sm:text-[34px] font-extrabold text-[#0F172A] dark:text-[#F8FAFC] tracking-tight font-sans leading-none">
              0
            </div>
          </div>

          <div className="flex items-center justify-between text-[11px] text-[#475569] dark:text-[#94A3B8] border-t border-[#F1F5F9] dark:border-[#1E293B] pt-2.5">
            <span className="truncate">0 active repositories</span>
          </div>
        </div>

        {/* Card 3: Total Scans */}
        <div className="bg-white dark:bg-[#111C2E] border border-[#E2E8F0] dark:border-[#243247] rounded-xl p-4 sm:p-4.5 shadow-[0_1px_3px_rgba(0,0,0,0.03)] flex flex-col justify-between min-h-[148px] relative overflow-hidden transition-colors hover:border-[#CBD5E1] dark:border-[#334460]">
          {/* Subtle 2.5px top accent indicator (SQUAD1 Blue #2563EB) */}
          <div className="absolute top-0 left-0 right-0 h-[2.5px] bg-[#2563EB]" />

          <div className="flex items-center justify-between gap-1.5">
            <div className="flex items-center gap-1.5 min-w-0">
              <Scan className="w-4 h-4 text-[#2563EB] shrink-0" strokeWidth={2} />
              <span className="text-[11px] font-bold uppercase tracking-wider text-[#475569] dark:text-[#CBD5E1] truncate">
                Total Scans
              </span>
            </div>
          </div>

          <div className="my-auto pt-1">
            <div className="text-[32px] sm:text-[34px] font-extrabold text-[#0F172A] dark:text-[#F8FAFC] tracking-tight font-sans leading-none">
              0
            </div>
          </div>

          <div className="flex items-center justify-between text-[11px] text-[#475569] dark:text-[#94A3B8] border-t border-[#F1F5F9] dark:border-[#1E293B] pt-2.5">
            <span className="truncate">0 completed runs</span>
          </div>
        </div>

        {/* Card 4: Vulnerable Libraries */}
        <div className="bg-white dark:bg-[#111C2E] border border-[#E2E8F0] dark:border-[#243247] rounded-xl p-4 sm:p-4.5 shadow-[0_1px_3px_rgba(0,0,0,0.03)] flex flex-col justify-between min-h-[148px] relative overflow-hidden transition-colors hover:border-[#CBD5E1] dark:hover:border-[#334460]">
          {/* Subtle 2.5px top accent indicator (Amber #D97706) */}
          <div className="absolute top-0 left-0 right-0 h-[2.5px] bg-[#D97706]" />

          <div className="flex items-center justify-between gap-1.5">
            <div className="flex items-center gap-1.5 min-w-0">
              <Package className="w-4 h-4 text-[#D97706] shrink-0" strokeWidth={2} />
              <span className="text-[11px] font-bold uppercase tracking-wider text-[#475569] dark:text-[#CBD5E1] truncate">
                Vulnerable Libraries
              </span>
            </div>
          </div>

          <div className="my-auto pt-1">
            <div className="text-[32px] sm:text-[34px] font-extrabold text-[#0F172A] dark:text-[#F8FAFC] tracking-tight font-sans leading-none">
              0
            </div>
          </div>

          <div className="flex items-center justify-between text-[11px] text-[#475569] dark:text-[#94A3B8] border-t border-[#F1F5F9] dark:border-[#1E293B] pt-2.5">
            <span className="truncate">0 requires patch</span>
          </div>
        </div>

        {/* Card 5: Unique CVEs */}
        <div className="bg-white dark:bg-[#111C2E] border border-[#E2E8F0] dark:border-[#243247] rounded-xl p-4 sm:p-4.5 shadow-[0_1px_3px_rgba(0,0,0,0.03)] flex flex-col justify-between min-h-[148px] relative overflow-hidden transition-colors hover:border-[#CBD5E1] dark:hover:border-[#334460]">
          {/* Subtle 2.5px top accent indicator (Red #DC2626) */}
          <div className="absolute top-0 left-0 right-0 h-[2.5px] bg-[#DC2626]" />

          <div className="flex items-center justify-between gap-1.5">
            <div className="flex items-center gap-1.5 min-w-0">
              <ShieldAlert className="w-4 h-4 text-[#DC2626] shrink-0" strokeWidth={2} />
              <span className="text-[11px] font-bold uppercase tracking-wider text-[#475569] dark:text-[#CBD5E1] truncate">
                Unique CVEs
              </span>
            </div>
          </div>

          <div className="my-auto pt-1">
            <div className="text-[32px] sm:text-[34px] font-extrabold text-[#0F172A] dark:text-[#F8FAFC] tracking-tight font-sans leading-none">
              0
            </div>
          </div>

          <div className="flex items-center justify-between text-[11px] text-[#475569] dark:text-[#94A3B8] border-t border-[#F1F5F9] dark:border-[#1E293B] pt-2.5">
            <span className="truncate">0 critical findings</span>
          </div>
        </div>
      </div>

      {/* 3. Threat Severity Breakdown */}
      <div className="bg-white dark:bg-[#111827] border border-gray-200 dark:border-gray-800 rounded-xl p-5 shadow-2xs">
        <div className="flex items-center justify-between pb-3 border-b border-gray-100 dark:border-gray-800">
          <div>
            <h3 className="text-sm font-bold text-gray-900 dark:text-white">Threat Severity Breakdown</h3>
            <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">Critical, High, Medium, and Low distribution of Common Vulnerabilities and Exposures</p>
          </div>
          <span className="text-[10px] font-bold px-2.5 py-1 rounded-md bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300 border border-blue-200/60 dark:border-blue-900/40">
            {timeRange === '7D' ? 'Last 7 Days' : timeRange === '30D' ? 'Last 30 Days' : 'Last 90 Days'}
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-center pt-4">
          <div className="md:col-span-4 flex items-center justify-center">
            <div className="relative w-[160px] h-[160px] shrink-0 flex items-center justify-center">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={severityDonutData}
                    cx="50%"
                    cy="50%"
                    innerRadius={48}
                    outerRadius={70}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {severityDonutData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 flex flex-col items-center justify-center text-center pointer-events-none">
                <span className="text-2xl font-black text-gray-900 dark:text-white leading-none">
                  0
                </span>
                <span className="text-[10px] text-gray-400 mt-1 uppercase tracking-wider font-semibold">Total CVEs</span>
              </div>
            </div>
          </div>

          <div className="md:col-span-8 grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-3.5 rounded-xl border border-red-200/60 dark:border-red-900/40 bg-red-50/40 dark:bg-red-950/20">
              <div className="flex items-center gap-1.5 text-xs font-bold text-red-700 dark:text-red-300">
                <span className="w-2.5 h-2.5 rounded-full bg-[#e03131]" />
                Critical
              </div>
              <div className="text-2xl font-black text-red-600 dark:text-red-400 font-mono mt-1.5">
                0
              </div>
              <div className="text-[10px] text-gray-500 mt-0.5">CVSS 9.0 - 10.0</div>
            </div>

            <div className="p-3.5 rounded-xl border border-orange-200/60 dark:border-orange-900/40 bg-orange-50/40 dark:bg-orange-950/20">
              <div className="flex items-center gap-1.5 text-xs font-bold text-orange-700 dark:text-orange-300">
                <span className="w-2.5 h-2.5 rounded-full bg-[#f97316]" />
                High
              </div>
              <div className="text-2xl font-black text-orange-600 dark:text-orange-400 font-mono mt-1.5">
                0
              </div>
              <div className="text-[10px] text-gray-500 mt-0.5">CVSS 7.0 - 8.9</div>
            </div>

            <div className="p-3.5 rounded-xl border border-amber-200/60 dark:border-amber-900/40 bg-amber-50/40 dark:bg-amber-950/20">
              <div className="flex items-center gap-1.5 text-xs font-bold text-amber-700 dark:text-amber-300">
                <span className="w-2.5 h-2.5 rounded-full bg-[#f59e0b]" />
                Medium
              </div>
              <div className="text-2xl font-black text-amber-600 dark:text-amber-400 font-mono mt-1.5">
                0
              </div>
              <div className="text-[10px] text-gray-500 mt-0.5">CVSS 4.0 - 6.9</div>
            </div>

            <div className="p-3.5 rounded-xl border border-sky-200/60 dark:border-sky-900/40 bg-sky-50/40 dark:bg-sky-950/20">
              <div className="flex items-center gap-1.5 text-xs font-bold text-sky-700 dark:text-sky-300">
                <span className="w-2.5 h-2.5 rounded-full bg-[#0ea5e9]" />
                Low
              </div>
              <div className="text-2xl font-black text-sky-600 dark:text-sky-400 font-mono mt-1.5">
                0
              </div>
              <div className="text-[10px] text-gray-500 mt-0.5">CVSS 0.1 - 3.9</div>
            </div>
          </div>
        </div>
      </div>

      {/* 4. LOWER CONTENT: Risk Trend Chart + Top 5 Vulnerable Projects */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3.5">
        {/* Risk Trend Chart (7 cols) */}
        <div className="lg:col-span-7 bg-white dark:bg-[#111827] border border-gray-200 dark:border-gray-800 rounded-xl p-4 sm:p-4.5 shadow-2xs">
          <div className="flex items-center justify-between mb-2.5">
            <div>
              <h3 className="text-sm font-bold text-gray-900 dark:text-white">Risk Trend Chart</h3>
              <p className="text-[11px] text-gray-500 dark:text-gray-400">
                Risk index and vulnerability count over the last {timeRange === '7D' ? '7 days' : timeRange === '30D' ? '30 days' : '90 days'}
              </p>
            </div>
            <div className="flex items-center gap-3 text-xs">
              <span className="flex items-center gap-1.5 text-red-600 font-semibold text-[11px]">
                <span className="w-2 h-2 rounded-full bg-red-600" /> Risk Index
              </span>
              <span className="flex items-center gap-1.5 text-blue-600 font-semibold text-[11px]">
                <span className="w-2 h-2 rounded-full bg-blue-600" /> Vuln Count
              </span>
            </div>
          </div>

          <div className="h-[175px] w-full flex items-center justify-center">
            {riskTrendData.length === 0 ? (
              <span className="text-xs text-gray-500 dark:text-gray-400">No data available yet.</span>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={riskTrendData} margin={{ top: 5, right: 10, left: -25, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} opacity={0.6} />
                  <XAxis dataKey="date" tickLine={false} axisLine={false} tick={{ fontSize: 10, fill: '#9ca3af' }} />
                  <YAxis domain={[15, 80]} tickLine={false} axisLine={false} tick={{ fontSize: 10, fill: '#9ca3af' }} />
                  <RechartsTooltip contentStyle={{ backgroundColor: '#1f2937', borderRadius: '8px', color: '#fff', fontSize: '11px', padding: '6px 10px' }} />
                  <Line type="monotone" dataKey="riskIndex" stroke="#e03131" strokeWidth={2} dot={{ r: 2.5 }} />
                  <Line type="monotone" dataKey="vulns" stroke="#3b82f6" strokeWidth={1.8} dot={{ r: 2.5 }} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Top 5 Vulnerable Projects (5 cols) */}
        <div className="lg:col-span-5 bg-white dark:bg-[#111827] border border-gray-200 dark:border-gray-800 rounded-xl p-4 sm:p-4.5 shadow-2xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-bold text-gray-900 dark:text-white">Top 5 Vulnerable Projects</h3>
              <button
                onClick={() => navigate('/software-inventory/projects')}
                className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
              >
                View all →
              </button>
            </div>

            <div className="space-y-1.5">
              {top5VulnerableProjects.length === 0 ? (
                <div className="py-8 text-center text-xs text-gray-500 dark:text-gray-400">
                  No data available yet.
                </div>
              ) : (
                top5VulnerableProjects.map((proj, idx) => (
                  <div
                    key={proj.id}
                    onClick={() => navigate('/software-inventory/projects')}
                    className="flex items-center justify-between py-1.5 px-2.5 rounded-lg border border-gray-100 dark:border-gray-800 hover:bg-gray-50/70 dark:hover:bg-gray-800/40 cursor-pointer transition-colors text-xs"
                  >
                    <div className="flex items-center gap-2">
                      <span className="w-4.5 h-4.5 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center font-bold text-[10px] text-gray-500">
                        {idx + 1}
                      </span>
                      <div>
                        <p className="font-bold text-gray-900 dark:text-white leading-tight">{proj.name}</p>
                        <p className="text-[10px] text-gray-400">{proj.apps} microservices • {proj.cves} CVEs</p>
                      </div>
                    </div>
                    <div className="text-right leading-tight">
                      <span className="font-bold text-red-600 dark:text-red-400 text-xs block">{proj.riskScore}</span>
                      <span className="text-[9px] uppercase font-bold text-gray-400">{proj.status}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      {/* 5. Project Repository Table */}
      <div className="bg-white dark:bg-[#111827] border border-gray-200 dark:border-gray-800 rounded-xl p-4 sm:p-4.5 shadow-2xs">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="text-sm font-bold text-gray-900 dark:text-white">Project Repository Table</h3>
            <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">Name, risk, applications, total scans, critical and high vulnerabilities</p>
          </div>
          <button
            onClick={() => navigate('/software-inventory/projects')}
            className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
          >
            Manage Projects →
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="text-gray-500 border-b border-gray-100 dark:border-gray-800">
                <th className="pb-2 font-semibold text-[11px]">NAME</th>
                <th className="pb-2 font-semibold text-[11px]">RISK SCORE</th>
                <th className="pb-2 font-semibold text-[11px]">SERVICES / APPS</th>
                <th className="pb-2 font-semibold text-[11px]">TOTAL SCANS</th>
                <th className="pb-2 font-semibold text-[11px]">VULNERABILITIES</th>
                <th className="pb-2 font-semibold text-[11px]">LAST SCAN</th>
                <th className="pb-2 font-semibold text-[11px] text-right">ACTION</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {filteredProjectRepositories.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-xs text-gray-500 dark:text-gray-400">
                    No data available yet.
                  </td>
                </tr>
              ) : (
                filteredProjectRepositories.map((repo) => (
                  <tr key={repo.id} className="hover:bg-gray-50/70 dark:hover:bg-gray-800/40 transition-colors">
                    <td className="py-2.5 font-bold text-blue-600 dark:text-blue-400 hover:underline cursor-pointer">
                      {repo.name}
                    </td>
                    <td className="py-2.5 font-bold text-gray-900 dark:text-white">{repo.risk} / 10</td>
                    <td className="py-2.5 text-gray-600 dark:text-gray-400">{repo.apps} apps</td>
                    <td className="py-2.5 text-gray-600 dark:text-gray-400 font-mono">{repo.scans}</td>
                    <td className="py-2.5">
                      <span className="text-red-600 dark:text-red-400 font-semibold">{repo.critVulns} Crit</span> •{' '}
                      <span className="text-orange-500 dark:text-orange-400 font-semibold">{repo.highVulns} High</span>
                    </td>
                    <td className="py-2.5 text-gray-500 dark:text-gray-400 text-[11px]">{repo.lastScan}</td>
                    <td className="py-2.5 text-right">
                      <button
                        onClick={() => navigate('/software-inventory/projects')}
                        className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
                      >
                        Open Project →
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
  );
};

export default Dashboard;
