import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, NavLink } from 'react-router-dom';
import {
  Folder,
  Layers,
  Upload,
  CheckCircle2,
  Info,
  ArrowRight,
  Shield,
  FileCode,
  Check,
  AlertTriangle,
  Github,
  Play,
  Ban,
  RotateCcw,
  Clock,
  Calendar,
  History,
  Radio,
  PlusCircle,
  Terminal,
  Trash2,
  ExternalLink,
  Download,
  Filter,
  Search,
  X,
  FileSpreadsheet,
  Package,
  FolderGit2,
  Copy,
  MoreVertical,
  Plus,
  ArrowLeft,
  User,
} from 'lucide-react';
import { useAppState } from '../../context/AppStateContext';
import type { ScanJob } from '../../types';
import { filesFromDataTransfer, folderLabel, folderTypeLabel, isArchiveName, isManifestRelativePath, selectFolderManifests, SUPPORTED_MANIFEST_HINT, type FolderFile } from './localFolder';
import { classifyBulkCsv } from './bulkRows';
import { PipelineGrid, ScanResultDetails } from './ScanResultDetails';
import { displayStatus, formatDuration, formatEventTime, isOpenStatus, stageLabel } from './scanProgress';
import { ScanActionMenu } from './ScanActionMenu';

export const SecurityScans: React.FC = () => {
  const { tab } = useParams<{ tab?: string }>();
  const navigate = useNavigate();
  const { startScan, rescanScan, cancelScan, activeScan, scansHistory, exportSBOM, addToast } = useAppState();

  // Active sub-page tab: 'table' | 'new' | 'live' | 'history' | 'schedules'
  const validTabs = ['table', 'new', 'live', 'history', 'schedules'] as const;
  type TabType = (typeof validTabs)[number];
  const activeTab: TabType = validTabs.includes(tab as TabType) ? (tab as TabType) : 'table';

  const setTab = (newTab: TabType) => {
    if (newTab === 'table') {
      navigate('/security-scans');
    } else {
      navigate(`/security-scans/${newTab}`);
    }
  };

  // =========================================================================
  // SUB-PAGE 0: SECURITY SCANS TABLE (Landing view for Security Scans)
  // =========================================================================
  const [scanSearch, setScanSearch] = useState('');
  const [scanStatusFilter, setScanStatusFilter] = useState('All');
  const [scanTypeFilter, setScanTypeFilter] = useState('All');
  const [showScanFilters, setShowScanFilters] = useState(false);

  const filteredScans = scansHistory.filter((s) => {
    const q = scanSearch.toLowerCase();
    const matchSearch =
      !q ||
      s.targetProject.toLowerCase().includes(q) ||
      (s.appService && s.appService.toLowerCase().includes(q)) ||
      s.scanType.toLowerCase().includes(q) ||
      ((s as any).requestedBy && (s as any).requestedBy.toLowerCase().includes(q)) ||
      s.status.toLowerCase().includes(q);
    const matchStatus = scanStatusFilter === 'All'
      || s.status === scanStatusFilter
      || (scanStatusFilter === 'running' && s.status === 'analyzing');
    const matchType = scanTypeFilter === 'All' || s.scanType === scanTypeFilter;
    return matchSearch && matchStatus && matchType;
  });

  const handleResetScanFilters = () => {
    setScanSearch('');
    setScanStatusFilter('All');
    setScanTypeFilter('All');
  };

  // =========================================================================
  // SUB-PAGE 1: NEW SCAN (2-Stage Input & Review Flow as per Excel Sr 5)
  // =========================================================================
  const [newScanStep, setNewScanStep] = useState<'input' | 'review'>('input');

  // Form State: Project Information
  const [projectName, setProjectName] = useState('');
  const [appService, setAppService] = useState('');
  const [releaseVersion, setReleaseVersion] = useState('');
  const [description, setDescription] = useState('');

  // Source Type: 'local' | 'git' | 'bulk'
  const [sourceType, setSourceType] = useState<'local' | 'git' | 'bulk'>('local');

  // Local Source State
  const [selectedFolder, setSelectedFolder] = useState<string>('');
  const [localFile, setLocalFile] = useState<File | null>(null);
  const [localFolder, setLocalFolder] = useState<FolderFile[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);

  const openFolderPicker = () => {
    const input = folderInputRef.current;
    if (!input) return;
    input.value = '';
    input.multiple = true;
    input.accept = '';
    input.removeAttribute('accept');
    // Whole project / mixed-manifest folder upload.
    input.setAttribute('webkitdirectory', '');
    input.setAttribute('directory', '');
    input.click();
  };

  const openFilePicker = () => {
    const input = fileInputRef.current;
    if (!input) return;
    input.value = '';
    input.multiple = false;
    input.click();
  };

  const useFolderManifests = (items: FolderFile[]) => {
    const manifests = selectFolderManifests(items);
    setSelectedFolder(folderTypeLabel(items, manifests));
    if (manifests.length === 0) {
      setLocalFile(null);
      setLocalFolder([]);
      addToast({
        type: 'warning',
        title: 'No manifests found',
        message: `That folder has no supported dependency manifest. Supported: ${SUPPORTED_MANIFEST_HINT}.`,
      });
      return;
    }
    setLocalFile(null);
    setLocalFolder(manifests);
  };

  const acceptLocalDrop = async (dt: DataTransfer) => {
    const items = await filesFromDataTransfer(dt);
    const nested = items.some((item) => item.relativePath.includes('/'));
    if (!nested && items.length === 1) {
      setLocalFolder([]);
      setLocalFile(items[0].file);
      setSelectedFolder(items[0].file.name);
      return;
    }
    useFolderManifests(items);
  };

  // Remote Git State (GitHub only)
  const [gitUrl, setGitUrl] = useState('');
  const [gitBranch, setGitBranch] = useState('main');
  const [gitToken, setGitToken] = useState('');

  // Bulk Scan State & Spreadsheet Matrix Support
  const bulkFileInputRef = useRef<HTMLInputElement>(null);
  const [uploadedBulk, setUploadedBulk] = useState<File | null>(null);
  const [bulkMode, setBulkMode] = useState<'file' | 'manual'>('file');
  const [bulkScanList, setBulkScanList] = useState(
    'https://github.com/expressjs/express\nhttps://github.com/pallets/flask\nhttps://github.com/fastapi/fastapi\nhttps://github.com/gin-gonic/gin'
  );

  interface BulkProjectRow {
    id: string;
    rowNumber?: number;
    project: string;
    name: string;
    version: string;
    source: string;
    branch: string;
    ecosystem: string;
    rowStatus?: 'ready' | 'duplicate' | 'invalid';
    rowMessage?: string;
  }

  const [bulkFile, setBulkFile] = useState<{
    name: string;
    size: string;
    rowCount: number;
    uploadedAt: string;
  }>({
    name: 'squad1_bulk_scan_template.csv',
    size: '0.8 KB',
    rowCount: 8,
    uploadedAt: 'Verified Template',
  });

  const [bulkFileError, setBulkFileError] = useState('');
  const [bulkProjects, setBulkProjects] = useState<BulkProjectRow[]>([
    { id: '1', project: 'Express', name: 'express', version: '4.21.2', source: 'https://github.com/expressjs/express', branch: 'master', ecosystem: 'npm', rowStatus: 'ready' },
    { id: '2', project: 'Flask', name: 'flask', version: '3.1.0', source: 'https://github.com/pallets/flask', branch: 'main', ecosystem: 'PyPI', rowStatus: 'ready' },
    { id: '3', project: 'Gson', name: 'gson', version: '2.11.0', source: 'https://github.com/google/gson', branch: 'main', ecosystem: 'Maven', rowStatus: 'ready' },
    { id: '4', project: 'Gin', name: 'gin', version: '1.10.0', source: 'https://github.com/gin-gonic/gin', branch: 'master', ecosystem: 'Go', rowStatus: 'ready' },
    { id: '5', project: 'Serde', name: 'serde', version: '1.0.217', source: 'https://github.com/serde-rs/serde', branch: 'master', ecosystem: 'Cargo', rowStatus: 'ready' },
    { id: '6', project: 'Newtonsoft.Json', name: 'newtonsoft.json', version: '13.0.3', source: 'https://github.com/JamesNK/Newtonsoft.Json', branch: 'master', ecosystem: 'NuGet', rowStatus: 'ready' },
    { id: '7', project: 'Guzzle', name: 'guzzle', version: '7.9.2', source: 'https://github.com/guzzle/guzzle', branch: '8.2', ecosystem: 'Packagist', rowStatus: 'ready' },
    { id: '8', project: 'Nokogiri', name: 'nokogiri', version: '1.18.2', source: 'https://github.com/sparklemotion/nokogiri', branch: 'main', ecosystem: 'RubyGems', rowStatus: 'ready' },
  ]);

  const handleDownloadSampleCsv = () => {
    const link = document.createElement('a');
    link.href = '/squad1_bulk_scan_template.csv';
    link.download = 'squad1_bulk_scan_template.csv';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    addToast({
      type: 'success',
      title: 'Template Downloaded',
      message: 'Downloaded squad1_bulk_scan_template.csv for batch inventory scanning.',
    });
  };

  const handleBulkFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadedBulk(file);
    const fileSizeKB = (file.size / 1024).toFixed(1) + ' KB';
    const fileName = file.name;
    const isCsv = fileName.toLowerCase().endsWith('.csv');

    if (isCsv) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const text = event.target?.result as string;
        if (!text) return;
        const classified = classifyBulkCsv(text);
        if (classified.fileError) {
          setBulkFileError(classified.fileError);
          setBulkProjects([]);
          setBulkFile({
            name: fileName,
            size: fileSizeKB,
            rowCount: 0,
            uploadedAt: 'Cannot scan',
          });
          addToast({ type: 'error', title: 'Spreadsheet cannot be scanned', message: classified.fileError });
          return;
        }
        const skipped = classified.rows.filter((row) => row.rowStatus !== 'ready').length;
        setBulkFileError('');
        setBulkProjects(classified.rows);
        setBulkFile({
          name: fileName,
          size: fileSizeKB,
          rowCount: classified.rows.length,
          uploadedAt: 'Just now',
        });
        setBulkScanList(classified.rows.map((row) => row.source).join('\n'));
        addToast({
          type: skipped ? 'warning' : 'success',
          title: skipped ? 'Spreadsheet needs review' : 'CSV Matrix Imported',
          message: skipped
            ? `${classified.rows.length - skipped} rows will be scanned. ${skipped} duplicate or invalid ${skipped === 1 ? 'row is' : 'rows are'} skipped.`
            : `Successfully loaded ${classified.rows.length} projects from ${fileName}.`,
        });
      };
      reader.readAsText(file);
    } else {
      setBulkFileError('');
      setBulkFile({
        name: fileName,
        size: fileSizeKB,
        rowCount: 0,
        uploadedAt: 'Checked on launch',
      });
      setBulkProjects([]);
      addToast({
        type: 'success',
        title: 'Spreadsheet ready',
        message: `${fileName} will be checked on launch. Duplicate projects and invalid rows are skipped, and the other rows are still scanned.`,
      });
    }
  };

  // Scan Configuration State (Combined on same page as per Excel Sr 5)
  const [sbomFormat, setSbomFormat] = useState<'SPDX-2.3' | 'CycloneDX-1.5'>('SPDX-2.3');
  const [vulnScan, setVulnScan] = useState(true);
  const [licenseCheck, setLicenseCheck] = useState(true);
  const [cryptoScan, setCryptoScan] = useState(true);
  const [signArtifact, setSignArtifact] = useState(true);

  // Tooltip State (Excel Sr 9: hover info icons)
  const [activeTooltip, setActiveTooltip] = useState<string | null>(null);

  // Submission State
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Advance to Review
  const handleProceedToReview = (e: React.FormEvent) => {
    e.preventDefault();
    if (sourceType !== 'bulk') {
      if (!projectName.trim()) {
        addToast({ type: 'warning', title: 'Validation Error', message: 'Project Name is required.' });
        return;
      }
      if (!appService.trim()) {
        addToast({ type: 'warning', title: 'Validation Error', message: 'Application / Service is required.' });
        return;
      }
    }
    if (sourceType === 'bulk' && bulkMode === 'file' && bulkFileError) {
      addToast({ type: 'warning', title: 'Spreadsheet cannot be scanned', message: bulkFileError });
      return;
    }
    if (sourceType === 'bulk' && bulkMode === 'file' && bulkProjects.length > 0 && bulkProjects.every((row) => row.rowStatus && row.rowStatus !== 'ready')) {
      addToast({
        type: 'warning',
        title: 'Nothing to scan',
        message: 'Every row is a duplicate project or invalid. Fix the spreadsheet and upload it again. Valid rows in a mixed file are still scanned.',
      });
      return;
    }
    setNewScanStep('review');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Final Launch Scan (Excel Sr 8) -> Transitions to Live Jobs
  const handleFinalLaunchScan = async () => {
    const manualUrls = bulkScanList.split(/\r?\n/).map((line) => line.trim()).filter((line) => line.startsWith('https://github.com/'));
    if (sourceType === 'local' && !localFile && localFolder.length === 0) {
      addToast({ type: 'warning', title: 'Source required', message: 'Choose a project folder, a single manifest file, or a .zip archive.' });
      return;
    }
    if (sourceType === 'git' && !gitUrl.trim().startsWith('https://github.com/')) {
      addToast({ type: 'warning', title: 'GitHub URL required', message: 'Use a URL that starts with https://github.com/.' });
      return;
    }
    if (sourceType === 'bulk' && bulkMode === 'file' && !uploadedBulk) {
      addToast({ type: 'warning', title: 'Spreadsheet required', message: 'Upload a CSV or XLSX that uses the template columns.' });
      return;
    }
    if (sourceType === 'bulk' && bulkMode === 'manual' && manualUrls.length === 0) {
      addToast({ type: 'warning', title: 'Repositories required', message: 'Enter one https://github.com/owner/repo URL per line.' });
      return;
    }

    setIsSubmitting(true);
    const sourceDesc =
      sourceType === 'local'
        ? localFile?.name || selectedFolder
        : sourceType === 'git'
          ? `${gitUrl} (${gitBranch})`
          : bulkMode === 'file'
            ? uploadedBulk?.name || bulkFile.name
            : `${manualUrls.length} GitHub repositories`;

    const bulkFileToSend = sourceType !== 'bulk'
      ? null
      : bulkMode === 'file'
        ? uploadedBulk
        : new File(
            [
              'project_name,application_name,version,repository_url,branch,authentication_reference,scan_type\n' +
              manualUrls.map((url) => {
                const parts = url.split('/').filter(Boolean);
                const name = parts.pop() || 'app';
                const owner = parts.pop() || name;
                return [owner, name, 'UNKNOWN', url, 'main', '', 'GITHUB']
                  .map((cell) => `"${String(cell).replace(/"/g, '""')}"`)
                  .join(',');
              }).join('\n') + '\n',
            ],
            'bulk.csv',
            { type: 'text/csv' },
          );

    try {
      const firstBulk = bulkProjects.find((row) => !row.rowStatus || row.rowStatus === 'ready') || bulkProjects[0];
      const scanId = await startScan({
        projectName: sourceType === 'bulk' ? (projectName.trim() || firstBulk?.project || 'Bulk scan') : projectName,
        appService: sourceType === 'bulk' ? (appService.trim() || firstBulk?.name || '') : appService,
        releaseTag: sourceType === 'bulk' ? (releaseVersion.trim() || firstBulk?.version || '') : releaseVersion,
        scanType: sourceType === 'local' ? 'Local Source' : sourceType === 'git' ? 'Remote Git' : 'Bulk Scan',
        source: sourceDesc,
        localFile,
        localFolder,
        bulkFile: bulkFileToSend,
        gitUrl,
        gitBranch,
        gitToken,
      });

      setIsSubmitting(false);
      if (scanId) setTab('live');
    } catch (err) {
      setIsSubmitting(false);
      addToast({
        type: 'error',
        title: 'Scan was not queued',
        message: err instanceof Error ? err.message : 'The scan API rejected the request.',
      });
    }
  };

  // =========================================================================
  // SUB-PAGE 2: LIVE JOBS STATE & LOGIC
  // =========================================================================
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!activeScan || !isOpenStatus(activeScan.status)) return;
    const interval = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(interval);
  }, [activeScan?.id, activeScan?.status]);

  const scanFailed = activeScan?.status === 'failed';
  const bulkChildren = activeScan?.isBulkAggregate
    ? scansHistory.filter((scan) => scan.bulkId === activeScan.bulkId && !scan.isBulkAggregate)
    : [];
  const pipelineScan = activeScan?.isBulkAggregate
    ? bulkChildren.find((scan) => scan.status === 'running' || scan.status === 'analyzing') || null
    : activeScan;

  // =========================================================================
  // SUB-PAGE 3: SCAN HISTORY STATE & DETAIL MODAL
  // =========================================================================
  const [historySearch, setHistorySearch] = useState('');
  const [historyStatusFilter, setHistoryStatusFilter] = useState('All');
  const [selectedScanId, setSelectedScanId] = useState<string | null>(null);
  const selectedHistoryScan = scansHistory.find((scan) => scan.id === selectedScanId) || null;
  const [rescanningId, setRescanningId] = useState<string | null>(null);
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  const canRescan = (status: string) => status === 'completed' || status === 'failed' || status === 'cancelled';
  const canCancel = (status: string) => {
    const normalized = status.toLowerCase();
    return normalized === 'queued' || normalized === 'pending' || normalized === 'running' || normalized === 'analyzing';
  };
  const waitingScans = scansHistory.filter((scan) => scan.status === 'queued' && scan.id !== activeScan?.id);

  const handleCancel = async (job: ScanJob) => {
    if (cancellingId) return;
    setCancellingId(job.id);
    try {
      if (job.isBulkAggregate) {
        const children = scansHistory.filter((scan) => scan.bulkId === job.bulkId && !scan.isBulkAggregate && canCancel(scan.status));
        if (children.length === 0) {
          addToast({ type: 'info', title: 'Nothing to cancel', message: 'Every row in this batch has already finished.' });
          return;
        }
        for (const child of children) {
          await cancelScan(child);
        }
        return;
      }
      await cancelScan(job);
    } catch (err) {
      addToast({
        type: 'error',
        title: 'Cancel failed',
        message: err instanceof Error ? err.message : 'The scan could not be cancelled.',
      });
    } finally {
      setCancellingId(null);
    }
  };

  const handleRescan = async (job: ScanJob) => {
    if (rescanningId) return;
    setRescanningId(job.id);
    try {
      await rescanScan(job);
      setSelectedScanId(null);
      setTab('live');
    } catch (err) {
      addToast({
        type: 'error',
        title: 'Rescan failed',
        message: err instanceof Error ? err.message : 'The scan could not be queued again.',
      });
    } finally {
      setRescanningId(null);
    }
  };

  const filteredHistory = scansHistory.filter((s) => {
    const matchSearch =
      !historySearch ||
      s.targetProject.toLowerCase().includes(historySearch.toLowerCase()) ||
      s.id.toLowerCase().includes(historySearch.toLowerCase());
    const matchStatus = historyStatusFilter === 'All'
      || s.status === historyStatusFilter
      || (historyStatusFilter === 'running' && s.status === 'analyzing');
    return matchSearch && matchStatus;
  });

  interface ScanScheduleItem {
    id: string;
    name: string;
    project: string;
    frequency: string;
    days: string;
    nextRun: string;
    lastRun: string;
    enabled: boolean;
  }

  const SCHEDULES_STORAGE_KEY = 'squad1_sbom_schedules';

  const [schedulesList, setSchedulesList] = useState<ScanScheduleItem[]>(() => {
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
      localStorage.setItem(SCHEDULES_STORAGE_KEY, JSON.stringify(schedulesList));
    } catch (e) {
      console.error('Failed to persist schedules', e);
    }
  }, [schedulesList]);

  const [createScheduleModalOpen, setCreateScheduleModalOpen] = useState(false);
  const [newSchedName, setNewSchedName] = useState('');
  const [newSchedProject, setNewSchedProject] = useState('Payments API');
  const [newSchedFreq, setNewSchedFreq] = useState('Daily');
  const [newSchedDate, setNewSchedDate] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return d.toISOString().split('T')[0];
  });
  const [newSchedTime, setNewSchedTime] = useState<string>('02:00');
  const [newSchedTimezone, setNewSchedTimezone] = useState<string>('UTC');

  const handleCreateSchedule = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSchedName.trim()) return;

    const formattedNextRun = `${newSchedDate}, ${newSchedTime} ${newSchedTimezone}`;
    const formattedFrequency = `${newSchedFreq} @ ${newSchedTime} ${newSchedTimezone}`;

    const newSched = {
      id: `sched-${Date.now()}`,
      name: newSchedName,
      project: newSchedProject,
      frequency: formattedFrequency,
      days: newSchedFreq === 'Daily' ? 'Daily' : newSchedFreq.startsWith('Weekly') ? 'Weekly' : newSchedFreq.startsWith('Monthly') ? 'Monthly' : 'One-time',
      nextRun: formattedNextRun,
      lastRun: 'Never',
      enabled: true,
    };

    setSchedulesList((prev) => [newSched, ...prev]);
    setCreateScheduleModalOpen(false);
    setNewSchedName('');
    addToast({
      type: 'success',
      title: 'Schedule Created',
      message: `Automated scan schedule configured for ${formattedNextRun}.`,
    });
  };

  const toggleSchedule = (id: string) => {
    setSchedulesList((prev) =>
      prev.map((s) => (s.id === id ? { ...s, enabled: !s.enabled } : s))
    );
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-16 animate-fadeIn">
      {/* ========================================================================= */}
      {/* 0. COMPONENTS TABLE SUB-PAGE (DEFAULT VIEW FOR SECURITY SCANS)            */}
      {/* ========================================================================= */}
      {activeTab === 'table' && (
        <div className="space-y-6">
          {/* Search & Action Bar */}
          <div className="bg-white dark:bg-[#111827] border border-gray-200 dark:border-gray-800 rounded-xl p-4 shadow-2xs space-y-3">
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
              {/* Left: Search Input & Filter Toggle */}
              <div className="flex items-center gap-2 flex-1 max-w-xl">
                <div className="relative flex-1">
                  <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    value={scanSearch}
                    onChange={(e) => setScanSearch(e.target.value)}
                    placeholder="Search by project name, application, scan type, status, or requester..."
                    className="w-full pl-9 pr-4 py-2 text-xs bg-gray-50/70 dark:bg-gray-800/80 border border-gray-200 dark:border-gray-700 rounded-lg text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 hover:border-blue-300 dark:hover:border-blue-700 transition-colors shadow-2xs"
                  />
                </div>

                {/* Filter Toggle Button */}
                <button
                  type="button"
                  onClick={() => setShowScanFilters((prev) => !prev)}
                  className={`px-3 py-2 text-xs font-semibold rounded-lg border transition-all flex items-center gap-1.5 cursor-pointer shadow-2xs shrink-0 ${showScanFilters || scanStatusFilter !== 'All' || scanTypeFilter !== 'All'
                    ? 'bg-blue-50 dark:bg-blue-950/60 border-blue-400 dark:border-blue-600 text-blue-600 dark:text-blue-400'
                    : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:border-blue-300 dark:hover:border-blue-700 hover:text-blue-600'
                    }`}
                  title="Toggle Filters"
                >
                  <Filter className="w-3.5 h-3.5" />
                  <span>Filters</span>
                  {(scanStatusFilter !== 'All' || scanTypeFilter !== 'All') && (
                    <span className="w-2 h-2 rounded-full bg-blue-600 shrink-0" />
                  )}
                </button>
              </div>

              {/* Right: ONLY ONE BUTTON: Launch Scan (No components count pill!) */}
              <div className="flex items-center gap-2 shrink-0 flex-wrap justify-end">
                <button
                  onClick={() => setTab('new')}
                  className="px-3.5 py-2 text-xs font-bold text-white bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 rounded-lg flex items-center gap-1.5 shadow-sm shadow-blue-500/20 cursor-pointer transition-all whitespace-nowrap"
                  title="Launch Security Scan"
                >
                  <Play className="w-3.5 h-3.5 shrink-0 fill-white" />
                  <span>Launch Scan</span>
                </button>
              </div>
            </div>

            {/* Filter Dropdowns revealed upon clicking Filter icon */}
            {showScanFilters && (
              <div className="p-3 bg-gray-50/90 dark:bg-gray-800/60 border border-gray-200/80 dark:border-gray-700/80 rounded-lg flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-fadeIn">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[11px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mr-1">
                    Filter by:
                  </span>

                  <select
                    value={scanStatusFilter}
                    onChange={(e) => setScanStatusFilter(e.target.value)}
                    className="text-xs px-2.5 py-1.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-gray-700 dark:text-gray-300 cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 shadow-2xs hover:border-blue-300 transition-colors"
                  >
                    <option value="All">All Statuses</option>
                    <option value="completed">Completed</option>
                    <option value="running">Running</option>
                    <option value="queued">Queued</option>
                    <option value="failed">Failed</option>
                    <option value="cancelled">Cancelled</option>
                  </select>

                  <select
                    value={scanTypeFilter}
                    onChange={(e) => setScanTypeFilter(e.target.value)}
                    className="text-xs px-2.5 py-1.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-gray-700 dark:text-gray-300 cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 shadow-2xs hover:border-blue-300 transition-colors"
                  >
                    <option value="All">All Scan Types</option>
                    <option value="Local Source">Local Source</option>
                    <option value="Remote Git">Remote Git</option>
                    <option value="Bulk Scan">Bulk Scan</option>
                  </select>

                  <button
                    onClick={handleResetScanFilters}
                    className="px-2.5 py-1.5 text-xs font-semibold text-gray-600 hover:text-red-600 dark:text-gray-300 dark:hover:text-red-400 bg-white dark:bg-gray-800 hover:bg-red-50 dark:hover:bg-red-950/40 border border-gray-200 dark:border-gray-700 rounded-lg flex items-center gap-1.5 cursor-pointer transition-colors shadow-2xs ml-1"
                    title="Reset Filters"
                  >
                    <RotateCcw className="w-3 h-3 text-gray-400" />
                    <span>Reset</span>
                  </button>
                </div>
              </div>
            )}

            {/* Table View */}
            <div className="overflow-x-auto rounded-lg border border-gray-100 dark:border-gray-800">
              <table className="w-full text-left text-xs min-w-[900px]">
                <thead>
                  <tr className="bg-slate-50/90 dark:bg-slate-800/70 text-slate-600 dark:text-slate-300 border-b border-slate-200/80 dark:border-slate-700/80">
                    <th className="py-2.5 pl-4 pr-3 font-bold uppercase tracking-wider text-[11px] whitespace-nowrap">PROJECT NAME</th>
                    <th className="py-2.5 px-3 font-bold uppercase tracking-wider text-[11px] whitespace-nowrap">APPLICATION NAME</th>
                    <th className="py-2.5 px-3 font-bold uppercase tracking-wider text-[11px] whitespace-nowrap">SCAN DATE</th>
                    <th className="py-2.5 px-3 font-bold uppercase tracking-wider text-[11px] whitespace-nowrap">SCAN STATUS</th>
                    <th className="py-2.5 px-3 font-bold uppercase tracking-wider text-[11px] whitespace-nowrap">SCAN TYPE</th>
                    <th className="py-2.5 px-3 font-bold uppercase tracking-wider text-[11px] whitespace-nowrap">SCAN REQUESTED BY</th>
                    <th className="py-2.5 pr-4 pl-3 font-bold uppercase tracking-wider text-[11px] text-right whitespace-nowrap">ACTIONS</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                  {filteredScans.length > 0 ? (
                    filteredScans.map((s) => (
                      <tr key={s.id} className="hover:bg-blue-50/40 dark:hover:bg-blue-950/20 transition-colors">
                        {/* PROJECT NAME */}
                        <td className="py-3 pl-4 pr-3 whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            <FolderGit2 className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                            <span
                              onClick={() => setSelectedScanId(s.id)}
                              className="font-bold text-gray-900 dark:text-white hover:text-blue-600 dark:hover:text-blue-400 cursor-pointer"
                            >
                              {s.targetProject}
                            </span>
                          </div>
                        </td>

                        {/* APPLICATION NAME */}
                        <td className="py-3 px-3 whitespace-nowrap">
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 font-mono">
                            {s.appService || '—'}
                          </span>
                        </td>

                        {/* SCAN DATE */}
                        <td className="py-3 px-3 text-gray-600 dark:text-gray-400 font-mono text-[11px] whitespace-nowrap">
                          {s.timestamp}
                        </td>

                        {/* SCAN STATUS */}
                        <td className="py-3 px-3 whitespace-nowrap">
                          <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${s.status === 'completed'
                            ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60'
                            : s.status === 'running' || s.status === 'analyzing'
                              ? 'bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800/60 animate-pulse'
                              : s.status === 'failed'
                                ? 'bg-red-50 dark:bg-red-950/60 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800/60'
                                : s.status === 'cancelled'
                                  ? 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700'
                                  : 'bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800/60'
                            }`}>
                            {s.status === 'running' || s.status === 'analyzing' ? (
                              <span className="w-1.5 h-1.5 rounded-full bg-blue-600 animate-ping" />
                            ) : s.status === 'completed' ? (
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-600" />
                            ) : s.status === 'cancelled' ? (
                              <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
                            ) : s.status === 'failed' ? (
                              <span className="w-1.5 h-1.5 rounded-full bg-red-600" />
                            ) : (
                              <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                            )}
                            {displayStatus(s.status)}
                            {(s.status === 'running' || s.status === 'analyzing') && ` ${s.progress}%`}
                          </span>
                        </td>

                        {/* SCAN TYPE */}
                        <td className="py-3 px-3 whitespace-nowrap">
                          <span className="px-2 py-0.5 rounded text-[11px] font-medium bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-700">
                            {s.scanType}
                          </span>
                        </td>

                        {/* SCAN REQUESTED BY */}
                        <td className="py-3 px-3 whitespace-nowrap">
                          <div className="flex items-center gap-1.5">
                            <div className="w-5 h-5 rounded-full bg-blue-100 dark:bg-blue-900/60 text-blue-700 dark:text-blue-300 flex items-center justify-center text-[10px] font-bold shrink-0">
                              <User className="w-3 h-3" />
                            </div>
                            <span className="text-gray-700 dark:text-gray-300 font-medium text-xs">
                              {(s as any).requestedBy || 'SecOps Admin'}
                            </span>
                          </div>
                        </td>

                        {/* ACTIONS */}
                        <td className="py-3 pr-4 pl-3 text-right whitespace-nowrap">
                          <div className="inline-flex items-center justify-end gap-1.5">
                            {canCancel(s.status) && (
                              <button
                                type="button"
                                disabled={cancellingId === s.id}
                                onClick={() => handleCancel(s)}
                                title="Stop this scan"
                                className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 hover:border-rose-300 hover:text-rose-700 dark:hover:text-rose-300 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                              >
                                <Ban className="w-3 h-3" />
                                {cancellingId === s.id ? 'Stopping' : 'Cancel'}
                              </button>
                            )}
                            {canRescan(s.status) && (
                              <button
                                type="button"
                                disabled={rescanningId === s.id}
                                onClick={() => handleRescan(s)}
                                title="Run this scan again with the same source"
                                className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 hover:border-blue-400 hover:text-blue-700 dark:hover:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-950/40 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                              >
                                <RotateCcw className={`w-3 h-3 ${rescanningId === s.id ? 'animate-spin' : ''}`} />
                                {rescanningId === s.id ? 'Queuing' : 'Rescan'}
                              </button>
                            )}
                            <ScanActionMenu
                              scan={s}
                              onViewDetails={(scan) => setSelectedScanId(scan.id)}
                              onExport={(format, scanId) => exportSBOM(format, scanId)}
                              canCancel={canCancel(s.status)}
                              canRescan={canRescan(s.status)}
                              cancelling={cancellingId === s.id}
                              rescanning={rescanningId === s.id}
                              onCancel={handleCancel}
                              onRescan={handleRescan}
                            />
                          </div>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={7} className="py-8 px-4 text-center">
                        <div className="flex flex-col items-center justify-center space-y-2">
                          <div className="w-10 h-10 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-400 flex items-center justify-center shadow-2xs">
                            <Search className="w-5 h-5" />
                          </div>
                          <div className="max-w-md mx-auto">
                            <h4 className="text-sm font-bold text-gray-900 dark:text-white">
                              No security scans available yet.
                            </h4>
                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 leading-relaxed">
                              No scan records found. Real security scans will appear once analysis is launched.
                            </p>
                          </div>
                          {(scanSearch || scanStatusFilter !== 'All' || scanTypeFilter !== 'All') && (
                            <button
                              onClick={handleResetScanFilters}
                              className="mt-1 px-3.5 py-1.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-750 text-xs font-semibold rounded-lg shadow-2xs cursor-pointer inline-flex items-center gap-1.5"
                            >
                              Clear Filters
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 1. NEW SCAN SUB-PAGE                                                      */}
      {/* ========================================================================= */}
      {activeTab === 'new' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between pb-1">
            <button
              type="button"
              onClick={() => setTab('table')}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 cursor-pointer transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back to Security Scans</span>
            </button>
          </div>
          {newScanStep === 'input' ? (
            <form onSubmit={handleProceedToReview} className="space-y-6">
              {/* SECTION 1: Project Information. Required for local and Git; optional for bulk, which reads these from the file. */}
              <div className="bg-white dark:bg-[#111827] border border-gray-200 dark:border-gray-800 rounded-xl p-5 shadow-2xs space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-gray-100 dark:border-gray-800">
                  <div className="flex items-center gap-2">
                    <h2 className="text-sm font-bold text-gray-900 dark:text-white">
                      1. Project Information
                    </h2>
                    {/* Hover Info Tooltip (Excel Sr 9) */}
                    <div className="relative">
                      <button
                        type="button"
                        onMouseEnter={() => setActiveTooltip('project-info')}
                        onMouseLeave={() => setActiveTooltip(null)}
                        className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 p-0.5"
                      >
                        <Info className="w-3.5 h-3.5" />
                      </button>
                      {activeTooltip === 'project-info' && (
                        <div className="absolute left-5 top-0 z-50 w-64 p-2 bg-gray-900 text-white text-[11px] rounded-lg shadow-xl border border-gray-700 pointer-events-none">
                          Tell us what you are scanning and provide project identifiers used across compliance audits and SBOM reports.
                        </div>
                      )}
                    </div>
                  </div>
                  <p className="text-[11px] text-gray-400">
                    {sourceType === 'bulk' ? 'Optional for bulk — each row supplies these' : '* Required fields'}
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                      PROJECT NAME {sourceType !== 'bulk' && <span className="text-red-500">*</span>}
                    </label>
                    <input
                      type="text"
                      required={sourceType !== 'bulk'}
                      value={projectName}
                      onChange={(e) => setProjectName(e.target.value)}
                      placeholder="e.g. Payments API"
                      className="w-full text-xs px-3 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-gray-900 dark:text-white focus:ring-1 focus:ring-blue-500"
                    />
                    <p className="text-[10px] text-gray-400 mt-1">A short, descriptive name for your project.</p>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                      APPLICATION / SERVICE {sourceType !== 'bulk' && <span className="text-red-500">*</span>}
                    </label>
                    <input
                      type="text"
                      required={sourceType !== 'bulk'}
                      value={appService}
                      onChange={(e) => setAppService(e.target.value)}
                      placeholder="e.g. payments-api"
                      className="w-full text-xs px-3 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-gray-900 dark:text-white focus:ring-1 focus:ring-blue-500"
                    />
                    <p className="text-[10px] text-gray-400 mt-1">The application or service name.</p>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                      RELEASE / VERSION
                    </label>
                    <input
                      type="text"
                      value={releaseVersion}
                      onChange={(e) => setReleaseVersion(e.target.value)}
                      placeholder="e.g. v3.2.0"
                      className="w-full text-xs px-3 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-gray-900 dark:text-white focus:ring-1 focus:ring-blue-500"
                    />
                    <p className="text-[10px] text-gray-400 mt-1">Application version or release tag.</p>
                  </div>
                </div>
              </div>

              {/* SECTION 2: Choose Scan Source */}
              <div className="bg-white dark:bg-[#111827] border border-gray-200 dark:border-gray-800 rounded-xl p-5 shadow-2xs space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-gray-100 dark:border-gray-800">
                  <div className="flex items-center gap-2">
                    <h2 className="text-sm font-bold text-gray-900 dark:text-white">
                      2. Choose Scan Source
                    </h2>
                    {/* Hover Info Tooltip (Excel Sr 9) */}
                    <div className="relative">
                      <button
                        type="button"
                        onMouseEnter={() => setActiveTooltip('source-info')}
                        onMouseLeave={() => setActiveTooltip(null)}
                        className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 p-0.5"
                      >
                        <Info className="w-3.5 h-3.5" />
                      </button>
                      {activeTooltip === 'source-info' && (
                        <div className="absolute left-5 top-0 z-50 w-64 p-2 bg-gray-900 text-white text-[11px] rounded-lg shadow-xl border border-gray-700 pointer-events-none">
                          Select where your source code or project manifests are located: local directories, remote GitHub repositories, or bulk batch scan.
                        </div>
                      )}
                    </div>
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Select where your source code or SBOM is located.
                  </p>
                </div>

                {/* 3 Scan Source Cards */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* Card 1: Local Source Directory */}
                  <div
                    onClick={() => setSourceType('local')}
                    className={`relative rounded-xl p-4 border transition-all cursor-pointer flex flex-col justify-between ${sourceType === 'local'
                      ? 'border-sky-500 bg-sky-50/30 dark:bg-sky-950/20 shadow-xs ring-1 ring-sky-500/30'
                      : 'border-gray-200 dark:border-gray-800 hover:border-gray-300'
                      }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="w-9 h-9 rounded-lg bg-sky-50 dark:bg-sky-950/60 text-sky-600 flex items-center justify-center">
                        <Folder className="w-5 h-5" />
                      </div>
                      <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${sourceType === 'local' ? 'border-sky-600' : 'border-gray-300'}`}>
                        {sourceType === 'local' && <div className="w-2 h-2 rounded-full bg-sky-600" />}
                      </div>
                    </div>
                    <div className="mt-3">
                      <h3 className="text-xs font-bold text-gray-900 dark:text-white uppercase tracking-wider">
                        LOCAL SOURCE DIRECTORY
                      </h3>
                      <p className="text-xs font-semibold text-gray-800 dark:text-gray-200 mt-1">
                        Upload your application source
                      </p>
                      <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">
                        Scan a project directory from your local machine.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSourceType('local');
                        openFolderPicker();
                      }}
                      className="mt-4 w-full py-1.5 px-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold cursor-pointer shadow-2xs"
                    >
                      Choose Folder
                    </button>
                  </div>

                  {/* Card 2: Remote Git Repository (GitHub icon & text only, Excel Sr 3 & Sr 4) */}
                  <div
                    onClick={() => setSourceType('git')}
                    className={`relative rounded-xl p-4 border transition-all cursor-pointer flex flex-col justify-between ${sourceType === 'git'
                      ? 'border-sky-500 bg-sky-50/30 dark:bg-sky-950/20 shadow-xs ring-1 ring-sky-500/30'
                      : 'border-gray-200 dark:border-gray-800 hover:border-gray-300'
                      }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="w-9 h-9 rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white flex items-center justify-center">
                        <Github className="w-5 h-5" />
                      </div>
                      <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${sourceType === 'git' ? 'border-sky-600' : 'border-gray-300'}`}>
                        {sourceType === 'git' && <div className="w-2 h-2 rounded-full bg-sky-600" />}
                      </div>
                    </div>
                    <div className="mt-3">
                      <h3 className="text-xs font-bold text-gray-900 dark:text-white uppercase tracking-wider">
                        REMOTE GIT REPOSITORY
                      </h3>
                      <p className="text-xs font-semibold text-gray-800 dark:text-gray-200 mt-1">
                        Connect remote Git provider
                      </p>
                      <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">
                        Scan from GitHub repository URL or webhook branch.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSourceType('git');
                      }}
                      className="mt-4 w-full py-1.5 px-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold cursor-pointer shadow-2xs"
                    >
                      Configure Git
                    </button>
                  </div>

                  {/* Card 3: Bulk Spreadsheet Orchestration */}
                  <div
                    onClick={() => setSourceType('bulk')}
                    className={`relative rounded-xl p-4 border transition-all cursor-pointer flex flex-col justify-between ${sourceType === 'bulk'
                      ? 'border-sky-500 bg-sky-50/30 dark:bg-sky-950/20 shadow-xs ring-1 ring-sky-500/30'
                      : 'border-gray-200 dark:border-gray-800 hover:border-gray-300'
                      }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="w-9 h-9 rounded-lg bg-sky-50 dark:bg-sky-950/60 text-sky-600 flex items-center justify-center">
                        <FileSpreadsheet className="w-5 h-5" />
                      </div>
                      <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${sourceType === 'bulk' ? 'border-sky-600' : 'border-gray-300'}`}>
                        {sourceType === 'bulk' && <div className="w-2 h-2 rounded-full bg-sky-600" />}
                      </div>
                    </div>
                    <div className="mt-3">
                      <h3 className="text-xs font-bold text-gray-900 dark:text-white uppercase tracking-wider">
                        BULK SPREADSHEET
                      </h3>
                      <p className="text-xs font-semibold text-gray-800 dark:text-gray-200 mt-1">
                        Multi-project batch scan
                      </p>
                      <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">
                        Upload CSV / XLSX inventory matrix to scan all apps.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSourceType('bulk');
                        bulkFileInputRef.current?.click();
                      }}
                      className="mt-4 w-full py-1.5 px-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold cursor-pointer shadow-2xs"
                    >
                      Choose File
                    </button>
                  </div>
                </div>

                {/* Source Configuration Detail Panel */}
                <div className="pt-2">
                  {sourceType === 'local' && (
                    <div className="bg-gray-50/70 dark:bg-gray-800/40 border border-gray-200 dark:border-gray-700 rounded-xl p-4 space-y-4">
                      <div
                        onDragOver={(e) => e.preventDefault()}
                        onDrop={(e) => {
                          e.preventDefault();
                          void acceptLocalDrop(e.dataTransfer);
                        }}
                        className="w-full border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-xl p-8 text-center bg-white dark:bg-gray-800/60 hover:border-blue-400 transition-colors"
                      >
                        <Folder className="w-8 h-8 text-blue-500 mx-auto mb-2" />
                        <p className="text-xs font-bold text-gray-900 dark:text-white">
                          Upload one manifest file, or a whole project folder
                        </p>
                        <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-1 max-w-xl mx-auto">
                          Folder mode scans every supported dependency file in the tree (mixed ecosystems in one folder are fine). File mode accepts a single manifest or a .zip archive.
                        </p>
                        <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-1 max-w-xl mx-auto">
                          {SUPPORTED_MANIFEST_HINT}
                        </p>
                        <div className="mt-3 flex items-center justify-center gap-2">
                          <button
                            type="button"
                            onClick={() => openFolderPicker()}
                            className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold cursor-pointer"
                          >
                            Choose folder
                          </button>
                          <button
                            type="button"
                            onClick={() => openFilePicker()}
                            className="px-3 py-1.5 bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-100 border border-gray-200 dark:border-gray-600 rounded-lg text-xs font-semibold cursor-pointer"
                          >
                            Choose file
                          </button>
                        </div>
                        <input
                          ref={folderInputRef}
                          type="file"
                          className="hidden"
                          multiple
                          onChange={(e) => {
                            const items = Array.from(e.target.files || []).map((file) => ({
                              file,
                              relativePath: file.webkitRelativePath || file.name,
                            }));
                            useFolderManifests(items);
                            e.target.value = '';
                          }}
                        />
                        <input
                          ref={fileInputRef}
                          type="file"
                          className="hidden"
                          onChange={(e) => {
                            const picked = Array.from(e.target.files || []);
                            e.target.value = '';
                            if (picked.length === 0) return;
                            if (picked.length === 1 && isArchiveName(picked[0].name)) {
                              setLocalFolder([]);
                              setLocalFile(picked[0]);
                              setSelectedFolder(picked[0].name);
                              return;
                            }
                            const manifests = picked.filter((file) => isManifestRelativePath(file.name));
                            if (manifests.length === 0) {
                              addToast({
                                type: 'warning',
                                title: 'Unsupported file',
                                message: `Choose a supported manifest or archive: ${SUPPORTED_MANIFEST_HINT}.`,
                              });
                              return;
                            }
                            if (manifests.length === 1) {
                              setLocalFolder([]);
                              setLocalFile(manifests[0]);
                              setSelectedFolder(manifests[0].name);
                              return;
                            }
                            const items = manifests.map((file) => ({ file, relativePath: file.name }));
                            setLocalFile(null);
                            setLocalFolder(items);
                            setSelectedFolder(folderLabel(items));
                          }}
                        />
                        {selectedFolder && (
                          <p className="text-[11px] text-gray-600 dark:text-gray-300 mt-2 font-mono">{selectedFolder}</p>
                        )}
                      </div>

                      <div className="flex items-center gap-2 p-2.5 bg-blue-50 dark:bg-blue-950/40 border border-blue-100 dark:border-blue-900/40 rounded-lg text-xs text-blue-800 dark:text-blue-300">
                        <Info className="w-4 h-4 shrink-0 text-blue-600" />
                        <span>
                          Your source is analyzed to discover dependencies and generate the SBOM. Source code is not displayed in the dashboard.
                        </span>
                      </div>
                    </div>
                  )}

                  {sourceType === 'git' && (
                    <div className="bg-gray-50/70 dark:bg-gray-800/40 border border-gray-200 dark:border-gray-700 rounded-xl p-4 space-y-3">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                            GITHUB REPOSITORY URL
                          </label>
                          <input
                            type="url"
                            value={gitUrl}
                            onChange={(e) => setGitUrl(e.target.value)}
                            placeholder="https://github.com/organization/payments-api"
                            className="w-full text-xs px-3 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-gray-900 dark:text-white"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                            BRANCH OR COMMIT TAG
                          </label>
                          <input
                            type="text"
                            value={gitBranch}
                            onChange={(e) => setGitBranch(e.target.value)}
                            placeholder="main"
                            className="w-full text-xs px-3 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-gray-900 dark:text-white"
                          />
                        </div>
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                          GITHUB PERSONAL ACCESS TOKEN <span className="text-gray-400 font-normal">(Required for private repos)</span>
                        </label>
                        <input
                          type="password"
                          value={gitToken}
                          onChange={(e) => setGitToken(e.target.value)}
                          placeholder="ghp_xxxxxxxxxxxxxxxxxxxx"
                          className="w-full text-xs px-3 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-gray-900 dark:text-white"
                        />
                      </div>
                    </div>
                  )}

                  {sourceType === 'bulk' && (
                    <div className="bg-gray-50/70 dark:bg-gray-800/40 border border-gray-200 dark:border-gray-700 rounded-xl p-4 space-y-4">
                      {/* Header bar with mode switcher and template download */}
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-3 border-b border-gray-200 dark:border-gray-700">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-gray-900 dark:text-white uppercase tracking-wider">
                            Batch Inventory Matrix
                          </span>
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-sky-50 dark:bg-sky-950/60 text-sky-700 dark:text-sky-300 border border-sky-200 dark:border-sky-800">
                            .CSV / .XLSX
                          </span>
                        </div>

                        <div className="flex items-center gap-2 flex-wrap">
                          <button
                            type="button"
                            onClick={handleDownloadSampleCsv}
                            className="px-2.5 py-1 text-xs font-semibold text-blue-600 hover:text-blue-700 dark:text-blue-400 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-750 flex items-center gap-1.5 shadow-2xs cursor-pointer transition-colors"
                          >
                            <Download className="w-3.5 h-3.5" />
                            Download Template (.CSV)
                          </button>

                          <div className="flex items-center bg-gray-200 dark:bg-gray-700 p-0.5 rounded-lg text-[11px]">
                            <button
                              type="button"
                              onClick={() => setBulkMode('file')}
                              className={`px-2.5 py-0.5 rounded font-medium cursor-pointer transition-colors ${bulkMode === 'file'
                                ? 'bg-white dark:bg-gray-800 text-blue-600 dark:text-blue-400 shadow-2xs font-bold'
                                : 'text-gray-600 dark:text-gray-300 hover:text-gray-900'
                                }`}
                            >
                              Spreadsheet File
                            </button>
                            <button
                              type="button"
                              onClick={() => setBulkMode('manual')}
                              className={`px-2.5 py-0.5 rounded font-medium cursor-pointer transition-colors ${bulkMode === 'manual'
                                ? 'bg-white dark:bg-gray-800 text-blue-600 dark:text-blue-400 shadow-2xs font-bold'
                                : 'text-gray-600 dark:text-gray-300 hover:text-gray-900'
                                }`}
                            >
                              Manual List
                            </button>
                          </div>
                        </div>
                      </div>

                      {bulkMode === 'file' ? (
                        <div className="space-y-4">
                          {/* Dropzone & Upload Button */}
                          <div
                            onClick={() => bulkFileInputRef.current?.click()}
                            className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-xl p-5 text-center bg-white dark:bg-gray-800/60 hover:border-blue-400 dark:hover:border-blue-500 transition-colors cursor-pointer group"
                          >
                            <div className="w-12 h-12 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 flex items-center justify-center mx-auto mb-2 group-hover:scale-105 transition-transform">
                              <FileSpreadsheet className="w-6 h-6" />
                            </div>
                            <p className="text-xs font-bold text-gray-900 dark:text-white">
                              Upload Bulk Inventory Spreadsheet (.CSV, .XLSX, .XLS)
                            </p>
                            <p className="text-xs text-blue-600 font-semibold hover:underline mt-0.5">
                              Drag and drop file here, or browse files
                            </p>
                            <p className="text-[10px] text-gray-400 mt-1.5">
                              Required columns: project_name, application_name, version, repository_url
                            </p>
                            <p className="text-[10px] text-gray-400 mt-1">
                              The same GitHub repository and branch is one project. The first row is scanned. Later copies and invalid rows are skipped, and the rest of the file still runs.
                            </p>
                            <input
                              ref={bulkFileInputRef}
                              type="file"
                              accept=".csv,.xlsx,.xls,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
                              className="hidden"
                              onChange={handleBulkFileUpload}
                            />
                          </div>

                          {/* Selected File Card & Verification Status */}
                          <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs">
                            <div className="flex items-center gap-3">
                              <div className="w-9 h-9 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 border border-emerald-200 dark:border-emerald-800/50 flex items-center justify-center shrink-0">
                                <FileSpreadsheet className="w-5 h-5" />
                              </div>
                              <div>
                                <div className="flex items-center gap-2">
                                  <span className="text-xs font-bold text-gray-900 dark:text-white font-mono">
                                    {bulkFile.name}
                                  </span>
                                  <span className={`px-1.5 py-0.2 rounded text-[10px] font-bold ${bulkFileError || bulkProjects.some((row) => row.rowStatus && row.rowStatus !== 'ready')
                                    ? 'bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300'
                                    : 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300'
                                    }`}>
                                    {bulkFileError ? 'Invalid file' : bulkProjects.some((row) => row.rowStatus && row.rowStatus !== 'ready') ? 'Needs review' : 'Verified'}
                                  </span>
                                </div>
                                <span className="text-[11px] text-gray-500">
                                  {bulkFile.size} • {bulkProjects.length} Microservices Detected • {bulkFile.uploadedAt}
                                </span>
                              </div>
                            </div>

                            <div className="flex items-center gap-2 self-end sm:self-center">
                              <button
                                type="button"
                                onClick={() => bulkFileInputRef.current?.click()}
                                className="px-2.5 py-1 text-xs font-semibold text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-gray-750 hover:bg-gray-100 dark:hover:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg cursor-pointer transition-colors"
                              >
                                Replace File
                              </button>
                            </div>
                          </div>

                          {/* Parsed Projects Matrix Table Preview */}
                          <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden shadow-2xs">
                            <div className="px-3.5 py-2.5 bg-gray-50/80 dark:bg-gray-750/50 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
                              <span className="text-xs font-bold text-gray-800 dark:text-gray-200">
                                Parsed Projects Matrix ({bulkProjects.length})
                              </span>
                              <span className="text-[11px] text-gray-400">
                                {bulkProjects.filter((row) => !row.rowStatus || row.rowStatus === 'ready').length} ready
                                {' · '}
                                {bulkProjects.filter((row) => row.rowStatus === 'duplicate').length} duplicate
                                {' · '}
                                {bulkProjects.filter((row) => row.rowStatus === 'invalid').length} invalid
                              </span>
                            </div>

                            <div className="overflow-x-auto">
                              <table className="w-full text-left text-xs">
                                <thead>
                                  <tr className="border-b border-gray-200 dark:border-gray-700 text-gray-500 text-[11px] uppercase tracking-wider bg-gray-50/40 dark:bg-gray-800/40">
                                    <th className="p-2.5 pl-3.5 font-bold">#</th>
                                    <th className="p-2.5 font-bold">Project Name</th>
                                    <th className="p-2.5 font-bold">Repository / Source Path</th>
                                    <th className="p-2.5 font-bold">Branch / Tag</th>
                                    <th className="p-2.5 font-bold">Ecosystem</th>
                                    <th className="p-2.5 pr-3.5 font-bold text-right">Status</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100 dark:divide-gray-800 font-medium">
                                  {bulkProjects.map((row, index) => (
                                    <tr key={row.id} className="hover:bg-gray-50/50 dark:hover:bg-gray-750/30">
                                      <td className="p-2.5 pl-3.5 text-gray-400 font-mono text-[11px]">{row.rowNumber || index + 1}</td>
                                      <td className="p-2.5 font-bold text-gray-900 dark:text-white">{row.project}</td>
                                      <td className="p-2.5 font-mono text-[11px] text-gray-600 dark:text-gray-300 truncate max-w-[220px]" title={row.rowMessage || row.source}>
                                        {row.source}
                                      </td>
                                      <td className="p-2.5 font-mono text-[11px] text-gray-500">{row.branch}</td>
                                      <td className="p-2.5">
                                        <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300">
                                          {row.ecosystem}
                                        </span>
                                      </td>
                                      <td className="p-2.5 pr-3.5 text-right">
                                        {row.rowStatus === 'duplicate' ? (
                                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-600 dark:text-amber-400" title={row.rowMessage}>
                                            <AlertTriangle className="w-3.5 h-3.5" />
                                            Duplicate
                                          </span>
                                        ) : row.rowStatus === 'invalid' ? (
                                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-red-600 dark:text-red-400" title={row.rowMessage}>
                                            <AlertTriangle className="w-3.5 h-3.5" />
                                            Invalid
                                          </span>
                                        ) : (
                                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400" title={row.rowMessage}>
                                            <CheckCircle2 className="w-3.5 h-3.5" />
                                            Ready
                                          </span>
                                        )}
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        </div>
                      ) : (
                        /* Manual Textarea Fallback */
                        <div className="space-y-2">
                          <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300">
                            REPOSITORIES OR DIRECTORIES TO BATCH SCAN (One per line)
                          </label>
                          <textarea
                            rows={4}
                            value={bulkScanList}
                            onChange={(e) => setBulkScanList(e.target.value)}
                            className="w-full text-xs px-3 py-2 font-mono bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-gray-900 dark:text-white focus:ring-1 focus:ring-blue-500 resize-none"
                            placeholder="https://github.com/expressjs/express&#10;https://github.com/pallets/flask"
                          />
                          <p className="text-[11px] text-gray-500">
                            Enter Git repository URLs or absolute local folder paths separated by new lines.
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* SECTION 3: Scan Configuration (Combined on same page as per Excel Sr 5) */}
              <div className="bg-white dark:bg-[#111827] border border-gray-200 dark:border-gray-800 rounded-xl p-5 shadow-2xs space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-gray-100 dark:border-gray-800">
                  <div className="flex items-center gap-2">
                    <h2 className="text-sm font-bold text-gray-900 dark:text-white">
                      3. Scan Configuration & Output
                    </h2>
                    {/* Hover Info Tooltip (Excel Sr 9) */}
                    <div className="relative">
                      <button
                        type="button"
                        onMouseEnter={() => setActiveTooltip('config-info')}
                        onMouseLeave={() => setActiveTooltip(null)}
                        className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 p-0.5"
                      >
                        <Info className="w-3.5 h-3.5" />
                      </button>
                      {activeTooltip === 'config-info' && (
                        <div className="absolute left-5 top-0 z-50 w-64 p-2 bg-gray-900 text-white text-[11px] rounded-lg shadow-xl border border-gray-700 pointer-events-none">
                          Choose primary output specifications (SPDX or CycloneDX) and security enrichment modules.
                        </div>
                      )}
                    </div>
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    SBOM specifications and security checks
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="border border-gray-200 dark:border-gray-700 rounded-xl p-4 bg-gray-50/50 dark:bg-gray-800/30">
                    <p className="text-xs font-bold text-gray-900 dark:text-white mb-2">
                      Primary SBOM Specification
                    </p>
                    <div className="space-y-2">
                      <label className="flex items-center gap-2 text-xs text-gray-700 dark:text-gray-300 cursor-pointer">
                        <input
                          type="radio"
                          name="sbomFormat"
                          checked={sbomFormat === 'SPDX-2.3'}
                          onChange={() => setSbomFormat('SPDX-2.3')}
                          className="text-blue-600 focus:ring-blue-500"
                        />
                        <span className="font-semibold">SPDX 2.3 (ISO/IEC 5962:2021)</span>
                      </label>
                      <label className="flex items-center gap-2 text-xs text-gray-700 dark:text-gray-300 cursor-pointer">
                        <input
                          type="radio"
                          name="sbomFormat"
                          checked={sbomFormat === 'CycloneDX-1.5'}
                          onChange={() => setSbomFormat('CycloneDX-1.5')}
                          className="text-blue-600 focus:ring-blue-500"
                        />
                        <span className="font-semibold">CycloneDX 1.5 (OWASP Flagship)</span>
                      </label>
                    </div>
                  </div>

                  <div className="border border-gray-200 dark:border-gray-700 rounded-xl p-4 bg-gray-50/50 dark:bg-gray-800/30">
                    <p className="text-xs font-bold text-gray-900 dark:text-white mb-2">
                      Security Analysis Modules
                    </p>
                    <div className="grid grid-cols-2 gap-2 text-xs text-gray-700 dark:text-gray-300">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={vulnScan}
                          onChange={(e) => setVulnScan(e.target.checked)}
                          className="rounded text-blue-600 focus:ring-blue-500"
                        />
                        <span>Vulnerability Telemetry</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={licenseCheck}
                          onChange={(e) => setLicenseCheck(e.target.checked)}
                          className="rounded text-blue-600 focus:ring-blue-500"
                        />
                        <span>License Risk Detection</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={cryptoScan}
                          onChange={(e) => setCryptoScan(e.target.checked)}
                          className="rounded text-blue-600 focus:ring-blue-500"
                        />
                        <span>Crypto Assets (CBOM)</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={signArtifact}
                          onChange={(e) => setSignArtifact(e.target.checked)}
                          className="rounded text-blue-600 focus:ring-blue-500"
                        />
                        <span>NIST P-256 Signature</span>
                      </label>
                    </div>
                  </div>
                </div>
              </div>

              {/* Bottom Action Bar: Cancel and Launch Scan (Excel Sr 6) */}
              <div className="flex items-center justify-between pt-4 border-t border-gray-200 dark:border-gray-800">
                <button
                  type="button"
                  onClick={() => setTab('table')}
                  className="px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg text-xs font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 cursor-pointer"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold flex items-center gap-2 shadow-sm cursor-pointer"
                >
                  <span>Launch Scan</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </form>
          ) : (
            /* STAGE 2: REVIEW PAGE (Excel Sr 5 & Sr 8) */
            <div className="space-y-6">
              <div className="bg-white dark:bg-[#111827] border border-gray-200 dark:border-gray-800 rounded-xl p-6 shadow-2xs space-y-6">
                <div className="flex items-center justify-between pb-4 border-b border-gray-100 dark:border-gray-800">
                  <div>
                    <h2 className="text-sm font-bold text-gray-900 dark:text-white">
                      Review Scan Configuration
                    </h2>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                      Verify the parameters below before initiating SBOM generation and supply chain analysis.
                    </p>
                  </div>
                  <span className="px-2.5 py-1 bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 text-xs font-bold rounded-lg">
                    Ready to Launch
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-3">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                      Project Details
                    </h3>
                    <div className="bg-gray-50/70 dark:bg-gray-800/40 rounded-xl p-4 border border-gray-200 dark:border-gray-700 space-y-2.5 text-xs">
                      {sourceType === 'bulk' ? (
                        <>
                          <div className="flex justify-between">
                            <span className="text-gray-500">Project Name:</span>
                            <span className="font-bold text-gray-900 dark:text-white">{projectName.trim() || 'From file'}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-500">Application / Service:</span>
                            <span className="font-semibold text-gray-900 dark:text-white">{appService.trim() || 'From file'}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-500">Release Version:</span>
                            <span className="font-mono font-semibold text-gray-900 dark:text-white">{releaseVersion.trim() || 'From file'}</span>
                          </div>
                          <p className="text-gray-500 pt-2 border-t border-gray-200 dark:border-gray-700">Each ready row is its own scan. Duplicate projects and invalid rows are skipped.</p>
                          {bulkProjects.length > 0 && (
                            <div className="space-y-1.5 max-h-40 overflow-y-auto">
                              {bulkProjects.map((row) => (
                                <div key={row.id} className="flex justify-between gap-3">
                                  <span className="font-semibold text-gray-900 dark:text-white truncate">{row.project}</span>
                                  <span className={`truncate ${row.rowStatus === 'invalid' ? 'text-red-600' : row.rowStatus === 'duplicate' ? 'text-amber-600' : 'text-gray-500'}`}>
                                    {row.rowStatus === 'duplicate' ? 'Duplicate' : row.rowStatus === 'invalid' ? 'Invalid' : `${row.name} · ${row.version || 'UNKNOWN'}`}
                                  </span>
                                </div>
                              ))}
                            </div>
                          )}
                        </>
                      ) : (
                        <>
                          <div className="flex justify-between">
                            <span className="text-gray-500">Project Name:</span>
                            <span className="font-bold text-gray-900 dark:text-white">{projectName}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-500">Application / Service:</span>
                            <span className="font-semibold text-gray-900 dark:text-white">{appService}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-500">Release Version:</span>
                            <span className="font-mono font-semibold text-gray-900 dark:text-white">{releaseVersion}</span>
                          </div>
                          <div className="pt-2 border-t border-gray-200 dark:border-gray-700">
                            <span className="text-gray-500 block mb-1">Description:</span>
                            <p className="text-gray-700 dark:text-gray-300 italic">{description}</p>
                          </div>
                        </>
                      )}
                    </div>
                  </div>

                  <div className="space-y-3">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                      Scan Source & Engine
                    </h3>
                    <div className="bg-gray-50/70 dark:bg-gray-800/40 rounded-xl p-4 border border-gray-200 dark:border-gray-700 space-y-2.5 text-xs">
                      <div className="flex justify-between">
                        <span className="text-gray-500">Source Type:</span>
                        <span className="font-bold text-gray-900 dark:text-white capitalize">
                          {sourceType === 'local' ? 'Local Source Directory' : sourceType === 'git' ? 'Remote Git (GitHub)' : 'Bulk Spreadsheet Matrix'}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500">Target Location:</span>
                        <span className="font-mono text-gray-900 dark:text-white truncate max-w-[220px]">
                          {sourceType === 'local' ? selectedFolder : sourceType === 'git' ? gitUrl : `${bulkFile.name} (${bulkProjects.length} Projects)`}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500">Primary Format:</span>
                        <span className="font-bold text-blue-600 dark:text-blue-400">{sbomFormat}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500">Modules Enabled:</span>
                        <span className="text-gray-900 dark:text-white">
                          {[vulnScan && 'Vulnerabilities', licenseCheck && 'Licenses', cryptoScan && 'CBOM', signArtifact && 'Signed'].filter(Boolean).join(', ')}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800/40 rounded-xl p-4 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-emerald-100 dark:bg-emerald-900/60 text-emerald-600 flex items-center justify-center">
                      <CheckCircle2 className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="font-bold text-gray-900 dark:text-white">Scan engine initialized and ready</p>
                      <p className="text-gray-500 dark:text-gray-400 text-[11px]">
                        Estimated duration: ~18 seconds. Lockfile resolution, CVE matching and attestation will execute.
                      </p>
                    </div>
                  </div>
                  <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">~18s</span>
                </div>
              </div>

              {/* Bottom Action Bar: Back and Prominent Launch Scan (Excel Sr 8) */}
              <div className="flex items-center justify-between pt-4 border-t border-gray-200 dark:border-gray-800">
                <button
                  type="button"
                  onClick={() => setNewScanStep('input')}
                  className="px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg text-xs font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 cursor-pointer"
                >
                  ← Back to Configuration
                </button>

                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={handleFinalLaunchScan}
                  className="px-8 py-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg text-sm font-bold flex items-center gap-2 shadow-md cursor-pointer transition-colors"
                >
                  {isSubmitting ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>Dispatching Scan...</span>
                    </>
                  ) : (
                    <>
                      <Play className="w-4 h-4 fill-white" />
                      <span>Launch Scan</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* 2. LIVE JOBS SUB-PAGE (Workspace UI Spec Section 11)                      */}
      {/* ========================================================================= */}
      {activeTab === 'live' && (
        <div className="space-y-6">
          {waitingScans.length > 0 && (
            <div className="bg-white dark:bg-[#111827] border border-gray-200 dark:border-gray-800 rounded-xl shadow-2xs overflow-hidden">
              <div className="px-5 py-3 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
                <h2 className="text-sm font-bold text-gray-900 dark:text-white">Waiting in queue</h2>
                <span className="text-[11px] font-semibold text-amber-700 dark:text-amber-300">
                  {waitingScans.length} not started
                </span>
              </div>
              <div className="divide-y divide-gray-100 dark:divide-gray-800">
                {waitingScans.map((scan) => (
                  <div key={scan.id} className="px-5 py-3 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">{scan.targetProject}</p>
                      <p className="text-[11px] text-gray-500 truncate">{scan.appService || scan.scanType} · {scan.source}</p>
                    </div>
                    <button
                      type="button"
                      disabled={cancellingId === scan.id}
                      onClick={() => handleCancel(scan)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 hover:border-rose-300 hover:text-rose-700 dark:hover:text-rose-300 text-xs font-semibold cursor-pointer disabled:opacity-50 shrink-0"
                    >
                      <Ban className="w-3.5 h-3.5" />
                      {cancellingId === scan.id ? 'Stopping' : 'Cancel'}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeScan ? (
            <div className="bg-white dark:bg-[#111827] border border-gray-200 dark:border-gray-800 rounded-xl p-6 shadow-2xs space-y-6">
              {/* Job Summary Banner */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-gray-100 dark:border-gray-800">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                    scanFailed
                      ? 'bg-red-50 dark:bg-red-950/40 text-red-600'
                      : activeScan.status === 'completed'
                        ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600'
                        : 'bg-blue-50 dark:bg-blue-950/60 text-blue-600'
                  }`}>
                    {scanFailed ? <AlertTriangle className="w-5 h-5" /> : activeScan.status === 'completed' ? <CheckCircle2 className="w-5 h-5" /> : <Radio className={`w-5 h-5 ${isOpenStatus(activeScan.status) ? 'animate-pulse' : ''}`} />}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-base font-bold text-gray-900 dark:text-white">
                        {activeScan.targetProject}
                      </h2>
                      <span className="font-mono text-xs px-2 py-0.5 bg-gray-100 dark:bg-gray-800 rounded text-gray-600 dark:text-gray-300">
                        {activeScan.id}
                      </span>
                      <span className={`px-2 py-0.5 text-[10px] font-bold rounded uppercase ${
                        scanFailed
                          ? 'bg-red-50 text-red-700 dark:bg-red-950/60 dark:text-red-300'
                          : activeScan.status === 'completed'
                            ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300'
                            : activeScan.status === 'cancelled'
                              ? 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'
                              : 'bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300'
                      }`}>
                        {displayStatus(activeScan.status)}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                      {activeScan.scanType} • {activeScan.source}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 text-xs">
                  <div className="flex items-center gap-1.5 text-gray-600 dark:text-gray-400 mr-2">
                    <Clock className="w-4 h-4 text-gray-400" />
                    <span>{activeScan.startedAt ? 'Elapsed' : 'Queue'}: <strong className="text-gray-900 dark:text-white font-mono">{activeScan.startedAt ? formatDuration(activeScan.startedAt, isOpenStatus(activeScan.status) ? undefined : activeScan.completedAt, now) : 'Waiting to start'}</strong></span>
                  </div>
                  {canCancel(activeScan.status) && (
                    <button
                      type="button"
                      disabled={cancellingId === activeScan.id}
                      onClick={() => handleCancel(activeScan)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 hover:border-rose-300 hover:text-rose-700 dark:hover:text-rose-300 text-xs font-semibold cursor-pointer disabled:opacity-50"
                    >
                      <Ban className="w-3.5 h-3.5" />
                      {cancellingId === activeScan.id ? 'Stopping' : 'Cancel scan'}
                    </button>
                  )}
                  {canRescan(activeScan.status) && !activeScan.isBulkAggregate && (
                    <button
                      type="button"
                      disabled={rescanningId === activeScan.id}
                      onClick={() => handleRescan(activeScan)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 hover:border-blue-400 hover:text-blue-700 dark:hover:text-blue-300 text-xs font-semibold cursor-pointer disabled:opacity-50"
                    >
                      <RotateCcw className={`w-3.5 h-3.5 ${rescanningId === activeScan.id ? 'animate-spin' : ''}`} />
                      {rescanningId === activeScan.id ? 'Queuing' : 'Rescan'}
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setSelectedScanId(activeScan.id)}
                    className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold cursor-pointer"
                  >
                    View results
                  </button>
                </div>
              </div>

              {activeScan.errorMessage && (scanFailed || activeScan.status === 'cancelled') && (
                <div className="rounded-lg border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-950/30 px-3 py-2 text-xs text-red-800 dark:text-red-200">
                  <span className="font-bold">{activeScan.errorCode || 'Error'}: </span>
                  {activeScan.errorMessage}
                </div>
              )}

              <div>
                <div className="flex justify-between text-xs font-semibold mb-1.5">
                  <span className="text-gray-700 dark:text-gray-300">
                    {activeScan.isBulkAggregate ? 'Batch progress' : stageLabel(activeScan.stage)}
                  </span>
                  <span className={`font-mono font-bold ${scanFailed ? 'text-red-600' : activeScan.status === 'completed' ? 'text-emerald-600' : 'text-blue-600 dark:text-blue-400'}`}>{activeScan.progress}%</span>
                </div>
                <div className="w-full bg-gray-100 dark:bg-gray-800 rounded-full h-2 overflow-hidden">
                  <div
                    className={`${scanFailed ? 'bg-red-500' : activeScan.status === 'cancelled' ? 'bg-slate-400' : activeScan.status === 'completed' ? 'bg-emerald-500' : 'bg-blue-600'} h-2 rounded-full transition-all duration-500`}
                    style={{ width: `${activeScan.progress}%` }}
                  />
                </div>
              </div>

              {activeScan.isBulkAggregate && (
                <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-800">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="text-gray-500 border-b border-gray-100 dark:border-gray-800">
                        <th className="px-3 py-2 font-semibold">Project</th>
                        <th className="px-3 py-2 font-semibold">Repository</th>
                        <th className="px-3 py-2 font-semibold">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                      {(activeScan.bulkItems || []).map((item) => {
                        const child = bulkChildren.find((scan) => scan.id === item.scanId);
                        const status = child?.status || item.status.toLowerCase();
                        return (
                          <tr key={`${item.rowNumber}-${item.scanId || item.repositoryUrl}`}>
                            <td className="px-3 py-2 font-semibold text-gray-900 dark:text-white">{item.projectName || item.applicationName || '—'}</td>
                            <td className="px-3 py-2 font-mono text-gray-500 max-w-[240px] truncate">{item.repositoryUrl}</td>
                            <td className="px-3 py-2">
                              <span className="uppercase font-bold text-[10px]">{displayStatus(status)}</span>
                              {child && (child.status === 'running' || child.status === 'analyzing') && (
                                <span className="text-gray-500"> · {stageLabel(child.stage)} {child.progress}%</span>
                              )}
                              {item.errorMessage && status !== 'completed' && status !== 'running' && status !== 'queued' && status !== 'analyzing' && (
                                <p className="text-[10px] text-red-600 dark:text-red-400 mt-0.5">{item.errorMessage}</p>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}

              {pipelineScan && (
                <div className="space-y-2">
                  {activeScan.isBulkAggregate && (
                    <p className="text-xs font-semibold text-gray-700 dark:text-gray-300">
                      Current row: {pipelineScan.targetProject} · {stageLabel(pipelineScan.stage)}
                    </p>
                  )}
                  <PipelineGrid job={pipelineScan} />
                </div>
              )}

              {activeScan.status === 'completed' && !activeScan.isBulkAggregate && (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                  <div className="rounded-lg border border-gray-200 dark:border-gray-800 px-3 py-2"><p className="text-gray-500">Components</p><p className="text-lg font-bold text-gray-900 dark:text-white">{activeScan.componentsFound}</p></div>
                  <div className="rounded-lg border border-gray-200 dark:border-gray-800 px-3 py-2"><p className="text-gray-500">Findings</p><p className="text-lg font-bold text-gray-900 dark:text-white">{activeScan.cvesFound}</p></div>
                  <div className="rounded-lg border border-gray-200 dark:border-gray-800 px-3 py-2"><p className="text-gray-500">Critical</p><p className="text-lg font-bold text-red-600">{activeScan.criticals}</p></div>
                  <div className="rounded-lg border border-gray-200 dark:border-gray-800 px-3 py-2"><p className="text-gray-500">High</p><p className="text-lg font-bold text-orange-500">{activeScan.highs}</p></div>
                </div>
              )}

              <div className="bg-gray-950 rounded-xl p-4 text-xs font-mono text-gray-300 space-y-1.5 shadow-inner max-h-52 overflow-y-auto">
                <div className="flex items-center justify-between text-gray-500 text-[11px] pb-2 border-b border-gray-800">
                  <span className="flex items-center gap-1.5">
                    <Terminal className="w-3.5 h-3.5 text-gray-400" />
                    Scan stage log
                  </span>
                  <span>{pipelineScan?.events?.length ? `${pipelineScan.events.length} events` : 'Waiting for events'}</span>
                </div>
                {(pipelineScan?.events?.length ? pipelineScan.events : []).map((event) => (
                  <p key={event.id} className="leading-relaxed">
                    <span className="text-gray-600">[{formatEventTime(event.createdAt)}]</span> {event.stage}: {event.message}
                  </p>
                ))}
                {!pipelineScan?.events?.length && (activeScan.logMessages || []).map((log, i) => (
                  <p key={i} className="leading-relaxed">{log}</p>
                ))}
              </div>
            </div>
          ) : waitingScans.length > 0 ? null : (
            <div className="bg-white dark:bg-[#111827] border border-gray-200 dark:border-gray-800 rounded-xl p-12 text-center space-y-3 shadow-2xs">
              <div className="w-12 h-12 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-400 flex items-center justify-center mx-auto">
                <Radio className="w-6 h-6" />
              </div>
              <h3 className="text-base font-bold text-gray-900 dark:text-white">
                No scans currently executing
              </h3>
              <p className="text-xs text-gray-500 max-w-sm mx-auto">
                All scheduled and manual jobs have completed. Launch a new scan from the New Scan tab.
              </p>
              <button
                onClick={() => setTab('new')}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg shadow-sm cursor-pointer"
              >
                + Launch New Scan
              </button>
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* 3. SCAN HISTORY SUB-PAGE (Workspace UI Spec Section 12)                    */}
      {/* ========================================================================= */}
      {activeTab === 'history' && (
        <div className="space-y-6">

          <div className="bg-white dark:bg-[#111827] border border-gray-200 dark:border-gray-800 rounded-xl p-5 shadow-2xs space-y-4">
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
              <div className="relative flex-1 max-w-md">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  value={historySearch}
                  onChange={(e) => setHistorySearch(e.target.value)}
                  placeholder="Filter by Job ID or project..."
                  className="w-full pl-9 pr-3 py-1.5 text-xs bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-gray-900 dark:text-white focus:ring-1 focus:ring-blue-500"
                />
              </div>

              <select
                value={historyStatusFilter}
                onChange={(e) => setHistoryStatusFilter(e.target.value)}
                className="text-xs px-3 py-1.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-gray-700 dark:text-gray-300"
              >
                <option value="All">All Statuses</option>
                <option value="completed">Completed</option>
                <option value="failed">Failed</option>
                <option value="cancelled">Cancelled</option>
                <option value="running">Running</option>
                <option value="queued">Queued</option>
              </select>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="text-gray-500 dark:text-gray-400 border-b border-gray-100 dark:border-gray-800">
                    <th className="pb-3 font-semibold">JOB ID</th>
                    <th className="pb-3 font-semibold">PROJECT & TAG</th>
                    <th className="pb-3 font-semibold">SOURCE</th>
                    <th className="pb-3 font-semibold">STATUS</th>
                    <th className="pb-3 font-semibold">SUBMITTED</th>
                    <th className="pb-3 font-semibold">COMPONENTS</th>
                    <th className="pb-3 font-semibold">FINDINGS</th>
                    <th className="pb-3 font-semibold text-right">ACTION</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                  {filteredHistory.map((job) => (
                    <tr key={job.id} className="hover:bg-gray-50/70 dark:hover:bg-gray-800/40">
                      <td className="py-3 font-mono font-semibold text-blue-600 dark:text-blue-400">
                        {job.id}
                      </td>
                      <td className="py-3">
                        <span className="font-bold text-gray-900 dark:text-white block">{job.targetProject}</span>
                        <span className="text-[10px] text-gray-400 font-mono">{job.releaseTag || 'v1.0.0'}</span>
                      </td>
                      <td className="py-3 text-gray-600 dark:text-gray-400 max-w-[180px] truncate" title={job.source}>
                        {job.source}
                      </td>
                      <td className="py-3">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${job.status === 'completed'
                          ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300'
                          : job.status === 'failed'
                            ? 'bg-red-50 text-red-700 dark:bg-red-950/60 dark:text-red-300'
                            : job.status === 'cancelled'
                              ? 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'
                              : job.status === 'running' || job.status === 'analyzing'
                              ? 'bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300'
                              : 'bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300'
                          }`}>
                          {job.status}
                        </span>
                      </td>
                      <td className="py-3 text-gray-500 dark:text-gray-400">{job.timestamp}</td>
                      <td className="py-3 font-semibold text-gray-900 dark:text-white">{job.componentsFound}</td>
                      <td className="py-3">
                        <span className="text-red-600 dark:text-red-400 font-semibold">{job.criticals || 0} Crit</span> •{' '}
                        <span className="text-orange-500 dark:text-orange-400 font-semibold">{job.highs || 0} High</span>
                      </td>
                      <td className="py-3 text-right">
                        <div className="inline-flex items-center justify-end gap-2">
                          {canCancel(job.status) && (
                            <button
                              type="button"
                              disabled={cancellingId === job.id}
                              onClick={() => handleCancel(job)}
                              title="Stop this scan"
                              className="inline-flex items-center gap-1 px-2 py-1 text-xs font-semibold rounded-lg border border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:border-rose-300 hover:text-rose-700 dark:hover:text-rose-300 cursor-pointer disabled:opacity-50"
                            >
                              <Ban className="w-3 h-3" />
                              {cancellingId === job.id ? 'Stopping' : 'Cancel'}
                            </button>
                          )}
                          {canRescan(job.status) && (
                            <button
                              type="button"
                              disabled={rescanningId === job.id}
                              onClick={() => handleRescan(job)}
                              title="Run this scan again with the same source"
                              className="inline-flex items-center gap-1 px-2 py-1 text-xs font-semibold rounded-lg border border-slate-200 dark:border-slate-600 text-slate-700 dark:text-slate-200 hover:border-blue-400 hover:text-blue-700 dark:hover:text-blue-300 cursor-pointer disabled:opacity-50"
                            >
                              <RotateCcw className={`w-3 h-3 ${rescanningId === job.id ? 'animate-spin' : ''}`} />
                              {rescanningId === job.id ? 'Queuing' : 'Rescan'}
                            </button>
                          )}
                          <ScanActionMenu
                            scan={job}
                            onViewDetails={(scan) => setSelectedScanId(scan.id)}
                            onExport={(format, scanId) => exportSBOM(format, scanId)}
                            canCancel={canCancel(job.status)}
                            canRescan={canRescan(job.status)}
                            cancelling={cancellingId === job.id}
                            rescanning={rescanningId === job.id}
                            onCancel={handleCancel}
                            onRescan={handleRescan}
                          />
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 4. SCHEDULED SCANS SUB-PAGE (Workspace UI Spec Section 13)                */}
      {/* ========================================================================= */}
      {activeTab === 'schedules' && (
        <div className="space-y-6">
          <div className="flex items-center justify-end">
            <button
              type="button"
              onClick={() => setCreateScheduleModalOpen(true)}
              className="px-3.5 py-2 text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-lg shadow-2xs inline-flex items-center gap-2 cursor-pointer transition-colors shrink-0"
            >
              <PlusCircle className="w-4 h-4" />
              <span>Create Schedule</span>
            </button>
          </div>

          {schedulesList.length === 0 ? (
            <div className="bg-white dark:bg-[#111827] border border-gray-200 dark:border-gray-800 rounded-2xl p-12 text-center">
              <div className="flex flex-col items-center justify-center max-w-md mx-auto space-y-3">
                <div className="w-12 h-12 rounded-full bg-blue-50 dark:bg-blue-950/50 flex items-center justify-center text-blue-500 border border-blue-200 dark:border-blue-800">
                  <Calendar className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-gray-900 dark:text-white">No Scheduled Scans Yet</h3>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    Static placeholder data has been removed. Configure your first real recurring scan schedule below to automate security audits.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setCreateScheduleModalOpen(true)}
                  className="px-4 py-2 text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white rounded-lg shadow-sm inline-flex items-center gap-2 cursor-pointer transition-colors mt-2"
                >
                  <PlusCircle className="w-4 h-4" />
                  <span>Create Scan Schedule</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {schedulesList.map((sched) => (
                <div
                  key={sched.id}
                  className="bg-white dark:bg-[#111827] border border-gray-200 dark:border-gray-800 rounded-xl p-5 shadow-2xs flex flex-col justify-between space-y-4"
                >
                  <div>
                    <div className="flex items-start justify-between gap-2">
                      <div className="w-8 h-8 rounded-lg bg-orange-50 dark:bg-orange-950/60 text-orange-600 flex items-center justify-center shrink-0">
                        <Calendar className="w-4 h-4" />
                      </div>
                      <label className="flex items-center gap-1.5 text-xs text-gray-500 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={sched.enabled}
                          onChange={() => toggleSchedule(sched.id)}
                          className="rounded text-blue-600 focus:ring-blue-500"
                        />
                        <span>{sched.enabled ? 'Enabled' : 'Disabled'}</span>
                      </label>
                    </div>

                    <h3 className="text-sm font-bold text-gray-900 dark:text-white mt-3">
                      {sched.name}
                    </h3>
                    <p className="text-xs font-semibold text-blue-600 dark:text-blue-400 mt-0.5">
                      {sched.project}
                    </p>

                    <div className="mt-3 space-y-1.5 text-xs text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-800/40 p-2.5 rounded-lg border border-gray-100 dark:border-gray-700/60">
                      <div className="flex justify-between">
                        <span className="text-gray-400">Cadence:</span>
                        <span className="font-semibold text-gray-800 dark:text-gray-200">{sched.frequency}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-400">Next Run:</span>
                        <span className="text-emerald-600 font-semibold">{sched.nextRun}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-400">Last Run:</span>
                        <span>{sched.lastRun}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-3 border-t border-gray-100 dark:border-gray-800 text-xs">
                    <button
                      onClick={() => {
                        addToast({
                          type: 'info',
                          title: 'Schedule Dispatched',
                          message: `Triggered immediate run of "${sched.name}".`,
                        });
                        setTab('live');
                      }}
                      className="font-bold text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1 cursor-pointer"
                    >
                      <Play className="w-3.5 h-3.5" />
                      Run Now
                    </button>

                    <button
                      onClick={() => {
                        setSchedulesList((prev) => prev.filter((s) => s.id !== sched.id));
                        addToast({ type: 'info', title: 'Schedule Deleted', message: `Removed schedule.` });
                      }}
                      className="text-gray-400 hover:text-red-600 cursor-pointer p-1"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {selectedHistoryScan && (
        <ScanResultDetails
          job={selectedHistoryScan}
          related={scansHistory.filter((scan) => selectedHistoryScan.bulkId && scan.bulkId === selectedHistoryScan.bulkId && !scan.isBulkAggregate)}
          now={now}
          cancelling={cancellingId === selectedHistoryScan.id}
          rescanning={rescanningId === selectedHistoryScan.id}
          canCancel={canCancel(selectedHistoryScan.status)}
          canRescan={canRescan(selectedHistoryScan.status)}
          onClose={() => setSelectedScanId(null)}
          onCancel={handleCancel}
          onRescan={handleRescan}
          onOpenScan={setSelectedScanId}
          onExport={(format, scanId) => exportSBOM(format, scanId)}
        />
      )}

      {/* Create Schedule Modal */}
      {createScheduleModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 animate-fadeIn backdrop-blur-xs">
          <div className="bg-white dark:bg-[#111827] rounded-xl max-w-lg w-full p-6 shadow-2xl border border-gray-200 dark:border-gray-800 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100 dark:border-gray-800">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-950/60 text-blue-600 flex items-center justify-center">
                  <Calendar className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-gray-900 dark:text-white">Create Scan Schedule</h3>
                  <p className="text-[11px] text-gray-500 dark:text-gray-400">Configure recurring automated SBOM security audits</p>
                </div>
              </div>
              <button onClick={() => setCreateScheduleModalOpen(false)} className="p-1 text-gray-400 hover:text-gray-600 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateSchedule} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-semibold text-gray-700 dark:text-gray-300 mb-1">Schedule Name</label>
                <input
                  type="text"
                  required
                  value={newSchedName}
                  onChange={(e) => setNewSchedName(e.target.value)}
                  placeholder="e.g. Nightly Core Scan"
                  className="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                />
              </div>

              <div>
                <label className="block font-semibold text-gray-700 dark:text-gray-300 mb-1">Target Project</label>
                <select
                  value={newSchedProject}
                  onChange={(e) => setNewSchedProject(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                >
                  <option value="Payments API">Payments API</option>
                  <option value="Customer Portal">Customer Portal</option>
                  <option value="Checkout Service">Checkout Service</option>
                  <option value="Mobile App Backend">Mobile App Backend</option>
                  <option value="Admin Portal">Admin Portal</option>
                </select>
              </div>

              {/* Calendar Date and Time Picker Section */}
              <div className="p-3.5 bg-gray-50 dark:bg-gray-800/50 rounded-xl border border-gray-200 dark:border-gray-700/80 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-gray-800 dark:text-gray-200 flex items-center gap-1.5 text-xs">
                    <Calendar className="w-3.5 h-3.5 text-blue-500" />
                    Select Date & Time (Calendar)
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <div>
                    <label className="block text-[11px] font-semibold text-gray-600 dark:text-gray-400 mb-1">
                      Execution Date
                    </label>
                    <input
                      type="date"
                      required
                      value={newSchedDate}
                      onChange={(e) => setNewSchedDate(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white font-medium text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/20 cursor-pointer"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-gray-600 dark:text-gray-400 mb-1">
                      Execution Time
                    </label>
                    <div className="grid grid-cols-2 gap-1.5">
                      <input
                        type="time"
                        required
                        value={newSchedTime}
                        onChange={(e) => setNewSchedTime(e.target.value)}
                        className="w-full px-2.5 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white font-medium text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/20 cursor-pointer font-mono"
                      />
                      <select
                        value={newSchedTimezone}
                        onChange={(e) => setNewSchedTimezone(e.target.value)}
                        className="w-full px-2 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white font-medium text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/20 cursor-pointer"
                      >
                        <option value="UTC">UTC</option>
                        <option value="EST">EST</option>
                        <option value="PST">PST</option>
                        <option value="IST">IST</option>
                        <option value="CET">CET</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* Quick Date Presets */}
                <div className="flex items-center gap-1.5 pt-0.5 flex-wrap">
                  <span className="text-[10px] text-gray-400 font-bold uppercase">Quick Dates:</span>
                  <button
                    type="button"
                    onClick={() => {
                      const today = new Date().toISOString().split('T')[0];
                      setNewSchedDate(today);
                    }}
                    className="px-2 py-0.5 rounded text-[10px] bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 hover:border-blue-400 text-gray-600 dark:text-gray-300 transition-colors cursor-pointer shadow-2xs"
                  >
                    Today
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const tom = new Date();
                      tom.setDate(tom.getDate() + 1);
                      setNewSchedDate(tom.toISOString().split('T')[0]);
                    }}
                    className="px-2 py-0.5 rounded text-[10px] bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 hover:border-blue-400 text-gray-600 dark:text-gray-300 transition-colors cursor-pointer shadow-2xs"
                  >
                    Tomorrow
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const nextWk = new Date();
                      nextWk.setDate(nextWk.getDate() + 7);
                      setNewSchedDate(nextWk.toISOString().split('T')[0]);
                    }}
                    className="px-2 py-0.5 rounded text-[10px] bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 hover:border-blue-400 text-gray-600 dark:text-gray-300 transition-colors cursor-pointer shadow-2xs"
                  >
                    +7 Days
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const firstNextMo = new Date();
                      firstNextMo.setMonth(firstNextMo.getMonth() + 1, 1);
                      setNewSchedDate(firstNextMo.toISOString().split('T')[0]);
                    }}
                    className="px-2 py-0.5 rounded text-[10px] bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 hover:border-blue-400 text-gray-600 dark:text-gray-300 transition-colors cursor-pointer shadow-2xs"
                  >
                    1st of Next Month
                  </button>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-gray-700 dark:text-gray-300 mb-1">Recurrence Frequency</label>
                <select
                  value={newSchedFreq}
                  onChange={(e) => setNewSchedFreq(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 cursor-pointer"
                >
                  <option value="Daily">Daily</option>
                  <option value="Weekly on Sunday">Weekly on Sunday</option>
                  <option value="Weekly on Monday">Weekly on Monday</option>
                  <option value="Monthly (1st of month)">Monthly (1st of month)</option>
                  <option value="One-time Run">One-time Run (No recurrence)</option>
                </select>
              </div>

              {/* Summary Banner */}
              <div className="p-2.5 bg-blue-50/70 dark:bg-blue-950/30 border border-blue-200/60 dark:border-blue-900/40 rounded-lg flex items-center justify-between text-[11px]">
                <div className="flex items-center gap-1.5 text-blue-800 dark:text-blue-300">
                  <Clock className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                  <span>Next scheduled run:</span>
                </div>
                <span className="font-bold text-blue-900 dark:text-blue-200 font-mono">
                  {newSchedDate || 'Selected Date'} @ {newSchedTime} {newSchedTimezone}
                </span>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-gray-100 dark:border-gray-800">
                <button
                  type="button"
                  onClick={() => setCreateScheduleModalOpen(false)}
                  className="px-3.5 py-1.5 border border-gray-200 dark:border-gray-700 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg shadow-sm transition-colors cursor-pointer flex items-center gap-1.5"
                >
                  <Calendar className="w-3.5 h-3.5" />
                  <span>Create Schedule</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default SecurityScans;
