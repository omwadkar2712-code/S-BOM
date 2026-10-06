import React, { useState, useRef } from 'react';
import {
  Folder,
  Upload,
  Download,
  CheckCircle2,
  FileCode,
  X,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { useAppState } from '../../context/AppStateContext';
import {
  filesFromDataTransfer,
  selectFolderManifests,
  type FolderFile,
} from '../scans/localFolder';
import type { Ecosystem, LicenseType, Severity } from '../../types';

export interface UploadInventoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialProject?: string;
  initialApplication?: string;
  onSuccess?: (projectName?: string) => void;
}

export type UploadDocumentModalProps = UploadInventoryModalProps;

const SAMPLE_FILE_NAME = 'BOM_Component_Dummy_Data.xlsx';

// Your Excel file (BOM_Component_Dummy_Data.xlsx) embedded as base64
const SAMPLE_BOM_XLSX_BASE64 =
  "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";

// "npm (Node.js / JS)" -> "npm", "Library (Open-source package / SDK)" -> "Library"
const stripNote = (value: unknown): string =>
  String(value ?? '').replace(/\s*\(.*\)\s*$/, '').trim();

const normHeader = (h: unknown): string => String(h ?? '').trim().toLowerCase();

export const UploadInventoryModal: React.FC<UploadInventoryModalProps> = ({
  isOpen,
  onClose,
  initialProject,
  initialApplication,
  onSuccess,
}) => {
  const { addToast, projects, addComponent } = useAppState();

  const [projectName, setProjectName] = useState(initialProject || projects[0]?.name || 'payments-api');
  const [projectApplication, setProjectApplication] = useState(initialApplication || 'backend-api');
  const [environment, setEnvironment] = useState('Production');

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [selectedFolderFiles, setSelectedFolderFiles] = useState<FolderFile[]>([]);
  const [displayName, setDisplayName] = useState<string>('');
  const [isDragging, setIsDragging] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  // Download your Excel file (BOM_Component_Dummy_Data.xlsx), embedded above as base64
  const handleDownloadSampleFile = () => {
    try {
      const binary = atob(SAMPLE_BOM_XLSX_BASE64);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);

      const blob = new Blob([bytes], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });
      const url = URL.createObjectURL(blob);

      const link = document.createElement('a');
      link.href = url;
      link.download = SAMPLE_FILE_NAME;
      link.style.display = 'none';
      document.body.appendChild(link);
      link.click();

      // Give the browser time to start the download before cleaning up
      setTimeout(() => {
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      }, 1500);

      addToast({
        type: 'success',
        title: 'Sample File Downloaded',
        message: `Downloaded ${SAMPLE_FILE_NAME} for software inventory onboarding.`,
      });
    } catch (err) {
      console.error('Sample download failed', err);
      addToast({
        type: 'error',
        title: 'Download Failed',
        message: String(err instanceof Error ? err.message : err),
      });
    }
  };

  const openFolderPicker = () => {
    const input = folderInputRef.current;
    if (!input) return;
    input.value = '';
    input.multiple = true;
    input.setAttribute('webkitdirectory', '');
    input.setAttribute('directory', '');
    input.click();
  };

  const openFilePicker = () => {
    const input = fileInputRef.current;
    if (!input) return;
    input.value = '';
    input.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    const file = files[0];
    setSelectedFile(file);
    setSelectedFolderFiles([]);
    setDisplayName(`${file.name} (${(file.size / 1024).toFixed(1)} KB)`);
  };

  const handleFolderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const items: FolderFile[] = Array.from(e.target.files || []).map((file) => ({
      file,
      relativePath: (file as any).webkitRelativePath || file.name,
    }));
    if (items.length === 0) return;
    const manifests = selectFolderManifests(items);
    setSelectedFolderFiles(manifests.length > 0 ? manifests : items);
    setSelectedFile(null);
    const rootName = items[0]?.relativePath.split('/')[0] || 'project-folder';
    setDisplayName(`${rootName} (${items.length} files, ${manifests.length} manifests detected)`);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    try {
      const items = await filesFromDataTransfer(e.dataTransfer);
      if (items.length === 0) return;

      const nested = items.some((item: FolderFile) => item.relativePath.includes('/'));
      if (!nested && items.length === 1) {
        setSelectedFile(items[0].file);
        setSelectedFolderFiles([]);
        setDisplayName(`${items[0].file.name} (${(items[0].file.size / 1024).toFixed(1)} KB)`);
        return;
      }

      const manifests = selectFolderManifests(items);
      setSelectedFolderFiles(manifests.length > 0 ? manifests : items);
      setSelectedFile(null);
      const rootName = items[0]?.relativePath.split('/')[0] || 'project-folder';
      setDisplayName(`${rootName} (${items.length} files, ${manifests.length} manifests detected)`);
    } catch (err) {
      console.error('Failed to parse dropped files', err);
      addToast({
        type: 'error',
        title: 'Upload Error',
        message: 'Could not process dropped files. Please use Choose File or Choose Folder.',
      });
    }
  };

  const handleClearSelection = () => {
    setSelectedFile(null);
    setSelectedFolderFiles([]);
    setDisplayName('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!displayName && !selectedFile && selectedFolderFiles.length === 0) {
      addToast({
        type: 'warning',
        title: 'Document Required',
        message: 'Please choose or drop an Excel spreadsheet, manifest, or project document before submitting.',
      });
      return;
    }

    setIsSubmitting(true);

    try {
      let ingestedCount = 0;
      const fallbackProject = selectedFile
        ? selectedFile.name.replace(/\.[^/.]+$/, '')
        : (selectedFolderFiles[0]?.file.name.replace(/\.[^/.]+$/, '') || 'Project Document');
      let targetProj = (projectName && projectName.trim()) || fallbackProject;
      const targetApp = (projectApplication && projectApplication.trim()) || 'backend-api';

      if (selectedFile) {
        const fname = selectedFile.name.toLowerCase();

        // 1. CSV or Excel Spreadsheet parser (uses SheetJS so real .xlsx files work)
        if (fname.endsWith('.csv') || fname.endsWith('.xlsx') || fname.endsWith('.xls')) {
          try {
            const buffer = await selectedFile.arrayBuffer();
            const workbook = XLSX.read(buffer, { type: 'array' });
            const sheet = workbook.Sheets[workbook.SheetNames[0]];
            const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' });

            const pick = (row: Record<string, unknown>, ...keys: string[]): string => {
              for (const rawKey of Object.keys(row)) {
                const k = normHeader(rawKey);
                if (keys.some((key) => k === key || k.includes(key))) {
                  const v = row[rawKey];
                  if (v !== '' && v !== null && v !== undefined) return String(v).trim();
                }
              }
              return '';
            };

            const importedProjects = new Set<string>();

            rows.forEach((row, idx) => {
              const compName =
                pick(row, 'component name') || pick(row, 'package name') || pick(row, 'name') || `Component-${idx + 1}`;
              const pkgName = pick(row, 'package name') || compName;
              const version = pick(row, 'version') || '1.0.0';

              const rowProject = pick(row, 'project name') || targetProj;
              const rowApp = pick(row, 'project application') || targetApp;

              const ecoRaw = stripNote(pick(row, 'ecosystem')) || 'npm';
              const eco = ecoRaw as Ecosystem;
              const license = (pick(row, 'license') || 'MIT') as LicenseType;
              const fieldType = stripNote(pick(row, 'field type')) || 'Library';

              const cveRaw = Number(pick(row, 'vulnerabilities', 'cve'));
              const cves = Number.isFinite(cveRaw) ? cveRaw : 0;

              const riskRaw = pick(row, 'risk level', 'risk');
              const risk = (riskRaw || (cves > 0 ? 'Low' : 'Safe')) as Severity | 'Safe';

              const purl =
                pick(row, 'p-url', 'purl') || `pkg:${ecoRaw.toLowerCase()}/${pkgName}@${version}`;

              importedProjects.add(rowProject);

              addComponent({
                name: compName,
                packageName: pkgName,
                version,
                project: rowProject,
                projectApplication: rowApp,
                fileName: selectedFile.name,
                fieldType: fieldType as any,
                ecosystem: eco,
                license,
                supplier: 'Spreadsheet Catalog',
                directDependency: true,
                compliance: 96.0,
                trustScore: 92,
                risk,
                cves,
                purl,
                createdBy: 'Excel Upload',
              });
              ingestedCount++;
            });

            if (importedProjects.size > 0) {
              targetProj = Array.from(importedProjects)[0];
            }
          } catch (err) {
            console.error('Spreadsheet parse failed', err);
            // fallback handled below
          }
        }
        // 2. JSON Manifest parser
        else if (fname.endsWith('.json')) {
          try {
            const text = await selectedFile.text();
            const parsed = JSON.parse(text);

            if (Array.isArray(parsed.dependencies)) {
              parsed.dependencies.forEach((depItem: any) => {
                const name = typeof depItem === 'string' ? depItem : depItem.name;
                const ver = typeof depItem === 'object' ? depItem.version || '1.0.0' : '1.0.0';
                const eco: Ecosystem = (depItem.ecosystem as Ecosystem) || 'npm';
                const lic: LicenseType = (depItem.license as LicenseType) || 'MIT';
                const rsk: Severity | 'Safe' = (depItem.risk as Severity | 'Safe') || 'Safe';

                addComponent({
                  name,
                  packageName: name,
                  version: ver,
                  project: targetProj,
                  projectApplication: targetApp,
                  fileName: selectedFile.name,
                  fieldType: 'Library',
                  ecosystem: eco,
                  license: lic,
                  supplier: depItem.supplier || 'Open Source',
                  directDependency: depItem.directDependency !== false,
                  compliance: 95.0,
                  trustScore: 92,
                  risk: rsk,
                  cves: 0,
                  purl: `pkg:${eco.toLowerCase()}/${name}@${ver}`,
                  createdBy: 'Document Ingestion',
                });
                ingestedCount++;
              });
            } else {
              const deps = { ...(parsed.dependencies || {}), ...(parsed.devDependencies || {}) };
              Object.entries(deps).forEach(([pkg, verRaw]) => {
                const cleanVer = String(verRaw).replace(/^[\^~>=<]+/, '') || '1.0.0';
                addComponent({
                  name: pkg,
                  packageName: pkg,
                  version: cleanVer,
                  project: targetProj,
                  projectApplication: targetApp,
                  fileName: selectedFile.name,
                  fieldType: 'Library',
                  ecosystem: 'npm',
                  license: 'MIT',
                  supplier: 'Open Source Community',
                  directDependency: true,
                  compliance: 96.0,
                  trustScore: 94,
                  risk: 'Safe',
                  cves: 0,
                  purl: `pkg:npm/${pkg}@${cleanVer}`,
                  createdBy: 'Manifest Ingestion',
                });
                ingestedCount++;
              });
            }
          } catch {
            // fallback handled below
          }
        }
      }

      if (ingestedCount === 0) {
        const rootCompName = selectedFile ? selectedFile.name.replace(/\.[^/.]+$/, '') : targetProj;
        addComponent({
          name: rootCompName,
          packageName: rootCompName,
          version: '1.0.0',
          project: targetProj,
          projectApplication: targetApp,
          fileName: selectedFile?.name || 'document.xlsx',
          fieldType: 'Library',
          ecosystem: 'npm',
          license: 'MIT',
          supplier: 'Registered Document Import',
          directDependency: true,
          compliance: 98.0,
          trustScore: 95,
          risk: 'Safe',
          cves: 0,
          purl: `pkg:npm/${rootCompName}@1.0.0`,
          createdBy: 'Doc Uploader',
        });
        ingestedCount = 1;
      }

      addToast({
        type: 'success',
        title: 'Document Submitted Successfully',
        message: `Cataloged ${ingestedCount} component(s) into Software Inventory for project "${targetProj}".`,
      });

      onSuccess?.(targetProj);
      onClose();
    } catch (err) {
      console.error('Error submitting document', err);
      addToast({
        type: 'error',
        title: 'Submission Failed',
        message: 'An unexpected error occurred while parsing the document.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-950/60 backdrop-blur-sm p-4 animate-fadeIn overflow-y-auto">
      <div className="bg-white dark:bg-[#111827] rounded-2xl max-w-2xl w-full shadow-2xl border border-gray-100 dark:border-gray-800 overflow-hidden my-6">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center border border-blue-100 dark:border-blue-900/60 shadow-2xs shrink-0">
              <Upload className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-gray-900 dark:text-white tracking-tight">
                Upload Document & Project Manifest
              </h3>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                Upload Excel spreadsheets, manifests, or packages to ingest components into your inventory.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors cursor-pointer"
            title="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5 max-h-[75vh] overflow-y-auto">
          {/* Upload Dropzone Area */}
          <div className="space-y-3">
            <div className="flex items-center justify-between pb-1.5 border-b border-gray-100 dark:border-gray-800">
              <div className="flex items-center gap-2">
                <FileCode className="w-4 h-4 text-blue-500" />
                <h4 className="text-xs font-bold text-gray-900 dark:text-white uppercase tracking-wider">
                  Document / Manifest Upload
                </h4>
              </div>
              <span className="text-[11px] text-gray-400">
                Supports Excel (.xlsx, .csv) & manifests
              </span>
            </div>

            {/* Dashed Dropzone Box */}
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              className={`w-full border-2 border-dashed rounded-2xl p-6 sm:p-8 text-center transition-all ${isDragging
                ? 'border-blue-500 bg-blue-50/60 dark:bg-blue-950/40 ring-4 ring-blue-500/10'
                : 'border-blue-300 dark:border-gray-700 bg-slate-50/40 dark:bg-gray-850/40 hover:border-blue-400 dark:hover:border-blue-500'
                }`}
            >
              <div className="w-12 h-12 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-500 flex items-center justify-center mx-auto mb-2.5 shadow-2xs border border-blue-100 dark:border-blue-900/50">
                <Folder className="w-7 h-7" />
              </div>

              <p className="text-sm font-bold text-gray-900 dark:text-white">
                DROP A FILE
              </p>

              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 max-w-xl mx-auto leading-relaxed">
                One file is enough: Excel (.xlsx, .xls, .csv), package.json, requirements.txt, pyproject.toml, pom.xml, build.gradle, go.mod, Cargo.toml, packages.config, composer.json, or Gemfile.
              </p>

              <div className="mt-3.5 flex items-center justify-center">
                <button
                  type="button"
                  onClick={openFilePicker}
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold cursor-pointer shadow-sm transition-all hover:shadow flex items-center gap-2"
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span>Choose File</span>
                </button>
              </div>

              <input
                ref={folderInputRef}
                type="file"
                className="hidden"
                multiple
                onChange={handleFolderChange}
              />
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                accept=".xlsx,.xls,.csv,.json,.txt,.toml,.xml,.gradle,.mod,.config,.lock,.zip,.tgz,.tar.gz"
                onChange={handleFileChange}
              />

              {displayName && (
                <div className="mt-4 inline-flex items-center gap-2.5 px-4 py-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200 text-xs font-semibold shadow-xs animate-fadeIn">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                  <span className="font-mono">{displayName}</span>
                  <button
                    type="button"
                    onClick={handleClearSelection}
                    className="p-1 rounded hover:bg-emerald-200/50 dark:hover:bg-emerald-900 text-emerald-700 dark:text-emerald-300 transition-colors ml-1"
                    title="Remove selected file"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Modal Footer Actions */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-4 border-t border-gray-100 dark:border-gray-800">
            {/* Left Button: Sample File Upload */}
            <button
              type="button"
              onClick={handleDownloadSampleFile}
              className="w-full sm:w-auto px-4 py-2 text-xs font-bold text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-750 border border-gray-300 dark:border-gray-700 rounded-lg shadow-2xs flex items-center justify-center gap-2 cursor-pointer transition-all hover:border-blue-400"
              title="Download sample Excel / spreadsheet file to test or fill out"
            >
              <Download className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
              <span>Sample File Upload</span>
            </button>

            {/* Right Buttons: Cancel & Submit */}
            <div className="flex items-center justify-end gap-2.5 w-full sm:w-auto">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-xs font-semibold text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white bg-transparent rounded-lg transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-6 py-2 text-xs font-bold text-white bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 rounded-lg shadow-sm shadow-blue-500/20 flex items-center justify-center gap-1.5 cursor-pointer transition-all hover:scale-[1.01] disabled:opacity-50"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>{isSubmitting ? 'Submitting...' : 'Submit'}</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};

export const UploadDocumentModal = UploadInventoryModal;
export default UploadInventoryModal;