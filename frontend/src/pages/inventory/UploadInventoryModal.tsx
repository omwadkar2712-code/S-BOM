import React, { useState, useRef } from 'react';
import {
  X,
  Upload,
  Download,
  FileSpreadsheet,
  CheckCircle2,
  AlertCircle,
  FileText,
  FileCheck,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { useAppState } from '../../context/AppStateContext';
import type { SBOMComponent } from '../../types';

interface UploadInventoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

function downloadSampleExcel() {
  const wb = XLSX.utils.book_new();
  const headers = [
    'Project Name',
    'Project Application',
    'Component Name',
    'Package Name',
    'Version',
    'File Name',
    'License',
    'Ecosystem',
    'Risk Level',
    'Package URL',
    'Created By',
  ];
  const sampleRows = [
    [
      'Payments Gateway API',
      'payments-api',
      'axios',
      'axios',
      '1.6.8',
      'package.json',
      'MIT',
      'npm',
      'Safe',
      'pkg:npm/axios@1.6.8',
      'SecOps Admin',
    ],
    [
      'Payments Gateway API',
      'payments-api',
      'express',
      'express',
      '4.19.2',
      'package.json',
      'MIT',
      'npm',
      'Safe',
      'pkg:npm/express@4.19.2',
      'SecOps Admin',
    ],
    [
      'Auth Core',
      'auth-service',
      'jsonwebtoken',
      'jsonwebtoken',
      '9.0.2',
      'pom.xml',
      'MIT',
      'npm',
      'Safe',
      'pkg:npm/jsonwebtoken@9.0.2',
      'DevOps Team',
    ],
    [
      'Analytics Engine',
      'analytics-worker',
      'lodash',
      'lodash',
      '4.17.21',
      'requirements.txt',
      'MIT',
      'npm',
      'Low',
      'pkg:npm/lodash@4.17.21',
      'Asha Mehta',
    ],
  ];

  const ws = XLSX.utils.aoa_to_sheet([headers, ...sampleRows]);

  // Set explicit column widths for Excel presentation
  ws['!cols'] = [
    { wch: 24 }, // Project Name
    { wch: 22 }, // Project Application
    { wch: 20 }, // Component Name
    { wch: 20 }, // Package Name
    { wch: 12 }, // Version
    { wch: 18 }, // File Name
    { wch: 14 }, // License
    { wch: 14 }, // Ecosystem
    { wch: 14 }, // Risk Level
    { wch: 32 }, // Package URL
    { wch: 18 }, // Created By
  ];

  XLSX.utils.book_append_sheet(wb, ws, 'Software Inventory');

  const excelBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  const blob = new Blob([excelBuffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'software_inventory_sample_template.xlsx';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export const UploadInventoryModal: React.FC<UploadInventoryModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const { addComponents, addToast } = useAppState();

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [parsedComponents, setParsedComponents] = useState<Partial<SBOMComponent>[]>([]);
  const [parseError, setParseError] = useState<string | null>(null);
  const [isParsing, setIsParsing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleFileChange = async (file: File) => {
    setSelectedFile(file);
    setParseError(null);
    setIsParsing(true);
    setParsedComponents([]);

    try {
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: 'array' });
      if (!workbook.SheetNames.length) {
        throw new Error('The workbook contains no sheets.');
      }
      const firstSheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[firstSheetName];
      const rawRows: any[] = XLSX.utils.sheet_to_json(worksheet, { defval: '' });

      if (!rawRows.length) {
        throw new Error('No data rows found in the uploaded file.');
      }

      const getVal = (row: any, possibleKeys: string[]): string => {
        for (const key of Object.keys(row)) {
          const cleanKey = key.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
          for (const pk of possibleKeys) {
            if (cleanKey === pk.toLowerCase().replace(/[^a-z0-9]/g, '')) {
              return String(row[key]).trim();
            }
          }
        }
        return '';
      };

      const mapped: Partial<SBOMComponent>[] = [];

      for (const row of rawRows) {
        const project = getVal(row, ['Project Name', 'Project', 'ProjectName']) || 'Imported Project';
        const projectApplication =
          getVal(row, ['Project Application', 'Application', 'App', 'ProjectApp']) || 'backend-api';
        const name =
          getVal(row, ['Component Name', 'Component', 'ComponentName', 'Name']) ||
          getVal(row, ['Package Name', 'Package']) ||
          '';
        const packageName = getVal(row, ['Package Name', 'Package', 'PackageName']) || name;
        const version = getVal(row, ['Version', 'Ver']) || '1.0.0';
        const fileName =
          getVal(row, ['File Name', 'FileName', 'File', 'Field Name', 'FieldName']) || 'package.json';
        const license = (getVal(row, ['License', 'Licence']) || 'MIT') as any;
        const ecosystem = (getVal(row, ['Ecosystem', 'Eco']) || 'npm') as any;
        const risk = (getVal(row, ['Risk Level', 'Risk', 'RiskLevel']) || 'Safe') as any;
        const purl =
          getVal(row, ['Package URL', 'PURL', 'P-URL', 'PackageURL']) ||
          `pkg:${ecosystem.toLowerCase()}/${packageName}@${version}`;
        const createdBy = getVal(row, ['Created By', 'CreatedBy', 'Author', 'Owner']) || 'SecOps Admin';

        if (!name) continue;

        mapped.push({
          name,
          packageName,
          version,
          project,
          projectApplication,
          fileName,
          fieldType: 'Library',
          license,
          ecosystem,
          risk,
          purl,
          createdBy,
          directDependency: true,
          compliance: 95,
          trustScore: 90,
          cves: 0,
          supplier: 'Imported Inventory Component',
        });
      }

      if (!mapped.length) {
        throw new Error(
          'Could not find valid component rows. Please ensure your file has columns like "Component Name", "Version", "Project Name", and "File Name".'
        );
      }

      setParsedComponents(mapped);
    } catch (err) {
      setParseError(err instanceof Error ? err.message : 'Failed to parse file.');
    } finally {
      setIsParsing(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      void handleFileChange(e.dataTransfer.files[0]);
    }
  };

  const handleSubmit = async () => {
    if (!parsedComponents.length || isSubmitting) return;

    setIsSubmitting(true);
    try {
      await addComponents(parsedComponents);
      addToast({
        type: 'success',
        title: 'Inventory Imported',
        message: `Successfully imported ${parsedComponents.length} components from ${
          selectedFile?.name || 'file'
        }.`,
      });
      if (onSuccess) onSuccess();
      onClose();
    } catch (err) {
      addToast({
        type: 'error',
        title: 'Import Failed',
        message: err instanceof Error ? err.message : 'Could not save components to inventory.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResetFile = () => {
    setSelectedFile(null);
    setParsedComponents([]);
    setParseError(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-fadeIn">
      <div className="bg-white dark:bg-[#111827] rounded-2xl max-w-xl w-full p-6 shadow-2xl border border-gray-200 dark:border-gray-800 space-y-5 animate-scaleUp">
        {/* Header */}
        <div className="flex items-start justify-between pb-3 border-b border-gray-100 dark:border-gray-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center border border-emerald-200/60 dark:border-emerald-800/60 shadow-2xs">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-gray-900 dark:text-white">
                Upload Inventory File
              </h3>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Bulk import software components using Excel (.xlsx, .xls) or CSV
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Upload Dropzone */}
        <div className="space-y-3">
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,text/csv"
            className="hidden"
            onChange={(e) => {
              if (e.target.files && e.target.files[0]) {
                void handleFileChange(e.target.files[0]);
              }
            }}
          />

          {!selectedFile ? (
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragging(true);
              }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all ${
                isDragging
                  ? 'border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/20 scale-[1.01]'
                  : 'border-gray-300 dark:border-gray-700 hover:border-emerald-500 dark:hover:border-emerald-400 bg-gray-50/50 dark:bg-gray-800/30'
              }`}
            >
              <div className="w-12 h-12 rounded-xl bg-emerald-100/80 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto mb-3 shadow-2xs">
                <Upload className="w-6 h-6" />
              </div>
              <p className="text-xs font-bold text-gray-800 dark:text-gray-200">
                Click to browse or drag & drop Excel / CSV file
              </p>
              <p className="text-[11px] text-gray-400 dark:text-gray-500 mt-1">
                Supports .xlsx, .xls, and .csv formats
              </p>
            </div>
          ) : (
            <div className="p-4 bg-emerald-50/40 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800/60 rounded-xl space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-9 h-9 rounded-lg bg-emerald-100 dark:bg-emerald-900/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                    <FileCheck className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-gray-900 dark:text-white truncate">
                      {selectedFile.name}
                    </p>
                    <p className="text-[10px] text-gray-500 font-mono">
                      {(selectedFile.size / 1024).toFixed(1)} KB · {selectedFile.type || 'Spreadsheet'}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleResetFile}
                  className="p-1 rounded text-gray-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors cursor-pointer"
                  title="Remove file"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Status information */}
              {isParsing && (
                <div className="flex items-center gap-2 text-xs text-blue-600 dark:text-blue-400 pt-1">
                  <div className="w-3.5 h-3.5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                  <span>Parsing worksheet data…</span>
                </div>
              )}

              {parseError && (
                <div className="flex items-start gap-2 p-2.5 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 rounded-lg text-xs text-red-700 dark:text-red-300">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span className="leading-snug">{parseError}</span>
                </div>
              )}

              {parsedComponents.length > 0 && (
                <div className="space-y-2 pt-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-emerald-700 dark:text-emerald-300 flex items-center gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>{parsedComponents.length} components parsed successfully</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="text-[11px] text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
                    >
                      Change file
                    </button>
                  </div>

                  {/* Quick table preview (first 3 rows) */}
                  <div className="max-h-32 overflow-y-auto rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 text-[11px]">
                    <table className="w-full text-left">
                      <thead className="bg-gray-50 dark:bg-gray-800 text-gray-500 font-semibold sticky top-0">
                        <tr>
                          <th className="px-2.5 py-1">Component</th>
                          <th className="px-2 py-1">Version</th>
                          <th className="px-2 py-1">File Name</th>
                          <th className="px-2 py-1">Project</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100 dark:divide-gray-800 font-mono">
                        {parsedComponents.slice(0, 3).map((comp, idx) => (
                          <tr key={idx} className="hover:bg-gray-50 dark:hover:bg-gray-800/40">
                            <td className="px-2.5 py-1 font-semibold font-sans text-gray-900 dark:text-white truncate max-w-[120px]">
                              {comp.name}
                            </td>
                            <td className="px-2 py-1 text-gray-600 dark:text-gray-300">{comp.version}</td>
                            <td className="px-2 py-1 text-blue-600 dark:text-blue-400">{comp.fileName}</td>
                            <td className="px-2 py-1 text-gray-500 font-sans truncate max-w-[120px]">
                              {comp.project}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Modal Actions Footer: Submit & Download Sample File */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 pt-3 border-t border-gray-100 dark:border-gray-800">
          {/* Button 1: Download Sample File (in Excel format) */}
          <button
            type="button"
            onClick={downloadSampleExcel}
            className="px-3.5 py-2 text-xs font-semibold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/50 hover:bg-emerald-100 dark:hover:bg-emerald-900/50 border border-emerald-200 dark:border-emerald-800 rounded-lg flex items-center justify-center gap-1.5 transition-colors cursor-pointer shadow-2xs"
            title="Download sample Excel template (.xlsx)"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Download Sample File (Excel)</span>
          </button>

          <div className="flex items-center gap-2 justify-end">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-2 text-xs font-semibold text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-750 transition-colors cursor-pointer shadow-2xs"
            >
              Cancel
            </button>

            {/* Button 2: Submit */}
            <button
              type="button"
              disabled={!parsedComponents.length || isSubmitting}
              onClick={handleSubmit}
              className="px-4 py-2 text-xs font-bold text-white bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 rounded-lg shadow-sm shadow-blue-500/20 flex items-center justify-center gap-1.5 cursor-pointer transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>
                {isSubmitting
                  ? 'Importing…'
                  : parsedComponents.length > 0
                  ? `Submit (${parsedComponents.length})`
                  : 'Submit'}
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
