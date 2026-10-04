import React, { useState, useEffect, useRef } from 'react';
import { useAppState } from '../../context/AppStateContext';
import { useNavigate } from 'react-router-dom';
import { Search, Package, ShieldAlert, FolderKanban, FileCode, X, ArrowRight } from 'lucide-react';
import { SeverityBadge, EcosystemBadge } from './Badge';

export const GlobalSearchModal: React.FC = () => {
  const { searchModalOpen, setSearchModalOpen, searchQuery, setSearchQuery, components, vulnerabilities, projects, setSelectedVulnerability } = useAppState();
  const [localQuery, setLocalQuery] = useState(searchQuery);
  const inputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (searchModalOpen) {
      setLocalQuery(searchQuery);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [searchModalOpen, searchQuery]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setSearchModalOpen(true);
      }
      if (e.key === 'Escape' && searchModalOpen) {
        setSearchModalOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [searchModalOpen, setSearchModalOpen]);

  if (!searchModalOpen) return null;

  const q = localQuery.toLowerCase().trim();

  const matchedProjects = projects.filter(p =>
    p.name.toLowerCase().includes(q) || p.component.toLowerCase().includes(q) || p.tags?.some(t => t.toLowerCase().includes(q))
  );

  const matchedVulnerabilities = vulnerabilities.filter(v =>
    v.cve.toLowerCase().includes(q) || v.package.toLowerCase().includes(q) || v.description.toLowerCase().includes(q)
  );

  const matchedComponents = components.filter(c =>
    c.name.toLowerCase().includes(q) || c.license.toLowerCase().includes(q) || c.project.toLowerCase().includes(q) || c.ecosystem.toLowerCase().includes(q)
  );

  const totalResults = matchedProjects.length + matchedVulnerabilities.length + matchedComponents.length;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-20 px-4 bg-black/50 backdrop-blur-sm animate-fadeIn">
      <div className="bg-white dark:bg-[#111827] border border-gray-200 dark:border-gray-800 rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[80vh]">
        {/* Search header */}
        <div className="flex items-center px-4 py-3.5 border-b border-gray-200 dark:border-gray-800 gap-3">
          <Search className="w-5 h-5 text-gray-400" />
          <input
            ref={inputRef}
            type="text"
            value={localQuery}
            onChange={e => {
              setLocalQuery(e.target.value);
              setSearchQuery(e.target.value);
            }}
            placeholder="Search packages, CVEs, repositories, licenses..."
            className="flex-1 bg-transparent text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none"
          />
          {localQuery && (
            <button
              onClick={() => {
                setLocalQuery('');
                setSearchQuery('');
              }}
              className="text-gray-400 hover:text-gray-600 p-1"
            >
              <X className="w-4 h-4" />
            </button>
          )}
          <span className="text-xs px-2 py-0.5 rounded bg-gray-100 dark:bg-gray-800 text-gray-400 border border-gray-200 dark:border-gray-700">
            ESC
          </span>
        </div>

        {/* Results Container */}
        <div className="overflow-y-auto p-4 space-y-5 flex-1">
          {q && totalResults === 0 ? (
            <div className="text-center py-10">
              <p className="text-sm text-gray-500 dark:text-gray-400">
                No matching results found for "<span className="font-semibold text-gray-700 dark:text-gray-300">{localQuery}</span>"
              </p>
              <p className="text-xs text-gray-400 mt-1">Try searching for axios, log4j, payments-api, CVE-2026, or MIT</p>
            </div>
          ) : null}

          {/* Vulnerabilities Section */}
          {matchedVulnerabilities.length > 0 && (
            <div>
              <div className="flex items-center justify-between text-xs font-bold text-gray-400 uppercase tracking-wider mb-2 px-1">
                <span>Vulnerabilities & CVEs ({matchedVulnerabilities.length})</span>
                <span className="text-[10px] font-normal lowercase">click to inspect details</span>
              </div>
              <div className="space-y-1">
                {matchedVulnerabilities.slice(0, 4).map(v => (
                  <div
                    key={v.id}
                    onClick={() => {
                      setSelectedVulnerability(v);
                      setSearchModalOpen(false);
                      navigate('/vulnerabilities');
                    }}
                    className="flex items-center justify-between p-2.5 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800/80 cursor-pointer border border-transparent hover:border-gray-200 dark:hover:border-gray-700 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-7 h-7 rounded bg-red-50 dark:bg-red-950/50 flex items-center justify-center text-red-600">
                        <ShieldAlert className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-sm text-gray-900 dark:text-white font-mono">{v.cve}</span>
                          <span className="text-xs text-gray-500">in {v.package}@{v.version}</span>
                        </div>
                        <p className="text-xs text-gray-500 dark:text-gray-400 truncate max-w-md">{v.description}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <SeverityBadge severity={v.severity} size="xs" />
                      <ArrowRight className="w-3.5 h-3.5 text-gray-400" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Components Section */}
          {matchedComponents.length > 0 && (
            <div>
              <div className="flex items-center justify-between text-xs font-bold text-gray-400 uppercase tracking-wider mb-2 px-1">
                <span>Audited Components ({matchedComponents.length})</span>
              </div>
              <div className="space-y-1">
                {matchedComponents.slice(0, 4).map(c => (
                  <div
                    key={c.id}
                    onClick={() => {
                      setSearchModalOpen(false);
                      navigate('/software-inventory');
                    }}
                    className="flex items-center justify-between p-2.5 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800/80 cursor-pointer border border-transparent hover:border-gray-200 dark:hover:border-gray-700 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-7 h-7 rounded bg-blue-50 dark:bg-blue-950/50 flex items-center justify-center text-blue-600">
                        <Package className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-sm text-gray-900 dark:text-white">{c.name}</span>
                          <span className="text-xs text-gray-500 font-mono">v{c.version}</span>
                          <EcosystemBadge ecosystem={c.ecosystem} />
                        </div>
                        <p className="text-xs text-gray-500 dark:text-gray-400">Project: {c.project} · License: {c.license}</p>
                      </div>
                    </div>
                    <div className="text-xs font-medium text-gray-600 dark:text-gray-300">
                      Compliance {c.compliance}%
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Projects Section */}
          {matchedProjects.length > 0 && (
            <div>
              <div className="flex items-center justify-between text-xs font-bold text-gray-400 uppercase tracking-wider mb-2 px-1">
                <span>Projects ({matchedProjects.length})</span>
              </div>
              <div className="space-y-1">
                {matchedProjects.slice(0, 3).map(p => (
                  <div
                    key={p.id}
                    onClick={() => {
                      setSearchModalOpen(false);
                      navigate('/dashboard');
                    }}
                    className="flex items-center justify-between p-2.5 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800/80 cursor-pointer border border-transparent hover:border-gray-200 dark:hover:border-gray-700 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-7 h-7 rounded bg-indigo-50 dark:bg-indigo-950/50 flex items-center justify-center text-indigo-600">
                        <FolderKanban className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-sm text-gray-900 dark:text-white">{p.name}</span>
                          <span className="text-xs text-gray-500">{p.version}</span>
                        </div>
                        <p className="text-xs text-gray-500 dark:text-gray-400">{p.componentsCount} components · {p.criticalCount} Critical CVEs</p>
                      </div>
                    </div>
                    <SeverityBadge severity={p.riskLevel} size="xs" />
                  </div>
                ))}
              </div>
            </div>
          )}

          {!q && (
            <div className="py-2 text-xs text-gray-400 dark:text-gray-500">
              <span className="font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider block mb-2">
                Quick Navigation
              </span>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => {
                    setSearchModalOpen(false);
                    navigate('/security-scans');
                  }}
                  className="p-2.5 rounded-lg text-left bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700/80 flex items-center gap-2 text-gray-700 dark:text-gray-300 font-medium"
                >
                  <FileCode className="w-4 h-4 text-blue-600" /> Launch Security Scan
                </button>
                <button
                  onClick={() => {
                    setSearchModalOpen(false);
                    navigate('/software-inventory');
                  }}
                  className="p-2.5 rounded-lg text-left bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700/80 flex items-center gap-2 text-gray-700 dark:text-gray-300 font-medium"
                >
                  <Package className="w-4 h-4 text-blue-500" /> Software Inventory (SBOM)
                </button>
                <button
                  onClick={() => {
                    setSearchModalOpen(false);
                    navigate('/vulnerabilities');
                  }}
                  className="p-2.5 rounded-lg text-left bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700/80 flex items-center gap-2 text-gray-700 dark:text-gray-300 font-medium"
                >
                  <ShieldAlert className="w-4 h-4 text-orange-500" /> Vulnerability Management
                </button>
                <button
                  onClick={() => {
                    setSearchModalOpen(false);
                    navigate('/compliance');
                  }}
                  className="p-2.5 rounded-lg text-left bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700/80 flex items-center gap-2 text-gray-700 dark:text-gray-300 font-medium"
                >
                  <FolderKanban className="w-4 h-4 text-emerald-500" /> Regulatory Compliance
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-2.5 bg-gray-50 dark:bg-gray-850 border-t border-gray-200 dark:border-gray-800 flex items-center justify-between text-xs text-gray-500">
          <span>Search SQUAD1 SBOM Catalog</span>
          <span className="flex items-center gap-1">
            Press <kbd className="px-1.5 py-0.5 rounded bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 font-mono">ESC</kbd> to close
          </span>
        </div>
      </div>
    </div>
  );
};
