import React, { useState, useMemo, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Search,
  Filter,
  Download,
  MoreVertical,
  Layers,
  Folder,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  ArrowRight,
  Shield,
  Box,
} from 'lucide-react';
import { useAppState } from '../../context/AppStateContext';
import { Vulnerability, Severity, VexStatus } from '../../types';

export const Vulnerabilities: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { vulnerabilities, projects, components, addToast } = useAppState();

  // Project Filter state - initialize from URL query param if present
  const [projectFilter, setProjectFilter] = useState<string>(searchParams.get('project') || 'all');
  const [searchQuery, setSearchQuery] = useState<string>(searchParams.get('search') || '');

  // Severity Filter state
  const [selectedSeverity, setSelectedSeverity] = useState<string>(searchParams.get('severity') || 'All');

  // Status & VEX filters (toggleable via Filters button)
  const [showFiltersPanel, setShowFiltersPanel] = useState<boolean>(false);
  const [statusFilter, setStatusFilter] = useState<string>('All');
  const [vexFilter, setVexFilter] = useState<string>('All');

  // Sync state if URL query param changes
  useEffect(() => {
    const urlProj = searchParams.get('project');
    if (urlProj && urlProj !== projectFilter) {
      setProjectFilter(urlProj);
    }
  }, [searchParams]);

  // Derive all real projects (NO hardcoded dummy data)
  const availableProjects = useMemo(() => {
    const set = new Set<string>();
    projects.forEach((p) => {
      if (p.name) set.add(p.name);
    });
    vulnerabilities.forEach((v) => {
      if (v.project) set.add(v.project);
    });
    components.forEach((c) => {
      if (c.project) set.add(c.project);
    });
    return Array.from(set).sort();
  }, [projects, vulnerabilities, components]);

  // Handle project filter changes
  const handleProjectFilterChange = (val: string) => {
    setProjectFilter(val);
    const newParams = new URLSearchParams(searchParams);
    if (val === 'all') {
      newParams.delete('project');
    } else {
      newParams.set('project', val);
    }
    setSearchParams(newParams);
  };

  // Severity counts based on currently selected project
  const projectScopedVulns = useMemo(() => {
    if (projectFilter === 'all') return vulnerabilities;
    return vulnerabilities.filter((v) => v.project.toLowerCase() === projectFilter.toLowerCase());
  }, [vulnerabilities, projectFilter]);

  const criticalCount = useMemo(() => projectScopedVulns.filter((v) => v.severity === 'Critical').length, [projectScopedVulns]);
  const highCount = useMemo(() => projectScopedVulns.filter((v) => v.severity === 'High').length, [projectScopedVulns]);
  const mediumCount = useMemo(() => projectScopedVulns.filter((v) => v.severity === 'Medium').length, [projectScopedVulns]);
  const lowCount = useMemo(() => projectScopedVulns.filter((v) => v.severity === 'Low').length, [projectScopedVulns]);

  // Filtered Vulnerabilities
  const filtered = useMemo(() => {
    return projectScopedVulns.filter((v) => {
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !q ||
        v.cve.toLowerCase().includes(q) ||
        (v.name && v.name.toLowerCase().includes(q)) ||
        (v.application && v.application.toLowerCase().includes(q)) ||
        v.package.toLowerCase().includes(q) ||
        v.project.toLowerCase().includes(q) ||
        v.description.toLowerCase().includes(q);

      const matchesSeverity =
        selectedSeverity === 'All' || v.severity.toLowerCase() === selectedSeverity.toLowerCase();

      const matchesStatus =
        statusFilter === 'All' || v.status.toLowerCase() === statusFilter.toLowerCase();

      const matchesVex =
        vexFilter === 'All' || v.vexStatus.toLowerCase() === vexFilter.toLowerCase();

      return matchesSearch && matchesSeverity && matchesStatus && matchesVex;
    });
  }, [projectScopedVulns, searchQuery, selectedSeverity, statusFilter, vexFilter]);

  // CSV Export
  const handleExportCsv = () => {
    if (filtered.length === 0) {
      addToast({ type: 'warning', title: 'No Data to Export', message: 'No vulnerabilities match the current filter.' });
      return;
    }
    const headers = [
      'CVE ID',
      'Vulnerability Name',
      'Application',
      'Severity',
      'CVSS Score',
      'Component',
      'Version',
      'Project',
      'Status',
      'VEX Status',
      'Fixed Version',
    ];
    const rows = filtered.map((v) => [
      `"${v.cve}"`,
      `"${(v.name || v.description?.split('.')[0] || v.cve).replace(/"/g, '""')}"`,
      `"${(v.application || v.project).replace(/"/g, '""')}"`,
      `"${v.severity}"`,
      `"${v.cvss}"`,
      `"${v.package.replace(/"/g, '""')}"`,
      `"${v.version}"`,
      `"${v.project.replace(/"/g, '""')}"`,
      `"${v.status}"`,
      `"${v.vexStatus}"`,
      `"${v.fixVersion || 'N/A'}"`,
    ]);
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `vulnerabilities-${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    addToast({
      type: 'success',
      title: 'Export Successful',
      message: `Exported ${filtered.length} vulnerabilities to CSV.`,
    });
  };

  // Helper renderers
  const renderSeverityBadge = (severity: Severity) => {
    switch (severity) {
      case 'Critical':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300 border border-rose-200/80 dark:border-rose-900/50">
            <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
            Critical
          </span>
        );
      case 'High':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-orange-50 text-orange-700 dark:bg-orange-950/60 dark:text-orange-300 border border-orange-200/80 dark:border-orange-900/50">
            <span className="w-1.5 h-1.5 rounded-full bg-orange-500" />
            High
          </span>
        );
      case 'Medium':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-200/80 dark:border-amber-900/50">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
            Medium
          </span>
        );
      case 'Low':
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-sky-50 text-sky-700 dark:bg-sky-950/60 dark:text-sky-300 border border-sky-200/80 dark:border-sky-900/50">
            <span className="w-1.5 h-1.5 rounded-full bg-sky-500" />
            Low
          </span>
        );
    }
  };

  const renderCvssScore = (cvss: number) => {
    let colorClass = 'text-sky-600 dark:text-sky-400';
    if (cvss >= 9.0) colorClass = 'text-rose-600 dark:text-rose-400';
    else if (cvss >= 7.0) colorClass = 'text-orange-600 dark:text-orange-400';
    else if (cvss >= 4.0) colorClass = 'text-amber-600 dark:text-amber-400';

    return <span className={`font-mono font-bold text-xs ${colorClass}`}>{cvss.toFixed(1)}</span>;
  };

  const renderStatusBadge = (status: string) => {
    switch (status) {
      case 'Fixed':
        return (
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200/80 dark:border-emerald-900/50">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            Fixed
          </span>
        );
      case 'Accepted':
      case 'Risk Accepted':
        return (
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 border border-blue-200/80 dark:border-blue-900/50">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
            Accepted
          </span>
        );
      case 'In Progress':
        return (
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300 border border-indigo-200/80 dark:border-indigo-900/50">
            <span className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
            In Progress
          </span>
        );
      case 'Open':
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300 border border-rose-200/80 dark:border-rose-900/50">
            <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
            Open
          </span>
        );
    }
  };

  const renderVexBadge = (vex: VexStatus) => {
    switch (vex) {
      case 'affected':
        return (
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300 border border-rose-200/80 dark:border-rose-900/50">
            <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
            Affected
          </span>
        );
      case 'not_affected':
        return (
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200/80 dark:border-emerald-900/50">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            Not Affected
          </span>
        );
      case 'fixed':
        return (
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-sky-50 text-sky-700 dark:bg-sky-950/60 dark:text-sky-300 border border-sky-200/80 dark:border-sky-900/50">
            <span className="w-1.5 h-1.5 rounded-full bg-sky-500" />
            Fixed
          </span>
        );
      case 'under_investigation':
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-200/80 dark:border-amber-900/50">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
            Under Investigation
          </span>
        );
    }
  };

  return (
    <div className="space-y-4 animate-fadeIn pb-14">
      {/* Top Container with No Blank Space Above Metric Boxes */}
      <div className="bg-white dark:bg-[#111827] border border-gray-200 dark:border-gray-800 rounded-2xl p-4 sm:p-5 shadow-2xs space-y-4">
        {/* Project Scope Dropdown Row */}
        <div className="flex items-center justify-end">
          <div className="flex items-center gap-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-1.5 shadow-2xs hover:border-gray-300 dark:hover:border-gray-600 transition-colors">
              <Folder className="w-4 h-4 text-gray-400" />
              <select
                value={projectFilter}
                onChange={(e) => handleProjectFilterChange(e.target.value)}
                className="text-xs font-semibold bg-transparent text-gray-800 dark:text-gray-200 focus:outline-none cursor-pointer pr-1"
              >
                <option value="all">All Projects (Org Scope)</option>
                {availableProjects.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </div>
          </div>

        {/* 5 Severity Metric Cards directly below (NO blank space above) */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 pt-1">
          {/* Card 1: ALL SEVERITIES */}
          <div
            onClick={() => setSelectedSeverity('All')}
            className={`p-3.5 rounded-xl border transition-all cursor-pointer ${
              selectedSeverity === 'All'
                ? 'border-blue-600 bg-blue-50/40 dark:bg-blue-950/30 ring-2 ring-blue-500/20 shadow-xs'
                : 'border-gray-200 dark:border-gray-800 bg-gray-50/60 dark:bg-gray-800/40 hover:border-gray-300 dark:hover:border-gray-700'
            }`}
          >
            <div className="flex items-center gap-1.5 mb-1.5">
              <span className="w-2 h-2 rounded-full bg-gray-400 dark:bg-gray-500" />
              <span className="text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider block">
                ALL SEVERITIES
              </span>
            </div>
            <span className="text-2xl font-black text-gray-900 dark:text-white font-mono block">
              {projectScopedVulns.length}
            </span>
          </div>

          {/* Card 2: CRITICAL */}
          <div
            onClick={() => setSelectedSeverity('Critical')}
            className={`p-3.5 rounded-xl border transition-all cursor-pointer ${
              selectedSeverity === 'Critical'
                ? 'border-rose-600 bg-rose-50/90 dark:bg-rose-950/60 ring-2 ring-rose-500/20 shadow-xs'
                : 'border-rose-200/80 dark:border-rose-900/40 bg-rose-50/30 dark:bg-rose-950/20 hover:border-rose-400 dark:hover:border-rose-800'
            }`}
          >
            <div className="flex items-center gap-1.5 mb-1.5">
              <span className="w-2 h-2 rounded-full bg-rose-500" />
              <span className="text-[10px] font-bold text-rose-600 dark:text-rose-400 uppercase tracking-wider block">
                CRITICAL
              </span>
            </div>
            <span className="text-2xl font-black text-rose-600 dark:text-rose-400 font-mono block">
              {criticalCount}
            </span>
          </div>

          {/* Card 3: HIGH */}
          <div
            onClick={() => setSelectedSeverity('High')}
            className={`p-3.5 rounded-xl border transition-all cursor-pointer ${
              selectedSeverity === 'High'
                ? 'border-orange-600 bg-orange-50/90 dark:bg-orange-950/60 ring-2 ring-orange-500/20 shadow-xs'
                : 'border-orange-200/80 dark:border-orange-900/40 bg-orange-50/30 dark:bg-orange-950/20 hover:border-orange-400 dark:hover:border-orange-800'
            }`}
          >
            <div className="flex items-center gap-1.5 mb-1.5">
              <span className="w-2 h-2 rounded-full bg-orange-500" />
              <span className="text-[10px] font-bold text-orange-600 dark:text-orange-400 uppercase tracking-wider block">
                HIGH
              </span>
            </div>
            <span className="text-2xl font-black text-orange-600 dark:text-orange-400 font-mono block">
              {highCount}
            </span>
          </div>

          {/* Card 4: MEDIUM */}
          <div
            onClick={() => setSelectedSeverity('Medium')}
            className={`p-3.5 rounded-xl border transition-all cursor-pointer ${
              selectedSeverity === 'Medium'
                ? 'border-amber-600 bg-amber-50/90 dark:bg-amber-950/60 ring-2 ring-amber-500/20 shadow-xs'
                : 'border-amber-200/80 dark:border-amber-900/40 bg-amber-50/30 dark:bg-amber-950/20 hover:border-amber-400 dark:hover:border-amber-800'
            }`}
          >
            <div className="flex items-center gap-1.5 mb-1.5">
              <span className="w-2 h-2 rounded-full bg-amber-500" />
              <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wider block">
                MEDIUM
              </span>
            </div>
            <span className="text-2xl font-black text-amber-600 dark:text-amber-400 font-mono block">
              {mediumCount}
            </span>
          </div>

          {/* Card 5: LOW */}
          <div
            onClick={() => setSelectedSeverity('Low')}
            className={`p-3.5 rounded-xl border transition-all cursor-pointer ${
              selectedSeverity === 'Low'
                ? 'border-sky-600 bg-sky-50/90 dark:bg-sky-950/60 ring-2 ring-sky-500/20 shadow-xs'
                : 'border-sky-200/80 dark:border-sky-900/40 bg-sky-50/30 dark:bg-sky-950/20 hover:border-sky-400 dark:hover:border-sky-800'
            }`}
          >
            <div className="flex items-center gap-1.5 mb-1.5">
              <span className="w-2 h-2 rounded-full bg-sky-500" />
              <span className="text-[10px] font-bold text-sky-600 dark:text-sky-400 uppercase tracking-wider block">
                LOW
              </span>
            </div>
            <span className="text-2xl font-black text-sky-600 dark:text-sky-400 font-mono block">
              {lowCount}
            </span>
          </div>
        </div>
      </div>

      {/* Search and Action Bar */}
      <div className="bg-white dark:bg-[#111827] border border-gray-200 dark:border-gray-800 rounded-2xl p-3 sm:p-3.5 shadow-2xs space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          {/* Search Input */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search CVE identifier, application, component, project, or description..."
              className="w-full text-xs pl-9 pr-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50/70 dark:bg-gray-800/60 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
            />
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
            {/* Filters Button */}
            <button
              type="button"
              onClick={() => setShowFiltersPanel(!showFiltersPanel)}
              className={`px-3 py-2 text-xs font-semibold rounded-xl border transition-all inline-flex items-center gap-1.5 cursor-pointer ${
                showFiltersPanel || statusFilter !== 'All' || vexFilter !== 'All'
                  ? 'bg-blue-50 dark:bg-blue-950/60 border-blue-300 dark:border-blue-800 text-blue-600 dark:text-blue-400'
                  : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
              }`}
            >
              <Filter className="w-3.5 h-3.5" />
              <span>Filters</span>
            </button>

            {/* Export Button */}
            <button
              type="button"
              onClick={handleExportCsv}
              className="px-3.5 py-2 text-xs font-semibold rounded-xl bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-800 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/60 transition-all inline-flex items-center gap-1.5 cursor-pointer shadow-2xs"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export</span>
            </button>

            {/* Showing Count */}
            <span className="text-xs text-gray-500 dark:text-gray-400 pl-1 shrink-0">
              Showing <strong className="text-gray-900 dark:text-white">{filtered.length}</strong> CVEs
            </span>
          </div>
        </div>

        {/* Expandable Advanced Filter Options */}
        {showFiltersPanel && (
          <div className="pt-3 border-t border-gray-100 dark:border-gray-800 flex items-center gap-3 flex-wrap text-xs">
            <div className="flex items-center gap-1.5">
              <span className="text-gray-400 font-medium">Status:</span>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-2.5 py-1 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-gray-800 dark:text-gray-200 cursor-pointer focus:outline-none"
              >
                <option value="All">All Statuses</option>
                <option value="Open">Open</option>
                <option value="Fixed">Fixed</option>
                <option value="Accepted">Accepted</option>
                <option value="In Progress">In Progress</option>
              </select>
            </div>

            <div className="flex items-center gap-1.5">
              <span className="text-gray-400 font-medium">VEX:</span>
              <select
                value={vexFilter}
                onChange={(e) => setVexFilter(e.target.value)}
                className="px-2.5 py-1 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-gray-800 dark:text-gray-200 cursor-pointer focus:outline-none"
              >
                <option value="All">All VEX</option>
                <option value="affected">Affected</option>
                <option value="not_affected">Not Affected</option>
                <option value="under_investigation">Under Investigation</option>
                <option value="fixed">Fixed</option>
              </select>
            </div>

            {(statusFilter !== 'All' || vexFilter !== 'All' || searchQuery) && (
              <button
                type="button"
                onClick={() => {
                  setStatusFilter('All');
                  setVexFilter('All');
                  setSearchQuery('');
                }}
                className="text-gray-400 hover:text-red-600 dark:hover:text-red-400 inline-flex items-center gap-1 ml-auto cursor-pointer"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Reset Filters</span>
              </button>
            )}
          </div>
        )}
      </div>

      {/* Main Vulnerability Table */}
      <div className="bg-white dark:bg-[#111827] border border-gray-200 dark:border-gray-800 rounded-2xl shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs min-w-[1100px]">
            <thead className="bg-gray-50/80 dark:bg-gray-800/70 text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider border-b border-gray-200 dark:border-gray-800">
              <tr>
                <th className="py-3 px-3.5">CVE ID</th>
                <th className="py-3 px-3.5">Vulnerability Name</th>
                <th className="py-3 px-3.5">Application</th>
                <th className="py-3 px-3.5">Severity</th>
                <th className="py-3 px-3.5">CVSS Score</th>
                <th className="py-3 px-3.5">Component + Version</th>
                <th className="py-3 px-3.5">Project</th>
                <th className="py-3 px-3.5">Status</th>
                <th className="py-3 px-3.5">VEX Status</th>
                <th className="py-3 px-3.5">Fixed Version</th>
                <th className="py-3 px-3.5 text-center">Actions</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-gray-100 dark:divide-gray-800/60">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={11} className="py-16 text-center">
                    <div className="flex flex-col items-center justify-center max-w-md mx-auto space-y-3">
                      <div className="w-12 h-12 rounded-2xl bg-blue-50 dark:bg-blue-950/50 flex items-center justify-center text-blue-600 dark:text-blue-400 border border-blue-200/80 dark:border-blue-800/60 shadow-2xs">
                        <CheckCircle2 className="w-6 h-6" />
                      </div>
                      <div>
                        <h4 className="text-sm font-bold text-gray-900 dark:text-white">No Vulnerabilities Found</h4>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 leading-relaxed">
                          All monitored software components are secure, or no vulnerability findings have been recorded yet for this project scope.
                        </p>
                      </div>
                      <div className="flex items-center gap-2 pt-1">
                        <button
                          type="button"
                          onClick={() => navigate('/security-scans/new')}
                          className="px-3.5 py-1.5 text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-2xs transition-colors cursor-pointer inline-flex items-center gap-1.5"
                        >
                          <span>Run Security Scan</span>
                          <ArrowRight className="w-3.5 h-3.5" />
                        </button>
                        {projectFilter !== 'all' && (
                          <button
                            type="button"
                            onClick={() => handleProjectFilterChange('all')}
                            className="px-3 py-1.5 text-xs font-semibold bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-xl hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors cursor-pointer"
                          >
                            View All Projects
                          </button>
                        )}
                      </div>
                    </div>
                  </td>
                </tr>
              ) : (
                filtered.map((v) => {
                  const vulnName = v.name || v.description?.split(/[.\n]/)[0]?.trim() || v.cwe || v.cve;
                  const appName = v.application || v.project || 'Service';

                  return (
                    <tr
                      key={v.id}
                      onClick={() =>
                        navigate(`/vulnerabilities/${encodeURIComponent(v.cve)}`, {
                          state: { vulnerability: v },
                        })
                      }
                      className="hover:bg-blue-50/30 dark:hover:bg-blue-950/20 transition-colors cursor-pointer group"
                    >
                      {/* CVE ID */}
                      <td className="py-3 px-3.5 whitespace-nowrap">
                        <span className="font-mono font-bold text-blue-600 dark:text-blue-400 group-hover:underline">
                          {v.cve}
                        </span>
                      </td>

                      {/* Vulnerability Name (Explicit user request) */}
                      <td className="py-3 px-3.5 max-w-[220px]">
                        <span
                          className="font-semibold text-gray-900 dark:text-white line-clamp-1 truncate block"
                          title={vulnName}
                        >
                          {vulnName}
                        </span>
                      </td>

                      {/* Application */}
                      <td className="py-3 px-3.5 whitespace-nowrap">
                        <div className="flex items-center gap-1.5 text-gray-800 dark:text-gray-200">
                          <Box className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                          <span className="font-medium text-xs">{appName}</span>
                        </div>
                      </td>

                      {/* Severity */}
                      <td className="py-3 px-3.5 whitespace-nowrap">
                        {renderSeverityBadge(v.severity)}
                      </td>

                      {/* CVSS Score */}
                      <td className="py-3 px-3.5 whitespace-nowrap">
                        {renderCvssScore(v.cvss)}
                      </td>

                      {/* Component + Version */}
                      <td className="py-3 px-3.5 whitespace-nowrap">
                        <div>
                          <span className="font-mono font-semibold text-gray-900 dark:text-white block">
                            {v.package}
                          </span>
                          <span className="font-mono text-[11px] text-gray-500 dark:text-gray-400">
                            {v.version || v.affectedVersions || '—'}
                          </span>
                        </div>
                      </td>

                      {/* Project (Clicking filters to project) */}
                      <td
                        className="py-3 px-3.5 whitespace-nowrap"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleProjectFilterChange(v.project);
                        }}
                      >
                        <span
                          className="font-mono text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 hover:underline cursor-pointer"
                          title={`Filter by project: ${v.project}`}
                        >
                          {v.project}
                        </span>
                      </td>

                      {/* Status */}
                      <td className="py-3 px-3.5 whitespace-nowrap">
                        {renderStatusBadge(v.status)}
                      </td>

                      {/* VEX Status */}
                      <td className="py-3 px-3.5 whitespace-nowrap">
                        {renderVexBadge(v.vexStatus)}
                      </td>

                      {/* Fixed Version */}
                      <td className="py-3 px-3.5 whitespace-nowrap font-mono text-gray-700 dark:text-gray-300">
                        {v.fixVersion || '—'}
                      </td>

                      {/* Actions (3 dots icon redirects to screenshot 2 page) */}
                      <td
                        className="py-3 px-3.5 whitespace-nowrap text-center"
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate(`/vulnerabilities/${encodeURIComponent(v.cve)}`, {
                            state: { vulnerability: v },
                          });
                        }}
                      >
                        <button
                          type="button"
                          className="p-1.5 rounded-lg text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors cursor-pointer"
                          title="View vulnerability details"
                        >
                          <MoreVertical className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default Vulnerabilities;
