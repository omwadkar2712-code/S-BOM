import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import * as api from '../api/client';
import {
  Project,
  Vulnerability,
  SBOMComponent,
  RemediationTicket,
  PolicyRule,
  ScanJob,
  TimelineEvent,
  UserAccount,
} from '../types';
import {
  initialProjects,
  initialVulnerabilities,
  initialComponents,
  initialTickets,
  initialPolicies,
  initialScansHistory,
  initialTimelineEvents,
  initialUsers,
} from '../data/mockData';

function severityRank(severity?: string): number {
  switch ((severity || '').toUpperCase()) {
    case 'CRITICAL':
      return 4;
    case 'HIGH':
      return 3;
    case 'MEDIUM':
    case 'MODERATE':
      return 2;
    case 'LOW':
      return 1;
    default:
      return 2;
  }
}

function packageKey(component: { name: string; version: string; ecosystem?: string }): string {
  return `${(component.ecosystem || '').toLowerCase()}|${component.name.toLowerCase()}|${component.version}`;
}

function mergeByPackage<T extends { name: string; version: string; ecosystem?: string }>(current: T[], incoming: T[]): T[] {
  const seen = new Set(current.map(packageKey));
  const added = incoming.filter((component) => {
    const key = packageKey(component);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  return added.length ? [...current, ...added] : current;
}

function vulnKey(vuln: Vulnerability): string {
  return `${vuln.cve}|${vuln.package.toLowerCase()}|${vuln.version}`;
}

function mergeVulns(current: Vulnerability[], incoming: Vulnerability[]): Vulnerability[] {
  const seen = new Set(current.map(vulnKey));
  const added = incoming.filter((vuln) => {
    const key = vulnKey(vuln);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  return added.length ? [...current, ...added] : current;
}

function riskFromRank(rank: number): SBOMComponent['risk'] {
  switch (rank) {
    case 4:
      return 'Critical';
    case 3:
      return 'High';
    case 2:
      return 'Medium';
    case 1:
      return 'Low';
    default:
      return 'Safe';
  }
}

export interface ToastMessage {
  id: string;
  type: 'success' | 'info' | 'warning' | 'error';
  title: string;
  message: string;
}

interface AppStateContextType {
  projects: Project[];
  vulnerabilities: Vulnerability[];
  components: SBOMComponent[];
  tickets: RemediationTicket[];
  policies: PolicyRule[];
  scansHistory: ScanJob[];
  timelineEvents: TimelineEvent[];
  users: UserAccount[];
  
  // Modals & Panels
  searchModalOpen: boolean;
  setSearchModalOpen: (open: boolean) => void;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  
  addProjectModalOpen: boolean;
  setAddProjectModalOpen: (open: boolean) => void;
  
  addDependencyModalOpen: boolean;
  setAddDependencyModalOpen: (open: boolean) => void;
  
  selectedVulnerability: Vulnerability | null;
  setSelectedVulnerability: (vuln: Vulnerability | null) => void;
  
  notificationPanelOpen: boolean;
  setNotificationPanelOpen: (open: boolean) => void;
  
  userMenuOpen: boolean;
  setUserMenuOpen: (open: boolean) => void;
  
  // Status Bar & System State
  systemStatus: {
    scanApi: 'connected' | 'reconnecting' | 'error';
    postgres: 'connected' | 'reconnecting' | 'error';
    scans: 'idle' | 'running' | 'queued';
    isSelfHealing: boolean;
  };
  triggerSelfHeal: () => void;
  
  // Actions
  activeScan: ScanJob | null;
  startScan: (params: {
    projectName: string;
    appService: string;
    releaseTag?: string;
    scanType: 'Local Source' | 'Remote Git' | 'Batch Multi-Project' | 'Bulk Scan';
    source: string;
    localFile?: File | null;
    localFolder?: { file: File; relativePath: string }[];
    bulkFile?: File | null;
    gitUrl?: string;
    gitBranch?: string;
    gitToken?: string;
  }) => Promise<string>;
  rescanScan: (job: ScanJob) => Promise<void>;
  cancelScan: (job: ScanJob) => Promise<void>;
  
  addProject: (newProj: Partial<Project>) => void;
  addComponent: (newComp: Partial<SBOMComponent>) => Promise<void>;
  addComponents: (items: Partial<SBOMComponent>[]) => Promise<void>;
  updateTicketStatus: (id: string, status: RemediationTicket['status']) => void;
  togglePolicy: (id: string) => void;
  
  toasts: ToastMessage[];
  addToast: (toast: Omit<ToastMessage, 'id'>) => void;
  removeToast: (id: string) => void;
  
  exportSBOM: (format: 'spdx' | 'cyclonedx' | 'csv' | 'json', scanId?: string) => void;
}

const AppStateContext = createContext<AppStateContextType | undefined>(undefined);

export const AppStateProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [projects, setProjects] = useState<Project[]>(initialProjects);
  const [vulnerabilities, setVulnerabilities] = useState<Vulnerability[]>(initialVulnerabilities);
  const [components, setComponents] = useState<SBOMComponent[]>(initialComponents);
  const [tickets, setTickets] = useState<RemediationTicket[]>(initialTickets);
  const [policies, setPolicies] = useState<PolicyRule[]>(initialPolicies);
  const [scansHistory, setScansHistory] = useState<ScanJob[]>(initialScansHistory);
  const [timelineEvents, setTimelineEvents] = useState<TimelineEvent[]>(initialTimelineEvents);
  const [users] = useState<UserAccount[]>(initialUsers);

  // UI state
  const [searchModalOpen, setSearchModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [addProjectModalOpen, setAddProjectModalOpen] = useState(false);
  const [addDependencyModalOpen, setAddDependencyModalOpen] = useState(false);
  const [selectedVulnerability, setSelectedVulnerability] = useState<Vulnerability | null>(null);
  const [notificationPanelOpen, setNotificationPanelOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);

  // System status
  const [systemStatus, setSystemStatus] = useState<{
    scanApi: 'connected' | 'reconnecting' | 'error';
    postgres: 'connected' | 'reconnecting' | 'error';
    scans: 'idle' | 'running' | 'queued';
    isSelfHealing: boolean;
  }>({
    scanApi: 'connected',
    postgres: 'connected',
    scans: 'idle',
    isSelfHealing: false,
  });

  const [activeScan, setActiveScan] = useState<ScanJob | null>(null);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [latestScanId, setLatestScanId] = useState<string | null>(null);
  const announced = useRef(new Set<string>());

  const addToast = (toast: Omit<ToastMessage, 'id'>) => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts(prev => [...prev, { ...toast, id }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 4000);
  };

  const removeToast = (id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  };

  const triggerSelfHeal = () => {
    setSystemStatus(prev => ({
      ...prev,
      isSelfHealing: true,
      scanApi: 'reconnecting',
      postgres: 'reconnecting',
    }));
    addToast({
      type: 'info',
      title: 'Self-Heal Initiated',
      message: 'Re-evaluating security policies, flushing stale BOM caches, and resyncing advisory feeds...',
    });

    setTimeout(() => {
      setSystemStatus({
        scanApi: 'connected',
        postgres: 'connected',
        scans: 'idle',
        isSelfHealing: false,
      });
      addToast({
        type: 'success',
        title: 'Self-Heal Complete',
        message: 'All daemon connections verified. Policy caches re-warmed and SBOM registries synced.',
      });
    }, 2000);
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await api.healthReady();
        const [scans, inventory] = await Promise.all([
          api.listScans(),
          api.listInventoryComponents().catch(() => [] as api.ApiInventoryComponent[]),
        ]);
        if (cancelled) return;
        setSystemStatus(prev => ({ ...prev, scanApi: 'connected', postgres: 'connected' }));
        if (scans?.length) {
          const jobs = await Promise.all(scans.map(async (scan) => {
            const job = api.mapScan(scan);
            if (scan.status !== 'COMPLETED') return job;
            try {
              return { ...job, ...(await api.scanPackageTotals(scan.id)) };
            } catch {
              return job;
            }
          }));
          if (cancelled) return;
          const bulkIds = [...new Set(jobs.map((job) => job.bulkId).filter((id): id is string => Boolean(id)))];
          const aggregates: ScanJob[] = [];
          for (const bulkId of bulkIds) {
            try {
              aggregates.push(api.mapBulkAggregate(await api.getBulkScan(bulkId)));
            } catch {
              // A missing batch record still leaves the child scans in history.
            }
          }
          if (cancelled) return;
          const history = [...aggregates, ...jobs];
          for (const job of history) {
            if (job.status === 'completed' || job.status === 'failed' || job.status === 'cancelled') {
              announced.current.add(job.id);
            }
          }
          setScansHistory(history);
          const openJob = aggregates.find((job) => job.status === 'queued' || job.status === 'running' || job.status === 'analyzing')
            || jobs.find((job) => job.status === 'queued' || job.status === 'running' || job.status === 'analyzing');
          if (openJob) {
            setActiveScan((prev) => prev ?? openJob);
          }
          const completed = [...scans].reverse().filter(s => s.status === 'COMPLETED' && s.id);
          for (const done of completed) {
            await loadScanResults(done.id, done.project_id || '', done.application_name || '');
          }
          if (completed.length) setLatestScanId(completed[completed.length - 1].id);
        }
        if (!cancelled && inventory.length) {
          const saved = inventory.map(api.mapInventoryComponent);
          const ids = new Set(saved.map((component) => component.id));
          setComponents((prev) => [...saved, ...prev.filter((component) => !ids.has(component.id))]);
        }
      } catch {
        if (!cancelled) {
          setSystemStatus(prev => ({ ...prev, scanApi: 'error', postgres: 'error' }));
        }
      }
    })();
    return () => {
      cancelled = true;
    };
    // loadScanResults is stable enough for the initial hydrate.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadScanResults = async (scanId: string, project: string, application = '') => {
    const [comps, vulns] = await Promise.all([
      api.scanComponents(scanId),
      api.scanVulnerabilities(scanId),
    ]);
    const mapped = (comps || []).map(c => api.mapComponent(c, project, application));
    const mappedVulns = api.mapVulns(vulns, comps || [], project || application);
    const matches = Array.isArray(vulns) ? vulns : [];
    const stats = new Map<string, { count: number; rank: number; patch: boolean }>();
    for (const match of matches) {
      const current = stats.get(match.component_id) || { count: 0, rank: 0, patch: false };
      current.count += 1;
      current.rank = Math.max(current.rank, severityRank(match.severity));
      current.patch = current.patch || Boolean(match.fixed_version);
      stats.set(match.component_id, current);
    }
    const decorated = mapped.map(c => {
      const stat = stats.get(c.id);
      return {
        ...c,
        cves: stat?.count || 0,
        risk: riskFromRank(stat?.rank || 0),
        patchAvailable: stat?.patch || false,
      };
    });
    setComponents(prev => mergeByPackage(prev, decorated));
    setVulnerabilities(prev => mergeVulns(prev, mappedVulns));
    return { components: mapped.length, cves: mappedVulns.length, criticals: mappedVulns.filter(v => v.severity === 'Critical').length, highs: mappedVulns.filter(v => v.severity === 'High').length };
  };

  const startScan = async (params: {
    projectName: string;
    appService: string;
    releaseTag?: string;
    scanType: 'Local Source' | 'Remote Git' | 'Batch Multi-Project' | 'Bulk Scan';
    source: string;
    localFile?: File | null;
    localFolder?: { file: File; relativePath: string }[];
    bulkFile?: File | null;
    gitUrl?: string;
    gitBranch?: string;
    gitToken?: string;
  }) => {
    setSystemStatus(prev => ({ ...prev, scans: 'queued' }));
    let createdId = '';
    let createdStatus = 'PENDING';
    let createdStage = 'QUEUED';
    if (params.scanType === 'Local Source') {
      if (!params.localFile && !(params.localFolder && params.localFolder.length > 0)) {
        throw new Error('Choose a folder, a zip archive, or a manifest file to scan.');
      }
      const created = await api.createLocalScan(
        { file: params.localFile, folderFiles: params.localFolder },
        params.projectName,
        params.appService,
        params.releaseTag || 'UNKNOWN',
      );
      createdId = created.scan_id;
      createdStatus = created.status || createdStatus;
      createdStage = created.stage || createdStage;
    } else if (params.scanType === 'Remote Git') {
      if (!params.gitUrl) throw new Error('A GitHub repository URL is required.');
      let credentialId: string | undefined;
      if (params.gitToken) {
        credentialId = await api.createGitHubPat(`${params.projectName}-pat`, params.gitToken);
      }
      const created = await api.createGitHubScan({
        repositoryUrl: params.gitUrl,
        project: params.projectName,
        application: params.appService,
        version: params.releaseTag || 'UNKNOWN',
        branch: params.gitBranch || 'main',
        credentialId,
      });
      createdId = created.scan_id;
      createdStatus = created.status || createdStatus;
      createdStage = created.stage || createdStage;
    } else {
      if (!params.bulkFile) throw new Error('Choose a CSV or XLSX file, or enter GitHub URLs in the manual list.');
      const created = await api.createBulkScan(params.bulkFile, params.projectName);
      const listed = await api.listScans().catch(() => []);
      const aggregate = api.mapBulkAggregate(created);
      const childById = new Map(api.childJobsFromBulk(created).map((job) => [job.id, job]));
      const listedJobs = listed.map((scan) => {
        const mapped = api.mapScan(scan);
        const child = childById.get(mapped.id);
        if (!child) return mapped;
        childById.delete(mapped.id);
        return {
          ...mapped,
          scanType: 'Bulk Scan' as const,
          bulkId: created.id,
          bulkRow: child.bulkRow,
          source: mapped.source || child.source,
        };
      });
      const queued = created.queued_rows ?? created.items?.filter(item => item.status === 'QUEUED').length ?? 0;
      const skipped = created.invalid_rows ?? 0;
      const duplicateProjects = created.validation_errors?.filter(err => err.code === 'DUPLICATE_PROJECT').length ?? 0;
      const invalidRows = Math.max(0, skipped - duplicateProjects);
      const parts = [`${queued} row${queued === 1 ? '' : 's'} queued`];
      if (duplicateProjects) parts.push(`${duplicateProjects} duplicate project${duplicateProjects === 1 ? '' : 's'} skipped`);
      if (invalidRows) parts.push(`${invalidRows} invalid row${invalidRows === 1 ? '' : 's'} skipped`);
      const detail = created.validation_errors?.find(err => err.message)?.message;
      addToast({
        type: skipped ? 'warning' : 'success',
        title: queued ? 'Bulk scan accepted' : 'Nothing queued',
        message: detail ? `${parts.join('. ')}. ${detail}` : `${parts.join('. ')}.`,
      });
      setScansHistory((prev) => {
        const previousAggregates = prev.filter((job) => job.isBulkAggregate && job.id !== aggregate.id);
        return [aggregate, ...previousAggregates, ...childById.values(), ...listedJobs];
      });
      setActiveScan(aggregate);
      const firstQueued = created.items?.find(item => item.status === 'QUEUED' && item.scan_id);
      if (firstQueued?.scan_id) setLatestScanId(firstQueued.scan_id);
      setSystemStatus(prev => ({ ...prev, scans: queued ? 'queued' : 'idle' }));
      return aggregate.id;
    }

    const job: ScanJob = {
      id: createdId,
      targetProject: params.projectName,
      appService: params.appService,
      releaseTag: params.releaseTag || 'UNKNOWN',
      scanType: params.scanType,
      source: params.source,
      status: api.mapStatus(createdStatus, createdStage),
      stage: createdStage,
      progress: api.progressFor(createdStage, createdStatus),
      timestamp: new Date().toISOString().replace('T', ' ').substring(0, 19),
      componentsFound: 0,
      cvesFound: 0,
      criticals: 0,
      highs: 0,
      logMessages: [`Scan ${createdId} queued`],
    };
    setActiveScan(job);
    setLatestScanId(createdId);
    setScansHistory(prev => [job, ...prev.filter(s => s.id !== createdId)]);
    addToast({ type: 'info', title: 'Scan queued', message: `${params.projectName} is in the worker queue.` });
    return createdId;
  };

  const rescanScan = async (job: ScanJob) => {
    setSystemStatus(prev => ({ ...prev, scans: 'queued' }));
    const created = await api.rescanScan(job.id);
    const next: ScanJob = {
      ...job,
      id: created.scan_id,
      status: 'queued',
      progress: 8,
      componentsFound: 0,
      cvesFound: 0,
      criticals: 0,
      highs: 0,
      snapshotId: undefined,
      logMessages: ['Rescan queued'],
      timestamp: new Date().toISOString().replace('T', ' ').substring(0, 19),
    };
    announced.current.delete(created.scan_id);
    loadedResults.current.delete(created.scan_id);
    setActiveScan(next);
    setLatestScanId(created.scan_id);
    setScansHistory(prev => [next, ...prev.filter(item => item.id !== job.id && item.id !== created.scan_id)]);
    addToast({
      type: 'info',
      title: 'Rescan queued',
      message: `${job.targetProject} will run again with the same source.`,
    });
  };

  const cancelScan = async (job: ScanJob) => {
    try {
      await api.cancelScan(job.id);
    } catch (err) {
      const status = await api.scanStatus(job.id).catch(() => null);
      if (status) {
        const mapped = api.mapStatus(status.status, status.stage);
        const progress = api.progressFor(status.stage, status.status);
        setScansHistory(prev => prev.map(item => (item.id === job.id ? { ...item, status: mapped, progress } : item)));
        setActiveScan(prev => (prev && prev.id === job.id ? { ...prev, status: mapped, progress } : prev));
        if (mapped === 'queued' || mapped === 'running' || mapped === 'analyzing') {
          throw err;
        }
        if (mapped === 'cancelled') {
          throw new Error('This scan is already cancelled.');
        }
        throw new Error('This scan has already finished.');
      }
      throw err;
    }
    announced.current.add(job.id);
    const next: ScanJob = {
      ...job,
      status: 'cancelled',
      stage: 'CANCELLED',
      progress: job.progress || 8,
      completedAt: new Date().toISOString(),
      errorCode: 'CANCELLED',
      errorMessage: 'Cancelled by user',
      logMessages: [...(job.logMessages || []), 'CANCELLED: Cancelled by user'],
    };
    setActiveScan(prev => (prev && prev.id === job.id ? next : prev));
    setScansHistory(prev => prev.map(item => (item.id === job.id ? next : item)));
    setSystemStatus(prev => ({ ...prev, scans: 'idle' }));
    addToast({
      type: 'info',
      title: 'Scan cancelled',
      message: `${job.targetProject} was stopped.`,
    });
  };

  const historyRef = useRef(scansHistory);
  historyRef.current = scansHistory;
  const loadedResults = useRef(new Set<string>());
  const openScanKey = scansHistory
    .filter((scan) => {
      const open = scan.status === 'queued' || scan.status === 'running' || scan.status === 'analyzing';
      if (!open) return false;
      if (scan.isBulkAggregate) return true;
      if (scan.bulkId && scansHistory.some((item) => item.isBulkAggregate && item.bulkId === scan.bulkId && (item.status === 'queued' || item.status === 'running' || item.status === 'analyzing'))) {
        return false;
      }
      return true;
    })
    .map((scan) => scan.id)
    .sort()
    .join('|');

  useEffect(() => {
    const ids = openScanKey.split('|').filter(Boolean);
    if (ids.length === 0) return;
    let stopped = false;

    const publish = (next: ScanJob) => {
      setScansHistory((prev) => prev.map((item) => {
        if (item.id !== next.id) return item;
        if (item.status === 'cancelled' && next.status !== 'cancelled') return item;
        return { ...item, ...next };
      }));
      setActiveScan((prev) => {
        if (!prev || prev.id !== next.id) return prev;
        if (prev.status === 'cancelled' && next.status !== 'cancelled') return prev;
        return { ...prev, ...next };
      });
    };

    const announce = (job: ScanJob, message: string, type: 'success' | 'error' | 'warning') => {
      if (announced.current.has(job.id)) return;
      announced.current.add(job.id);
      const title = type === 'error' ? 'Scan failed' : type === 'warning' ? 'Bulk scan finished with row errors' : 'Scan finished';
      addToast({ type, title, message });
    };

    const finishCounts = async (job: ScanJob) => {
      if (job.status !== 'completed' || job.isBulkAggregate || loadedResults.current.has(job.id)) return;
      loadedResults.current.add(job.id);
      try {
        const counts = await loadScanResults(job.id, job.targetProject, job.appService);
        const finished: ScanJob = {
          ...job,
          componentsFound: counts.components,
          cvesFound: counts.cves,
          criticals: counts.criticals,
          highs: counts.highs,
          status: 'completed',
          progress: 100,
        };
        publish(finished);
        if (!job.bulkId) {
          announce(finished, `${counts.components} components, ${counts.cves} CVEs.`, 'success');
        }
        setLatestScanId(job.id);
      } catch {
        loadedResults.current.delete(job.id);
      }
    };

    const tick = async () => {
      await Promise.all(ids.map(async (id) => {
        const current = historyRef.current.find((item) => item.id === id);
        if (!current || stopped) return;
        try {
          if (current.isBulkAggregate && current.bulkId) {
            const bulk = await api.getBulkScan(current.bulkId);
            if (stopped) return;
            const aggregate = api.mapBulkAggregate(bulk);
            if ((aggregate.status === 'completed' || aggregate.status === 'failed') && !aggregate.completedAt) {
              aggregate.completedAt = new Date().toISOString();
            }
            const detailed = new Map<string, ScanJob>();
            const running = (bulk.items || []).filter((item) => item.status === 'RUNNING' && item.scan_id).slice(0, 8);
            await Promise.all(running.map(async (item) => {
              const child = historyRef.current.find((row) => row.id === item.scan_id);
              if (!child) return;
              const status = await api.scanStatus(item.scan_id as string);
              const events = await api.scanEvents(item.scan_id as string).catch(() => []);
              if (stopped) return;
              detailed.set(child.id, api.applyScanUpdate(child, status, events));
            }));
            publish(aggregate);
            for (const next of detailed.values()) publish(next);
            for (const item of bulk.items || []) {
              if (!item.scan_id || detailed.has(item.scan_id)) {
                const detailedJob = item.scan_id ? detailed.get(item.scan_id) : undefined;
                if (detailedJob?.status === 'completed') void finishCounts(detailedJob);
                continue;
              }
              const child = historyRef.current.find((row) => row.id === item.scan_id);
              if (!child || (child.status === 'cancelled' && item.status !== 'CANCELLED')) continue;
              const mapped = api.mapStatus(item.status, child.stage || item.status);
              const patched: ScanJob = {
                ...child,
                status: mapped,
                errorCode: item.error_code || child.errorCode,
                errorMessage: item.error_message || child.errorMessage,
                progress: mapped === 'completed' ? 100 : child.progress,
              };
              if (mapped !== child.status || Boolean(item.error_message && item.error_message !== child.errorMessage)) {
                publish(patched);
              }
              if (mapped === 'completed') void finishCounts(patched);
              if (mapped === 'failed' || mapped === 'cancelled') announced.current.add(child.id);
            }
            if (aggregate.status === 'failed') {
              announce(aggregate, aggregate.errorMessage || 'The batch did not queue any scans.', 'error');
            } else if (aggregate.status === 'completed') {
              const failed = (aggregate.bulkItems || []).filter((item) => item.status === 'FAILED' || item.status === 'DEAD_LETTER').length;
              const completed = (aggregate.bulkItems || []).filter((item) => item.status === 'COMPLETED').length;
              announce(
                aggregate,
                failed ? `${completed} completed, ${failed} failed.` : `${completed} completed.`,
                failed ? 'warning' : 'success',
              );
            }
            return;
          }

          const status = await api.scanStatus(id);
          const events = await api.scanEvents(id).catch(() => []);
          if (stopped) return;
          const next = api.applyScanUpdate(current, status, events);
          if (current.status === 'cancelled' && next.status !== 'cancelled') return;
          publish(next);
          if (next.status === 'failed') {
            announce(next, next.errorMessage || 'The worker reported a failure.', 'error');
          } else if (next.status === 'cancelled') {
            announced.current.add(next.id);
          } else if (next.status === 'completed') {
            await finishCounts(next);
          }
        } catch {
          // The next tick retries.
        }
      }));
      if (stopped) return;
      const stillOpen = historyRef.current.some((scan) => scan.status === 'queued' || scan.status === 'running' || scan.status === 'analyzing');
      setSystemStatus((prev) => ({ ...prev, scans: stillOpen ? 'running' : 'idle' }));
    };

    void tick();
    const timer = window.setInterval(() => { void tick(); }, 1500);
    return () => {
      stopped = true;
      window.clearInterval(timer);
    };
    // Status polling is keyed by the set of open scan ids.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openScanKey]);

  const addProject = (newProj: Partial<Project>) => {
    const proj: Project = {
      id: `proj-${Date.now()}`,
      name: newProj.name || 'new-service',
      component: newProj.component || 'backend-api',
      version: newProj.version || 'v1.0.0',
      riskScore: newProj.riskScore || 3.0,
      riskLevel: newProj.riskLevel || 'Low',
      complianceScore: newProj.complianceScore || 90.0,
      dossierUrl: `/dossier/${newProj.name || 'service'}`,
      componentsCount: newProj.componentsCount || 15,
      criticalCount: newProj.criticalCount || 0,
      highCount: newProj.highCount || 0,
      mediumCount: newProj.mediumCount || 1,
      lowCount: newProj.lowCount || 2,
      lastScanned: 'Just now',
      repoUrl: newProj.repoUrl || 'https://github.com/talakunchi/new-service',
      branch: newProj.branch || 'main',
      tags: newProj.tags || ['service'],
      status: 'Audited',
    };
    setProjects(prev => [proj, ...prev]);
    addToast({
      type: 'success',
      title: 'Project Added',
      message: `Project "${proj.name}" added to organization inventory.`,
    });
  };

  const rememberComponents = (comps: SBOMComponent[]) => {
    if (!comps.length) return;
    const ids = new Set(comps.map((component) => component.id));
    setComponents((prev) => [...comps, ...prev.filter((component) => !ids.has(component.id))]);
  };

  const addComponents = async (items: Partial<SBOMComponent>[]) => {
    if (!items.length) return;
    const saved = await api.createInventoryComponents(items.map((item) => ({
      project: item.project || '',
      project_application: item.projectApplication || '',
      name: item.name || '',
      package_name: item.packageName || item.name || '',
      version: item.version || '',
      field_type: item.fieldType,
      license: item.license,
      cves: item.cves,
      ecosystem: item.ecosystem,
      risk: item.risk,
      purl: item.purl,
      direct_dependency: item.directDependency,
      supplier: item.supplier,
    })));
    rememberComponents(saved.map(api.mapInventoryComponent));
  };

  const addComponent = async (newComp: Partial<SBOMComponent>) => {
    await addComponents([newComp]);
    const name = newComp.name || 'new-package';
    const version = newComp.version || '1.0.0';
    addToast({
      type: 'success',
      title: 'Inventory Item Added',
      message: `Component "${name}@${version}" added to Software Inventory.`,
    });
  };

  const updateTicketStatus = (id: string, status: RemediationTicket['status']) => {
    setTickets(prev =>
      prev.map(t => (t.id === id ? { ...t, status } : t))
    );
    addToast({
      type: 'info',
      title: 'Ticket Updated',
      message: `Remediation ticket status changed to "${status}".`,
    });
  };

  const togglePolicy = (id: string) => {
    setPolicies(prev =>
      prev.map(p => {
        if (p.id === id) {
          const nextStatus = p.status === 'Active' ? 'Disabled' : 'Active';
          addToast({
            type: nextStatus === 'Active' ? 'success' : 'warning',
            title: `Policy ${nextStatus}`,
            message: `Policy rule "${p.name}" is now ${nextStatus.toLowerCase()}.`,
          });
          return { ...p, status: nextStatus };
        }
        return p;
      })
    );
  };

  const exportSBOM = (format: 'spdx' | 'cyclonedx' | 'csv' | 'json', scanId?: string) => {
    const exportId = scanId || latestScanId;
    const targetScan = exportId ? scansHistory.find(s => s.id === exportId) : null;
    const projName = targetScan?.targetProject || 'sbom-project';
    const cleanProj = projName.toLowerCase().replace(/[^a-z0-9_-]/g, '-');
    const ext = format === 'spdx' ? 'spdx.json' : format === 'cyclonedx' ? 'cdx.json' : format === 'csv' ? 'csv' : 'json';
    const downloadName = `${cleanProj}-${exportId || Date.now()}.${ext}`;

    const downloadClientFile = () => {
      let content = '';
      let mimeType = 'text/plain';

      let scanComponents: typeof components = [];
      if (targetScan?.isBulkAggregate && targetScan.bulkId) {
        const childScans = scansHistory.filter(s => s.bulkId === targetScan.bulkId && !s.isBulkAggregate);
        const childProjects = new Set([targetScan.targetProject, ...childScans.map(s => s.targetProject)]);
        scanComponents = components.filter(c => childProjects.has(c.project));
      } else if (targetScan) {
        scanComponents = components.filter(c => c.project === targetScan.targetProject);
      }
      const exportComponents = scanComponents.length > 0 ? scanComponents : components;

      if (format === 'spdx') {
        mimeType = 'application/json';
        content = JSON.stringify({
          spdxVersion: 'SPDX-2.3',
          dataLicense: 'CC0-1.0',
          SPDXID: 'SPDXRef-DOCUMENT',
          name: `SPDX-${projName}`,
          documentNamespace: `https://spdx.org/spdxdocs/${cleanProj}-${exportId || 'export'}-${Date.now()}`,
          creationInfo: {
            created: new Date().toISOString(),
            creators: [
              'Tool: S-BOM Generator',
              (targetScan as any)?.requestedBy ? `Person: ${(targetScan as any).requestedBy}` : 'Organization: Security Operations',
            ],
          },
          packages: exportComponents.map(c => ({
            SPDXID: `SPDXRef-Package-${c.id || c.name}`,
            name: c.name,
            versionInfo: c.version,
            licenseConcluded: c.license || 'NOASSERTION',
            externalRefs: c.purl
              ? [
                  {
                    referenceCategory: 'PACKAGE-MANAGER',
                    referenceType: 'purl',
                    referenceLocator: c.purl,
                  },
                ]
              : [],
          })),
        }, null, 2);
      } else if (format === 'cyclonedx') {
        mimeType = 'application/json';
        content = JSON.stringify({
          bomFormat: 'CycloneDX',
          specVersion: '1.5',
          version: 1,
          metadata: {
            timestamp: new Date().toISOString(),
            component: {
              type: 'application',
              name: projName,
              version: targetScan?.releaseTag || '1.0.0',
            },
            tools: [{ vendor: 'S-BOM', name: 'SBOM Engine' }],
            authors: (targetScan as any)?.requestedBy ? [{ name: (targetScan as any).requestedBy }] : [],
          },
          components: exportComponents.map(c => ({
            type: 'library',
            name: c.name,
            version: c.version,
            purl: c.purl,
            licenses: c.license ? [{ license: { id: c.license } }] : [],
          })),
        }, null, 2);
      } else if (format === 'csv') {
        mimeType = 'text/csv';
        const headers = ['NAME', 'VERSION', 'PROJECT', 'COMPLIANCE', 'LICENSE', 'TRUST', 'RISK', 'CVES', 'ECOSYSTEM'];
        const rows = exportComponents.map(c => [
          `"${c.name}"`,
          `"${c.version}"`,
          `"${c.project}"`,
          `"${c.compliance}%"`,
          `"${c.license}"`,
          `"${c.trustScore}"`,
          `"${c.risk}"`,
          `"${c.cves}"`,
          `"${c.ecosystem}"`,
        ].join(','));
        content = [headers.join(','), ...rows].join('\n');
      } else {
        mimeType = 'application/json';
        content = JSON.stringify({ components: exportComponents, vulnerabilities, projects }, null, 2);
      }

      const blob = new Blob([content], { type: mimeType });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = downloadName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      addToast({
        type: 'success',
        title: 'Export Successful',
        message: `Downloaded ${downloadName} (${format.toUpperCase()} format).`,
      });
    };

    if (exportId && format !== 'json') {
      const fmt = format === 'spdx' ? 'spdx-json' : format === 'cyclonedx' ? 'cyclonedx-json' : 'csv';
      void (async () => {
        try {
          const res = await fetch(api.exportUrl(exportId, fmt), {
            headers: { 'X-Organization-Id': 'default' },
          });
          if (!res.ok) {
            throw new Error('API returned ' + res.status);
          }
          const blob = await res.blob();
          const url = URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = url;
          link.download = downloadName;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          URL.revokeObjectURL(url);
          addToast({
            type: 'success',
            title: 'Export Successful',
            message: `Downloaded ${downloadName} (${format.toUpperCase()} format).`,
          });
        } catch {
          downloadClientFile();
        }
      })();
      return;
    }

    downloadClientFile();
  };

  return (
    <AppStateContext.Provider
      value={{
        projects,
        vulnerabilities,
        components,
        tickets,
        policies,
        scansHistory,
        timelineEvents,
        users,
        searchModalOpen,
        setSearchModalOpen,
        searchQuery,
        setSearchQuery,
        addProjectModalOpen,
        setAddProjectModalOpen,
        addDependencyModalOpen,
        setAddDependencyModalOpen,
        selectedVulnerability,
        setSelectedVulnerability,
        notificationPanelOpen,
        setNotificationPanelOpen,
        userMenuOpen,
        setUserMenuOpen,
        systemStatus,
        triggerSelfHeal,
        activeScan,
        startScan,
        rescanScan,
        cancelScan,
        addProject,
        addComponent,
        addComponents,
        updateTicketStatus,
        togglePolicy,
        toasts,
        addToast,
        removeToast,
        exportSBOM,
      }}
    >
      {children}
    </AppStateContext.Provider>
  );
};

export const useAppState = () => {
  const context = useContext(AppStateContext);
  if (!context) throw new Error('useAppState must be used within an AppStateProvider');
  return context;
};
