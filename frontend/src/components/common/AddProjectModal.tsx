import React, { useState } from 'react';
import { useAppState } from '../../context/AppStateContext';
import { X, FolderPlus, GitBranch, Layers, ShieldCheck } from 'lucide-react';
import { Severity } from '../../types';

export const AddProjectModal: React.FC = () => {
  const { addProjectModalOpen, setAddProjectModalOpen, addProject, addToast } = useAppState();
  const [name, setName] = useState('');
  const [component, setComponent] = useState('');
  const [version, setVersion] = useState('v1.0.0');
  const [repoUrl, setRepoUrl] = useState('');
  const [branch, setBranch] = useState('main');
  const [tags, setTags] = useState('production, api');
  const [riskLevel, setRiskLevel] = useState<Severity>('Low');

  if (!addProjectModalOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    try {
      await addProject({
        name: name.trim(),
        component: component.trim() || `${name.trim()}-svc`,
        version: version.trim(),
        repoUrl: repoUrl.trim() || `https://github.com/talakunchi/${name.trim()}`,
        branch: branch.trim(),
        tags: tags.split(',').map(t => t.trim()).filter(Boolean),
        riskLevel,
        riskScore: riskLevel === 'Critical' ? 8.5 : riskLevel === 'High' ? 6.5 : riskLevel === 'Medium' ? 4.5 : 2.0,
        complianceScore: 88.0,
        componentsCount: 18,
        criticalCount: riskLevel === 'Critical' ? 1 : 0,
        highCount: riskLevel === 'High' ? 2 : 0,
        mediumCount: 2,
        lowCount: 5,
      });
    } catch (error) {
      addToast({
        type: 'error',
        title: 'Could not register project',
        message: error instanceof Error ? error.message : 'The project was not saved to the database.',
      });
      return;
    }

    setName('');
    setComponent('');
    setRepoUrl('');
    setAddProjectModalOpen(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fadeIn">
      <div className="bg-white dark:bg-[#111827] border border-gray-200 dark:border-gray-800 rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-800">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-950/50 flex items-center justify-center text-blue-600">
              <FolderPlus className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base text-gray-900 dark:text-white">Register Target Project</h3>
              <p className="text-xs text-gray-500">Add a new software project for SBOM tracking & compliance</p>
            </div>
          </div>
          <button
            onClick={() => setAddProjectModalOpen(false)}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 p-1"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-1.5">
              Project Name *
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g. billing-microservice"
              className="w-full px-3.5 py-2 text-sm bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-1.5">
                Application Component
              </label>
              <input
                type="text"
                value={component}
                onChange={e => setComponent(e.target.value)}
                placeholder="e.g. backend-api"
                className="w-full px-3.5 py-2 text-sm bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-1.5">
                Release Tag
              </label>
              <input
                type="text"
                value={version}
                onChange={e => setVersion(e.target.value)}
                placeholder="e.g. v1.0.0-prod"
                className="w-full px-3.5 py-2 text-sm bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-1.5">
              Git Repository URL
            </label>
            <div className="relative">
              <input
                type="url"
                value={repoUrl}
                onChange={e => setRepoUrl(e.target.value)}
                placeholder="https://github.com/talakunchi/repo"
                className="w-full px-3.5 py-2 pl-9 text-sm bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-xs"
              />
              <GitBranch className="w-4 h-4 text-gray-400 absolute left-3 top-2.5" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-1.5">
                Default Branch
              </label>
              <input
                type="text"
                value={branch}
                onChange={e => setBranch(e.target.value)}
                className="w-full px-3.5 py-2 text-sm bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-xs"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-1.5">
                Initial Risk Level
              </label>
              <select
                value={riskLevel}
                onChange={e => setRiskLevel(e.target.value as Severity)}
                className="w-full px-3.5 py-2 text-sm bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="Low">Low Risk</option>
                <option value="Medium">Medium Risk</option>
                <option value="High">High Risk</option>
                <option value="Critical">Critical Risk</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-1.5">
              Taxonomy Tags (comma-separated)
            </label>
            <input
              type="text"
              value={tags}
              onChange={e => setTags(e.target.value)}
              placeholder="production, fintech, pci-dss"
              className="w-full px-3.5 py-2 text-sm bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="pt-3 flex items-center justify-end gap-3 border-t border-gray-200 dark:border-gray-800">
            <button
              type="button"
              onClick={() => setAddProjectModalOpen(false)}
              className="px-4 py-2 text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 text-sm font-medium bg-blue-600 hover:bg-blue-700 text-white rounded-lg shadow-sm flex items-center gap-2"
            >
              <FolderPlus className="w-4 h-4" />
              Register Project
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
