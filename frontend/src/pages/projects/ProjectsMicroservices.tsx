import React, { useEffect, useMemo, useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import {
  FolderGit2,
  Package,
  FileCode,
  ShieldCheck,
  Scan,
  Search,
  ChevronRight,
} from 'lucide-react';
import { ApiError, listProjects, type ApiProjectRow, type ApiProjectSummary } from '../../api/client';
import { useAppState } from '../../context/AppStateContext';

const EMPTY_SUMMARY: ApiProjectSummary = {
  project_count: 0,
  active_projects: 0,
  avg_compliance_pct: 0,
  compliant_count: 0,
  total_count: 0,
  total_scans: 0,
  sbom_files: 0,
};

function riskColor(risk: ApiProjectRow['risk']): string {
  if (risk === 'High Risk') return 'bg-red-50 text-red-700 border-red-200 dark:bg-red-950/40 dark:text-red-300 dark:border-red-900/50';
  if (risk === 'Needs Attention') return 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-900/50';
  return 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-900/50';
}

function relativeTime(iso: string): string {
  if (!iso) return '—';
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return iso;
  const seconds = Math.max(0, Math.round((Date.now() - then) / 1000));
  if (seconds < 45) return 'Just now';
  if (seconds < 3600) return `${Math.max(1, Math.round(seconds / 60))}m ago`;
  if (seconds < 86400) return `${Math.max(1, Math.round(seconds / 3600))}h ago`;
  if (seconds < 604800) return `${Math.max(1, Math.round(seconds / 86400))}d ago`;
  return new Date(iso).toLocaleDateString();
}

export const ProjectsMicroservices: React.FC = () => {
  const navigate = useNavigate();
  const { addToast } = useAppState();
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('All Statuses');
  const [summary, setSummary] = useState<ApiProjectSummary>(EMPTY_SUMMARY);
  const [projectsList, setProjectsList] = useState<ApiProjectRow[]>([]);
  const [loading, setLoading] = useState(true);
  const toastOnce = React.useRef(false);

  useEffect(() => {
    let cancelled = false;
    const timer = window.setTimeout(async () => {
      setLoading(true);
      try {
        const data = await listProjects({
          q: searchQuery.trim() || undefined,
          status: statusFilter,
        });
        if (cancelled) return;
        setSummary(data.summary || EMPTY_SUMMARY);
        setProjectsList(data.projects || []);
        toastOnce.current = false;
      } catch (err) {
        if (cancelled) return;
        setSummary(EMPTY_SUMMARY);
        setProjectsList([]);
        // Avoid toast storms when addToast identity changes after each notification.
        if (!toastOnce.current) {
          toastOnce.current = true;
          addToast({
            type: 'error',
            title: 'Projects unavailable',
            message: err instanceof ApiError ? err.message : 'Could not load projects from scans.',
          });
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 200);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [searchQuery, statusFilter, addToast]);

  const emptyMessage = useMemo(() => {
    if (loading) return 'Loading projects discovered from scans…';
    if (searchQuery || statusFilter !== 'All Statuses') {
      return 'No projects match the current search or status filter.';
    }
    return 'No projects or microservices available yet. Real services will appear once discovered from scans.';
  }, [loading, searchQuery, statusFilter]);

  return (
    <div className="space-y-5 animate-fadeIn pb-16">
      <div className="border-b border-gray-200 dark:border-gray-800">
        <nav className="flex items-center space-x-2 sm:space-x-3 overflow-x-auto" aria-label="Software Inventory Tabs">
          <NavLink
            to="/software-inventory"
            end
            className={({ isActive }) =>
              `flex items-center gap-2 py-2.5 px-3.5 text-xs font-semibold rounded-t-lg transition-all cursor-pointer whitespace-nowrap shrink-0 border-b-2 ${
                isActive
                  ? 'bg-blue-50/80 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 border-blue-600 font-bold shadow-2xs'
                  : 'border-transparent text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800/40'
              }`
            }
          >
            <Package className="w-4 h-4" />
            <span>Software Components & Packages</span>
          </NavLink>

          <NavLink
            to="/software-inventory/projects"
            className={({ isActive }) =>
              `flex items-center gap-2 py-2.5 px-3.5 text-xs font-semibold rounded-t-lg transition-all cursor-pointer whitespace-nowrap shrink-0 border-b-2 ${
                isActive
                  ? 'bg-blue-50/80 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 border-blue-600 font-bold shadow-2xs'
                  : 'border-transparent text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800/40'
              }`
            }
          >
            <FolderGit2 className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            <span>Projects & Microservices</span>
          </NavLink>

          <NavLink
            to="/software-inventory/artifacts"
            className={({ isActive }) =>
              `flex items-center gap-2 py-2.5 px-3.5 text-xs font-semibold rounded-t-lg transition-all cursor-pointer whitespace-nowrap shrink-0 border-b-2 ${
                isActive
                  ? 'bg-blue-50/80 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 border-blue-600 font-bold shadow-2xs'
                  : 'border-transparent text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800/40'
              }`
            }
          >
            <FileCode className="w-4 h-4" />
            <span>SBOM Documents & Artifacts</span>
          </NavLink>
        </nav>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        <div className="bg-white dark:bg-[#111827] border border-gray-200 dark:border-gray-800 rounded-xl p-4 shadow-2xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-950/60 text-blue-600 flex items-center justify-center">
                <FolderGit2 className="w-4 h-4" />
              </div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                PROJECTS
              </span>
            </div>
            <ChevronRight className="w-4 h-4 text-gray-400" />
          </div>
          <div className="mt-3">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">{summary.project_count}</h2>
            <p className="text-[11px] text-gray-400 mt-0.5">{summary.active_projects} active projects</p>
          </div>
        </div>

        <div className="bg-white dark:bg-[#111827] border border-gray-200 dark:border-gray-800 rounded-xl p-4 shadow-2xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 flex items-center justify-center">
                <ShieldCheck className="w-4 h-4" />
              </div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                AVG COMPLIANCE
              </span>
            </div>
            <ChevronRight className="w-4 h-4 text-gray-400" />
          </div>
          <div className="mt-3">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">{summary.avg_compliance_pct.toFixed(1)}%</h2>
            <p className="text-[11px] text-gray-400 mt-0.5">
              {summary.compliant_count} / {summary.total_count} compliant
            </p>
          </div>
        </div>

        <div className="bg-white dark:bg-[#111827] border border-gray-200 dark:border-gray-800 rounded-xl p-4 shadow-2xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-950/60 text-blue-600 flex items-center justify-center">
                <Scan className="w-4 h-4" />
              </div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                TOTAL SCANS
              </span>
            </div>
            <ChevronRight className="w-4 h-4 text-gray-400" />
          </div>
          <div className="mt-3">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">{summary.total_scans}</h2>
            <p className="text-[11px] text-gray-400 mt-0.5">{summary.total_scans} total scans</p>
          </div>
        </div>

        <div className="bg-white dark:bg-[#111827] border border-gray-200 dark:border-gray-800 rounded-xl p-4 shadow-2xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-orange-50 dark:bg-orange-950/60 text-orange-600 flex items-center justify-center">
                <FileCode className="w-4 h-4" />
              </div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                SBOM FILES
              </span>
            </div>
            <ChevronRight className="w-4 h-4 text-gray-400" />
          </div>
          <div className="mt-3">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">{summary.sbom_files}</h2>
            <p className="text-[11px] text-gray-400 mt-0.5">{summary.sbom_files} files generated</p>
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-[#111827] border border-gray-200 dark:border-gray-800 rounded-xl p-5 shadow-2xs space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-3 border-b border-gray-100 dark:border-gray-800">
          <div>
            <h3 className="text-sm font-bold text-gray-900 dark:text-white">SBOM Projects</h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              Risk + compliance mapped per project from completed scans
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search projects"
                className="pl-9 pr-3 py-1.5 text-xs bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="text-xs px-3 py-1.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-gray-700 dark:text-gray-300 cursor-pointer focus:outline-none"
            >
              <option value="All Statuses">All Statuses</option>
              <option value="High Risk">High Risk</option>
              <option value="Needs Attention">Needs Attention</option>
              <option value="Healthy">Healthy</option>
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs min-w-[800px]">
            <thead>
              <tr className="text-gray-500 dark:text-gray-400 border-b border-gray-100 dark:border-gray-800">
                <th className="pb-3 pr-4 font-semibold whitespace-nowrap">NAME</th>
                <th className="pb-3 px-4 font-semibold whitespace-nowrap">CLASSIFIER</th>
                <th className="pb-3 px-4 font-semibold whitespace-nowrap">RISK</th>
                <th className="pb-3 px-4 font-semibold whitespace-nowrap">COMPLIANCE</th>
                <th className="pb-3 px-4 font-semibold whitespace-nowrap">VULNS</th>
                <th className="pb-3 px-4 font-semibold whitespace-nowrap">SCANS</th>
                <th className="pb-3 px-4 font-semibold whitespace-nowrap">TAGS</th>
                <th className="pb-3 pl-4 font-semibold whitespace-nowrap">HISTORY</th>
              </tr>
            </thead>
            {projectsList.length > 0 ? (
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {projectsList.map((p) => (
                  <tr key={p.id} className="hover:bg-gray-50/70 dark:hover:bg-gray-800/40 transition-colors">
                    <td
                      onClick={() => navigate(`/vulnerabilities?project=${encodeURIComponent(p.name)}`)}
                      className="py-3.5 pr-4 font-bold text-blue-600 dark:text-blue-400 whitespace-nowrap cursor-pointer hover:underline hover:text-blue-700 dark:hover:text-blue-300 transition-colors"
                      title={`View vulnerability management for ${p.name}`}
                    >
                      {p.name}
                    </td>
                    <td className="py-3.5 px-4 text-gray-600 dark:text-gray-400 whitespace-nowrap">{p.classifier}</td>
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      <span className={`px-2.5 py-0.5 rounded text-[10px] font-bold border ${riskColor(p.risk)}`}>
                        {p.risk}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 font-semibold text-gray-900 dark:text-white whitespace-nowrap">{p.compliance}</td>
                    <td className="py-3.5 px-4 font-semibold whitespace-nowrap">
                      {p.vulns > 0 ? (
                        <span className="text-red-600 dark:text-red-400 font-bold">{p.vulns}</span>
                      ) : (
                        <span className="text-gray-400">0</span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-gray-600 dark:text-gray-400 whitespace-nowrap">{p.scans}</td>
                    <td className="py-3.5 px-4">
                      <div className="flex gap-1 flex-wrap">
                        {p.tags.map((t) => (
                          <span
                            key={t}
                            className="px-1.5 py-0.5 bg-gray-100 dark:bg-gray-800 text-[10px] rounded text-gray-600 dark:text-gray-400 whitespace-nowrap"
                          >
                            {t}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="py-3.5 pl-4 text-gray-500 dark:text-gray-400 whitespace-nowrap">
                      {relativeTime(p.last_scanned_at)}
                    </td>
                  </tr>
                ))}
              </tbody>
            ) : null}
          </table>

          {projectsList.length === 0 && (
            <div className="py-12 text-center space-y-3">
              <div className="w-12 h-12 mx-auto rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center text-gray-400">
                <Search className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-gray-900 dark:text-white">
                  {loading ? 'Loading…' : 'No projects or microservices available yet.'}
                </h4>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{emptyMessage}</p>
              </div>
              <button
                onClick={() => {
                  setSearchQuery('');
                  setStatusFilter('All Statuses');
                }}
                className="px-3.5 py-1.5 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 text-xs font-semibold rounded-lg transition-colors cursor-pointer"
              >
                Reset Filters
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ProjectsMicroservices;
