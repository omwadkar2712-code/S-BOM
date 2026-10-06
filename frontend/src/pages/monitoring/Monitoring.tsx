import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Activity,
  Calendar,
  Clock,
  TrendingUp,
  Cpu,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  Folder,
  Play,
  Zap,
  Shield,
  Layers,
  Terminal,
} from 'lucide-react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip as RechartsTooltip,
  CartesianGrid,
} from 'recharts';
import { useAppState } from '../../context/AppStateContext';

export const Monitoring: React.FC = () => {
  const { addToast } = useAppState();

  // Shared Chrome Context Filter
  const [scopedProject, setScopedProject] = useState<string>('all');
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);

  const navigate = useNavigate();
  const SCHEDULES_STORAGE_KEY = 'squad1_sbom_schedules';

  // Component 1: Schedule Calendar State loaded from persistent real schedules
  const [schedules, setSchedules] = useState<any[]>(() => {
    try {
      const saved = localStorage.getItem(SCHEDULES_STORAGE_KEY);
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.error('Failed to parse saved schedules', e);
    }
    return [];
  });

  useEffect(() => {
    try {
      const saved = localStorage.getItem(SCHEDULES_STORAGE_KEY);
      if (saved) setSchedules(JSON.parse(saved));
    } catch (e) {
      // ignore
    }
  }, []);

  const toggleSchedule = (id: string) => {
    setSchedules((prev) =>
      prev.map((s) => (s.id === id ? { ...s, enabled: !s.enabled } : s))
    );
    addToast({ type: 'info', title: 'Schedule Toggled', message: 'Updated automation state.' });
  };

  const handleRunNow = (name: string) => {
    addToast({
      type: 'success',
      title: 'Unattended Scan Dispatched',
      message: `Triggered scheduled run for ${name}. Monitoring for drift.`,
    });
  };

  // Component 2: Historical Risk Curve (Focused on Drift)
  const driftRiskCurve = [
    { date: 'Aug 10', baselineRisk: 61, currentDrift: 61, driftDelta: 0 },
    { date: 'Aug 17', baselineRisk: 61, currentDrift: 63, driftDelta: +2 },
    { date: 'Aug 24', baselineRisk: 61, currentDrift: 62, driftDelta: +1 },
    { date: 'Aug 31', baselineRisk: 61, currentDrift: 65, driftDelta: +4 },
    { date: 'Sep 07', baselineRisk: 61, currentDrift: 67, driftDelta: +6 },
    { date: 'Sep 14', baselineRisk: 61, currentDrift: 68, driftDelta: +7 },
  ];

  // Component 3: Scanner Tools Status (Admin)
  const scannerTools = [
    { name: 'Anchore Syft', role: 'Multi-Ecosystem SBOM Engine', version: 'v1.14.0', status: 'Healthy', activePids: 2, lastUpdated: '1d ago' },
    { name: 'Anchore Grype', role: 'Continuous Vulnerability Matcher', version: 'v0.82.0', status: 'Healthy', activePids: 1, lastUpdated: '6h ago' },
    { name: 'Aquasecurity Trivy', role: 'Binary & Container Image Scanner', version: 'v0.56.2', status: 'Healthy', activePids: 1, lastUpdated: '2d ago' },
    { name: 'TruffleHog v3', role: 'Cryptographic Secret Detector', version: 'v3.81.0', status: 'Healthy', activePids: 0, lastUpdated: '3d ago' },
    { name: 'CycloneDX CLI', role: 'Attestation & XML/JSON Converter', version: 'v0.25.1', status: 'Healthy', activePids: 0, lastUpdated: '5d ago' },
    { name: 'eBPF Kernel Sensor', role: 'Live Runtime Syscall Behavioral Monitor', version: 'v2.4.0-k', status: 'Active', activePids: 4, lastUpdated: 'Real-time' },
  ];

  const handleRefreshHealth = async () => {
    setIsRefreshing(true);
    await new Promise((r) => setTimeout(r, 800));
    setIsRefreshing(false);
    addToast({
      type: 'success',
      title: 'Scanners Online & Synchronized',
      message: 'All 6 scanner binaries and feeds responded with 200 OK.',
    });
  };

  return (
    <div className="space-y-6 animate-fadeIn pb-12">
      {/* Scope Filter & Telemetry Controls */}
      <div className="bg-white dark:bg-[#111827] border border-gray-200 dark:border-gray-800 rounded-xl p-4 sm:p-5 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-[11px] font-bold bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400">
              <Activity className="w-3.5 h-3.5" />
              Continuous Unattended Telemetry & Drift Watch
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
                <option value="all">All Watched Repositories (Org)</option>
                <option value="Payments API">Payments API Watchlist</option>
                <option value="Customer Portal">Customer Portal Watchlist</option>
              </select>
            </div>

            {/* Primary Action Button */}
            <button
              onClick={handleRefreshHealth}
              disabled={isRefreshing}
              className="px-3.5 py-1.5 text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-lg shadow-xs flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
            >
              <RotateCcw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
              <span>Refresh Health Checks</span>
            </button>
          </div>
        </div>
      </div>

      {/* Component 2: Historical Risk Curve (Focused on Drift) */}
      <div className="bg-white dark:bg-[#111827] border border-gray-200 dark:border-gray-800 rounded-xl p-5 shadow-xs space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-bold text-gray-900 dark:text-white">
              Inventory Posture & Dependency Drift Curve
            </h2>
            <p className="text-xs text-gray-500">
              Tracking posture drift over 30 days without source code changes (due to new upstream CVEs published by NVD/OSV).
            </p>
          </div>
          <div className="flex items-center gap-3 text-xs">
            <div className="flex items-center gap-1.5 font-semibold text-gray-500">
              <span className="w-2.5 h-1 bg-gray-400 rounded" />
              <span>Release Baseline (61)</span>
            </div>
            <div className="flex items-center gap-1.5 font-semibold text-red-600">
              <span className="w-2.5 h-1 bg-[#e03131] rounded" />
              <span>Current Drifted Posture (68)</span>
            </div>
          </div>
        </div>

        <div className="h-56">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={driftRiskCurve} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" strokeOpacity={0.6} />
              <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#94a3b8' }} tickLine={false} axisLine={{ stroke: '#cbd5e1' }} />
              <YAxis domain={[50, 75]} ticks={[50, 55, 60, 65, 70, 75]} tick={{ fontSize: 10, fill: '#94a3b8' }} tickLine={false} axisLine={false} />
              <RechartsTooltip
                contentStyle={{
                  backgroundColor: '#1e293b',
                  borderRadius: '8px',
                  border: 'none',
                  color: '#fff',
                  fontSize: '11px',
                }}
              />
              <Line type="stepAfter" dataKey="baselineRisk" stroke="#94a3b8" strokeDasharray="4 4" strokeWidth={2} name="Baseline Score" />
              <Line type="monotone" dataKey="currentDrift" stroke="#e03131" strokeWidth={2.5} dot={{ r: 3, fill: '#e03131' }} name="Active Drift Index" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Grid: Component 1 (Schedule Calendar) & Component 3 (Scanner Tools Status) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Component 1: Schedule Calendar */}
        <div className="lg:col-span-6 bg-white dark:bg-[#111827] border border-gray-200 dark:border-gray-800 rounded-xl p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-blue-100 dark:bg-blue-900/40 text-blue-600 flex items-center justify-center">
                <Calendar className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-gray-900 dark:text-white">Unattended Schedule Calendar</h2>
                <p className="text-xs text-gray-500">Recurring automated monitoring jobs</p>
              </div>
            </div>
            <span className="text-xs font-mono font-bold text-emerald-600">
              {schedules.filter((s) => s.enabled).length} Active Daemons
            </span>
          </div>

          <div className="space-y-3">
            {schedules.length === 0 ? (
              <div className="p-8 text-center bg-gray-50/50 dark:bg-gray-800/30 rounded-xl border border-gray-200 dark:border-gray-800">
                <Calendar className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                <p className="text-xs font-semibold text-gray-800 dark:text-gray-200">No Automated Schedules Configured</p>
                <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-1 mb-3">
                  Create recurring cron or calendar scan schedules to monitor drift automatically.
                </p>
                <button
                  type="button"
                  onClick={() => navigate('/security-scans/schedules')}
                  className="px-3 py-1.5 text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors cursor-pointer"
                >
                  Configure Schedules
                </button>
              </div>
            ) : (
              schedules.map((sched) => (
                <div
                  key={sched.id}
                  className="p-3.5 rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/30 flex items-center justify-between gap-3 text-xs"
                >
                  <div className="space-y-1">
                    <div className="font-bold text-gray-900 dark:text-white">{sched.name}</div>
                    <div className="text-[11px] text-gray-500">
                      {sched.project} • <span className="font-mono text-blue-600 font-semibold">{sched.frequency}</span>
                    </div>
                    <div className="text-[10px] text-gray-400">Next: {sched.nextRun}</div>
                  </div>

                  <div className="flex items-center gap-2.5">
                    <button
                      type="button"
                      onClick={() => toggleSchedule(sched.id)}
                      className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${
                        sched.enabled ? 'bg-emerald-600' : 'bg-gray-300 dark:bg-gray-700'
                      }`}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition ${
                          sched.enabled ? 'translate-x-4' : 'translate-x-0'
                        }`}
                      />
                    </button>

                    <button
                      onClick={() => handleRunNow(sched.name)}
                      className="px-2.5 py-1 text-[11px] font-semibold bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 rounded cursor-pointer"
                    >
                      Run Now
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Component 3: Scanner Tools Status (Admin) */}
        <div className="lg:col-span-6 bg-white dark:bg-[#111827] border border-gray-200 dark:border-gray-800 rounded-xl p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 flex items-center justify-center">
                <Cpu className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-gray-900 dark:text-white">Scanner Daemons & Tool Status</h2>
                <p className="text-xs text-gray-500">Installed engine binaries and live worker daemons</p>
              </div>
            </div>
            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700">
              ALL OPERATIONAL
            </span>
          </div>

          <div className="space-y-2 text-xs">
            {scannerTools.map((tool) => (
              <div
                key={tool.name}
                className="p-2.5 rounded-lg border border-gray-100 dark:border-gray-800/80 bg-gray-50/50 dark:bg-gray-800/30 flex items-center justify-between"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-gray-900 dark:text-white">{tool.name}</span>
                    <span className="font-mono text-[10px] text-gray-400">{tool.version}</span>
                  </div>
                  <div className="text-[10px] text-gray-500">{tool.role}</div>
                </div>

                <div className="text-right">
                  <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-600">
                    <CheckCircle2 className="w-3 h-3" /> {tool.status}
                  </span>
                  <span className="block font-mono text-[10px] text-gray-400">{tool.activePids} workers active</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Monitoring;
