import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Ticket,
  Clock,
  AlertTriangle,
  CheckCircle2,
  Filter,
  Search,
  Plus,
  ArrowRight,
  User,
  Bot,
  Wrench,
  RotateCcw,
  ShieldCheck,
  ShieldX,
  ExternalLink,
  Folder,
  X,
  GitPullRequest,
  Sparkles,
  ChevronDown,
} from 'lucide-react';
import { useAppState } from '../context/AppStateContext';
import { RemediationTicket, VexStatus } from '../types';

export const Remediation: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { tickets, vulnerabilities, projects, selectedVulnerability, updateTicketStatus, addToast } = useAppState();

  const [localTickets, setLocalTickets] = useState<RemediationTicket[]>(tickets);

  useEffect(() => {
    setLocalTickets(tickets);
  }, [tickets]);

  // Shared Chrome Context Filter
  const [projectFilter, setProjectFilter] = useState<string>(searchParams.get('project') || 'all');
  const [statusFilter, setStatusFilter] = useState<string>('All');
  const [priorityFilter, setPriorityFilter] = useState<string>('All');

  // Component 1 & 2: Active Ticket Drawer (AI Remediation Modal + Version Options Panel)
  const [activeTicket, setActiveTicket] = useState<RemediationTicket | null>(null);

  // Component 5: Risk Acceptance Form Modal
  const [riskModalOpen, setRiskModalOpen] = useState<boolean>(false);
  const [selectedTicketForRisk, setSelectedTicketForRisk] = useState<RemediationTicket | null>(null);
  const [riskJustification, setRiskJustification] = useState<string>(
    'Vulnerable code path is unreachable due to network isolation in production VPC.'
  );
  const [riskVexStatus, setRiskVexStatus] = useState<VexStatus>('not_affected');
  const [riskApprover, setRiskApprover] = useState<string>('Security Officer (Maitri)');
  const [riskExpiry, setRiskExpiry] = useState<string>('2026-12-31');

  // Version picker state within Component 2
  const [selectedVersionOption, setSelectedVersionOption] = useState<'recommended' | 'latest' | 'current'>('recommended');
  const [autoGitHubSync, setAutoGitHubSync] = useState<boolean>(true);
  const [isPatching, setIsPatching] = useState<boolean>(false);
  const [isRescanning, setIsRescanning] = useState<boolean>(false);

  // New ticket creation modal
  const [createTicketOpen, setCreateTicketOpen] = useState<boolean>(false);
  const [newCve, setNewCve] = useState<string>('');
  const [newPkg, setNewPkg] = useState<string>('');
  const [newProj, setNewProj] = useState<string>('Payments API');
  const [newPriority, setNewPriority] = useState<'P0 - Blocker' | 'P1 - High' | 'P2 - Medium' | 'P3 - Low'>('P1 - High');

  // React to query parameters or selectedVulnerability from Vulnerabilities inbox
  useEffect(() => {
    const raiseParam = searchParams.get('raiseTicket');
    const projParam = searchParams.get('project');
    const cveParam = searchParams.get('cve');
    const pkgParam = searchParams.get('pkg');

    if (raiseParam === 'true' || selectedVulnerability) {
      if (projParam) {
        setNewProj(projParam);
        setProjectFilter(projParam);
      } else if (selectedVulnerability?.project) {
        setNewProj(selectedVulnerability.project);
        setProjectFilter(selectedVulnerability.project);
      }

      if (cveParam) setNewCve(cveParam);
      else if (selectedVulnerability?.cve) setNewCve(selectedVulnerability.cve);

      if (pkgParam) setNewPkg(pkgParam);
      else if (selectedVulnerability?.package) setNewPkg(selectedVulnerability.package);

      if (selectedVulnerability) {
        if (selectedVulnerability.severity === 'Critical') setNewPriority('P0 - Blocker');
        else if (selectedVulnerability.severity === 'High') setNewPriority('P1 - High');
        else setNewPriority('P2 - Medium');
      }

      setCreateTicketOpen(true);
    }
  }, [searchParams, selectedVulnerability]);

  const filteredTickets = localTickets.filter((t) => {
    const matchesStatus = statusFilter === 'All' || t.status === statusFilter;
    const matchesPriority = priorityFilter === 'All' || t.priority.startsWith(priorityFilter);
    const cleanProjectFilter = projectFilter.toLowerCase().replace(/[\s-_]/g, '');
    const cleanTicketProject = t.project.toLowerCase().replace(/[\s-_]/g, '');
    const matchesProject =
      projectFilter === 'all' ||
      cleanTicketProject === cleanProjectFilter ||
      cleanTicketProject.includes(cleanProjectFilter);
    return matchesStatus && matchesPriority && matchesProject;
  });

  // Component 3: Apply Patch Action
  const handleApplyPatch = async () => {
    if (!activeTicket) return;
    setIsPatching(true);
    await new Promise((r) => setTimeout(r, 1200));
    setIsPatching(false);

    updateTicketStatus(activeTicket.id, 'Resolved');
    setLocalTickets((prev) =>
      prev.map((t) => (t.id === activeTicket.id ? { ...t, status: 'Resolved' } : t))
    );
    addToast({
      type: 'success',
      title: 'Automated Patch Applied',
      message: `Upgraded ${activeTicket.package} to recommended version. ${autoGitHubSync ? 'Created GitHub PR #142.' : ''}`,
    });
    setActiveTicket(null);
  };

  // Component 4: Component Re-Scan Action
  const handleComponentRescan = async () => {
    if (!activeTicket) return;
    setIsRescanning(true);
    await new Promise((r) => setTimeout(r, 1000));
    setIsRescanning(false);

    addToast({
      type: 'info',
      title: 'CERT-In Row Re-scanned',
      message: `Refreshed CERT-In telemetry and checksum for ${activeTicket.package}.`,
    });
  };

  // Component 5: Submit Risk Acceptance
  const handleSaveRiskAcceptance = (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedTicketForRisk) {
      updateTicketStatus(selectedTicketForRisk.id, 'Resolved');
      setLocalTickets((prev) =>
        prev.map((t) => (t.id === selectedTicketForRisk.id ? { ...t, status: 'Resolved' } : t))
      );
    }
    setRiskModalOpen(false);
    addToast({
      type: 'info',
      title: 'Risk Accepted & VEX Published',
      message: `Recorded VEX status "${riskVexStatus}" approved by ${riskApprover}.`,
    });
  };

  return (
    <div className="space-y-6 animate-fadeIn pb-12">
      {/* Project Context Filter Bar */}
      <div className="bg-white dark:bg-[#111827] border border-gray-200 dark:border-gray-800 rounded-xl p-4 sm:p-5 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-2 flex-wrap">
            <div className="relative group/workflow inline-block shrink-0">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-[11px] font-bold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 cursor-help border border-emerald-200/60 dark:border-emerald-900/40 hover:bg-emerald-100/70 dark:hover:bg-emerald-900/50 transition-colors">
                <Ticket className="w-3.5 h-3.5" />
                <span>Automated Remediation Workflow Engine</span>
              </span>
              {/* Tooltip Popover on Hover */}
              <div className="absolute left-0 top-full mt-2 opacity-0 invisible group-hover/workflow:opacity-100 group-hover/workflow:visible transition-all duration-150 w-72 sm:w-80 p-3 bg-gray-900 dark:bg-gray-800 text-white text-[11px] font-normal rounded-xl shadow-xl z-50 pointer-events-none border border-gray-700/80 leading-relaxed">
                <div className="flex items-center gap-1.5 font-bold text-emerald-400 mb-1">
                  <Ticket className="w-3.5 h-3.5" />
                  <span>Automated Remediation Workflow</span>
                </div>
                <p className="text-gray-300">
                  Converts CVE detections into tracked Jira and GitHub developer tickets, orchestrates AI version upgrades, verifies patch fixes, and generates auditable VEX records.
                </p>
                <div className="absolute bottom-full left-4 border-4 border-transparent border-b-gray-900 dark:border-b-gray-800" />
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2.5 shrink-0 flex-nowrap">
            {/* Project Context Filter - Styled Button Dropdown */}
            <div className="relative inline-flex items-center bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-2xs hover:border-gray-300 dark:hover:border-gray-600 transition-colors">
              <Folder className="w-3.5 h-3.5 text-gray-500 dark:text-gray-400 absolute left-2.5 pointer-events-none" />
              <select
                value={projectFilter}
                onChange={(e) => setProjectFilter(e.target.value)}
                className="appearance-none pl-8 pr-7 py-2 text-xs font-semibold bg-transparent text-gray-800 dark:text-gray-200 focus:outline-none cursor-pointer whitespace-nowrap"
              >
                <option value="all">All Projects (Org Scope)</option>
                <option value="payments-api">Payments API Scope</option>
                <option value="customer-portal">Customer Portal Scope</option>
                <option value="checkout-service">Checkout Service Scope</option>
                <option value="identity-service">Identity Service Scope</option>
                <option value="mobile-api">Mobile App Backend Scope</option>
              </select>
              <ChevronDown className="w-3.5 h-3.5 text-gray-400 absolute right-2 pointer-events-none" />
            </div>

            {/* Primary Action Button */}
            <button
              onClick={() => setCreateTicketOpen(true)}
              className="px-3.5 py-2 text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-lg shadow-xs flex items-center gap-1.5 transition-colors cursor-pointer shrink-0 whitespace-nowrap"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Create Ticket</span>
            </button>
          </div>
        </div>

        {/* Interactive SLA Metric & Status Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4 pt-3 border-t border-gray-100 dark:border-gray-800">
          {/* 1. Overdue SLA */}
          <button
            type="button"
            onClick={() => setStatusFilter(statusFilter === 'Overdue' ? 'All' : 'Overdue')}
            className={`p-3 text-left rounded-xl border transition-all cursor-pointer ${
              statusFilter === 'Overdue'
                ? 'bg-red-100/80 dark:bg-red-950/60 border-red-400 dark:border-red-700 ring-2 ring-red-500/50 shadow-xs'
                : 'bg-red-50/40 hover:bg-red-50/80 dark:bg-red-950/20 dark:hover:bg-red-950/30 border-red-200/70 dark:border-red-900/40'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold text-red-600 dark:text-red-400 uppercase tracking-wider flex items-center gap-1.5">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
                </span>
                Overdue SLA
              </span>
              <AlertTriangle className="w-3.5 h-3.5 text-red-500" />
            </div>
            <div className="flex items-baseline gap-2 mt-1.5">
              <span className="text-2xl font-black text-red-600 dark:text-red-400 font-mono">
                {localTickets.filter((t) => t.status === 'Overdue').length}
              </span>
              <span className="text-[11px] font-medium text-red-700/80 dark:text-red-300/80">Breached Target</span>
            </div>
            <div className="text-[10px] text-gray-500 dark:text-gray-400 mt-1 flex items-center justify-between">
              <span>Immediate triage</span>
              <span className="font-semibold text-red-600 dark:text-red-400">&lt; 0d left</span>
            </div>
          </button>

          {/* 2. Open Queue */}
          <button
            type="button"
            onClick={() => setStatusFilter(statusFilter === 'Open' ? 'All' : 'Open')}
            className={`p-3 text-left rounded-xl border transition-all cursor-pointer ${
              statusFilter === 'Open'
                ? 'bg-sky-100/80 dark:bg-sky-950/60 border-sky-400 dark:border-sky-700 ring-2 ring-sky-500/50 shadow-xs'
                : 'bg-sky-50/40 hover:bg-sky-50/80 dark:bg-sky-950/20 dark:hover:bg-sky-950/30 border-sky-200/70 dark:border-sky-900/40'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold text-sky-600 dark:text-sky-400 uppercase tracking-wider flex items-center gap-1.5">
                <span className="inline-block h-2 w-2 rounded-full bg-sky-500"></span>
                Open Queue
              </span>
              <Clock className="w-3.5 h-3.5 text-sky-500" />
            </div>
            <div className="flex items-baseline gap-2 mt-1.5">
              <span className="text-2xl font-black text-sky-600 dark:text-sky-400 font-mono">
                {localTickets.filter((t) => t.status === 'Open').length}
              </span>
              <span className="text-[11px] font-medium text-sky-700/80 dark:text-sky-300/80">Awaiting Pickup</span>
            </div>
            <div className="text-[10px] text-gray-500 dark:text-gray-400 mt-1 flex items-center justify-between">
              <span>Assigned to devs</span>
              <span className="font-semibold text-sky-600 dark:text-sky-400">Within SLA</span>
            </div>
          </button>

          {/* 3. In Progress */}
          <button
            type="button"
            onClick={() => setStatusFilter(statusFilter === 'In Progress' ? 'All' : 'In Progress')}
            className={`p-3 text-left rounded-xl border transition-all cursor-pointer ${
              statusFilter === 'In Progress'
                ? 'bg-amber-100/80 dark:bg-amber-950/60 border-amber-400 dark:border-amber-700 ring-2 ring-amber-500/50 shadow-xs'
                : 'bg-amber-50/40 hover:bg-amber-50/80 dark:bg-amber-950/20 dark:hover:bg-amber-950/30 border-amber-200/70 dark:border-amber-900/40'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
                <span className="inline-block h-2 w-2 rounded-full bg-amber-500"></span>
                In Progress
              </span>
              <Wrench className="w-3.5 h-3.5 text-amber-500" />
            </div>
            <div className="flex items-baseline gap-2 mt-1.5">
              <span className="text-2xl font-black text-amber-600 dark:text-amber-400 font-mono">
                {localTickets.filter((t) => t.status === 'In Progress').length}
              </span>
              <span className="text-[11px] font-medium text-amber-700/80 dark:text-amber-300/80">Active Remediation</span>
            </div>
            <div className="text-[10px] text-gray-500 dark:text-gray-400 mt-1 flex items-center justify-between">
              <span>Patch / PR active</span>
              <span className="font-semibold text-amber-600 dark:text-amber-400">Under Review</span>
            </div>
          </button>

          {/* 4. Resolved */}
          <button
            type="button"
            onClick={() => setStatusFilter(statusFilter === 'Resolved' ? 'All' : 'Resolved')}
            className={`p-3 text-left rounded-xl border transition-all cursor-pointer ${
              statusFilter === 'Resolved'
                ? 'bg-emerald-100/80 dark:bg-emerald-950/60 border-emerald-400 dark:border-emerald-700 ring-2 ring-emerald-500/50 shadow-xs'
                : 'bg-emerald-50/40 hover:bg-emerald-50/80 dark:bg-emerald-950/20 dark:hover:bg-emerald-950/30 border-emerald-200/70 dark:border-emerald-900/40'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
                <span className="inline-block h-2 w-2 rounded-full bg-emerald-500"></span>
                Resolved (30D)
              </span>
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
            </div>
            <div className="flex items-baseline gap-2 mt-1.5">
              <span className="text-2xl font-black text-emerald-600 dark:text-emerald-400 font-mono">
                {localTickets.filter((t) => t.status === 'Resolved').length}
              </span>
              <span className="text-[11px] font-medium text-emerald-700/80 dark:text-emerald-300/80">Closed & VEX</span>
            </div>
            <div className="text-[10px] text-gray-500 dark:text-gray-400 mt-1 flex items-center justify-between">
              <span>Fix verified</span>
              <span className="font-semibold text-emerald-600 dark:text-emerald-400">100% Passed</span>
            </div>
          </button>
        </div>
      </div>

      {/* Ticket Table and Quick Filter Toolbar */}
      <div className="bg-white dark:bg-[#111827] border border-gray-200 dark:border-gray-800 rounded-xl shadow-xs overflow-hidden">
        {/* Table Toolbar */}
        <div className="p-4 border-b border-gray-200 dark:border-gray-800 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2 w-full sm:w-auto flex-wrap">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="text-xs px-2.5 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-800 dark:text-gray-200"
            >
              <option value="All">All Statuses</option>
              <option value="Open">Open</option>
              <option value="In Progress">In Progress</option>
              <option value="Overdue">Overdue</option>
              <option value="Resolved">Resolved</option>
            </select>

            <select
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value)}
              className="text-xs px-2.5 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-800 dark:text-gray-200"
            >
              <option value="All">All Priorities</option>
              <option value="P0">P0 - Blocker</option>
              <option value="P1">P1 - High</option>
              <option value="P2">P2 - Medium</option>
            </select>

            {statusFilter !== 'All' && (
              <button
                type="button"
                onClick={() => setStatusFilter('All')}
                className="text-[11px] font-semibold text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1 cursor-pointer ml-1"
              >
                <X className="w-3 h-3" />
                Reset filter ({statusFilter})
              </button>
            )}
          </div>

          <span className="text-xs text-gray-500">
            Showing <strong className="text-gray-900 dark:text-white">{filteredTickets.length}</strong> active remediation tickets
          </span>
        </div>

        {/* Tickets List */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-gray-50 dark:bg-gray-800 text-[10px] font-bold text-gray-400 uppercase tracking-wider border-b border-gray-200 dark:border-gray-800">
              <tr>
                <th className="p-3">Ticket ID</th>
                <th className="p-3">Vulnerability / CVE</th>
                <th className="p-3">Affected Package</th>
                <th className="p-3">Project</th>
                <th className="p-3">Priority</th>
                <th className="p-3">SLA Status</th>
                <th className="p-3">Assignee</th>
                <th className="p-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800/60">
              {filteredTickets.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-12 text-center">
                    <div className="flex flex-col items-center justify-center max-w-sm mx-auto space-y-3">
                      <div className="w-12 h-12 rounded-full bg-blue-50 dark:bg-blue-950/50 flex items-center justify-center text-blue-500 border border-blue-200 dark:border-blue-800">
                        <CheckCircle2 className="w-6 h-6" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-gray-900 dark:text-white">No Remediation Tickets</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                          There are no active remediation tickets. You can create a new ticket or raise one directly from Vulnerability Management.
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setCreateTicketOpen(true)}
                        className="px-3 py-1.5 text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors cursor-pointer inline-flex items-center gap-1.5 shadow-2xs"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Create Ticket</span>
                      </button>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredTickets.map((ticket) => (
                  <tr
                    key={ticket.id}
                    onClick={() => setActiveTicket(ticket)}
                    className="hover:bg-gray-50/70 dark:hover:bg-gray-800/40 transition-colors cursor-pointer"
                  >
                    <td className="p-3 font-mono font-bold text-sky-700 dark:text-sky-300 hover:underline">
                      {ticket.id}
                    </td>
                    <td className="p-3 font-mono font-bold text-red-600 dark:text-red-400">{ticket.cve}</td>
                    <td className="p-3 font-mono text-gray-700 dark:text-gray-300">{ticket.package}</td>
                    <td className="p-3 text-gray-600 dark:text-gray-400">{ticket.project}</td>
                    <td className="p-3">
                      <span
                        className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold ${
                          ticket.priority.startsWith('P0')
                            ? 'bg-red-50 text-red-700 dark:bg-red-950/60 dark:text-red-300'
                            : ticket.priority.startsWith('P1')
                            ? 'bg-orange-50 text-orange-700 dark:bg-orange-950/60 dark:text-orange-300'
                            : ticket.priority.startsWith('P2')
                            ? 'bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300'
                            : 'bg-sky-50 text-sky-700 dark:bg-sky-950/60 dark:text-sky-300'
                        }`}
                      >
                        {ticket.priority}
                      </span>
                    </td>
                    <td className="p-3">
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                          ticket.status === 'Resolved'
                            ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300'
                            : ticket.status === 'Overdue'
                            ? 'bg-red-50 text-red-700 dark:bg-red-950/60 dark:text-red-300'
                            : 'bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300'
                        }`}
                      >
                        {ticket.status} ({ticket.slaDaysRemaining}d left)
                      </span>
                    </td>
                    <td className="p-3 text-gray-700 dark:text-gray-300 font-medium">{ticket.assignee}</td>
                    <td className="p-3 text-right" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => {
                            setSelectedTicketForRisk(ticket);
                            setRiskModalOpen(true);
                          }}
                          className="px-2 py-1 text-[10px] font-semibold bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200 rounded"
                        >
                          Accept Risk
                        </button>
                        <button
                          onClick={() => setActiveTicket(ticket)}
                          className="px-2.5 py-1 text-[10px] font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded shadow-2xs"
                        >
                          AI Plan & Patch
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Component 1 & 2: Active Ticket Drawer (AI Remediation Modal + Version Options Panel) */}
      {activeTicket && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4 backdrop-blur-xs animate-fadeIn">
          <div className="bg-white dark:bg-[#111827] border border-gray-200 dark:border-gray-800 rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            {/* Modal Header */}
            <div className="p-5 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-mono font-bold text-base text-gray-900 dark:text-white">
                    {activeTicket.ticketNumber}
                  </span>
                  <span className="font-mono text-xs px-2 py-0.5 rounded bg-red-50 text-red-600 font-bold">
                    {activeTicket.cve}
                  </span>
                  <span className="text-xs text-gray-500">• {activeTicket.project}</span>
                </div>
                <p className="text-xs text-gray-500 mt-0.5">
                  Package: <strong className="text-gray-800 dark:text-gray-200 font-mono">{activeTicket.package}</strong>
                </p>
              </div>
              <button
                onClick={() => setActiveTicket(null)}
                className="p-1 rounded-lg text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto space-y-5 text-xs flex-1">
              {/* Component 1: AI Remediation Strategy Card */}
              <div className="p-4 bg-gradient-to-r from-red-50 to-orange-50 dark:from-red-950/30 dark:to-orange-950/20 border border-red-200 dark:border-red-900/40 rounded-xl space-y-3">
                <div className="flex items-center gap-2 text-red-600 font-bold">
                  <Sparkles className="w-4 h-4" />
                  <span>AI Remediation Rationale & Strategy (xAI Grok Engine)</span>
                </div>
                <p className="text-gray-700 dark:text-gray-300 leading-relaxed">
                  Upgrade package to recommended patch version. CVSS drops from <strong>9.8</strong> to <strong>0.0</strong>, achieving a <strong>92% risk reduction</strong> with zero breaking changes in core banking endpoints.
                </p>
                <div className="p-2.5 bg-gray-900 text-emerald-400 font-mono rounded-lg text-[11px]">
                  <code>npm install {activeTicket.package.split('@')[0]}@1.13.0 --save</code>
                </div>
              </div>

              {/* Component 2: Version Options Panel */}
              <div>
                <h3 className="text-xs font-bold uppercase text-gray-400 tracking-wider mb-2">
                  Version Options & Vulnerability Delta
                </h3>
                <div className="grid grid-cols-3 gap-3">
                  <div
                    onClick={() => setSelectedVersionOption('current')}
                    className={`p-3 rounded-xl border cursor-pointer ${
                      selectedVersionOption === 'current'
                        ? 'border-blue-600 bg-blue-50/40 dark:bg-blue-950/30 ring-1 ring-blue-500/30'
                        : 'border-gray-200 dark:border-gray-800'
                    }`}
                  >
                    <span className="text-[10px] text-gray-400 font-bold uppercase block">CURRENT</span>
                    <span className="font-mono font-bold text-xs block mt-0.5">v1.12.2</span>
                    <span className="text-[10px] font-bold text-red-600 mt-1 block">3 Active CVEs</span>
                  </div>

                  <div
                    onClick={() => setSelectedVersionOption('recommended')}
                    className={`p-3 rounded-xl border cursor-pointer ${
                      selectedVersionOption === 'recommended'
                        ? 'border-blue-600 bg-emerald-50/50 dark:bg-emerald-950/30 ring-1 ring-blue-500/30'
                        : 'border-gray-200 dark:border-gray-800'
                    }`}
                  >
                    <span className="text-[10px] text-emerald-600 font-bold uppercase block">RECOMMENDED</span>
                    <span className="font-mono font-bold text-xs block mt-0.5">v1.13.0</span>
                    <span className="text-[10px] font-bold text-emerald-600 mt-1 block">0 CVEs (Safe)</span>
                  </div>

                  <div
                    onClick={() => setSelectedVersionOption('latest')}
                    className={`p-3 rounded-xl border cursor-pointer ${
                      selectedVersionOption === 'latest'
                        ? 'border-blue-600 bg-blue-50/40 dark:bg-blue-950/30 ring-1 ring-blue-500/30'
                        : 'border-gray-200 dark:border-gray-800'
                    }`}
                  >
                    <span className="text-[10px] text-gray-400 font-bold uppercase block">LATEST RELEASE</span>
                    <span className="font-mono font-bold text-xs block mt-0.5">v2.0.0</span>
                    <span className="text-[10px] font-bold text-amber-600 mt-1 block">Breaking APIs</span>
                  </div>
                </div>
              </div>

              {/* GitHub Pull Request Sync Option */}
              <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800/40 rounded-xl">
                <div className="flex items-center gap-2">
                  <GitPullRequest className="w-4 h-4 text-blue-600" />
                  <span className="font-semibold text-gray-800 dark:text-gray-200">
                    Auto-generate GitHub Pull Request & sync commit
                  </span>
                </div>
                <input
                  type="checkbox"
                  checked={autoGitHubSync}
                  onChange={(e) => setAutoGitHubSync(e.target.checked)}
                  className="w-4 h-4 accent-blue-600 cursor-pointer"
                />
              </div>
            </div>

            {/* Modal Actions */}
            <div className="p-4 border-t border-gray-100 dark:border-gray-800 flex items-center justify-between bg-gray-50/50 dark:bg-gray-800/20">
              {/* Component 4: Component Re-scan Action */}
              <button
                onClick={handleComponentRescan}
                disabled={isRescanning}
                className="px-3 py-1.5 text-xs font-semibold bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-800 dark:text-gray-200 rounded-lg flex items-center gap-1.5 cursor-pointer"
              >
                <RotateCcw className={`w-3.5 h-3.5 ${isRescanning ? 'animate-spin' : ''}`} />
                <span>Re-scan Component Row</span>
              </button>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setActiveTicket(null)}
                  className="px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-100 rounded-lg"
                >
                  Cancel
                </button>
                {/* Component 3: Apply Patch Action */}
                <button
                  onClick={handleApplyPatch}
                  disabled={isPatching}
                  className="px-4 py-1.5 text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white rounded-lg shadow-sm flex items-center gap-1.5 cursor-pointer"
                >
                  <Wrench className="w-3.5 h-3.5" />
                  <span>{isPatching ? 'Applying Patch...' : 'Apply Patch & Close Ticket'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Component 5: Risk Acceptance Form Modal */}
      {riskModalOpen && selectedTicketForRisk && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4 backdrop-blur-xs animate-fadeIn">
          <div className="bg-white dark:bg-[#111827] border border-gray-200 dark:border-gray-800 rounded-2xl w-full max-w-lg shadow-xl p-5 space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <div>
                <h3 className="text-sm font-bold text-gray-900 dark:text-white">
                  Formal Risk Acceptance (VEX Override)
                </h3>
                <p className="text-xs text-gray-500">Record an auditor-grade justification for {selectedTicketForRisk.cve}</p>
              </div>
              <button onClick={() => setRiskModalOpen(false)}>
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>

            <form onSubmit={handleSaveRiskAcceptance} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-gray-700 dark:text-gray-300 mb-1">
                  VEX Exploitability Status *
                </label>
                <select
                  value={riskVexStatus}
                  onChange={(e) => setRiskVexStatus(e.target.value as VexStatus)}
                  className="w-full text-xs px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800"
                >
                  <option value="not_affected">not_affected (Unreachable code path)</option>
                  <option value="under_investigation">under_investigation (Pending review)</option>
                  <option value="fixed">fixed (Mitigated via WAF/firewall)</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold text-gray-700 dark:text-gray-300 mb-1">
                  Justification Text *
                </label>
                <textarea
                  rows={3}
                  value={riskJustification}
                  onChange={(e) => setRiskJustification(e.target.value)}
                  className="w-full text-xs p-2.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-gray-700 dark:text-gray-300 mb-1">
                    Approver Identity
                  </label>
                  <input
                    type="text"
                    value={riskApprover}
                    onChange={(e) => setRiskApprover(e.target.value)}
                    className="w-full text-xs px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 font-medium"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-gray-700 dark:text-gray-300 mb-1">
                    Expiry Date
                  </label>
                  <input
                    type="date"
                    value={riskExpiry}
                    onChange={(e) => setRiskExpiry(e.target.value)}
                    className="w-full text-xs px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 font-mono"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t">
                <button
                  type="button"
                  onClick={() => setRiskModalOpen(false)}
                  className="px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-100 rounded"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white rounded-lg shadow-sm"
                >
                  Publish VEX Justification
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* New Ticket Modal */}
      {createTicketOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4 backdrop-blur-xs animate-fadeIn">
          <div className="bg-white dark:bg-[#111827] border border-gray-200 dark:border-gray-800 rounded-2xl w-full max-w-md shadow-xl p-5 space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="text-sm font-bold text-gray-900 dark:text-white">Create Remediation Ticket</h3>
              <button onClick={() => setCreateTicketOpen(false)}>
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                const newTicket: RemediationTicket = {
                  id: `sq-ticket-${Date.now()}`,
                  ticketNumber: `SEC-${Math.floor(2000 + Math.random() * 8000)}`,
                  cve: newCve,
                  package: newPkg,
                  project: newProj,
                  priority: newPriority,
                  status: 'Open',
                  dueDate: new Date(Date.now() + 86400000 * (newPriority.startsWith('P0') ? 1 : 7)).toISOString().slice(0, 10),
                  slaDaysRemaining: newPriority.startsWith('P0') ? 1 : newPriority.startsWith('P1') ? 7 : 14,
                  assignee: 'Security Engineering',
                  createdAt: new Date().toISOString(),
                };

                setLocalTickets((prev) => [newTicket, ...prev]);
                setCreateTicketOpen(false);
                addToast({
                  type: 'success',
                  title: 'Remediation Ticket Created',
                  message: `Queued ${newTicket.ticketNumber} for ${newCve} on ${newProj}.`,
                });
              }}
              className="space-y-3.5 text-xs"
            >
              <div>
                <label className="block font-semibold mb-1 text-gray-700 dark:text-gray-300">
                  Target Project *
                </label>
                <select
                  value={newProj}
                  onChange={(e) => {
                    const p = e.target.value;
                    setNewProj(p);
                    const pVulns = vulnerabilities.filter((v) => v.project === p);
                    if (pVulns.length > 0) {
                      setNewCve(pVulns[0].cve);
                      setNewPkg(pVulns[0].package);
                      if (pVulns[0].severity === 'Critical') setNewPriority('P0 - Blocker');
                      else if (pVulns[0].severity === 'High') setNewPriority('P1 - High');
                    }
                  }}
                  className="w-full text-xs px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 font-medium"
                  required
                >
                  <option value="Payments API">Payments API</option>
                  <option value="Customer Portal">Customer Portal</option>
                  <option value="Checkout Service">Checkout Service</option>
                  <option value="Mobile App Backend">Mobile App Backend</option>
                  <option value="Admin Portal">Admin Portal</option>
                </select>
              </div>

              {/* Quick-select Project Vulnerabilities helper */}
              {vulnerabilities.filter((v) => v.project === newProj).length > 0 && (
                <div className="p-2.5 bg-blue-50/60 dark:bg-blue-950/30 border border-blue-100 dark:border-blue-900/40 rounded-lg space-y-1">
                  <label className="block text-[11px] font-bold text-blue-700 dark:text-blue-300">
                    Quick Select from Discovered CVEs in {newProj}:
                  </label>
                  <select
                    value={newCve}
                    onChange={(e) => {
                      const cveVal = e.target.value;
                      setNewCve(cveVal);
                      const matched = vulnerabilities.find((v) => v.cve === cveVal && v.project === newProj);
                      if (matched) {
                        setNewPkg(matched.package);
                        if (matched.severity === 'Critical') setNewPriority('P0 - Blocker');
                        else if (matched.severity === 'High') setNewPriority('P1 - High');
                        else setNewPriority('P2 - Medium');
                      }
                    }}
                    className="w-full text-xs px-2.5 py-1.5 rounded-lg border border-blue-200 dark:border-blue-800 bg-white dark:bg-gray-800 font-mono text-gray-900 dark:text-white"
                  >
                    {vulnerabilities
                      .filter((v) => v.project === newProj)
                      .map((v) => (
                        <option key={v.id} value={v.cve}>
                          {v.cve} ({v.package}) - {v.severity}
                        </option>
                      ))}
                  </select>
                </div>
              )}

              <div>
                <label className="block font-semibold mb-1 text-gray-700 dark:text-gray-300">
                  CVE Identifier *
                </label>
                <input
                  type="text"
                  value={newCve}
                  onChange={(e) => setNewCve(e.target.value)}
                  className="w-full text-xs px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 font-mono"
                  required
                />
              </div>

              <div>
                <label className="block font-semibold mb-1 text-gray-700 dark:text-gray-300">
                  Vulnerable Package *
                </label>
                <input
                  type="text"
                  value={newPkg}
                  onChange={(e) => setNewPkg(e.target.value)}
                  className="w-full text-xs px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 font-mono"
                  required
                />
              </div>

              <div>
                <label className="block font-semibold mb-1 text-gray-700 dark:text-gray-300">
                  Priority & SLA Target
                </label>
                <select
                  value={newPriority}
                  onChange={(e) => setNewPriority(e.target.value as 'P0 - Blocker' | 'P1 - High' | 'P2 - Medium' | 'P3 - Low')}
                  className="w-full text-xs px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 font-medium"
                >
                  <option value="P0 - Blocker">P0 - Blocker (24 Hours SLA)</option>
                  <option value="P1 - High">P1 - High (7 Days SLA)</option>
                  <option value="P2 - Medium">P2 - Medium (14 Days SLA)</option>
                </select>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-gray-100 dark:border-gray-800">
                <button
                  type="button"
                  onClick={() => setCreateTicketOpen(false)}
                  className="px-3.5 py-1.5 text-xs text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800 rounded-lg cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white rounded-lg shadow-sm cursor-pointer transition-colors"
                >
                  Submit Ticket
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Remediation;
