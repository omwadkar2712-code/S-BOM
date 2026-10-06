import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Package,
  Layers,
  Shield,
  CheckCircle2,
} from 'lucide-react';
import { useAppState } from '../../context/AppStateContext';
import { ComponentFieldType, LicenseType, Severity, Ecosystem } from '../../types';

export const AddInventoryComponent: React.FC = () => {
  const navigate = useNavigate();
  const { addToast, projects, addComponent } = useAppState();

  // Form State: Empty inputs by default as requested
  const [projectName, setProjectName] = useState('');
  const [projectApplication, setProjectApplication] = useState('');
  const [componentName, setComponentName] = useState('');
  const [packageName, setPackageName] = useState('');
  const [version, setVersion] = useState('');
  const [fieldType, setFieldType] = useState<ComponentFieldType>('Library');
  const [ecosystem, setEcosystem] = useState<Ecosystem>('npm');
  const [license, setLicense] = useState<LicenseType>('MIT');
  const [vulnerabilities, setVulnerabilities] = useState<string>('');
  const [purl, setPurl] = useState('');
  const [purlManuallyEdited, setPurlManuallyEdited] = useState(false);
  const [riskLevel, setRiskLevel] = useState<Severity | 'Safe'>('Safe');
  const [directDependency, setDirectDependency] = useState(true);

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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const trimmedProject = projectName.trim();
    const trimmedApp = projectApplication.trim();
    const trimmedComp = componentName.trim();
    const trimmedPkg = packageName.trim() || trimmedComp;
    const trimmedVer = version.trim();

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

    const numVulns = parseInt(vulnerabilities, 10);
    const parsedVulns = isNaN(numVulns) || numVulns < 0 ? 0 : numVulns;

    addComponent({
      name: trimmedComp,
      packageName: trimmedPkg,
      version: trimmedVer,
      project: trimmedProject,
      projectApplication: trimmedApp,
      fieldType,
      ecosystem,
      license,
      supplier: 'Registered Software Component',
      directDependency,
      compliance: 95.0,
      trustScore: 90,
      risk: riskLevel,
      cves: parsedVulns,
      purl: finalPurl,
    });

    addToast({
      type: 'success',
      title: 'Component Added',
      message: `Successfully added ${trimmedComp}@${trimmedVer} to ${trimmedProject}.`,
    });

    // Navigate back to the inventory page
    navigate('/software-inventory');
  };

  return (
    <div className="w-full max-w-7xl mx-auto animate-fadeIn pb-6">
      {/* Single Unified Full Form Card with Compact Enterprise Layout */}
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

              {/* Field Type */}
              <div>
                <label className="block text-[11px] font-bold text-gray-700 dark:text-gray-300 uppercase tracking-tight mb-1">
                  Field Type <span className="text-red-500">*</span>
                </label>
                <select
                  value={fieldType}
                  onChange={(e) => setFieldType(e.target.value as ComponentFieldType)}
                  className="w-full px-2.5 py-1.5 text-xs bg-gray-50/70 dark:bg-gray-800/80 border border-gray-200 dark:border-gray-700 rounded-lg text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 focus:bg-white dark:focus:bg-gray-850 transition-colors shadow-2xs cursor-pointer"
                >
                  <option value="Library">Library (Open-source package / SDK)</option>
                  <option value="Application">Application (Standalone program / service)</option>
                  <option value="Framework">Framework (Structural architecture / engine)</option>
                  <option value="Container">Container (Base container image / OCI)</option>
                  <option value="Service">Service (Cloud microservice / SaaS API)</option>
                  <option value="Operating System">Operating System (OS kernel / distro package)</option>
                  <option value="Device / Firmware">Device / Firmware (Hardware driver / embedded)</option>
                  <option value="File">File (Script / binary asset)</option>
                </select>
              </div>
            </div>
          </div>

          {/* Section 2: Package & Security Information */}
          <div className="space-y-2.5 pt-2">
            <div className="flex items-center gap-2 pb-1.5 border-b border-gray-100 dark:border-gray-800">
              <div className="w-5 h-5 rounded-md bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center border border-emerald-200/60 dark:border-emerald-800/60">
                <Shield className="w-3 h-3" />
              </div>
              <h2 className="text-xs font-bold text-gray-900 dark:text-white uppercase tracking-wider">
                Package & Security Information
              </h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3 pt-0.5">
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

              {/* Vulnerabilities (CVEs) */}
              <div>
                <label className="block text-[11px] font-bold text-gray-700 dark:text-gray-300 uppercase tracking-tight mb-1">
                  Vulnerabilities (CVEs)
                </label>
                <input
                  type="number"
                  min="0"
                  value={vulnerabilities}
                  onChange={(e) => setVulnerabilities(e.target.value)}
                  placeholder="0"
                  className="w-full px-2.5 py-1.5 text-xs font-mono bg-gray-50/70 dark:bg-gray-800/80 border border-gray-200 dark:border-gray-700 rounded-lg text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 focus:bg-white dark:focus:bg-gray-850 transition-colors shadow-2xs"
                />
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

              {/* P-URL (Package URL) */}
              <div className="sm:col-span-2 lg:col-span-4">
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-[11px] font-bold text-gray-700 dark:text-gray-300 uppercase tracking-tight">
                    P-URL (Package URL)
                  </label>

                </div>
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
            </div>
          </div>

          {/* Section 3: Dependency Configuration */}
          <div className="space-y-2 pt-2">
            <div className="flex items-center gap-2 pb-1.5 border-b border-gray-100 dark:border-gray-800">
              <div className="w-5 h-5 rounded-md bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center border border-indigo-200/60 dark:border-indigo-800/60">
                <Package className="w-3 h-3" />
              </div>
              <h2 className="text-xs font-bold text-gray-900 dark:text-white uppercase tracking-wider">
                Dependency Configuration
              </h2>
            </div>

            <div className="p-2.5 bg-gray-50/60 dark:bg-gray-800/40 border border-gray-200/70 dark:border-gray-700/70 rounded-lg">
              <label className="flex items-center gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={directDependency}
                  onChange={(e) => setDirectDependency(e.target.checked)}
                  className="w-3.5 h-3.5 rounded text-blue-600 focus:ring-blue-500 border-gray-300 dark:border-gray-600 cursor-pointer"
                />
                <span className="text-xs font-semibold text-gray-800 dark:text-gray-200">
                  Direct root package dependency
                </span>
                <span className="text-[11px] text-gray-400 dark:text-gray-500 hidden sm:inline">
                  (Declared in root manifest, e.g. package.json / pom.xml; uncheck if transitive)
                </span>
              </label>
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
              className="px-4 py-1.5 text-xs font-bold text-white bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 rounded-lg shadow-sm shadow-blue-500/20 flex items-center gap-1.5 cursor-pointer transition-all hover:scale-[1.01]"
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Save & Add Component</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AddInventoryComponent;
