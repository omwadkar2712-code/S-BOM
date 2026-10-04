import React, { useState } from 'react';
import { NavLink } from 'react-router-dom';
import {
  FolderGit2,
  Package,
  FileCode,
  ShieldCheck,
  Scan,
  Plus,
  Search,
  Download,
  Upload,
  BookOpen,
  ArrowRight,
  CheckCircle2,
  ExternalLink,
  Layers,
  X,
  FileSpreadsheet,
  AlertTriangle,
  ChevronRight,
  Shield,
  HelpCircle,
} from 'lucide-react';
import { useAppState } from '../context/AppStateContext';

// Client-side CSV export helper
const exportTableToCsv = (filename: string, rows: (string | number)[][]) => {
  const processRow = (row: (string | number)[]) =>
    row
      .map((val) => {
        const text = String(val ?? '');
        if (text.search(/("|,|\n)/g) >= 0) {
          return `"${text.replace(/"/g, '""')}"`;
        }
        return text;
      })
      .join(',');

  const csvContent = 'data:text/csv;charset=utf-8,' + rows.map(processRow).join('\n');
  const encodedUri = encodeURI(csvContent);
  const link = document.createElement('a');
  link.setAttribute('href', encodedUri);
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

export const ProjectsMicroservices: React.FC = () => {
  const { addToast } = useAppState();

  // Search & filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('All Statuses');

  // Modals
  const [addProjectModalOpen, setAddProjectModalOpen] = useState(false);
  const [learnModalOpen, setLearnModalOpen] = useState(false); // Excel Sr 19
  const [ingestModalOpen, setIngestModalOpen] = useState(false);
  const [auditModalOpen, setAuditModalOpen] = useState(false);
  const [uploadModalOpen, setUploadModalOpen] = useState(false);

  // New Project Form State
  const [newProjectName, setNewProjectName] = useState('');
  const [newProjectClassifier, setNewProjectClassifier] = useState('Service / Microservice');
  const [newProjectRepo, setNewProjectRepo] = useState('');
  const [newProjectBranch, setNewProjectBranch] = useState('main');

  // Projects list (empty ready for real data)
  const [projectsList, setProjectsList] = useState<any[]>([]);

  const filteredProjects = projectsList.filter((p) => {
    const matchesSearch =
      !searchQuery ||
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.classifier.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus =
      statusFilter === 'All Statuses' ||
      (statusFilter === 'High Risk' && p.risk === 'High Risk') ||
      (statusFilter === 'Needs Attention' && p.risk === 'Needs Attention') ||
      (statusFilter === 'Healthy' && p.risk === 'Healthy');
    return matchesSearch && matchesStatus;
  });

  const handleCreateProject = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProjectName.trim()) return;

    const newProj = {
      id: `proj-${Date.now()}`,
      name: newProjectName,
      classifier: newProjectClassifier,
      risk: 'Healthy',
      riskColor: 'bg-emerald-50 text-emerald-700 border-emerald-200',
      compliance: '100.0%',
      vulns: 0,
      scans: 1,
      tags: ['New', 'Microservice'],
      history: 'Just now',
    };

    setProjectsList((prev) => [newProj, ...prev]);
    setAddProjectModalOpen(false);
    setNewProjectName('');
    setNewProjectRepo('');

    addToast({
      type: 'success',
      title: 'Project Registered',
      message: `Project "${newProj.name}" created and registered for continuous SBOM ingestion.`,
    });
  };

  const handleExportAllProjects = () => {
    const dataToExport = filteredProjects;
    const headers = ['Project Name', 'Classifier', 'Risk Level', 'Compliance', 'Vulnerabilities', 'Total Scans', 'Tags', 'Last Scan'];
    const rows = [
      headers,
      ...dataToExport.map((p) => [
        p.name,
        p.classifier,
        p.risk,
        p.compliance,
        p.vulns,
        p.scans,
        p.tags.join('; '),
        p.history,
      ]),
    ];
    exportTableToCsv(`projects-inventory-${Date.now()}.csv`, rows);
    addToast({
      type: 'success',
      title: 'Projects Exported',
      message: `Exported ${dataToExport.length} projects to CSV.`,
    });
  };

  return (
    <div className="space-y-5 animate-fadeIn pb-16">
      {/* 3 Navigation Tabs (Full Width) */}
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

      {/* Action Controls - Single Clean Row */}
      <div className="flex items-center justify-end gap-2 shrink-0 flex-nowrap overflow-x-auto pb-1 lg:pb-0">
          {/* ONLY ONE primary Add Project button */}
          <button
            onClick={() => setAddProjectModalOpen(true)}
            className="px-3.5 py-1.5 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg flex items-center gap-1.5 shadow-xs cursor-pointer transition-colors whitespace-nowrap shrink-0"
          >
            <Plus className="w-3.5 h-3.5" />
            Add project
          </button>

          <button
            onClick={() => setUploadModalOpen(true)}
            className="px-3 py-1.5 text-xs font-semibold text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-750 flex items-center gap-1.5 shadow-2xs cursor-pointer whitespace-nowrap shrink-0"
          >
            <Upload className="w-3.5 h-3.5 text-gray-500" />
            Upload SBOM
          </button>

          <button
            onClick={handleExportAllProjects}
            className="px-3 py-1.5 text-xs font-semibold text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-750 flex items-center gap-1.5 shadow-2xs cursor-pointer whitespace-nowrap shrink-0"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-gray-500" />
            Export CSV
          </button>
        </div>

      {/* Top 4 KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        {/* Card 1: PROJECTS */}
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
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
              0
            </h2>
            <p className="text-[11px] text-gray-400 mt-0.5">0 active projects</p>
          </div>
        </div>

        {/* Card 2: AVG COMPLIANCE */}
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
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">0.0%</h2>
            <p className="text-[11px] text-gray-400 mt-0.5">0 / 0 compliant</p>
          </div>
        </div>

        {/* Card 3: TOTAL SCANS */}
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
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">0</h2>
            <p className="text-[11px] text-gray-400 mt-0.5">0 total scans</p>
          </div>
        </div>

        {/* Card 4: SBOM FILES */}
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
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">0</h2>
            <p className="text-[11px] text-gray-400 mt-0.5">0 files generated</p>
          </div>
        </div>
      </div>

      {/* SECTION: SBOM Projects */}
      <div className="bg-white dark:bg-[#111827] border border-gray-200 dark:border-gray-800 rounded-xl p-5 shadow-2xs space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-3 border-b border-gray-100 dark:border-gray-800">
          <div>
            <h3 className="text-sm font-bold text-gray-900 dark:text-white">
              SBOM Projects
            </h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              Risk + compliance mapped per project
            </p>
          </div>

          {/* Search, Status filter & Export (Duplicate Add Project button REMOVED as per Excel Sr 16) */}
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

            <button
              onClick={handleExportAllProjects}
              className="px-3 py-1.5 text-xs font-semibold text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-750 flex items-center gap-1.5 cursor-pointer"
            >
              <Download className="w-3.5 h-3.5 text-gray-500" />
              Export All Projects (CSV)
            </button>
          </div>
        </div>

        {/* Table View */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs min-w-[900px]">
            <thead>
              <tr className="text-gray-500 dark:text-gray-400 border-b border-gray-100 dark:border-gray-800">
                <th className="pb-3 pr-4 font-semibold whitespace-nowrap">NAME</th>
                <th className="pb-3 px-4 font-semibold whitespace-nowrap">CLASSIFIER</th>
                <th className="pb-3 px-4 font-semibold whitespace-nowrap">RISK</th>
                <th className="pb-3 px-4 font-semibold whitespace-nowrap">COMPLIANCE</th>
                <th className="pb-3 px-4 font-semibold whitespace-nowrap">VULNS</th>
                <th className="pb-3 px-4 font-semibold whitespace-nowrap">SCANS</th>
                <th className="pb-3 px-4 font-semibold whitespace-nowrap">TAGS</th>
                <th className="pb-3 px-4 font-semibold whitespace-nowrap">HISTORY</th>
                <th className="pb-3 pl-4 font-semibold text-right whitespace-nowrap">EXPORT</th>
              </tr>
            </thead>
            {filteredProjects.length > 0 ? (
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {filteredProjects.map((p) => (
                  <tr key={p.id} className="hover:bg-gray-50/70 dark:hover:bg-gray-800/40 transition-colors">
                    <td className="py-3.5 pr-4 font-bold text-blue-600 dark:text-blue-400 hover:underline cursor-pointer whitespace-nowrap">
                      {p.name}
                    </td>
                    <td className="py-3.5 px-4 text-gray-600 dark:text-gray-400 whitespace-nowrap">{p.classifier}</td>
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      <span className={`px-2.5 py-0.5 rounded text-[10px] font-bold border ${p.riskColor}`}>
                        {p.risk}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 font-semibold text-gray-900 dark:text-white whitespace-nowrap">{p.compliance}</td>
                    <td className="py-3.5 px-4 font-semibold whitespace-nowrap">
                      {p.vulns > 0 ? <span className="text-red-600 dark:text-red-400 font-bold">{p.vulns}</span> : <span className="text-gray-400">0</span>}
                    </td>
                    <td className="py-3.5 px-4 text-gray-600 dark:text-gray-400 whitespace-nowrap">{p.scans}</td>
                    <td className="py-3.5 px-4">
                      <div className="flex gap-1 flex-wrap">
                        {p.tags.map((t: string) => (
                          <span key={t} className="px-1.5 py-0.5 bg-gray-100 dark:bg-gray-800 text-[10px] rounded text-gray-600 dark:text-gray-400 whitespace-nowrap">
                            {t}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="py-3.5 px-4 text-gray-500 dark:text-gray-400 whitespace-nowrap">{p.history}</td>
                    <td className="py-3.5 pl-4 text-right whitespace-nowrap">
                      <button
                        onClick={() => {
                          const rows = [
                            ['Project', p.name],
                            ['Classifier', p.classifier],
                            ['Risk', p.risk],
                            ['Compliance', p.compliance],
                          ];
                          exportTableToCsv(`${p.name.toLowerCase().replace(/\s+/g, '-')}-sbom.csv`, rows);
                        }}
                        className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline inline-flex items-center gap-1 cursor-pointer"
                      >
                        <Download className="w-3.5 h-3.5" />
                        SBOM
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            ) : null}
          </table>

          {/* Filter Empty State (Single Add Project button is preserved in action bar above) */}
          {filteredProjects.length === 0 && (
            <div className="py-12 text-center space-y-3">
              <div className="w-12 h-12 mx-auto rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center text-gray-400">
                <Search className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-gray-900 dark:text-white">
                  No projects or microservices available yet.
                </h4>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  No projects registered yet. Real services will appear once added or discovered from scans.
                </p>
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

      {/* ================================================================= */}
      {/* MODAL: ADD PROJECT MODAL                                          */}
      {/* ================================================================= */}
      {addProjectModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 animate-fadeIn">
          <div className="bg-white dark:bg-[#111827] rounded-xl max-w-lg w-full p-6 shadow-2xl border border-gray-200 dark:border-gray-800 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100 dark:border-gray-800">
              <div className="flex items-center gap-2">
                <FolderGit2 className="w-5 h-5 text-blue-600" />
                <h3 className="text-base font-bold text-gray-900 dark:text-white">
                  Add New SBOM Project
                </h3>
              </div>
              <button
                onClick={() => setAddProjectModalOpen(false)}
                className="p-1 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateProject} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                  Project Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={newProjectName}
                  onChange={(e) => setNewProjectName(e.target.value)}
                  placeholder="e.g. Identity Service"
                  className="w-full text-xs px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-gray-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                  Classifier
                </label>
                <select
                  value={newProjectClassifier}
                  onChange={(e) => setNewProjectClassifier(e.target.value)}
                  className="w-full text-xs px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-gray-900 dark:text-white"
                >
                  <option value="Service / Microservice">Service / Microservice</option>
                  <option value="Web Application">Web Application</option>
                  <option value="Client Application">Client Application</option>
                  <option value="Internal Dashboard">Internal Dashboard</option>
                  <option value="Firmware Image">Firmware Image</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                  Repository URL (GitHub)
                </label>
                <input
                  type="url"
                  value={newProjectRepo}
                  onChange={(e) => setNewProjectRepo(e.target.value)}
                  placeholder="https://github.com/organization/identity-service"
                  className="w-full text-xs px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-gray-900 dark:text-white"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-gray-100 dark:border-gray-800">
                <button
                  type="button"
                  onClick={() => setAddProjectModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold border border-gray-200 dark:border-gray-700 rounded-lg text-gray-600 dark:text-gray-300 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white rounded-lg shadow-sm"
                >
                  Create Project
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================================================================= */}
      {/* MODAL: LEARN HOW PROJECTS WORK (Excel Sr 19)                      */}
      {/* ================================================================= */}
      {learnModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 animate-fadeIn">
          <div className="bg-white dark:bg-[#111827] rounded-xl max-w-xl w-full p-6 shadow-2xl border border-gray-200 dark:border-gray-800 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100 dark:border-gray-800">
              <div className="flex items-center gap-2">
                <BookOpen className="w-5 h-5 text-blue-600" />
                <h3 className="text-base font-bold text-gray-900 dark:text-white">
                  How SBOM Projects Work
                </h3>
              </div>
              <button
                onClick={() => setLearnModalOpen(false)}
                className="p-1 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3.5 text-xs text-gray-600 dark:text-gray-300 leading-relaxed">
              <div className="flex items-start gap-2.5 p-3 bg-blue-50/50 dark:bg-blue-950/30 rounded-lg border border-blue-100 dark:border-blue-900/40">
                <span className="w-5 h-5 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-[11px] shrink-0 mt-0.5">
                  1
                </span>
                <div>
                  <h5 className="font-bold text-gray-900 dark:text-white">Project Registration & Scope</h5>
                  <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">
                    A project corresponds to a discrete application, microservice, container, or firmware image within your organization.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-2.5 p-3 bg-gray-50 dark:bg-gray-800/60 rounded-lg border border-gray-200 dark:border-gray-700">
                <span className="w-5 h-5 rounded-full bg-gray-700 text-white flex items-center justify-center font-bold text-[11px] shrink-0 mt-0.5">
                  2
                </span>
                <div>
                  <h5 className="font-bold text-gray-900 dark:text-white">Automated SBOM Ingestion</h5>
                  <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">
                    CI/CD pipelines or scheduled scans generate SPDX 2.3 or CycloneDX 1.5 manifests for every git commit or release tag.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-2.5 p-3 bg-gray-50 dark:bg-gray-800/60 rounded-lg border border-gray-200 dark:border-gray-700">
                <span className="w-5 h-5 rounded-full bg-gray-700 text-white flex items-center justify-center font-bold text-[11px] shrink-0 mt-0.5">
                  3
                </span>
                <div>
                  <h5 className="font-bold text-gray-900 dark:text-white">Continuous Vulnerability & License Tracking</h5>
                  <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">
                    All normalized package URLs (P-URLs) are continuously enriched against NVD, OSV, CERT-In advisories, and EPSS scores.
                  </p>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end pt-3 border-t border-gray-100 dark:border-gray-800">
              <button
                onClick={() => setLearnModalOpen(false)}
                className="px-4 py-2 text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white rounded-lg shadow-sm"
              >
                Got It
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProjectsMicroservices;
