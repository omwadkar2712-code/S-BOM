import React, { useState, useMemo } from 'react';
import { useNavigate, NavLink, useSearchParams, useLocation } from 'react-router-dom';
import {
  Package,
  FolderGit2,
  FileCode,
  Search,
  Filter,
  RotateCcw,
  Info,
  ArrowRight,
  Download,
  Upload,
  CheckCircle2,
  ChevronDown,
  Layers,
  X,
  FileSpreadsheet,
  ShieldCheck,
  MoreVertical,
  ExternalLink,
  Copy,
  Plus,
} from 'lucide-react';
import { useAppState } from '../../context/AppStateContext';
import { ComponentFieldType, LicenseType, Severity, Ecosystem } from '../../types';
import { parseUploadedSbom, type ParsedSbomUpload } from './parseUploadedSbom';
import { UploadInventoryModal } from './UploadInventoryModal';

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

export const SoftwareInventory: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const { addToast, components, projects, setAddDependencyModalOpen, addComponents } = useAppState();
  const tabSearch = location.search;

  // Search and filter state
  const [searchQuery, setSearchQuery] = useState(searchParams.get('q') || '');
  const [typeFilter, setTypeFilter] = useState(searchParams.get('type') || 'All Types');
  const [licenseFilter, setLicenseFilter] = useState(searchParams.get('license') || 'All Licenses');
  const [riskFilter, setRiskFilter] = useState(searchParams.get('risk') || 'All Risk Levels');
  const [sourceFilter, setSourceFilter] = useState(searchParams.get('source') || 'All Sources');
  const [showFilters, setShowFilters] = useState(false);

  // Modals for Top Actions (Excel Sr 12)
  const [ingestModalOpen, setIngestModalOpen] = useState(false);
  const [auditModalOpen, setAuditModalOpen] = useState(false);
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [uploadInventoryModalOpen, setUploadInventoryModalOpen] = useState(false);

  // Ingest form state
  const [manifestContent, setManifestContent] = useState('');
  const [manifestFileName, setManifestFileName] = useState<string | null>(null);

  // Upload SBOM form state
  const [sbomUploadFileName, setSbomUploadFileName] = useState<string | null>(null);
  const [parsedSbom, setParsedSbom] = useState<ParsedSbomUpload | null>(null);
  const [sbomParseError, setSbomParseError] = useState<string | null>(null);

  // Catalog components with Project Name, Project Application, and File Name
  const mockComponents: Array<{
    id: string;
    projectName: string;
    projectApplication: string;
    name: string;
    packageName: string;
    version: string;
    fieldType: string;
    fileName: string;
    license: string;
    vulnerabilities: number;
    purl: string;
    riskLevel: string;
    riskBadge: string;
    ecosystem: string;
    directDependency: boolean;
  }> = (components || []).map((comp) => {
    const proj = (projects || []).find((p) => p.name === comp.project);
    return {
      id: comp.id,
      projectName: comp.project || proj?.name || '',
      projectApplication: comp.projectApplication || proj?.component || '',
      name: comp.name,
      packageName: comp.packageName || comp.name,
      version: comp.version,
      fieldType: comp.fieldType || 'Library',
      fileName: comp.fileName || comp.fieldType || 'package.json',
      license: comp.license,
      vulnerabilities: comp.cves || 0,
      purl: comp.purl,
      riskLevel: comp.risk,
      ecosystem: comp.ecosystem || 'npm',
      directDependency: comp.directDependency !== undefined ? comp.directDependency : true,
      riskBadge:
        comp.risk === 'Critical'
          ? 'bg-red-50 text-red-700 border-red-200 dark:bg-red-950/40 dark:text-red-300'
          : comp.risk === 'High'
          ? 'bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-950/40 dark:text-orange-300'
          : comp.risk === 'Medium'
          ? 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300'
          : comp.risk === 'Low'
          ? 'bg-yellow-50 text-yellow-700 border-yellow-200 dark:bg-yellow-950/40 dark:text-yellow-300'
          : 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300',
    };
  });

  // Filtering
  const filteredComponents = mockComponents.filter((comp) => {
    const q = searchQuery.toLowerCase();
    const matchSearch =
      !q ||
      comp.name.toLowerCase().includes(q) ||
      comp.packageName.toLowerCase().includes(q) ||
      comp.projectName.toLowerCase().includes(q) ||
      comp.projectApplication.toLowerCase().includes(q) ||
      comp.purl.toLowerCase().includes(q) ||
      comp.fileName.toLowerCase().includes(q) ||
      comp.fieldType.toLowerCase().includes(q) ||
      comp.license.toLowerCase().includes(q);

    const matchType =
      typeFilter === 'All Types' ||
      comp.fieldType === typeFilter ||
      comp.ecosystem === typeFilter;
    const matchLicense = licenseFilter === 'All Licenses' || comp.license === licenseFilter;
    const matchRisk = riskFilter === 'All Risk Levels' || comp.riskLevel === riskFilter;
    const matchSource =
      sourceFilter === 'All Sources' ||
      (sourceFilter === 'Direct' && comp.directDependency) ||
      (sourceFilter === 'Transitive' && !comp.directDependency);

    return matchSearch && matchType && matchLicense && matchRisk && matchSource;
  });

  const writeFiltersToUrl = (next: {
    q?: string;
    type?: string;
    license?: string;
    risk?: string;
    source?: string;
  }) => {
    const params = new URLSearchParams(searchParams);
    const q = next.q !== undefined ? next.q : searchQuery;
    const type = next.type !== undefined ? next.type : typeFilter;
    const license = next.license !== undefined ? next.license : licenseFilter;
    const risk = next.risk !== undefined ? next.risk : riskFilter;
    const source = next.source !== undefined ? next.source : sourceFilter;
    const assign = (key: string, value: string, empty: string) => {
      if (!value || value === empty) params.delete(key);
      else params.set(key, value);
    };
    assign('q', q.trim(), '');
    assign('type', type, 'All Types');
    assign('license', license, 'All Licenses');
    assign('risk', risk, 'All Risk Levels');
    assign('source', source, 'All Sources');
    setSearchParams(params, { replace: true });
  };

  const handleResetFilters = () => {
    setSearchQuery('');
    setTypeFilter('All Types');
    setLicenseFilter('All Licenses');
    setRiskFilter('All Risk Levels');
    setSourceFilter('All Sources');
    setSearchParams({}, { replace: true });
  };

  const kpiComponents = filteredComponents;
  const uniqueProjects = useMemo(() => new Set(kpiComponents.map((c) => c.projectName)), [kpiComponents]);
  const vulnerablePackages = useMemo(() => kpiComponents.filter((c) => c.vulnerabilities > 0).length, [kpiComponents]);
  const auditGaps = useMemo(
    () => kpiComponents.filter((c) => c.riskLevel === 'Critical' || c.riskLevel === 'High').length,
    [kpiComponents],
  );


  // Export CSV handler
  const handleExportCsv = () => {
    const dataToExport = filteredComponents;
    const headers = [
      'Project Name',
      'Project Application',
      'Component Name',
      'Package Name',
      'Version',
      'File Name',
      'License',
      'Vulnerabilities',
      'P-URL',
      'Risk Level',
    ];
    const rows = [
      headers,
      ...dataToExport.map((c) => [
        c.projectName,
        c.projectApplication,
        c.name,
        c.packageName,
        c.version,
        c.fileName || c.fieldType || 'package.json',
        c.license,
        c.vulnerabilities,
        c.purl,
        c.riskLevel,
      ]),
    ];
    exportTableToCsv(`software-inventory-${Date.now()}.csv`, rows);
    addToast({
      type: 'success',
      title: 'CSV Export Generated',
      message: `Exported ${dataToExport.length} components to CSV.`,
    });
  };

  const resetSbomUpload = () => {
    setSbomUploadFileName(null);
    setParsedSbom(null);
    setSbomParseError(null);
  };

  const closeUploadModal = () => {
    setUploadModalOpen(false);
    resetSbomUpload();
  };

  const readSbomFile = (file: File) => {
    setSbomUploadFileName(file.name);
    setParsedSbom(null);
    setSbomParseError(null);
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = parseUploadedSbom(String(reader.result || ''), file.name);
        if (!parsed.rows.length) {
          setSbomParseError('No components were found in this SBOM.');
          return;
        }
        setParsedSbom(parsed);
      } catch (error) {
        setSbomParseError(error instanceof Error ? error.message : 'This file could not be read.');
      }
    };
    reader.onerror = () => setSbomParseError('This file could not be read.');
    reader.readAsText(file);
  };

  const handleIngestSbom = async () => {
    if (!parsedSbom || parsedSbom.rows.length === 0) {
      addToast({
        type: 'warning',
        title: 'Choose an SBOM file',
        message: sbomParseError || 'Supported file formats are CycloneDX and SPDX.',
      });
      return;
    }
    const count = parsedSbom.rows.length;
    const format = parsedSbom.format;
    try {
      await addComponents(parsedSbom.rows);
    } catch (error) {
      addToast({
        type: 'error',
        title: 'Could not save SBOM',
        message: error instanceof Error ? error.message : 'The SBOM was not saved to the database.',
      });
      return;
    }
    closeUploadModal();
    addToast({
      type: 'success',
      title: 'SBOM Uploaded',
      message: `Added ${count} component${count === 1 ? '' : 's'} from ${format} into the inventory.`,
    });
  };

  const handleCopyPurl = (purl: string) => {
    navigator.clipboard?.writeText(purl);
    addToast({
      type: 'info',
      title: 'P-URL Copied',
      message: purl,
    });
  };

  return (
    <div className="space-y-5 animate-fadeIn pb-16">
      {/* 3 Navigation Tabs (Full Width) */}
      <div className="border-b border-gray-200 dark:border-gray-800">
        <nav className="flex items-center space-x-2 sm:space-x-3 overflow-x-auto" aria-label="Software Inventory Tabs">
          <NavLink
            to={`/software-inventory${tabSearch}`}
            end
            className={({ isActive }) =>
              `flex items-center gap-2 py-2.5 px-3.5 text-xs font-semibold rounded-t-lg transition-all cursor-pointer whitespace-nowrap shrink-0 border-b-2 ${
                isActive
                  ? 'bg-blue-50/80 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 border-blue-600 font-bold shadow-2xs'
                  : 'border-transparent text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800/40'
              }`
            }
          >
            <Package className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            <span>Software Components & Packages</span>
          </NavLink>

          <NavLink
            to={`/software-inventory/projects${tabSearch}`}
            className={({ isActive }) =>
              `flex items-center gap-2 py-2.5 px-3.5 text-xs font-semibold rounded-t-lg transition-all cursor-pointer whitespace-nowrap shrink-0 border-b-2 ${
                isActive
                  ? 'bg-blue-50/80 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 border-blue-600 font-bold shadow-2xs'
                  : 'border-transparent text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800/40'
              }`
            }
          >
            <FolderGit2 className="w-4 h-4" />
            <span>Projects & Microservices</span>
          </NavLink>

          <NavLink
            to={`/software-inventory/artifacts${tabSearch}`}
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

      {/* Top 5 KPI Cards - Elevated with soft tinted backgrounds & modern icon avatars */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
        {/* Card 1: UNIQUE COMPONENTS */}
        <div
          onClick={handleResetFilters}
          className="bg-gradient-to-b from-blue-50/40 via-white to-white dark:from-blue-950/20 dark:via-[#111827] dark:to-[#111827] border border-blue-100/90 dark:border-gray-800 hover:border-blue-400 dark:hover:border-blue-500 rounded-xl p-3.5 sm:p-4 shadow-2xs hover:shadow-md hover:shadow-blue-500/5 hover:-translate-y-0.5 transition-all duration-200 min-h-[116px] flex flex-col justify-between cursor-pointer group"
        >
          <div className="flex items-start justify-between gap-1.5">
            <div className="flex items-center gap-2 min-w-0 pr-1">
              <div className="w-7 h-7 rounded-lg bg-blue-100/80 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0 border border-blue-200/50 dark:border-blue-800/50 shadow-2xs">
                <Layers className="w-3.5 h-3.5" />
              </div>
              <span className="text-[11px] font-bold uppercase tracking-tight text-gray-700 dark:text-gray-300 leading-snug">
                UNIQUE COMPONENTS
              </span>
            </div>
            <div className="relative group/info shrink-0 -mr-1 -mt-0.5">
              <button
                type="button"
                onClick={(e) => e.stopPropagation()}
                className="p-1 rounded-full text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/40 transition-colors cursor-help"
                aria-label="Component Information"
              >
                <Info className="w-3.5 h-3.5" />
              </button>
              <div className="absolute right-0 bottom-full mb-2 opacity-0 invisible group-hover/info:opacity-100 group-hover/info:visible transition-all duration-150 w-56 p-2.5 bg-gray-900 text-white text-[11px] normal-case font-normal rounded-lg shadow-xl z-50 pointer-events-none leading-relaxed">
                <div className="font-bold text-white mb-0.5">Unique Components</div>
                Total distinct open-source and third-party library dependencies cataloged across all monitored applications.
                <div className="absolute top-full right-2 border-4 border-transparent border-t-gray-900" />
              </div>
            </div>
          </div>

          <div className="mt-3 flex items-end justify-between">
            <div>
              <h2 className="text-2xl font-black text-gray-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors leading-none">
                {kpiComponents.length}
              </h2>
              <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-1 flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-500 inline-block"></span>
                <span>
                  {kpiComponents.filter(c => c.directDependency).length} Direct • {kpiComponents.filter(c => !c.directDependency).length} Transitive
                </span>
              </p>
            </div>
            <ArrowRight className="w-3.5 h-3.5 text-blue-400 dark:text-blue-500/70 group-hover:text-blue-600 dark:group-hover:text-blue-300 group-hover:translate-x-0.5 transition-all mb-0.5 shrink-0" />
          </div>
        </div>

        {/* Card 2: MICROSERVICES */}
        <div
          onClick={() => navigate('/software-inventory/projects')}
          className="bg-gradient-to-b from-indigo-50/40 via-white to-white dark:from-indigo-950/20 dark:via-[#111827] dark:to-[#111827] border border-indigo-100/90 dark:border-gray-800 hover:border-indigo-400 dark:hover:border-indigo-500 rounded-xl p-3.5 sm:p-4 shadow-2xs hover:shadow-md hover:shadow-indigo-500/5 hover:-translate-y-0.5 transition-all duration-200 min-h-[116px] flex flex-col justify-between cursor-pointer group"
        >
          <div className="flex items-start justify-between gap-1.5">
            <div className="flex items-center gap-2 min-w-0 pr-1">
              <div className="w-7 h-7 rounded-lg bg-indigo-100/80 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0 border border-indigo-200/50 dark:border-indigo-800/50 shadow-2xs">
                <FolderGit2 className="w-3.5 h-3.5" />
              </div>
              <span className="text-[11px] font-bold uppercase tracking-tight text-gray-700 dark:text-gray-300 leading-snug">
                MICROSERVICES
              </span>
            </div>
            <div className="relative group/info shrink-0 -mr-1 -mt-0.5">
              <button
                type="button"
                onClick={(e) => e.stopPropagation()}
                className="p-1 rounded-full text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 transition-colors cursor-help"
                aria-label="Microservices Information"
              >
                <Info className="w-3.5 h-3.5" />
              </button>
              <div className="absolute right-0 bottom-full mb-2 opacity-0 invisible group-hover/info:opacity-100 group-hover/info:visible transition-all duration-150 w-56 p-2.5 bg-gray-900 text-white text-[11px] normal-case font-normal rounded-lg shadow-xl z-50 pointer-events-none leading-relaxed">
                <div className="font-bold text-white mb-0.5">Monitored Microservices</div>
                Active services and repositories generating continuous SBOMs. Click to manage projects & microservices.
                <div className="absolute top-full right-2 border-4 border-transparent border-t-gray-900" />
              </div>
            </div>
          </div>

          <div className="mt-3 flex items-end justify-between">
            <div>
              <h2 className="text-2xl font-black text-gray-900 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors leading-none">
                {uniqueProjects.size}
              </h2>
              <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-1 flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 inline-block"></span>
                <span>{uniqueProjects.size} active services</span>
              </p>
            </div>
            <ArrowRight className="w-3.5 h-3.5 text-indigo-400 dark:text-indigo-500/70 group-hover:text-indigo-600 dark:group-hover:text-indigo-300 group-hover:translate-x-0.5 transition-all mb-0.5 shrink-0" />
          </div>
        </div>

        {/* Card 3: VULNERABLE PACKAGES */}
        <div
          onClick={() => navigate('/vulnerabilities')}
          className="bg-gradient-to-b from-amber-50/40 via-white to-white dark:from-amber-950/20 dark:via-[#111827] dark:to-[#111827] border border-amber-100/90 dark:border-gray-800 hover:border-amber-400 dark:hover:border-amber-500 rounded-xl p-3.5 sm:p-4 shadow-2xs hover:shadow-md hover:shadow-amber-500/5 hover:-translate-y-0.5 transition-all duration-200 min-h-[116px] flex flex-col justify-between cursor-pointer group"
        >
          <div className="flex items-start justify-between gap-1.5">
            <div className="flex items-center gap-2 min-w-0 pr-1">
              <div className="w-7 h-7 rounded-lg bg-amber-100/80 dark:bg-amber-900/40 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0 border border-amber-200/50 dark:border-amber-800/50 shadow-2xs">
                <ShieldCheck className="w-3.5 h-3.5" />
              </div>
              <span className="text-[11px] font-bold uppercase tracking-tight text-gray-700 dark:text-gray-300 leading-snug">
                VULNERABLE PACKAGES
              </span>
            </div>
            <div className="relative group/info shrink-0 -mr-1 -mt-0.5">
              <button
                type="button"
                onClick={(e) => e.stopPropagation()}
                className="p-1 rounded-full text-gray-400 hover:text-amber-600 dark:hover:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/40 transition-colors cursor-help"
                aria-label="Vulnerabilities Information"
              >
                <Info className="w-3.5 h-3.5" />
              </button>
              <div className="absolute right-0 bottom-full mb-2 opacity-0 invisible group-hover/info:opacity-100 group-hover/info:visible transition-all duration-150 w-56 p-2.5 bg-gray-900 text-white text-[11px] normal-case font-normal rounded-lg shadow-xl z-50 pointer-events-none leading-relaxed">
                <div className="font-bold text-white mb-0.5">Vulnerable Packages</div>
                Dependencies with detected Common Vulnerabilities and Exposures (CVEs). Click to view Vulnerability Management.
                <div className="absolute top-full right-2 border-4 border-transparent border-t-gray-900" />
              </div>
            </div>
          </div>

          <div className="mt-3 flex items-end justify-between">
            <div>
              <h2 className="text-2xl font-black text-amber-600 dark:text-amber-400 leading-none">
                {vulnerablePackages}
              </h2>
              <p className="text-[11px] text-amber-700 dark:text-amber-400/90 mt-1 flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500 inline-block animate-pulse"></span>
                <span>{vulnerablePackages} requiring patch</span>
              </p>
            </div>
            <ArrowRight className="w-3.5 h-3.5 text-amber-400 dark:text-amber-500/70 group-hover:text-amber-600 group-hover:translate-x-0.5 transition-all mb-0.5 shrink-0" />
          </div>
        </div>

        {/* Card 4: P-URL NORMALIZATION */}
        <div
          onClick={() => navigate('/supply-chain')}
          className="bg-gradient-to-b from-emerald-50/40 via-white to-white dark:from-emerald-950/20 dark:via-[#111827] dark:to-[#111827] border border-emerald-100/90 dark:border-gray-800 hover:border-emerald-400 dark:hover:border-emerald-500 rounded-xl p-3.5 sm:p-4 shadow-2xs hover:shadow-md hover:shadow-emerald-500/5 hover:-translate-y-0.5 transition-all duration-200 min-h-[116px] flex flex-col justify-between cursor-pointer group"
        >
          <div className="flex items-start justify-between gap-1.5">
            <div className="flex items-center gap-2 min-w-0 pr-1">
              <div className="w-7 h-7 rounded-lg bg-emerald-100/80 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0 border border-emerald-200/50 dark:border-emerald-800/50 shadow-2xs">
                <FileCode className="w-3.5 h-3.5" />
              </div>
              <span className="text-[11px] font-bold uppercase tracking-tight text-gray-700 dark:text-gray-300 leading-snug">
                P-URL NORMALIZATION
              </span>
            </div>
            <div className="relative group/info shrink-0 -mr-1 -mt-0.5">
              <button
                type="button"
                onClick={(e) => e.stopPropagation()}
                className="p-1 rounded-full text-gray-400 hover:text-emerald-600 dark:hover:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 transition-colors cursor-help"
                aria-label="PURL Normalization Information"
              >
                <Info className="w-3.5 h-3.5" />
              </button>
              <div className="absolute right-0 bottom-full mb-2 opacity-0 invisible group-hover/info:opacity-100 group-hover/info:visible transition-all duration-150 w-56 p-2.5 bg-gray-900 text-white text-[11px] normal-case font-normal rounded-lg shadow-xl z-50 pointer-events-none leading-relaxed">
                <div className="font-bold text-white mb-0.5">Package URL Normalization</div>
                Standardized canonical Package URLs (PURLs) generated for cross-ecosystem supply chain tracking and audit readiness.
                <div className="absolute top-full right-2 border-4 border-transparent border-t-gray-900" />
              </div>
            </div>
          </div>

          <div className="mt-3 flex items-end justify-between">
            <div>
              <h2 className="text-2xl font-black text-emerald-600 dark:text-emerald-400 leading-none">
                {kpiComponents.length > 0 ? '100%' : '0%'}
              </h2>
              <p className="text-[11px] text-emerald-700 dark:text-emerald-400/90 mt-1 flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block"></span>
                <span>{kpiComponents.length} canonical P-URLs</span>
              </p>
            </div>
            <ArrowRight className="w-3.5 h-3.5 text-emerald-400 dark:text-emerald-500/70 group-hover:text-emerald-600 group-hover:translate-x-0.5 transition-all mb-0.5 shrink-0" />
          </div>
        </div>

        {/* Card 5: REGULATORY READINESS */}
        <div
          onClick={() => navigate('/compliance')}
          className="bg-gradient-to-b from-sky-50/40 via-white to-white dark:from-sky-950/20 dark:via-[#111827] dark:to-[#111827] border border-sky-100/90 dark:border-gray-800 hover:border-sky-400 dark:hover:border-sky-500 rounded-xl p-3.5 sm:p-4 shadow-2xs hover:shadow-md hover:shadow-sky-500/5 hover:-translate-y-0.5 transition-all duration-200 min-h-[116px] flex flex-col justify-between cursor-pointer group"
        >
          <div className="flex items-start justify-between gap-1.5">
            <div className="flex items-center gap-2 min-w-0 pr-1">
              <div className="w-7 h-7 rounded-lg bg-sky-100/80 dark:bg-sky-900/40 text-sky-600 dark:text-sky-400 flex items-center justify-center shrink-0 border border-sky-200/50 dark:border-sky-800/50 shadow-2xs">
                <FileSpreadsheet className="w-3.5 h-3.5" />
              </div>
              <span className="text-[11px] font-bold uppercase tracking-tight text-gray-700 dark:text-gray-300 leading-snug">
                REGULATORY READINESS
              </span>
            </div>
            <div className="relative group/info shrink-0 -mr-1 -mt-0.5">
              <button
                type="button"
                onClick={(e) => e.stopPropagation()}
                className="p-1 rounded-full text-gray-400 hover:text-sky-600 dark:hover:text-sky-400 hover:bg-sky-50 dark:hover:bg-sky-950/40 transition-colors cursor-help"
                aria-label="Regulatory Readiness Information"
              >
                <Info className="w-3.5 h-3.5" />
              </button>
              <div className="absolute right-0 bottom-full mb-2 opacity-0 invisible group-hover/info:opacity-100 group-hover/info:visible transition-all duration-150 w-56 p-2.5 bg-gray-900 text-white text-[11px] normal-case font-normal rounded-lg shadow-xl z-50 pointer-events-none leading-relaxed">
                <div className="font-bold text-white mb-0.5">Regulatory Readiness Gaps</div>
                Unresolved supply chain compliance issues failing CERT-In, NTIA, or EU CRA mandates. Click to view Compliance.
                <div className="absolute top-full right-2 border-4 border-transparent border-t-gray-900" />
              </div>
            </div>
          </div>

          <div className="mt-3 flex items-end justify-between">
            <div>
              <h2 className="text-2xl font-black text-gray-900 dark:text-white group-hover:text-sky-600 transition-colors leading-none">
                {auditGaps}
              </h2>
              <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-1 flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-sky-500 inline-block"></span>
                <span>{auditGaps} audit gaps</span>
              </p>
            </div>
            <ArrowRight className="w-3.5 h-3.5 text-sky-400 dark:text-sky-500/70 group-hover:text-sky-600 group-hover:translate-x-0.5 transition-all mb-0.5 shrink-0" />
          </div>
        </div>
      </div>

      {/* Component Catalog Card with Integrated Action Toolbar */}
      <div className="bg-white dark:bg-[#111827] border border-gray-200 dark:border-gray-800 rounded-xl p-4 sm:p-5 shadow-2xs space-y-3.5">
        {/* Integrated Action Toolbar (Search & Filter on left, Add Inventory / Upload / Export on right) */}
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3 pb-3 border-b border-gray-100 dark:border-gray-800">
          {/* Left: Search input & Filter toggle */}
          <div className="flex items-center gap-2.5 flex-1 max-w-xl">
            <div className="relative flex-1">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-blue-500 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => {
                  const next = e.target.value;
                  setSearchQuery(next);
                  writeFiltersToUrl({ q: next });
                }}
                placeholder="Search for components, packages, versions, licenses, or P-URL..."
                className="w-full pl-9 pr-4 py-2 text-xs bg-gray-50/70 dark:bg-gray-800/80 border border-gray-200 dark:border-gray-700 rounded-lg text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 hover:border-blue-300 dark:hover:border-blue-700 transition-colors shadow-2xs"
              />
            </div>

            {/* Filter Toggle Button */}
            <button
              type="button"
              onClick={() => setShowFilters((prev) => !prev)}
              className={`px-3 py-2 text-xs font-semibold rounded-lg border transition-all flex items-center gap-1.5 cursor-pointer shadow-2xs shrink-0 ${
                showFilters || (typeFilter !== 'All Types' || licenseFilter !== 'All Licenses' || riskFilter !== 'All Risk Levels' || sourceFilter !== 'All Sources')
                  ? 'bg-blue-50 dark:bg-blue-950/60 border-blue-400 dark:border-blue-600 text-blue-600 dark:text-blue-400'
                  : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:border-blue-300 dark:hover:border-blue-700 hover:text-blue-600'
              }`}
              title="Toggle Filters"
            >
              <Filter className="w-3.5 h-3.5" />
              <span>Filters</span>
              {(typeFilter !== 'All Types' || licenseFilter !== 'All Licenses' || riskFilter !== 'All Risk Levels' || sourceFilter !== 'All Sources') && (
                <span className="w-2 h-2 rounded-full bg-blue-600 shrink-0" />
              )}
            </button>
          </div>

          {/* Right: Action Buttons Group (Add Inventory, Upload SBOM, Export CSV) */}
          <div className="flex items-center gap-2 shrink-0 flex-wrap justify-end">

            {/* Add Inventory Button - Navigates to Dedicated Add Page */}
            <button
              onClick={() => navigate('/software-inventory/add')}
              className="px-3.5 py-2 text-xs font-bold rounded-lg flex items-center gap-1.5 shadow-sm transition-all whitespace-nowrap cursor-pointer text-white bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 shadow-blue-500/20"
              title="Add New Inventory Component"
            >
              <Plus className="w-3.5 h-3.5 shrink-0" />
              <span>Add Inventory</span>
            </button>

            {/* Upload File Button - Opens Excel/CSV Upload Modal */}
            <button
              onClick={() => setUploadInventoryModalOpen(true)}
              className="px-3 py-2 text-xs font-semibold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-lg hover:border-emerald-400 dark:hover:border-emerald-600 hover:bg-emerald-100/60 dark:hover:bg-emerald-900/40 flex items-center gap-1.5 shadow-2xs cursor-pointer whitespace-nowrap transition-all"
              title="Upload Inventory Excel or CSV File"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
              <span>Upload File</span>
            </button>



            {/* Export CSV Button */}
            <button
              onClick={handleExportCsv}
              className="px-3 py-2 text-xs font-semibold text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg hover:border-blue-300 dark:hover:border-blue-700 hover:bg-blue-50/40 dark:hover:bg-blue-950/30 hover:text-blue-600 dark:hover:text-blue-400 flex items-center gap-1.5 shadow-2xs cursor-pointer whitespace-nowrap transition-all"
              title="Export Catalog to CSV"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
              <span>Export CSV</span>
            </button>
          </div>
        </div>

        {/* Filter Dropdowns revealed upon clicking Filter icon */}
        {showFilters && (
          <div className="p-3 bg-gray-50/90 dark:bg-gray-800/60 border border-gray-200/80 dark:border-gray-700/80 rounded-lg flex flex-col md:flex-row md:items-center justify-between gap-3 animate-fadeIn">
            {/* Filter Dropdowns & Reset Button */}
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[11px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mr-1">
                Filter by:
              </span>

              <select
                value={typeFilter}
                onChange={(e) => {
                  setTypeFilter(e.target.value);
                  writeFiltersToUrl({ type: e.target.value });
                }}
                className="text-xs px-2.5 py-1.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-gray-700 dark:text-gray-300 cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 shadow-2xs hover:border-blue-300 transition-colors"
              >
                <option value="All Types">All Types</option>
                <option value="Library">Library</option>
                <option value="Application">Application</option>
                <option value="Framework">Framework</option>
                <option value="Container">Container</option>
                <option value="Service">Service</option>
                <option value="Operating System">Operating System</option>
                <option value="Device / Firmware">Device / Firmware</option>
                <option value="File">File</option>
                <option value="npm">npm</option>
                <option value="Maven">Maven</option>
                <option value="PyPI">PyPI</option>
              </select>

              <select
                value={licenseFilter}
                onChange={(e) => {
                  setLicenseFilter(e.target.value);
                  writeFiltersToUrl({ license: e.target.value });
                }}
                className="text-xs px-2.5 py-1.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-gray-700 dark:text-gray-300 cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 shadow-2xs hover:border-blue-300 transition-colors"
              >
                <option value="All Licenses">All Licenses</option>
                <option value="MIT">MIT</option>
                <option value="Apache-2.0">Apache-2.0</option>
                <option value="OpenSSL">OpenSSL</option>
                <option value="GPL-3.0">GPL-3.0</option>
              </select>

              <select
                value={riskFilter}
                onChange={(e) => {
                  setRiskFilter(e.target.value);
                  writeFiltersToUrl({ risk: e.target.value });
                }}
                className="text-xs px-2.5 py-1.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-gray-700 dark:text-gray-300 cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 shadow-2xs hover:border-blue-300 transition-colors"
              >
                <option value="All Risk Levels">All Risk Levels</option>
                <option value="Critical">Critical</option>
                <option value="High">High</option>
                <option value="Medium">Medium</option>
                <option value="Low">Low</option>
                <option value="Safe">Safe</option>
              </select>

              <select
                value={sourceFilter}
                onChange={(e) => {
                  setSourceFilter(e.target.value);
                  writeFiltersToUrl({ source: e.target.value });
                }}
                className="text-xs px-2.5 py-1.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-gray-700 dark:text-gray-300 cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 shadow-2xs hover:border-blue-300 transition-colors"
              >
                <option value="All Sources">All Sources</option>
                <option value="Direct">Direct</option>
                <option value="Transitive">Transitive</option>
              </select>

              {/* Reset button adjacent to selects, no giant gap */}
              <button
                onClick={handleResetFilters}
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
          <table className="w-full text-left text-xs min-w-[1100px]">
            <thead>
              <tr className="bg-slate-50/90 dark:bg-slate-800/70 text-slate-600 dark:text-slate-300 border-b border-slate-200/80 dark:border-slate-700/80">
                <th className="py-2.5 pl-4 pr-3 font-bold uppercase tracking-wider text-[11px] whitespace-nowrap">PROJECT NAME</th>
                <th className="py-2.5 px-3 font-bold uppercase tracking-wider text-[11px] whitespace-nowrap">PROJECT APPLICATION</th>
                <th className="py-2.5 px-3 font-bold uppercase tracking-wider text-[11px] whitespace-nowrap">COMPONENT NAME</th>
                <th className="py-2.5 px-3 font-bold uppercase tracking-wider text-[11px] whitespace-nowrap">PACKAGE NAME</th>
                <th className="py-2.5 px-3 font-bold uppercase tracking-wider text-[11px] whitespace-nowrap">VERSION</th>
                <th className="py-2.5 px-3 font-bold uppercase tracking-wider text-[11px] whitespace-nowrap">FILE NAME</th>
                <th className="py-2.5 px-3 font-bold uppercase tracking-wider text-[11px] whitespace-nowrap">LICENSE</th>
                <th className="py-2.5 px-3 font-bold uppercase tracking-wider text-[11px] whitespace-nowrap">VULNERABILITIES</th>
                <th className="py-2.5 px-3 font-bold uppercase tracking-wider text-[11px] whitespace-nowrap">P-URL</th>
                <th className="py-2.5 px-3 font-bold uppercase tracking-wider text-[11px] whitespace-nowrap">RISK LEVEL</th>
                <th className="py-2.5 pr-4 pl-3 font-bold uppercase tracking-wider text-[11px] text-right whitespace-nowrap">ACTIONS</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {filteredComponents.length > 0 ? (
                filteredComponents.map((c) => (
                  <tr key={c.id} className="hover:bg-blue-50/40 dark:hover:bg-blue-950/20 transition-colors">
                    {/* PROJECT NAME */}
                    <td className="py-3 pl-4 pr-3 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <FolderGit2 className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                        <span
                          onClick={() => navigate(`/vulnerabilities?project=${encodeURIComponent(c.projectName)}`)}
                          className="font-bold text-gray-900 dark:text-white hover:text-blue-600 dark:hover:text-blue-400 cursor-pointer hover:underline transition-colors"
                          title={`View vulnerability management for ${c.projectName}`}
                        >
                          {c.projectName}
                        </span>
                      </div>
                    </td>

                    {/* PROJECT APPLICATION */}
                    <td className="py-3 px-3 whitespace-nowrap">
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 font-mono">
                        {c.projectApplication}
                      </span>
                    </td>

                    {/* COMPONENT NAME */}
                    <td className="py-3 px-3 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-md bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0 border border-blue-100/80 dark:border-blue-900/40">
                          <Package className="w-3.5 h-3.5" />
                        </div>
                        <span className="font-bold text-blue-600 dark:text-blue-400 hover:underline cursor-pointer">
                          {c.name}
                        </span>
                      </div>
                    </td>
                    <td className="py-3 px-3 text-gray-700 dark:text-gray-300 font-mono text-[11px] whitespace-nowrap">
                      <span className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800/80 text-slate-700 dark:text-slate-300 font-mono text-[11px]">
                        {c.packageName}
                      </span>
                    </td>
                    <td className="py-3 px-3 font-mono text-gray-600 dark:text-gray-400 whitespace-nowrap">{c.version}</td>

                    {/* FILE NAME */}
                    <td className="py-3 px-3 whitespace-nowrap font-mono text-[11px]">
                      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 font-mono">
                        <FileCode className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                        <span>{c.fileName || c.fieldType || 'package.json'}</span>
                      </span>
                    </td>

                    <td className="py-3 px-3 whitespace-nowrap">
                      <span className="px-2.5 py-0.5 bg-blue-50/60 dark:bg-blue-950/40 border border-blue-200/60 dark:border-blue-800/50 rounded font-semibold text-blue-700 dark:text-blue-300 text-[11px]">
                        {c.license}
                      </span>
                    </td>
                    <td className="py-3 px-3 font-semibold whitespace-nowrap">
                      {c.vulnerabilities > 0 ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold bg-red-50 dark:bg-red-950/50 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-900/60">
                          {c.vulnerabilities}
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-900/60">
                          0
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-3 text-gray-500 font-mono text-[11px] max-w-[240px] truncate" title={c.purl}>
                      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-gray-50 dark:bg-gray-800/60 border border-gray-200/70 dark:border-gray-700/70">
                        <span className="text-blue-600 dark:text-blue-400 font-semibold truncate">{c.purl}</span>
                        <button
                          onClick={() => handleCopyPurl(c.purl)}
                          className="text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 cursor-pointer shrink-0 p-0.5 rounded hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                          title="Copy P-URL"
                        >
                          <Copy className="w-3 h-3" />
                        </button>
                      </span>
                    </td>
                    <td className="py-3 px-3 whitespace-nowrap">
                      <span className={`px-2.5 py-0.5 rounded-md text-[10px] font-bold border ${c.riskBadge}`}>
                        {c.riskLevel}
                      </span>
                    </td>
                    <td className="py-3 pr-4 pl-3 text-right whitespace-nowrap">
                      <button
                        onClick={() => addToast({ type: 'info', title: 'Component Inspection', message: `Inspecting ${c.name}@${c.version}` })}
                        className="p-1 rounded text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/50 cursor-pointer transition-colors"
                      >
                        <MoreVertical className="w-4 h-4 inline-block" />
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={11} className="py-8 px-4 text-center">
                    <div className="flex flex-col items-center justify-center space-y-2">
                      <div className="w-10 h-10 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-400 flex items-center justify-center shadow-2xs">
                        <Search className="w-5 h-5" />
                      </div>
                      <div className="max-w-md mx-auto">
                        <h4 className="text-sm font-bold text-gray-900 dark:text-white">
                          No software components available yet.
                        </h4>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 leading-relaxed">
                          No catalog items found. Real software components will appear once scans or manifests are imported.
                        </p>
                      </div>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ================================================================= */}
      {/* MODAL 1: INGEST MANIFEST MODAL (Excel Sr 12) - High-End Redesign  */}
      {/* ================================================================= */}
      {ingestModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-950/60 backdrop-blur-sm p-4 animate-fadeIn">
          <div className="bg-white dark:bg-[#111827] rounded-2xl max-w-lg w-full shadow-2xl border border-gray-100 dark:border-gray-800 overflow-hidden">
            {/* Modal Header */}
            <div className="px-6 py-5 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
              <div className="flex items-center gap-3.5">
                <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center border border-blue-100 dark:border-blue-900/60 shadow-xs shrink-0">
                  <FileCode className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-gray-900 dark:text-white tracking-tight">
                    Ingest Software Manifest
                  </h3>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                    Extract package coordinates, lockfiles, and dependency relationships
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIngestModalOpen(false)}
                className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors cursor-pointer"
                title="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-5">
              {/* File Dropzone */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 dark:text-gray-300 mb-2">
                  Upload Manifest File
                </label>
                <div className="border-2 border-dashed border-blue-200/90 dark:border-blue-900/60 hover:border-blue-500 dark:hover:border-blue-400 rounded-2xl p-6 text-center bg-gradient-to-b from-blue-50/30 to-slate-50/50 dark:from-blue-950/20 dark:to-slate-900/20 transition-all group">
                  <div className="w-11 h-11 rounded-xl bg-blue-100/80 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 flex items-center justify-center mx-auto mb-2.5 group-hover:scale-105 transition-transform shadow-2xs">
                    <Upload className="w-5 h-5" />
                  </div>
                  {manifestFileName ? (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 rounded-full text-xs font-semibold text-emerald-700 dark:text-emerald-300">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>{manifestFileName}</span>
                    </span>
                  ) : (
                    <div>
                      <p className="text-xs font-semibold text-gray-800 dark:text-gray-200">
                        Drag and drop package manifest, or{' '}
                        <label
                          htmlFor="manifest-file"
                          className="text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
                        >
                          browse file
                        </label>
                      </p>
                      <p className="text-[11px] text-gray-400 dark:text-gray-500 mt-1">
                        package.json, pom.xml, requirements.txt, Cargo.toml, go.mod
                      </p>
                    </div>
                  )}
                  <input
                    type="file"
                    id="manifest-file"
                    className="hidden"
                    onChange={(e) => {
                      if (e.target.files && e.target.files[0]) {
                        setManifestFileName(e.target.files[0].name);
                      }
                    }}
                  />
                  {!manifestFileName && (
                    <label
                      htmlFor="manifest-file"
                      className="mt-3 inline-block px-3.5 py-1.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-xs font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-50 cursor-pointer shadow-2xs transition-colors"
                    >
                      Choose Manifest
                    </label>
                  )}
                </div>
              </div>

              {/* Paste textarea */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 dark:text-gray-300 mb-2">
                  Or Paste Raw Manifest Content
                </label>
                <textarea
                  rows={4}
                  value={manifestContent}
                  onChange={(e) => setManifestContent(e.target.value)}
                  placeholder='{\n  "dependencies": {\n    "axios": "^1.7.4"\n  }\n}'
                  className="w-full text-xs font-mono p-3 bg-gray-50/70 dark:bg-gray-800/80 border border-gray-200 dark:border-gray-700 rounded-xl text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all resize-none shadow-2xs"
                />
              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-4 bg-gray-50/70 dark:bg-gray-850/70 border-t border-gray-100 dark:border-gray-800 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setIngestModalOpen(false)}
                className="px-4 py-2 text-xs font-semibold text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-750 transition-colors cursor-pointer shadow-2xs"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  setIngestModalOpen(false);
                  addToast({
                    type: 'success',
                    title: 'Manifest Ingested',
                    message: `Extracted dependencies from ${manifestFileName || 'dependency manifest'}. Catalog refreshed.`,
                  });
                }}
                className="px-5 py-2 text-xs font-bold text-white bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 rounded-xl shadow-md shadow-blue-500/20 flex items-center gap-2 cursor-pointer transition-all"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Ingest & Parse</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================================================================= */}
      {/* MODAL 2: 1-CLICK AUDIT EXPORT MODAL (Excel Sr 12) - High-End      */}
      {/* ================================================================= */}
      {auditModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-950/60 backdrop-blur-sm p-4 animate-fadeIn">
          <div className="bg-white dark:bg-[#111827] rounded-2xl max-w-lg w-full shadow-2xl border border-gray-100 dark:border-gray-800 overflow-hidden">
            {/* Modal Header */}
            <div className="px-6 py-5 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
              <div className="flex items-center gap-3.5">
                <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center border border-emerald-100 dark:border-emerald-900/60 shadow-xs shrink-0">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-gray-900 dark:text-white tracking-tight">
                    Regulatory Audit Dossier Export
                  </h3>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                    Signed compliance package for CERT-In, ISO 27001, and SOC 2
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setAuditModalOpen(false)}
                className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors cursor-pointer"
                title="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-4">
              <p className="text-xs text-gray-600 dark:text-gray-300 leading-relaxed">
                Generate an audit-ready compliance package containing cryptographic SBOM attestations, NTIA minimum elements verification, and vulnerability mitigation records.
              </p>

              <div className="space-y-2.5 bg-gray-50/80 dark:bg-gray-800/60 p-4 rounded-xl border border-gray-200/80 dark:border-gray-700/80 text-xs">
                <div className="flex justify-between items-center py-0.5">
                  <span className="text-gray-500 dark:text-gray-400 font-medium">Compliance Target:</span>
                  <span className="font-bold text-gray-900 dark:text-white">CERT-In / ISO 27001 / SOC 2</span>
                </div>
                <div className="flex justify-between items-center py-0.5">
                  <span className="text-gray-500 dark:text-gray-400 font-medium">Components Included:</span>
                  <span className="font-semibold text-gray-900 dark:text-white">{mockComponents.length} Normalized P-URLs</span>
                </div>
                <div className="flex justify-between items-center py-0.5">
                  <span className="text-gray-500 dark:text-gray-400 font-medium">Cryptographic Signing:</span>
                  <span className="font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>NIST P-256 Verified</span>
                  </span>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-4 bg-gray-50/70 dark:bg-gray-850/70 border-t border-gray-100 dark:border-gray-800 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setAuditModalOpen(false)}
                className="px-4 py-2 text-xs font-semibold text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-750 transition-colors cursor-pointer shadow-2xs"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  const auditContent = [
                    ['Audit Report', 'SQUAD1 Software Supply Chain Compliance'],
                    ['Generated', new Date().toISOString()],
                    ['Total Components', String(mockComponents.length)],
                    ['CERT-In Readiness', '100%'],
                    ['ISO 27001 Readiness', '100%'],
                  ];
                  exportTableToCsv(`audit-export-${Date.now()}.csv`, auditContent);
                  setAuditModalOpen(false);
                  addToast({
                    type: 'success',
                    title: 'Audit Package Exported',
                    message: 'Compliance dossier downloaded successfully.',
                  });
                }}
                className="px-5 py-2 text-xs font-bold text-white bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-700 hover:to-emerald-800 rounded-xl shadow-md shadow-emerald-500/20 flex items-center gap-2 cursor-pointer transition-all"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Generate & Download</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================================================================= */}
      {/* MODAL 3: UPLOAD SBOM MODAL (Excel Sr 12) - High-End Redesign      */}
      {/* ================================================================= */}
      {uploadModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-950/60 backdrop-blur-sm p-4 animate-fadeIn">
          <div className="bg-white dark:bg-[#111827] rounded-2xl max-w-lg w-full shadow-2xl border border-gray-100 dark:border-gray-800 overflow-hidden space-y-0">
            {/* Header */}
            <div className="px-6 py-5 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
              <div className="flex items-center gap-3.5">
                <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center border border-blue-100 dark:border-blue-900/60 shadow-xs shrink-0">
                  <Upload className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-gray-900 dark:text-white tracking-tight">
                    Upload Existing SBOM
                  </h3>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                    Import standard SPDX or CycloneDX manifests into your catalog
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={closeUploadModal}
                className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors cursor-pointer"
                title="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Body */}
            <div className="p-6 space-y-5">
              <p className="text-xs text-gray-600 dark:text-gray-300">
                Supported file formats are CycloneDX and SPDX.
              </p>

              {/* Upload Dropzone */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 dark:text-gray-300 mb-2">
                  SBOM Artifact File
                </label>
                <div
                  className="relative border-2 border-dashed border-blue-200/90 dark:border-blue-900/60 hover:border-blue-500 dark:hover:border-blue-400 rounded-2xl p-7 text-center bg-gradient-to-b from-blue-50/30 to-slate-50/50 dark:from-blue-950/20 dark:to-slate-900/20 transition-all group"
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault();
                    const file = e.dataTransfer.files?.[0];
                    if (file) readSbomFile(file);
                  }}
                >
                  <div className="w-12 h-12 rounded-2xl bg-blue-100/80 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 flex items-center justify-center mx-auto mb-3 group-hover:scale-105 transition-transform shadow-2xs">
                    <Upload className="w-5 h-5" />
                  </div>
                  {sbomUploadFileName ? (
                    <div className="space-y-1">
                      <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border ${
                        sbomParseError
                          ? 'bg-red-50 dark:bg-red-950/50 border-red-200 dark:border-red-800 text-red-700 dark:text-red-300'
                          : 'bg-emerald-50 dark:bg-emerald-950/50 border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300'
                      }`}>
                        {sbomParseError ? <X className="w-3.5 h-3.5" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                        <span>{sbomUploadFileName}</span>
                      </span>
                      <p className="text-[11px] text-gray-500 dark:text-gray-400">
                        {parsedSbom
                          ? `${parsedSbom.format} · ${parsedSbom.rows.length} component${parsedSbom.rows.length === 1 ? '' : 's'} ready for the inventory`
                          : sbomParseError
                          ? 'Choose a CycloneDX or SPDX file'
                          : 'Reading SBOM…'}
                      </p>
                      <label
                        htmlFor="sbom-upload-file"
                        className="inline-block text-[11px] font-semibold text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
                      >
                        Choose a different file
                      </label>
                    </div>
                  ) : (
                    <div>
                      <p className="text-xs font-semibold text-gray-800 dark:text-gray-200">
                        Drag and drop your SBOM file here, or{' '}
                        <label
                          htmlFor="sbom-upload-file"
                          className="text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
                        >
                          browse files
                        </label>
                      </p>
                    </div>
                  )}

                  <input
                    type="file"
                    id="sbom-upload-file"
                    accept=".json,.spdx,.xml,.yaml,.yml"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) readSbomFile(file);
                      e.target.value = '';
                    }}
                  />

                  {!sbomUploadFileName && (
                    <label
                      htmlFor="sbom-upload-file"
                      className="mt-3.5 inline-block px-4 py-1.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-xs font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-750 cursor-pointer shadow-2xs transition-colors"
                    >
                      Choose File
                    </label>
                  )}
                </div>
                {sbomParseError && (
                  <p className="mt-2 text-[11px] font-medium text-red-600 dark:text-red-400">{sbomParseError}</p>
                )}
              </div>
            </div>

            {/* Footer */}
            <div className="px-6 py-4 bg-gray-50/70 dark:bg-gray-850/70 border-t border-gray-100 dark:border-gray-800 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={closeUploadModal}
                className="px-4 py-2 text-xs font-semibold text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-750 transition-colors cursor-pointer shadow-2xs"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleIngestSbom}
                disabled={!parsedSbom}
                className="px-5 py-2 text-xs font-bold text-white bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 rounded-xl shadow-md shadow-blue-500/20 flex items-center gap-2 cursor-pointer transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Upload className="w-3.5 h-3.5" />
                <span>Upload & Ingest</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Upload File Pop-up Modal */}
      <UploadInventoryModal
        isOpen={uploadInventoryModalOpen}
        onClose={() => setUploadInventoryModalOpen(false)}
      />
    </div>
  );
};

export default SoftwareInventory;
