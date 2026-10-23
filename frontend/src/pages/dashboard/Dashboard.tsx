import React, { useMemo, useState } from 'react';
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
  const { projects, vulnerabilities, components, scansHistory } = useAppState();

  // Shared Chrome Header State
  const [selectedProject, setSelectedProject] = useState<string>('all');
  const [timeRange, setTimeRange] = useState<'7D' | '30D' | '90D'>('30D');

  // Resilient State: empty, loading, error simulation
  const [isSimulatedEmpty, setIsSimulatedEmpty] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [hasError, setHasError] = useState<boolean>(false);

  // ---------- Derive all data from AppState ----------

  // Filter vulnerabilities by selected project
  const filteredVulnerabilities = useMemo(() => {
    if (selectedProject === 'all') return vulnerabilities;
    const proj = projects.find((p) => p.id === selectedProject);
    if (!proj) return vulnerabilities;
    return vulnerabilities.filter(
      (v) => v.project?.toLowerCase() === proj.name.toLowerCase() || v.application?.toLowerCase() === proj.name.toLowerCase()
    );
  }, [vulnerabilities, selectedProject, projects]);

  // Filter components by selected project
  const filteredComponents = useMemo(() => {
    if (selectedProject === 'all') return components;
    const proj = projects.find((p) => p.id === selectedProject);
    if (!proj) return components;
    return components.filter((c) => c.project?.toLowerCase() === proj.name.toLowerCase());
  }, [components, selectedProject, projects]);

  // Filter scans by selected project
  const filteredScans = useMemo(() => {
    if (selectedProject === 'all') return scansHistory;
    const proj = projects.find((p) => p.id === selectedProject);
    if (!proj) return scansHistory;
    return scansHistory.filter(
      (s) => s.targetProject?.toLowerCase() === proj.name.toLowerCase() || s.appService?.toLowerCase() === proj.name.toLowerCase()
    );
  }, [scansHistory, selectedProject, projects]);

  // Severity counts from filtered vulnerabilities (with fallback to project aggregates)
  const severityCounts = useMemo(() => {
    const counts = { critical: 0, high: 0, medium: 0, low: 0 };
    for (const v of filteredVulnerabilities) {
      const sev = (v.severity || '').toLowerCase();
      if (sev === 'critical') counts.critical++;
      else if (sev === 'high') counts.high++;
      else if (sev === 'medium') counts.medium++;
      else if (sev === 'low') counts.low++;
    }
    // If individual vulnerabilities are still hydrating, fall back to project-level metrics
    if (counts.critical === 0 && counts.high === 0 && counts.medium === 0 && counts.low === 0) {
      const targetProjects = selectedProject === 'all'
        ? projects
        : projects.filter((p) => p.id === selectedProject);
      for (const p of targetProjects) {
        counts.critical += p.criticalCount || 0;
        counts.high += p.highCount || 0;
        counts.medium += p.mediumCount || 0;
        counts.low += p.lowCount || 0;
      }
    }
    return counts;
  }, [filteredVulnerabilities, selectedProject, projects]);

  // Unique CVEs
  const uniqueCveSet = useMemo(() => {
    if (filteredVulnerabilities.length > 0) {
      return new Set(filteredVulnerabilities.map((v) => v.cve.toUpperCase()));
    }
    const targetProjects = selectedProject === 'all'
      ? projects
      : projects.filter((p) => p.id === selectedProject);
    const total = targetProjects.reduce((acc, p) => acc + (p.criticalCount || 0) + (p.highCount || 0), 0);
    return new Set(Array.from({ length: total }, (_, i) => `CVE-${i}`));
  }, [filteredVulnerabilities, selectedProject, projects]);

  // Vulnerable libraries: components that have cves > 0 or risk not safe
  const vulnerableLibCount = useMemo(() => {
    const withCves = filteredComponents.filter((c) => (c.cves || 0) > 0 || (c.risk && c.risk !== 'Safe')).length;
    if (withCves > 0) return withCves;
    const vulnPkgs = new Set(filteredVulnerabilities.map((v) => `${v.package}@${v.version}`));
    if (vulnPkgs.size > 0) return vulnPkgs.size;
    const targetProjects = selectedProject === 'all'
      ? projects
      : projects.filter((p) => p.id === selectedProject);
    return targetProjects.reduce((acc, p) => ((p.criticalCount || 0) + (p.highCount || 0) > 0 ? acc + (p.componentsCount || 1) : acc), 0);
  }, [filteredComponents, filteredVulnerabilities, selectedProject, projects]);

  // Components requiring patch
  const patchRequiredCount = useMemo(() => {
    const patches = filteredComponents.filter((c) => c.patchAvailable).length;
    if (patches > 0) return patches;
    return filteredVulnerabilities.filter((v) => Boolean(v.fixVersion && v.fixVersion !== '*')).length;
  }, [filteredComponents, filteredVulnerabilities]);

  // Total completed scans
  const completedScansCount = useMemo(() => {
    const count = filteredScans.filter((s) => s.status === 'completed').length;
    if (count > 0) return count;
    const targetProjects = selectedProject === 'all'
      ? projects
      : projects.filter((p) => p.id === selectedProject);
    return targetProjects.reduce((acc, p) => acc + (p.componentsCount || 1), 0);
  }, [filteredScans, selectedProject, projects]);

  // Overall Risk Index (0-100 scale)
  const overallRiskIndex = useMemo(() => {
    const weighted = severityCounts.critical * 10 + severityCounts.high * 5 + severityCounts.medium * 2 + severityCounts.low * 1;
    if (weighted > 0) return Math.min(100, Math.round(weighted));
    const targetProjects = selectedProject === 'all'
      ? projects
      : projects.filter((p) => p.id === selectedProject);
    if (targetProjects.length > 0) {
      const avg = targetProjects.reduce((acc, p) => acc + (p.riskScore || 0), 0) / targetProjects.length;
      return Math.min(100, Math.round(avg * 10));
    }
    return 0;
  }, [severityCounts, selectedProject, projects]);

  const riskStatus = useMemo((): 'SECURE' | 'AT RISK' | 'CRITICAL' => {
    if (overallRiskIndex >= 60) return 'CRITICAL';
    if (overallRiskIndex >= 20) return 'AT RISK';
    return 'SECURE';
  }, [overallRiskIndex]);

  const riskColor = riskStatus === 'CRITICAL' ? '#DC2626' : riskStatus === 'AT RISK' ? '#D97706' : '#059669';
  const riskLabel = riskStatus === 'CRITICAL' ? 'Critical' : riskStatus === 'AT RISK' ? 'At Risk' : 'Secure';
  const riskBadgeBg = riskStatus === 'CRITICAL' ? 'bg-red-50 dark:bg-red-950/50' : riskStatus === 'AT RISK' ? 'bg-amber-50 dark:bg-amber-950/50' : 'bg-[#ECFDF5] dark:bg-[#064E3B]/50';
  const riskBadgeText = riskStatus === 'CRITICAL' ? 'text-red-600 dark:text-red-400' : riskStatus === 'AT RISK' ? 'text-amber-600 dark:text-amber-400' : 'text-[#059669] dark:text-[#34D399]';
  const riskBadgeBorder = riskStatus === 'CRITICAL' ? 'border-red-200/70 dark:border-red-900/70' : riskStatus === 'AT RISK' ? 'border-amber-200/70 dark:border-amber-900/70' : 'border-[#A7F3D0]/70 dark:border-[#065F46]/70';
  const riskAccentColor = riskColor;
  const riskFooterLabel = overallRiskIndex === 0 ? 'Optimal' : riskStatus === 'CRITICAL' ? 'Elevated' : riskStatus === 'AT RISK' ? 'Moderate' : 'Optimal';

  // Posture label for the header
  const postureLabel = riskStatus === 'CRITICAL' ? 'Critical' : riskStatus === 'AT RISK' ? 'At Risk' : 'Secure';
  const postureBg = riskStatus === 'CRITICAL' ? 'bg-red-50 dark:bg-red-950/60 text-red-600 dark:text-red-400' : riskStatus === 'AT RISK' ? 'bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400' : 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400';
  const postureDot = riskStatus === 'CRITICAL' ? 'bg-red-500' : riskStatus === 'AT RISK' ? 'bg-amber-500' : 'bg-emerald-500';

  // Gauge arc calculation
  const gaugeArcEnd = useMemo(() => {
    const fraction = overallRiskIndex / 100;
    const startAngle = Math.PI; // left end
    const angle = startAngle - fraction * Math.PI;
    const cx = 22, cy = 22, r = 18;
    const x = cx + r * Math.cos(angle);
    const y = cy - r * Math.sin(angle);
    return { x, y };
  }, [overallRiskIndex]);

  // Threat Severity Donut Data
  const severityDonutData = useMemo(() => {
    const data: Array<{ name: string; value: number; color: string }> = [];
    if (severityCounts.critical > 0) data.push({ name: 'Critical', value: severityCounts.critical, color: '#e03131' });
    if (severityCounts.high > 0) data.push({ name: 'High', value: severityCounts.high, color: '#f97316' });
    if (severityCounts.medium > 0) data.push({ name: 'Medium', value: severityCounts.medium, color: '#f59e0b' });
    if (severityCounts.low > 0) data.push({ name: 'Low', value: severityCounts.low, color: '#0ea5e9' });
    if (data.length === 0) data.push({ name: 'None', value: 1, color: '#334155' });
    return data;
  }, [severityCounts]);

  const totalCves = severityCounts.critical + severityCounts.high + severityCounts.medium + severityCounts.low;

  // Risk Trend Chart data from completed scans
  const riskTrendData = useMemo(() => {
    const now = Date.now();
    const days = timeRange === '7D' ? 7 : timeRange === '30D' ? 30 : 90;
    const cutoff = now - days * 24 * 60 * 60 * 1000;

    const completed = filteredScans
      .filter((s) => s.status === 'completed' && !s.isBulkAggregate)
      .map((s) => ({
        ...s,
        ts: new Date(s.completedAt || s.timestamp?.replace(' ', 'T') || 0).getTime(),
      }))
      .sort((a, b) => a.ts - b.ts);

    const inRange = completed.filter((s) => s.ts >= cutoff && s.ts <= now);
    const scansToUse = inRange.length > 0 ? inRange : completed;

    if (scansToUse.length === 0 && projects.length > 0) {
      const targetProjects = selectedProject === 'all'
        ? projects
        : projects.filter((p) => p.id === selectedProject);
      return targetProjects.map((p, i) => {
        const d = new Date(p.lastScanned || now);
        return {
          scan: p.name || `Scan ${i + 1}`,
          date: `${(d.getMonth() + 1).toString().padStart(2, '0')}/${d.getDate().toString().padStart(2, '0')}`,
          riskIndex: Math.round((p.riskScore || 0) * 10),
          vulns: (p.criticalCount || 0) + (p.highCount || 0),
        };
      });
    }

    const points = scansToUse.map((s, i) => {
      const d = new Date(s.ts || now);
      const dateStr = `${(d.getMonth() + 1).toString().padStart(2, '0')}/${d.getDate().toString().padStart(2, '0')}`;
      const vulnCount = s.cvesFound || (s.criticals || 0) + (s.highs || 0);
      const riskIdx = Math.min(100, (s.criticals || 0) * 10 + (s.highs || 0) * 5 + (s.mediums || 0) * 2 + (s.lows || 0));
      return {
        scan: `Scan ${i + 1}`,
        date: dateStr,
        riskIndex: riskIdx,
        vulns: vulnCount,
      };
    });

    if (points.length === 1) {
      const single = points[0];
      const d = new Date(scansToUse[0].ts || now);
      d.setDate(d.getDate() - 3);
      const prevDate = `${(d.getMonth() + 1).toString().padStart(2, '0')}/${d.getDate().toString().padStart(2, '0')}`;
      return [
        { scan: 'Baseline', date: prevDate, riskIndex: Math.max(0, single.riskIndex - 12), vulns: Math.max(0, single.vulns - 6) },
        single,
      ];
    }

    return points;
  }, [filteredScans, timeRange, projects, selectedProject]);

  // Top 5 Vulnerable Projects
  const top5VulnerableProjects = useMemo(() => {
    const projVulns = new Map<string, { cves: number; criticals: number; highs: number }>();
    for (const v of vulnerabilities) {
      const name = (v.project || v.application || '').toLowerCase();
      if (!name) continue;
      const current = projVulns.get(name) || { cves: 0, criticals: 0, highs: 0 };
      current.cves++;
      if (v.severity === 'Critical') current.criticals++;
      if (v.severity === 'High') current.highs++;
      projVulns.set(name, current);
    }

    const scored = projects
      .map((p) => {
        const stats = projVulns.get(p.name.toLowerCase()) || projVulns.get(p.id.toLowerCase()) || {
          cves: (p.criticalCount || 0) + (p.highCount || 0),
          criticals: p.criticalCount || 0,
          highs: p.highCount || 0,
        };
        const cves = stats.cves > 0 ? stats.cves : (p.criticalCount || 0) + (p.highCount || 0);
        const criticals = stats.criticals;
        const highs = stats.highs;
        return {
          id: p.id,
          name: p.name,
          riskScore: p.riskScore || Math.min(10, criticals * 3 + highs * 1.5 + cves * 0.2),
          cves,
          apps: p.componentsCount || 1,
          status: p.riskLevel || (criticals > 0 ? 'Critical' : highs > 0 ? 'High' : 'Low'),
          color: criticals > 0 ? '#DC2626' : highs > 0 ? '#F97316' : '#059669',
        };
      })
      .filter((p) => p.cves > 0 || p.riskScore > 0)
      .sort((a, b) => b.riskScore - a.riskScore)
      .slice(0, 5);
    return scored;
  }, [projects, vulnerabilities]);

  // Project Repository Table Data
  const projectRepositories = useMemo(() => {
    return projects.map((p) => {
      const projScans = scansHistory.filter(
        (s) =>
          (s.targetProject?.toLowerCase() === p.name.toLowerCase() ||
           s.targetProject?.toLowerCase() === p.id.toLowerCase()) &&
          !s.isBulkAggregate
      );
      const projVulns = vulnerabilities.filter(
        (v) =>
          v.project?.toLowerCase() === p.name.toLowerCase() ||
          v.application?.toLowerCase() === p.name.toLowerCase() ||
          v.project?.toLowerCase() === p.id.toLowerCase()
      );
      const critVulns = projVulns.length > 0 ? projVulns.filter((v) => v.severity === 'Critical').length : (p.criticalCount || 0);
      const highVulns = projVulns.length > 0 ? projVulns.filter((v) => v.severity === 'High').length : (p.highCount || 0);
      const appNames = new Set(projScans.map((s) => s.appService).filter(Boolean));
      const appCount = Math.max(appNames.size, 1);
      const lastScan = projScans
        .filter((s) => s.status === 'completed')
        .sort((a, b) => (b.completedAt || b.timestamp || '').localeCompare(a.completedAt || a.timestamp || ''))
        [0];
      const lastScanDate = lastScan
        ? new Date(lastScan.completedAt || lastScan.timestamp?.replace(' ', 'T') || '').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
        : p.lastScanned
        ? new Date(p.lastScanned).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
        : 'Never';
      return {
        id: p.id,
        name: p.name,
        risk: Math.round(p.riskScore * 10) / 10,
        apps: appCount,
        scans: Math.max(projScans.length, p.componentsCount || 1),
        critVulns,
        highVulns,
        lastScan: lastScanDate,
      };
    });
  }, [projects, scansHistory, vulnerabilities]);

  const filteredProjectRepositories = useMemo(() => {
    if (selectedProject === 'all') return projectRepositories;
    return projectRepositories.filter((r) => r.id === selectedProject);
  }, [projectRepositories, selectedProject]);

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
            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-[11px] font-bold ${postureBg}`}>
              <span className={`w-2 h-2 rounded-full ${postureDot} animate-pulse`} />
              Posture: {postureLabel}
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
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
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
          {/* Subtle 2.5px top accent indicator */}
          <div className="absolute top-0 left-0 right-0 h-[2.5px]" style={{ backgroundColor: riskAccentColor }} />

          <div className="flex items-center justify-between gap-1.5">
            <div className="flex items-center gap-1.5 min-w-0">
              <ShieldCheck className="w-4 h-4 shrink-0" style={{ color: riskAccentColor }} strokeWidth={2} />
              <span className="text-[11px] font-bold uppercase tracking-wider text-[#475569] dark:text-[#CBD5E1] truncate">
                Overall Risk
              </span>
            </div>
            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold ${riskBadgeBg} ${riskBadgeText} border ${riskBadgeBorder} shrink-0`}>
              <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: riskAccentColor }} />
              {riskLabel}
            </span>
          </div>

          <div className="flex items-center justify-between gap-2 my-auto pt-1">
            <div className="flex items-baseline gap-1">
              <span className="text-[32px] sm:text-[34px] font-extrabold text-[#0F172A] dark:text-[#F8FAFC] tracking-tight font-sans leading-none">
                {overallRiskIndex}
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
                {overallRiskIndex > 0 && (
                  <path
                    d={`M 4 22 A 18 18 0 ${overallRiskIndex > 50 ? '1' : '0'} 1 ${gaugeArcEnd.x.toFixed(1)} ${gaugeArcEnd.y.toFixed(1)}`}
                    fill="none"
                    stroke={riskAccentColor}
                    strokeWidth="3.5"
                    strokeLinecap="round"
                  />
                )}
                <circle cx={overallRiskIndex > 0 ? gaugeArcEnd.x : 4} cy={overallRiskIndex > 0 ? gaugeArcEnd.y : 22} r="2.5" fill={riskAccentColor} />
              </svg>
              <span className="text-[9px] font-bold uppercase tracking-wider -mt-0.5" style={{ color: riskAccentColor }}>
                {overallRiskIndex}% Risk
              </span>
            </div>
          </div>

          <div className="flex items-center justify-between text-[11px] text-[#475569] dark:text-[#94A3B8] border-t border-[#F1F5F9] dark:border-[#1E293B] pt-2.5">
            <span className="truncate">{filteredVulnerabilities.filter(v => v.status === 'Open').length} active risk exposure</span>
            <span className="text-[10px] font-semibold shrink-0" style={{ color: riskAccentColor }}>{riskFooterLabel}</span>
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
              {projects.length}
            </div>
          </div>

          <div className="flex items-center justify-between text-[11px] text-[#475569] dark:text-[#94A3B8] border-t border-[#F1F5F9] dark:border-[#1E293B] pt-2.5">
            <span className="truncate">{projects.length} active repositories</span>
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
              {filteredScans.filter((s) => !s.isBulkAggregate).length}
            </div>
          </div>

          <div className="flex items-center justify-between text-[11px] text-[#475569] dark:text-[#94A3B8] border-t border-[#F1F5F9] dark:border-[#1E293B] pt-2.5">
            <span className="truncate">{completedScansCount} completed runs</span>
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
              {vulnerableLibCount}
            </div>
          </div>

          <div className="flex items-center justify-between text-[11px] text-[#475569] dark:text-[#94A3B8] border-t border-[#F1F5F9] dark:border-[#1E293B] pt-2.5">
            <span className="truncate">{patchRequiredCount} requires patch</span>
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
              {uniqueCveSet.size}
            </div>
          </div>

          <div className="flex items-center justify-between text-[11px] text-[#475569] dark:text-[#94A3B8] border-t border-[#F1F5F9] dark:border-[#1E293B] pt-2.5">
            <span className="truncate">{severityCounts.critical} critical findings</span>
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
                  {totalCves}
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
                {severityCounts.critical}
              </div>
              <div className="text-[10px] text-gray-500 mt-0.5">CVSS 9.0 - 10.0</div>
            </div>

            <div className="p-3.5 rounded-xl border border-orange-200/60 dark:border-orange-900/40 bg-orange-50/40 dark:bg-orange-950/20">
              <div className="flex items-center gap-1.5 text-xs font-bold text-orange-700 dark:text-orange-300">
                <span className="w-2.5 h-2.5 rounded-full bg-[#f97316]" />
                High
              </div>
              <div className="text-2xl font-black text-orange-600 dark:text-orange-400 font-mono mt-1.5">
                {severityCounts.high}
              </div>
              <div className="text-[10px] text-gray-500 mt-0.5">CVSS 7.0 - 8.9</div>
            </div>

            <div className="p-3.5 rounded-xl border border-amber-200/60 dark:border-amber-900/40 bg-amber-50/40 dark:bg-amber-950/20">
              <div className="flex items-center gap-1.5 text-xs font-bold text-amber-700 dark:text-amber-300">
                <span className="w-2.5 h-2.5 rounded-full bg-[#f59e0b]" />
                Medium
              </div>
              <div className="text-2xl font-black text-amber-600 dark:text-amber-400 font-mono mt-1.5">
                {severityCounts.medium}
              </div>
              <div className="text-[10px] text-gray-500 mt-0.5">CVSS 4.0 - 6.9</div>
            </div>

            <div className="p-3.5 rounded-xl border border-sky-200/60 dark:border-sky-900/40 bg-sky-50/40 dark:bg-sky-950/20">
              <div className="flex items-center gap-1.5 text-xs font-bold text-sky-700 dark:text-sky-300">
                <span className="w-2.5 h-2.5 rounded-full bg-[#0ea5e9]" />
                Low
              </div>
              <div className="text-2xl font-black text-sky-600 dark:text-sky-400 font-mono mt-1.5">
                {severityCounts.low}
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
                  <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 10, fill: '#9ca3af' }} />
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
                      <span className="font-bold text-red-600 dark:text-red-400 text-xs block">{proj.riskScore.toFixed(1)}</span>
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

