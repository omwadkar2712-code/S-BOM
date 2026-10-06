import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Package,
  Layers,
  Shield,
  CheckCircle2,
  Upload,
  ArrowLeft,
} from 'lucide-react';
import { useAppState } from '../../context/AppStateContext';
import { LicenseType, Severity, Ecosystem } from '../../types';
import { UploadInventoryModal } from './UploadInventoryModal';

export const AddInventoryComponent: React.FC = () => {
  const navigate = useNavigate();
  const { addToast, projects, addComponent } = useAppState();

  // Form State
  const [projectName, setProjectName] = useState('');
  const [projectApplication, setProjectApplication] = useState('');
  const [componentName, setComponentName] = useState('');
  const [packageName, setPackageName] = useState('');
  const [version, setVersion] = useState('');
  const [fileName, setFileName] = useState('package.json');
  const [ecosystem, setEcosystem] = useState<Ecosystem>('npm');
  const [license, setLicense] = useState<LicenseType>('MIT');
  const [purl, setPurl] = useState('');
  const [purlManuallyEdited, setPurlManuallyEdited] = useState(false);
  const [riskLevel, setRiskLevel] = useState<Severity | 'Safe'>('Safe');
  const [createdBy, setCreatedBy] = useState('SecOps Admin');

  // Modal State for Upload File
  const [uploadModalOpen, setUploadModalOpen] = useState(false);

  // Auto-generate canonical Package URL (P-URL) live when not manually overridden
  useEffect(() => {
    if (!purlManuallyEdited) {
      const pkg = packageName.trim() || componentName.trim();
      const ver = version.trim();
      if (pkg && ver) {
        setPurl(`pkg:${ecosystem.toLowerCase()}/${pkg}@${ver}`);
      } else if (pkg) {
        setPurl(`pkg:${ecosystem.toLowerCase()}/${pkg}`);
      } else {
        setPurl('');
      }
    }
  }, [packageName, componentName, version, ecosystem, purlManuallyEdited]);

  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saving) return;

    const trimmedProject = projectName.trim();
    const trimmedApp = projectApplication.trim();
    const trimmedComp = componentName.trim();
    const trimmedPkg = packageName.trim() || trimmedComp;
    const trimmedVer = version.trim();
    const trimmedFile = fileName.trim() || 'package.json';
    const trimmedCreatedBy = createdBy.trim() || 'SecOps Admin';

    if (!trimmedProject) {
      addToast({
        type: 'warning',
        title: 'Validation Error',
        message: 'Project Name is required.',
      });
      return;
    }

    if (!trimmedApp) {
      addToast({
        type: 'warning',
        title: 'Validation Error',
        message: 'Project Application is required.',
      });
      return;
    }

    if (!trimmedComp) {
      addToast({
        type: 'warning',
        title: 'Validation Error',
        message: 'Component Name is required.',
      });
      return;
    }

    if (!trimmedVer) {
      addToast({
        type: 'warning',
        title: 'Validation Error',
        message: 'Version is required.',
      });
      return;
    }

    const finalPurl =
      purl.trim() ||
      `pkg:${ecosystem.toLowerCase()}/${trimmedPkg}@${trimmedVer}`;

    setSaving(true);
    try {
      await addComponent({
        name: trimmedComp,
        packageName: trimmedPkg,
        version: trimmedVer,
        project: trimmedProject,
        projectApplication: trimmedApp,
        fileName: trimmedFile,
        fieldType: 'Library',
        ecosystem,
        license,
        supplier: 'Registered Software Component',
        directDependency: true,
        compliance: 95.0,
        trustScore: 90,
        risk: riskLevel,
        cves: 0,
        purl: finalPurl,
        createdBy: trimmedCreatedBy,
      });
    } catch (error) {
      addToast({
        type: 'error',
        title: 'Could not save component',
        message: error instanceof Error ? error.message : 'The component was not saved to the database.',
      });
      setSaving(false);
      return;
    }

    addToast({
      type: 'success',
      title: 'Component Added',
      message: `Successfully added ${trimmedComp}@${trimmedVer} to ${trimmedProject}.`,
    });

    navigate('/software-inventory');
  };

  return (
    <div className="w-full max-w-7xl mx-auto animate-fadeIn pb-6">
      {/* Top Header Bar with Upload File button */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => navigate('/software-inventory')}
            className="p-1.5 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-300 transition-colors cursor-pointer"
            title="Back to Software Inventory"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <h1 className="text-base font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <Package className="w-4 h-4 text-blue-600" />
              <span>Add Inventory Component</span>
            </h1>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Register a software component manually or bulk import via Excel file
            </p>
          </div>
        </div>

        {/* Upload File Button */}
        <button
          type="button"
          onClick={() => setUploadModalOpen(true)}
          className="px-4 py-2 text-xs font-bold text-white bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 rounded-lg shadow-sm shadow-emerald-500/20 flex items-center gap-2 cursor-pointer transition-all shrink-0 self-start sm:self-auto hover:scale-[1.01]"
          title="Upload Excel or CSV file"
        >
          <Upload className="w-3.5 h-3.5" />
          <span>Upload File</span>
        </button>
      </div>

      {/* Single Unified Full Form Card */}
      <div className="bg-white dark:bg-[#111827] border border-gray-200 dark:border-gray-800 rounded-xl p-4 sm:p-5 shadow-xs">
        <form id="add-inventory-form" onSubmit={handleSubmit} className="space-y-4">
          {/* Section 1: Basic Information */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between pb-1.5 border-b border-gray-100 dark:border-gray-800">
              <div className="flex items-center gap-2">
                <div className="w-5 h-5 rounded-md bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center border border-blue-200/60 dark:border-blue-800/60">
                  <Layers className="w-3 h-3" />
                </div>
                <h2 className="text-xs font-bold text-gray-900 dark:text-white uppercase tracking-wider">
                  Basic Information
                </h2>
              </div>
              <span className="text-[10px] font-semibold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/50 px-2 py-0.5 rounded border border-blue-100 dark:border-blue-900/50">
                * Required Fields
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 sm:gap-3 pt-0.5">
              {/* Project Name */}
              <div>
                <label className="block text-[11px] font-bold text-gray-700 dark:text-gray-300 uppercase tracking-tight mb-1">
                  Project Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  list="project-names-list"
                  value={projectName}
                  onChange={(e) => setProjectName(e.target.value)}
                  placeholder="e.g. payments-api"
                  className="w-full px-2.5 py-1.5 text-xs bg-gray-50/70 dark:bg-gray-800/80 border border-gray-200 dark:border-gray-700 rounded-lg text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 focus:bg-white dark:focus:bg-gray-850 transition-colors shadow-2xs"
                />
                <datalist id="project-names-list">
                  {projects.map((p) => (
                    <option key={p.id} value={p.name} />
                  ))}
                </datalist>
              </div>

              {/* Project Application */}
              <div>
                <label className="block text-[11px] font-bold text-gray-700 dark:text-gray-300 uppercase tracking-tight mb-1">
                  Project Application <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={projectApplication}
                  onChange={(e) => setProjectApplication(e.target.value)}
                  placeholder="e.g. backend-api, auth-service"
                  className="w-full px-2.5 py-1.5 text-xs font-mono bg-gray-50/70 dark:bg-gray-800/80 border border-gray-200 dark:border-gray-700 rounded-lg text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 focus:bg-white dark:focus:bg-gray-850 transition-colors shadow-2xs"
                />
              </div>

              {/* Component Name */}
              <div>
                <label className="block text-[11px] font-bold text-gray-700 dark:text-gray-300 uppercase tracking-tight mb-1">
                  Component Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={componentName}
                  onChange={(e) => {
                    const val = e.target.value;
                    setComponentName(val);
                    if (!packageName) {
                      setPackageName(val);
                    }
                  }}
                  placeholder="e.g. axios, express, log4j-core"
                  className="w-full px-2.5 py-1.5 text-xs bg-gray-50/70 dark:bg-gray-800/80 border border-gray-200 dark:border-gray-700 rounded-lg text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 focus:bg-white dark:focus:bg-gray-850 transition-colors shadow-2xs"
                />
              </div>

              {/* Package Name */}
              <div>
                <label className="block text-[11px] font-bold text-gray-700 dark:text-gray-300 uppercase tracking-tight mb-1">
                  Package Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={packageName}
                  onChange={(e) => setPackageName(e.target.value)}
                  placeholder="e.g. axios, @angular/core, org.apache:log4j"
                  className="w-full px-2.5 py-1.5 text-xs font-mono bg-gray-50/70 dark:bg-gray-800/80 border border-gray-200 dark:border-gray-700 rounded-lg text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 focus:bg-white dark:focus:bg-gray-850 transition-colors shadow-2xs"
                />
              </div>

              {/* Version */}
              <div>
                <label className="block text-[11px] font-bold text-gray-700 dark:text-gray-300 uppercase tracking-tight mb-1">
                  Version <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={version}
                  onChange={(e) => setVersion(e.target.value)}
                  placeholder="e.g. 1.7.4, 2.17.1"
                  className="w-full px-2.5 py-1.5 text-xs font-mono bg-gray-50/70 dark:bg-gray-800/80 border border-gray-200 dark:border-gray-700 rounded-lg text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 focus:bg-white dark:focus:bg-gray-850 transition-colors shadow-2xs"
                />
              </div>

              {/* File Name (Changed from Field Type) */}
              <div>
                <label className="block text-[11px] font-bold text-gray-700 dark:text-gray-300 uppercase tracking-tight mb-1">
                  File Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={fileName}
                  onChange={(e) => setFileName(e.target.value)}
                  placeholder="e.g. package.json, pom.xml, app.js"
                  className="w-full px-2.5 py-1.5 text-xs font-mono bg-gray-50/70 dark:bg-gray-800/80 border border-gray-200 dark:border-gray-700 rounded-lg text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 focus:bg-white dark:focus:bg-gray-850 transition-colors shadow-2xs"
                />
              </div>
            </div>
          </div>

          {/* Section 2: Package & Security Information (Vulnerabilities removed) */}
          <div className="space-y-2.5 pt-2">
            <div className="flex items-center gap-2 pb-1.5 border-b border-gray-100 dark:border-gray-800">
              <div className="w-5 h-5 rounded-md bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center border border-emerald-200/60 dark:border-emerald-800/60">
                <Shield className="w-3 h-3" />
              </div>
              <h2 className="text-xs font-bold text-gray-900 dark:text-white uppercase tracking-wider">
                Package & Security Information
              </h2>
            </div>

            {/* Row 1: License, Ecosystem, Risk Level */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 sm:gap-3 pt-0.5">
              {/* License */}
              <div>
                <label className="block text-[11px] font-bold text-gray-700 dark:text-gray-300 uppercase tracking-tight mb-1">
                  License
                </label>
                <select
                  value={license}
                  onChange={(e) => setLicense(e.target.value as LicenseType)}
                  className="w-full px-2.5 py-1.5 text-xs bg-gray-50/70 dark:bg-gray-800/80 border border-gray-200 dark:border-gray-700 rounded-lg text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 focus:bg-white dark:focus:bg-gray-850 transition-colors shadow-2xs cursor-pointer"
                >
                  <option value="MIT">MIT</option>
                  <option value="Apache-2.0">Apache-2.0</option>
                  <option value="BSD-3-Clause">BSD-3-Clause</option>
                  <option value="GPL-3.0">GPL-3.0</option>
                  <option value="LGPL-3.0">LGPL-3.0</option>
                  <option value="MPL-2.0">MPL-2.0</option>
                  <option value="ISC">ISC</option>
                  <option value="Commercial">Commercial / Proprietary</option>
                  <option value="Unknown">Unknown</option>
                </select>
              </div>

              {/* Ecosystem */}
              <div>
                <label className="block text-[11px] font-bold text-gray-700 dark:text-gray-300 uppercase tracking-tight mb-1">
                  Ecosystem
                </label>
                <select
                  value={ecosystem}
                  onChange={(e) => setEcosystem(e.target.value as Ecosystem)}
                  className="w-full px-2.5 py-1.5 text-xs bg-gray-50/70 dark:bg-gray-800/80 border border-gray-200 dark:border-gray-700 rounded-lg text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 focus:bg-white dark:focus:bg-gray-850 transition-colors shadow-2xs cursor-pointer"
                >
                  <option value="npm">npm (Node.js / JS)</option>
                  <option value="PyPI">PyPI (Python)</option>
                  <option value="Maven">Maven (Java / JVM)</option>
                  <option value="Go">Go Modules (Golang)</option>
                  <option value="Cargo">Cargo (Rust)</option>
                  <option value="NuGet">NuGet (.NET / C#)</option>
                  <option value="RubyGems">RubyGems (Ruby)</option>
                  <option value="Packagist">Packagist (PHP / Composer)</option>
                </select>
              </div>

              {/* Risk Level */}
              <div>
                <label className="block text-[11px] font-bold text-gray-700 dark:text-gray-300 uppercase tracking-tight mb-1">
                  Risk Level
                </label>
                <select
                  value={riskLevel}
                  onChange={(e) => setRiskLevel(e.target.value as Severity | 'Safe')}
                  className="w-full px-2.5 py-1.5 text-xs bg-gray-50/70 dark:bg-gray-800/80 border border-gray-200 dark:border-gray-700 rounded-lg text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 focus:bg-white dark:focus:bg-gray-850 transition-colors shadow-2xs cursor-pointer"
                >
                  <option value="Safe">Safe</option>
                  <option value="Low">Low</option>
                  <option value="Medium">Medium</option>
                  <option value="High">High</option>
                  <option value="Critical">Critical</option>
                </select>
              </div>
            </div>

            {/* Row 2: Package URL (small) & Created By side-by-side */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 sm:gap-3 pt-1">
              {/* P-URL (Package URL) */}
              <div>
                <label className="block text-[11px] font-bold text-gray-700 dark:text-gray-300 uppercase tracking-tight mb-1">
                  P-URL (Package URL)
                </label>
                <input
                  type="text"
                  value={purl}
                  onChange={(e) => {
                    setPurl(e.target.value);
                    setPurlManuallyEdited(true);
                  }}
                  placeholder="pkg:npm/package-name@version"
                  className="w-full px-2.5 py-1.5 text-xs font-mono bg-gray-50/70 dark:bg-gray-800/80 border border-gray-200 dark:border-gray-700 rounded-lg text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 focus:bg-white dark:focus:bg-gray-850 transition-colors shadow-2xs"
                />
              </div>

              {/* Created By (Styled the same way as Package URL) */}
              <div>
                <label className="block text-[11px] font-bold text-gray-700 dark:text-gray-300 uppercase tracking-tight mb-1">
                  Created By
                </label>
                <input
                  type="text"
                  value={createdBy}
                  onChange={(e) => setCreatedBy(e.target.value)}
                  placeholder="e.g. SecOps Admin, Jane Doe"
                  className="w-full px-2.5 py-1.5 text-xs font-mono bg-gray-50/70 dark:bg-gray-800/80 border border-gray-200 dark:border-gray-700 rounded-lg text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 focus:bg-white dark:focus:bg-gray-850 transition-colors shadow-2xs"
                />
              </div>
            </div>
          </div>

          {/* Bottom Actions Bar */}
          <div className="flex items-center justify-between gap-3 pt-3 border-t border-gray-100 dark:border-gray-800">
            <button
              type="button"
              onClick={() => navigate('/software-inventory')}
              className="px-4 py-1.5 text-xs font-semibold text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-750 transition-colors cursor-pointer shadow-2xs"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-1.5 text-xs font-bold text-white bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 rounded-lg shadow-sm shadow-blue-500/20 flex items-center gap-1.5 cursor-pointer transition-all hover:scale-[1.01] disabled:opacity-60 disabled:cursor-not-allowed"
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>{saving ? 'Saving…' : 'Save & Add Component'}</span>
            </button>
          </div>
        </form>
      </div>

      {/* Upload File Pop-up Modal */}
      <UploadInventoryModal
        isOpen={uploadModalOpen}
        onClose={() => setUploadModalOpen(false)}
        onSuccess={() => navigate('/software-inventory')}
      />
    </div>
  );
};

export default AddInventoryComponent;
