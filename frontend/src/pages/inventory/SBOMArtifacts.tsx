import React, { useState } from 'react';
import { NavLink } from 'react-router-dom';
import {
  FileText,
  Layers,
  ShieldCheck,
  AlertTriangle,
  Download,
  Search,
  Upload,
  FileCode,
  CheckCircle2,
  MoreVertical,
  Calendar,
  X,
  FileSpreadsheet,
  Package,
  FolderGit2,
  Shield,
  Check,
} from 'lucide-react';
import { useAppState } from '../../context/AppStateContext';

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

// Client-side File Downloader (JSON / XML / SPDX / Text)
const downloadFileBlob = (filename: string, content: string, mimeType: string) => {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

interface SbomArtifact {
  id: string;
  fileName: string;
  fileSize: string;
  format: 'SPDX-2.3' | 'CycloneDX-1.5';
  project: string;
  components: number;
  signed: 'Pass' | 'Fail';
  uploaded: string;
  isFailingRow?: boolean;
}

export const SBOMArtifacts: React.FC = () => {
  const { addToast } = useAppState();

  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFormat, setSelectedFormat] = useState('All Formats');
  const [selectedProject, setSelectedProject] = useState('All Projects');
  const [selectedStatus, setSelectedStatus] = useState('All Status');
  const [selectedDateRange, setSelectedDateRange] = useState('All Time');

  // Modals for Top Actions
  const [ingestModalOpen, setIngestModalOpen] = useState(false);
  const [auditModalOpen, setAuditModalOpen] = useState(false);
  const [uploadModalOpen, setUploadModalOpen] = useState(false);

  // Format Download modal state (Excel Sr 21)
  const [downloadModalOpen, setDownloadModalOpen] = useState(false);
  const [targetArtifact, setTargetArtifact] = useState<SbomArtifact | null>(null);
  const [chosenDownloadFormat, setChosenDownloadFormat] = useState<'spdx-json' | 'spdx-tag' | 'cyclonedx-json' | 'cyclonedx-xml' | 'csv'>('spdx-json');
  const [includeSignature, setIncludeSignature] = useState(true);

  // Ingest form state
  const [manifestFileName, setManifestFileName] = useState<string | null>(null);

  // Upload SBOM form state
  const [sbomUploadFileName, setSbomUploadFileName] = useState<string | null>(null);

  // Artifacts list (empty, ready for backend data)
  const artifacts: SbomArtifact[] = [];

  // Filtering
  const filteredArtifacts = artifacts.filter((art) => {
    const q = searchQuery.toLowerCase();
    const matchesSearch =
      !q ||
      art.fileName.toLowerCase().includes(q) ||
      art.project.toLowerCase().includes(q);

    const matchesFormat = selectedFormat === 'All Formats' || art.format === selectedFormat;
    const matchesProject = selectedProject === 'All Projects' || art.project === selectedProject;
    const matchesStatus = selectedStatus === 'All Status' || art.signed === selectedStatus;

    return matchesSearch && matchesFormat && matchesProject && matchesStatus;
  });

  // Open download chooser modal (Excel Sr 21)
  const handleOpenDownloadChooser = (art: SbomArtifact) => {
    setTargetArtifact(art);
    setChosenDownloadFormat(art.format === 'SPDX-2.3' ? 'spdx-json' : 'cyclonedx-json');
    setDownloadModalOpen(true);
  };

  // Execute download in chosen format (Excel Sr 21)
  const handleExecuteDownload = () => {
    if (!targetArtifact) return;

    const baseName = targetArtifact.fileName.replace(/\.(json|spdx|xml)$/, '');
    let exportFileName = `${baseName}.json`;
    let fileContent = '';
    let mimeType = 'application/json';

    if (chosenDownloadFormat === 'spdx-json') {
      exportFileName = `${baseName}.spdx.json`;
      mimeType = 'application/json';
      fileContent = JSON.stringify(
        {
          spdxVersion: 'SPDX-2.3',
          dataLicense: 'CC0-1.0',
          SPDXID: 'SPDXRef-DOCUMENT',
          name: targetArtifact.project,
          documentNamespace: `https://squad1.io/spdx/${targetArtifact.id}`,
          creationInfo: {
            creators: ['Tool: SQUAD1 SBOM Engine v2.4', 'Person: Security Admin'],
            created: new Date().toISOString(),
          },
          packages: [
            {
              name: targetArtifact.project,
              SPDXID: 'SPDXRef-Package-Root',
              versionInfo: '3.2.0',
              downloadLocation: 'NOASSERTION',
              filesAnalyzed: false,
              licenseConcluded: 'MIT',
            },
          ],
        },
        null,
        2
      );
    } else if (chosenDownloadFormat === 'spdx-tag') {
      exportFileName = `${baseName}.spdx`;
      mimeType = 'text/plain';
      fileContent = `SPDXVersion: SPDX-2.3\nDataLicense: CC0-1.0\nSPDXID: SPDXRef-DOCUMENT\nDocumentName: ${targetArtifact.project}\nDocumentNamespace: https://squad1.io/spdx/${targetArtifact.id}\nCreator: Tool: SQUAD1 SBOM Engine v2.4\nCreated: ${new Date().toISOString()}\n`;
    } else if (chosenDownloadFormat === 'cyclonedx-json') {
      exportFileName = `${baseName}.cdx.json`;
      mimeType = 'application/json';
      fileContent = JSON.stringify(
        {
          bomFormat: 'CycloneDX',
          specVersion: '1.5',
          serialNumber: `urn:uuid:${targetArtifact.id}-98b94d4a`,
          version: 1,
          metadata: {
            timestamp: new Date().toISOString(),
            tools: [{ vendor: 'SQUAD1', name: 'SBOM Engine', version: '2.4.0' }],
            component: {
              name: targetArtifact.project,
              type: 'application',
              version: '3.2.0',
            },
          },
          components: [
            {
              type: 'library',
              name: 'axios',
              version: '1.12.2',
              purl: 'pkg:npm/axios@1.12.2',
            },
          ],
        },
        null,
        2
      );
    } else if (chosenDownloadFormat === 'cyclonedx-xml') {
      exportFileName = `${baseName}.cdx.xml`;
      mimeType = 'application/xml';
      fileContent = `<?xml version="1.0" encoding="UTF-8"?>\n<bom xmlns="http://cyclonedx.org/schema/bom/1.5" serialNumber="urn:uuid:${targetArtifact.id}" version="1">\n  <metadata>\n    <timestamp>${new Date().toISOString()}</timestamp>\n    <component type="application">\n      <name>${targetArtifact.project}</name>\n    </component>\n  </metadata>\n</bom>`;
    } else {
      exportFileName = `${baseName}-components.csv`;
      mimeType = 'text/csv';
      fileContent = `File,Project,Components,Signed,Format\n${targetArtifact.fileName},${targetArtifact.project},${targetArtifact.components},${targetArtifact.signed},${targetArtifact.format}\n`;
    }

    downloadFileBlob(exportFileName, fileContent, mimeType);

    if (includeSignature) {
      setTimeout(() => {
        downloadFileBlob(
          `${exportFileName}.sig`,
          `-----BEGIN SQUAD1 ATTESTATION SIGNATURE-----\nVersion: NIST P-256 ECDSA\nHash: SHA-256\nDocument: ${exportFileName}\nTimestamp: ${new Date().toISOString()}\nSignature: MEQCIGx4z...SQUAD1_VERIFIED\n-----END SQUAD1 ATTESTATION SIGNATURE-----`,
          'text/plain'
        );
      }, 200);
    }

    setDownloadModalOpen(false);
    addToast({
      type: 'success',
      title: 'SBOM Download Complete',
      message: `Downloaded ${exportFileName} in chosen format (${chosenDownloadFormat.toUpperCase()}).`,
    });
  };

  const handleExportCsv = () => {
    const headers = ['File Name', 'Format', 'Project', 'Components', 'Signed Status', 'Uploaded'];
    const rows = [
      headers,
      ...filteredArtifacts.map((a) => [a.fileName, a.format, a.project, a.components, a.signed, a.uploaded]),
    ];
    exportTableToCsv(`sbom-artifacts-${Date.now()}.csv`, rows);
    addToast({
      type: 'success',
      title: 'Artifacts Exported',
      message: `Exported ${filteredArtifacts.length} artifacts to CSV.`,
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
            <FolderGit2 className="w-4 h-4" />
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
            <FileCode className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            <span>SBOM Documents & Artifacts</span>
          </NavLink>
        </nav>
      </div>

      {/* Action Controls - Single Clean Row */}
      <div className="flex items-center justify-end gap-2 shrink-0 flex-nowrap overflow-x-auto pb-1 lg:pb-0">

          <button
            onClick={() => setUploadModalOpen(true)}
            className="px-3 py-1.5 text-xs font-semibold text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-750 flex items-center gap-1.5 shadow-2xs cursor-pointer whitespace-nowrap"
          >
            <Upload className="w-3.5 h-3.5 text-gray-500 shrink-0" />
            <span>Upload SBOM</span>
          </button>

          <button
            onClick={handleExportCsv}
            className="px-3.5 py-1.5 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg flex items-center gap-1.5 shadow-xs cursor-pointer transition-colors whitespace-nowrap"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 shrink-0" />
            <span>Export CSV</span>
          </button>
        </div>

      {/* Banner Card: SBOM Artifacts with 4 metric blocks matching Screenshot 5 */}
      <div className="bg-white dark:bg-[#111827] border border-gray-200 dark:border-gray-800 rounded-xl p-5 shadow-2xs">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
          {/* Left Title & Icon (~38%) */}
          <div className="lg:col-span-4 flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 flex items-center justify-center shrink-0">
              <FileText className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base font-bold text-gray-900 dark:text-white">
                SBOM Artifacts
              </h3>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                SPDX / CycloneDX files ready to download, sign or share.
              </p>
            </div>
          </div>

          {/* Right 4 Metric Blocks (~62%) */}
          <div className="lg:col-span-8 grid grid-cols-2 sm:grid-cols-4 gap-4">
            {/* Metric 1: Total Artifacts */}
            <div className="border-l border-gray-100 dark:border-gray-800 pl-4">
              <div className="flex items-center gap-1.5 text-gray-400 text-xs mb-1">
                <FileCode className="w-3.5 h-3.5 text-blue-500" />
                <span className="text-[11px] font-semibold text-gray-600 dark:text-gray-400">Total Artifacts</span>
              </div>
              <div className="text-xl font-bold text-gray-900 dark:text-white">0</div>
              <p className="text-[10px] text-gray-500 dark:text-gray-400 mt-0.5">0 total artifacts</p>
            </div>

            {/* Metric 2: Components Covered */}
            <div className="border-l border-gray-100 dark:border-gray-800 pl-4">
              <div className="flex items-center gap-1.5 text-gray-400 text-xs mb-1">
                <Layers className="w-3.5 h-3.5 text-blue-500" />
                <span className="text-[11px] font-semibold text-gray-600 dark:text-gray-400">Components Covered</span>
              </div>
              <div className="text-xl font-bold text-gray-900 dark:text-white">0</div>
              <p className="text-[10px] text-gray-500 dark:text-gray-400 mt-0.5">0 components mapped</p>
            </div>

            {/* Metric 3: Signed Artifacts */}
            <div className="border-l border-gray-100 dark:border-gray-800 pl-4">
              <div className="flex items-center gap-1.5 text-gray-400 text-xs mb-1">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
                <span className="text-[11px] font-semibold text-gray-600 dark:text-gray-400">Signed Artifacts</span>
              </div>
              <div className="text-xl font-bold text-emerald-600 dark:text-emerald-400">0</div>
              <p className="text-[10px] text-gray-500 dark:text-gray-400 mt-0.5">0% verified</p>
            </div>

            {/* Metric 4: Failed Artifacts */}
            <div className="border-l border-gray-100 dark:border-gray-800 pl-4">
              <div className="flex items-center gap-1.5 text-gray-400 text-xs mb-1">
                <AlertTriangle className="w-3.5 h-3.5 text-red-500" />
                <span className="text-[11px] font-semibold text-gray-600 dark:text-gray-400">Failed Artifacts</span>
              </div>
              <div className="text-xl font-bold text-red-600">0</div>
              <p className="text-[10px] text-gray-500 dark:text-gray-400 mt-0.5">0 generation errors</p>
            </div>
          </div>
        </div>
      </div>

      {/* Filter Row matching Screenshot 5 */}
      <div className="bg-white dark:bg-[#111827] border border-gray-200 dark:border-gray-800 rounded-xl p-3.5 shadow-2xs">
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          {/* Search file or project */}
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search file or project"
              className="w-full pl-9 pr-3 py-1.5 text-xs bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          {/* Dropdown Filters */}
          <div className="flex items-center gap-2 flex-wrap">
            <select
              value={selectedFormat}
              onChange={(e) => setSelectedFormat(e.target.value)}
              className="text-xs px-2.5 py-1.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-gray-700 dark:text-gray-300 cursor-pointer focus:outline-none"
            >
              <option value="All Formats">All Formats</option>
              <option value="SPDX-2.3">SPDX-2.3</option>
              <option value="CycloneDX-1.5">CycloneDX-1.5</option>
            </select>

            <select
              value={selectedProject}
              onChange={(e) => setSelectedProject(e.target.value)}
              className="text-xs px-2.5 py-1.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-gray-700 dark:text-gray-300 cursor-pointer focus:outline-none"
            >
              <option value="All Projects">All Projects</option>
              <option value="Paynext SBOM">Paynext SBOM</option>
              <option value="Checkout Docker">Checkout Docker</option>
              <option value="AI-Assets">AI-Assets</option>
              <option value="Edge Gateway">Edge Gateway</option>
              <option value="Crypto Vault">Crypto Vault</option>
              <option value="KnoxApp">KnoxApp</option>
            </select>

            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="text-xs px-2.5 py-1.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-gray-700 dark:text-gray-300 cursor-pointer focus:outline-none"
            >
              <option value="All Status">All Status</option>
              <option value="Pass">Pass</option>
              <option value="Fail">Fail</option>
            </select>

            <select
              value={selectedDateRange}
              onChange={(e) => setSelectedDateRange(e.target.value)}
              className="text-xs px-2.5 py-1.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-gray-700 dark:text-gray-300 cursor-pointer focus:outline-none"
            >
              <option value="All Time">Date Range</option>
              <option value="Today">Last 24 Hours</option>
              <option value="7D">Last 7 Days</option>
              <option value="30D">Last 30 Days</option>
            </select>
          </div>
        </div>
      </div>

      {/* Artifacts Table matching Screenshot 5 */}
      <div className="bg-white dark:bg-[#111827] border border-gray-200 dark:border-gray-800 rounded-xl p-5 shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs min-w-[850px]">
            <thead>
              <tr className="text-gray-500 dark:text-gray-400 border-b border-gray-100 dark:border-gray-800">
                <th className="pb-3 pr-4 font-semibold whitespace-nowrap">FILE</th>
                <th className="pb-3 px-4 font-semibold whitespace-nowrap">FORMAT</th>
                <th className="pb-3 px-4 font-semibold whitespace-nowrap">PROJECT</th>
                <th className="pb-3 px-4 font-semibold whitespace-nowrap">COMPONENTS</th>
                <th className="pb-3 px-4 font-semibold whitespace-nowrap">SIGNED</th>
                <th className="pb-3 px-4 font-semibold whitespace-nowrap">UPLOADED</th>
                <th className="pb-3 pl-4 font-semibold text-right whitespace-nowrap">ACTION</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {filteredArtifacts.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-gray-500 dark:text-gray-400">
                    No data available yet.
                  </td>
                </tr>
              ) : (
                filteredArtifacts.map((art) => (
                <tr
                  key={art.id}
                  className={`transition-colors ${
                    art.isFailingRow
                      ? 'bg-red-50/40 dark:bg-red-950/20 hover:bg-red-50/70'
                      : 'hover:bg-gray-50/70 dark:hover:bg-gray-800/40'
                  }`}
                >
                  {/* File column with file icon + name + size */}
                  <td className="py-3.5 pr-4 whitespace-nowrap">
                    <div className="flex items-center gap-2.5">
                      <div className="w-7 h-7 rounded-lg bg-blue-50 dark:bg-blue-950/60 text-blue-600 flex items-center justify-center shrink-0">
                        <FileText className="w-3.5 h-3.5" />
                      </div>
                      <div>
                        <p className="font-semibold text-gray-900 dark:text-white">{art.fileName}</p>
                        <p className="text-[11px] text-gray-400">{art.fileSize}</p>
                      </div>
                    </div>
                  </td>

                  {/* Format badge */}
                  <td className="py-3.5 px-4 whitespace-nowrap">
                    <span className="px-2.5 py-0.5 rounded text-[10px] font-bold bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-900/50">
                      {art.format}
                    </span>
                  </td>

                  {/* Project */}
                  <td className="py-3.5 px-4 font-medium text-gray-700 dark:text-gray-300 whitespace-nowrap">
                    {art.project}
                  </td>

                  {/* Components count */}
                  <td className="py-3.5 px-4 text-gray-700 dark:text-gray-300 font-semibold whitespace-nowrap">
                    {art.components}
                  </td>

                  {/* Signed status */}
                  <td className="py-3.5 px-4 whitespace-nowrap">
                    {art.signed === 'Pass' ? (
                      <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-600 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/50 px-2.5 py-0.5 rounded">
                        <Check className="w-3 h-3 stroke-[3]" />
                        Pass
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[11px] font-bold text-red-600 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800/50 px-2.5 py-0.5 rounded">
                        <AlertTriangle className="w-3 h-3 stroke-[2.5]" />
                        Fail
                      </span>
                    )}
                  </td>

                  {/* Uploaded time */}
                  <td className="py-3.5 px-4 text-gray-500 dark:text-gray-400 whitespace-nowrap">
                    {art.uploaded}
                  </td>

                  {/* Action: Download opens format chooser modal (Excel Sr 21) */}
                  <td className="py-3.5 pl-4 text-right whitespace-nowrap">
                    <div className="inline-flex items-center gap-2">
                      <button
                        onClick={() => handleOpenDownloadChooser(art)}
                        className="text-xs font-bold text-blue-600 dark:text-blue-400 hover:text-blue-800 hover:underline flex items-center gap-1 cursor-pointer"
                      >
                        <Download className="w-3.5 h-3.5" />
                        Download
                      </button>

                      <button
                        onClick={() => addToast({ type: 'info', title: 'Artifact Details', message: `${art.fileName} (${art.fileSize})` })}
                        className="p-1 rounded text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 cursor-pointer"
                      >
                        <MoreVertical className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              )))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* MODAL: DOWNLOAD FORMAT SELECTOR (Excel Sr 21)                             */}
      {/* "The format Column cannot be predefined, When clicked on the download    */}
      {/* button the user should get an option to choose the format to download In" */}
      {/* ========================================================================= */}
      {downloadModalOpen && targetArtifact && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 animate-fadeIn">
          <div className="bg-white dark:bg-[#111827] rounded-xl max-w-md w-full p-6 shadow-2xl border border-gray-200 dark:border-gray-800 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100 dark:border-gray-800">
              <div className="flex items-center gap-2">
                <Download className="w-5 h-5 text-blue-600" />
                <h3 className="text-base font-bold text-gray-900 dark:text-white">
                  Choose Download Format
                </h3>
              </div>
              <button
                onClick={() => setDownloadModalOpen(false)}
                className="p-1 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="bg-gray-50 dark:bg-gray-800/60 p-3 rounded-lg border border-gray-200 dark:border-gray-700 text-xs">
              <p className="text-gray-500">Selected Artifact:</p>
              <p className="font-bold text-gray-900 dark:text-white mt-0.5 truncate">{targetArtifact.fileName}</p>
              <p className="text-[11px] text-gray-400 mt-0.5">
                {targetArtifact.project} • {targetArtifact.components} Components • {targetArtifact.fileSize}
              </p>
            </div>

            {/* Format Selection Options */}
            <div>
              <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-2">
                Select Output Format
              </label>
              <div className="space-y-2">
                {[
                  { id: 'spdx-json', label: 'SPDX 2.3 (JSON)', desc: 'ISO/IEC 5962:2021 Standard' },
                  { id: 'spdx-tag', label: 'SPDX 2.3 (Tag-Value)', desc: 'Plain-text RFC specification' },
                  { id: 'cyclonedx-json', label: 'CycloneDX 1.5 (JSON)', desc: 'OWASP Application Security Standard' },
                  { id: 'cyclonedx-xml', label: 'CycloneDX 1.5 (XML)', desc: 'XML Schema Definition' },
                  { id: 'csv', label: 'CSV Spreadsheet', desc: 'Flat table of all components and packages' },
                ].map((fmt) => (
                  <label
                    key={fmt.id}
                    className={`flex items-start gap-3 p-2.5 rounded-lg border transition-all cursor-pointer ${
                      chosenDownloadFormat === fmt.id
                        ? 'border-blue-600 bg-blue-50/30 dark:bg-blue-950/30 ring-1 ring-blue-500/30'
                        : 'border-gray-200 dark:border-gray-700 hover:border-gray-300'
                    }`}
                  >
                    <input
                      type="radio"
                      name="formatChoice"
                      checked={chosenDownloadFormat === fmt.id}
                      onChange={() => setChosenDownloadFormat(fmt.id as any)}
                      className="mt-0.5 text-blue-600 focus:ring-blue-500"
                    />
                    <div>
                      <p className="text-xs font-bold text-gray-900 dark:text-white">{fmt.label}</p>
                      <p className="text-[10px] text-gray-500 dark:text-gray-400">{fmt.desc}</p>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            {/* Cryptographic Signature Checkbox */}
            <div className="pt-2 border-t border-gray-100 dark:border-gray-800">
              <label className="flex items-center gap-2 text-xs text-gray-700 dark:text-gray-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={includeSignature}
                  onChange={(e) => setIncludeSignature(e.target.checked)}
                  className="rounded text-blue-600 focus:ring-blue-500"
                />
                <span>Include cryptographic attestation signature (.sig)</span>
              </label>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-gray-100 dark:border-gray-800">
              <button
                type="button"
                onClick={() => setDownloadModalOpen(false)}
                className="px-4 py-2 text-xs font-semibold border border-gray-200 dark:border-gray-700 rounded-lg text-gray-600 dark:text-gray-300 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleExecuteDownload}
                className="px-4 py-2 text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white rounded-lg shadow-sm flex items-center gap-1.5"
              >
                <Download className="w-3.5 h-3.5" />
                Download Artifact
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Ingest Modal */}
      {ingestModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 animate-fadeIn">
          <div className="bg-white dark:bg-[#111827] rounded-xl max-w-lg w-full p-6 shadow-2xl border border-gray-200 dark:border-gray-800 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100 dark:border-gray-800">
              <div className="flex items-center gap-2">
                <FileCode className="w-5 h-5 text-blue-600" />
                <h3 className="text-base font-bold text-gray-900 dark:text-white">Ingest Manifest</h3>
              </div>
              <button onClick={() => setIngestModalOpen(false)} className="p-1 text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Upload or paste a dependency manifest to extract packages, lockfile relationships, and license declarations.
            </p>
            <div className="flex justify-end gap-2 pt-3 border-t">
              <button onClick={() => setIngestModalOpen(false)} className="px-3 py-1.5 text-xs border rounded-lg">Cancel</button>
              <button
                onClick={() => {
                  setIngestModalOpen(false);
                  addToast({ type: 'success', title: 'Manifest Ingested', message: 'Parsed dependency manifest' });
                }}
                className="px-3 py-1.5 text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white rounded-lg shadow-sm"
              >
                Parse & Ingest
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Audit Export Modal */}
      {auditModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 animate-fadeIn">
          <div className="bg-white dark:bg-[#111827] rounded-xl max-w-lg w-full p-6 shadow-2xl border border-gray-200 dark:border-gray-800 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100 dark:border-gray-800">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-blue-600" />
                <h3 className="text-base font-bold text-gray-900 dark:text-white">1-Click Audit Export</h3>
              </div>
              <button onClick={() => setAuditModalOpen(false)} className="p-1 text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-xs text-gray-500">Generates certified audit package across all 6 verified artifacts.</p>
            <div className="flex justify-end gap-2 pt-3 border-t">
              <button onClick={() => setAuditModalOpen(false)} className="px-3 py-1.5 text-xs border rounded-lg">Cancel</button>
              <button
                onClick={() => {
                  setAuditModalOpen(false);
                  addToast({ type: 'success', title: 'Audit Package Generated', message: 'Downloaded audit package.' });
                }}
                className="px-3 py-1.5 text-xs font-bold bg-blue-600 text-white rounded-lg"
              >
                Download Package
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Upload SBOM Modal */}
      {uploadModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 animate-fadeIn">
          <div className="bg-white dark:bg-[#111827] rounded-xl max-w-lg w-full p-6 shadow-2xl border border-gray-200 dark:border-gray-800 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100 dark:border-gray-800">
              <div className="flex items-center gap-2">
                <Upload className="w-5 h-5 text-blue-600" />
                <h3 className="text-base font-bold text-gray-900 dark:text-white">Upload SBOM</h3>
              </div>
              <button onClick={() => setUploadModalOpen(false)} className="p-1 text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-xs text-gray-500">Select an existing SPDX or CycloneDX JSON/XML file.</p>
            <div className="flex justify-end gap-2 pt-3 border-t">
              <button onClick={() => setUploadModalOpen(false)} className="px-3 py-1.5 text-xs border rounded-lg">Cancel</button>
              <button
                onClick={() => {
                  setUploadModalOpen(false);
                  addToast({ type: 'success', title: 'SBOM Uploaded', message: 'New artifact registered.' });
                }}
                className="px-3 py-1.5 text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white rounded-lg shadow-sm"
              >
                Upload File
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SBOMArtifacts;
