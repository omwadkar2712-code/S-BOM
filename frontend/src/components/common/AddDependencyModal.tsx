import React, { useState, useEffect } from 'react';
import { useAppState } from '../../context/AppStateContext';
import { X, PackagePlus, Box, Info } from 'lucide-react';
import { Ecosystem, LicenseType, ComponentFieldType, Severity } from '../../types';

export const AddDependencyModal: React.FC = () => {
  const { addDependencyModalOpen, setAddDependencyModalOpen, addComponent, addToast, projects } = useAppState();
  
  // Field States matching the Software Inventory table exactly
  const [projectName, setProjectName] = useState(projects[0]?.name || 'payments-api');
  const [projectApplication, setProjectApplication] = useState('backend-api');
  const [name, setName] = useState('');
  const [packageName, setPackageName] = useState('');
  const [version, setVersion] = useState('1.0.0');
  const [fieldType, setFieldType] = useState<ComponentFieldType>('Library');
  const [ecosystem, setEcosystem] = useState<Ecosystem>('npm');
  const [license, setLicense] = useState<LicenseType>('MIT');
  const [vulnerabilities, setVulnerabilities] = useState<number>(0);
  const [riskLevel, setRiskLevel] = useState<Severity | 'Safe'>('Safe');
  const [purl, setPurl] = useState('');
  const [supplier, setSupplier] = useState('');
  const [directDependency, setDirectDependency] = useState(true);

  // Auto-generate canonical P-URL when package name, version, or ecosystem changes
  useEffect(() => {
    const pkg = packageName.trim() || name.trim() || 'package';
    const v = version.trim() || '1.0.0';
    const eco = ecosystem.toLowerCase();
    setPurl(`pkg:${eco}/${pkg}@${v}`);
  }, [name, packageName, version, ecosystem]);

  if (!addDependencyModalOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() && !packageName.trim()) return;

    const compName = name.trim() || packageName.trim();
    const pkgName = packageName.trim() || compName;
    const finalPurl = purl.trim() || `pkg:${ecosystem.toLowerCase()}/${pkgName}@${version.trim()}`;

    try {
      await addComponent({
        name: compName,
        packageName: pkgName,
        version: version.trim() || '1.0.0',
        project: projectName.trim() || 'payments-api',
        projectApplication: projectApplication.trim() || 'backend-api',
        fieldType,
        ecosystem,
        license,
        supplier: supplier.trim() || 'Open Source Project',
        directDependency,
        compliance: 95.0,
        trustScore: 92,
        risk: riskLevel,
        cves: Number(vulnerabilities) || 0,
        purl: finalPurl,
      });
    } catch (error) {
      addToast({
        type: 'error',
        title: 'Could not save component',
        message: error instanceof Error ? error.message : 'The component was not saved to the database.',
      });
      return;
    }

    setName('');
    setPackageName('');
    setVersion('1.0.0');
    setSupplier('');
    setVulnerabilities(0);
    setRiskLevel('Safe');
    setAddDependencyModalOpen(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fadeIn">
      <div className="bg-white dark:bg-[#111827] border border-gray-200 dark:border-gray-800 rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden max-h-[90vh] flex flex-col">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-800 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-950/50 flex items-center justify-center text-blue-600">
              <PackagePlus className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base text-gray-900 dark:text-white">Add Software Inventory Component</h3>
              <p className="text-xs text-gray-500">Add a component with complete software catalog metadata and standard SBOM fields</p>
            </div>
          </div>
          <button
            onClick={() => setAddDependencyModalOpen(false)}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 p-1 rounded-lg"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto flex-1 text-xs">
          {/* Row 1: Project Name & Project Application */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-1.5">
                Project Name *
              </label>
              <input
                type="text"
                required
                list="modal-project-list"
                value={projectName}
                onChange={e => setProjectName(e.target.value)}
                placeholder="e.g. payments-api"
                className="w-full px-3 py-2 text-xs bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <datalist id="modal-project-list">
                {projects.map(p => (
                  <option key={p.id} value={p.name} />
                ))}
              </datalist>
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-1.5">
                Project Application *
              </label>
              <input
                type="text"
                required
                value={projectApplication}
                onChange={e => setProjectApplication(e.target.value)}
                placeholder="e.g. backend-api, auth-service"
                className="w-full px-3 py-2 text-xs bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
              />
            </div>
          </div>

          {/* Row 2: Component Name & Package Name */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-1.5">
                Component Name *
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={e => {
                  setName(e.target.value);
                  if (!packageName) setPackageName(e.target.value);
                }}
                placeholder="e.g. axios, express, log4j"
                className="w-full px-3 py-2 text-xs bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-1.5">
                Package Name *
              </label>
              <input
                type="text"
                required
                value={packageName}
                onChange={e => setPackageName(e.target.value)}
                placeholder="e.g. axios, @sentry/node, log4j-core"
                className="w-full px-3 py-2 text-xs bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
              />
            </div>
          </div>

          {/* Row 3: Version, Field Type & Ecosystem */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
            <div>
              <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-1.5">
                Version *
              </label>
              <input
                type="text"
                required
                value={version}
                onChange={e => setVersion(e.target.value)}
                placeholder="1.0.0"
                className="w-full px-3 py-2 text-xs bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-1.5">
                Field Type *
              </label>
              <select
                value={fieldType}
                onChange={e => setFieldType(e.target.value as ComponentFieldType)}
                className="w-full px-3 py-2 text-xs bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="Library">Library (Open-source package / SDK)</option>
                <option value="Application">Application (Standalone program / microservice)</option>
                <option value="Framework">Framework (Structural architecture / engine)</option>
                <option value="Container">Container (Base container image / OCI)</option>
                <option value="Service">Service (Cloud API / SaaS service)</option>
                <option value="Operating System">Operating System (OS kernel / distro package)</option>
                <option value="Device / Firmware">Device / Firmware (Hardware driver / embedded)</option>
                <option value="File">File (Script / binary asset)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-1.5">
                Ecosystem
              </label>
              <select
                value={ecosystem}
                onChange={e => setEcosystem(e.target.value as Ecosystem)}
                className="w-full px-3 py-2 text-xs bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="npm">npm (JavaScript / TypeScript)</option>
                <option value="PyPI">PyPI (Python)</option>
                <option value="Maven">Maven (Java)</option>
                <option value="Go">Go Modules</option>
                <option value="Cargo">Cargo (Rust)</option>
                <option value="NuGet">NuGet (.NET)</option>
                <option value="RubyGems">RubyGems</option>
                <option value="Packagist">Packagist (PHP / Composer)</option>
              </select>
            </div>
          </div>

          {/* Row 4: License, Vulnerabilities & Risk Level */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
            <div>
              <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-1.5">
                License
              </label>
              <select
                value={license}
                onChange={e => setLicense(e.target.value as LicenseType)}
                className="w-full px-3 py-2 text-xs bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
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

            <div>
              <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-1.5">
                Vulnerabilities (CVEs)
              </label>
              <input
                type="number"
                min="0"
                value={vulnerabilities}
                onChange={e => setVulnerabilities(Math.max(0, parseInt(e.target.value) || 0))}
                className="w-full px-3 py-2 text-xs bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-1.5">
                Risk Level
              </label>
              <select
                value={riskLevel}
                onChange={e => setRiskLevel(e.target.value as Severity | 'Safe')}
                className="w-full px-3 py-2 text-xs bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="Safe">Safe (Compliant)</option>
                <option value="Low">Low Risk</option>
                <option value="Medium">Medium Risk</option>
                <option value="High">High Risk</option>
                <option value="Critical">Critical Risk</option>
              </select>
            </div>
          </div>

          {/* Row 5: Package URL (P-URL) */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                P-URL (Package URL)
              </label>
              <span className="text-[10px] text-gray-400 font-mono">Canonical RFC-compliant identifier</span>
            </div>
            <input
              type="text"
              value={purl}
              onChange={e => setPurl(e.target.value)}
              placeholder="pkg:npm/packageName@version"
              className="w-full px-3 py-2 text-xs bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-[11px]"
            />
          </div>

          {/* Row 6: Supplier & Direct Dependency */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 items-center">
            <div>
              <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-1.5">
                Maintainer / Supplier
              </label>
              <input
                type="text"
                value={supplier}
                onChange={e => setSupplier(e.target.value)}
                placeholder="e.g. Open Source Project, Apache Foundation"
                className="w-full px-3 py-2 text-xs bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="pt-5 flex items-center gap-2">
              <input
                type="checkbox"
                id="modalDirectDepCheck"
                checked={directDependency}
                onChange={e => setDirectDependency(e.target.checked)}
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <label htmlFor="modalDirectDepCheck" className="text-xs text-gray-700 dark:text-gray-300">
                Declared as direct dependency in root package manifest
              </label>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="pt-4 flex items-center justify-end gap-3 border-t border-gray-200 dark:border-gray-800">
            <button
              type="button"
              onClick={() => setAddDependencyModalOpen(false)}
              className="px-4 py-2 text-xs font-semibold text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white rounded-lg shadow-sm flex items-center gap-2 cursor-pointer"
            >
              <PackagePlus className="w-4 h-4" />
              <span>Add to Inventory</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
