import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  MoreVertical,
  Eye,
  Download,
  FileCode,
  Layers,
  ChevronRight,
  Ban,
  RotateCcw,
} from 'lucide-react';
import type { ScanJob } from '../../types';

export interface ScanActionMenuProps {
  scan: ScanJob;
  onViewDetails: (scan: ScanJob) => void;
  onExport: (format: 'spdx' | 'cyclonedx', scanId: string) => void;
  canCancel?: boolean;
  canRescan?: boolean;
  cancelling?: boolean;
  rescanning?: boolean;
  onCancel?: (scan: ScanJob) => void;
  onRescan?: (scan: ScanJob) => void;
}

export const ScanActionMenu: React.FC<ScanActionMenuProps> = ({
  scan,
  onViewDetails,
  onExport,
  canCancel = false,
  canRescan = false,
  cancelling = false,
  rescanning = false,
  onCancel,
  onRescan,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [exportExpanded, setExportExpanded] = useState(true);
  const [menuCoords, setMenuCoords] = useState<{
    top?: number;
    bottom?: number;
    right: number;
  } | null>(null);

  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const updatePosition = () => {
    if (!buttonRef.current) return;
    const rect = buttonRef.current.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom;
    const openUpwards = spaceBelow < 280 && rect.top > 280;

    setMenuCoords({
      top: openUpwards ? undefined : rect.bottom + 6,
      bottom: openUpwards ? window.innerHeight - rect.top + 6 : undefined,
      right: Math.max(12, window.innerWidth - rect.right),
    });
  };

  const handleToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!isOpen) {
      updatePosition();
      setIsOpen(true);
    } else {
      setIsOpen(false);
    }
  };

  useEffect(() => {
    if (!isOpen) return;
    updatePosition();

    const handlePointerDown = (e: MouseEvent | TouchEvent) => {
      const target = e.target as Node;
      if (
        menuRef.current &&
        !menuRef.current.contains(target) &&
        buttonRef.current &&
        !buttonRef.current.contains(target)
      ) {
        setIsOpen(false);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsOpen(false);
      }
    };

    const handleScroll = (e: Event) => {
      const target = e.target as Node;
      if (menuRef.current && menuRef.current.contains(target)) return;
      setIsOpen(false);
    };

    window.addEventListener('scroll', handleScroll, true);
    window.addEventListener('resize', updatePosition);
    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('touchstart', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('scroll', handleScroll, true);
      window.removeEventListener('resize', updatePosition);
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('touchstart', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  const handleViewDetails = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsOpen(false);
    onViewDetails(scan);
  };

  const handleExportSPDX = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsOpen(false);
    onExport('spdx', scan.id);
  };

  const handleExportCycloneDX = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsOpen(false);
    onExport('cyclonedx', scan.id);
  };

  return (
    <div className="relative inline-block text-left">
      {/* 3 Dots Trigger Button */}
      <button
        ref={buttonRef}
        type="button"
        onClick={handleToggle}
        title="More actions"
        aria-label="Scan actions"
        aria-expanded={isOpen}
        className={`p-1.5 rounded-lg border transition-all cursor-pointer shadow-2xs flex items-center justify-center ${
          isOpen
            ? 'bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 border-blue-300 dark:border-blue-600 ring-2 ring-blue-500/20'
            : 'bg-white dark:bg-gray-800 text-gray-500 dark:text-gray-400 border-gray-200 dark:border-gray-700 hover:text-gray-900 dark:hover:text-white hover:bg-gray-50 dark:hover:bg-gray-750 hover:border-gray-300 dark:hover:border-gray-600'
        }`}
      >
        <MoreVertical className="w-4 h-4" />
      </button>

      {/* Floating Dropdown Portal */}
      {isOpen &&
        menuCoords &&
        createPortal(
          <div
            ref={menuRef}
            style={{
              position: 'fixed',
              top: menuCoords.top !== undefined ? `${menuCoords.top}px` : undefined,
              bottom: menuCoords.bottom !== undefined ? `${menuCoords.bottom}px` : undefined,
              right: `${menuCoords.right}px`,
            }}
            className="z-50 w-64 bg-white dark:bg-[#111827] border border-gray-200 dark:border-gray-700/80 rounded-xl shadow-2xl p-1.5 animate-fadeIn backdrop-blur-md text-left select-none"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header info */}
            <div className="px-3 py-2 border-b border-gray-100 dark:border-gray-800/80 mb-1">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400 dark:text-gray-500">
                  Scan Actions
                </span>
                <span className="text-[10px] font-mono text-gray-400 dark:text-gray-500 truncate max-w-[100px]">
                  {scan.id}
                </span>
              </div>
              <p className="text-xs font-semibold text-gray-900 dark:text-white truncate mt-0.5" title={scan.targetProject}>
                {scan.targetProject}
              </p>
            </div>

            {/* Option 1: View Details */}
            <button
              type="button"
              onClick={handleViewDetails}
              className="w-full text-left px-3 py-2 text-xs font-semibold rounded-lg text-gray-700 dark:text-gray-200 hover:bg-blue-50 dark:hover:bg-blue-950/50 hover:text-blue-600 dark:hover:text-blue-400 flex items-center gap-2.5 transition-colors cursor-pointer group"
            >
              <div className="w-7 h-7 rounded-lg bg-blue-100/70 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                <Eye className="w-3.5 h-3.5" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-bold text-gray-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400">
                  View Details
                </div>
                <div className="text-[10px] text-gray-500 dark:text-gray-400 truncate">
                  Inspect findings, packages & SBOM
                </div>
              </div>
            </button>

            {/* Option 2: Export */}
            <div className="mt-1 pt-1 border-t border-gray-100 dark:border-gray-800/80">
              <button
                type="button"
                onClick={() => setExportExpanded((prev) => !prev)}
                className={`w-full text-left px-3 py-2 text-xs font-semibold rounded-lg transition-colors cursor-pointer flex items-center justify-between gap-2 group ${
                  exportExpanded
                    ? 'bg-emerald-50/70 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300'
                    : 'text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800'
                }`}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-7 h-7 rounded-lg bg-emerald-100/70 dark:bg-emerald-900/50 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                    <Download className="w-3.5 h-3.5" />
                  </div>
                  <div className="min-w-0">
                    <div className="font-bold text-gray-900 dark:text-white group-hover:text-emerald-600 dark:group-hover:text-emerald-400">
                      Export
                    </div>
                    <div className="text-[10px] text-gray-500 dark:text-gray-400 truncate">
                      Download SBOM specifications
                    </div>
                  </div>
                </div>
                <ChevronRight
                  className={`w-3.5 h-3.5 text-gray-400 transition-transform duration-200 shrink-0 ${
                    exportExpanded ? 'rotate-90 text-emerald-600 dark:text-emerald-400' : ''
                  }`}
                />
              </button>

              {/* Sub-options for Export: SPDX and CYCLONE */}
              {exportExpanded && (
                <div className="mt-1 ml-3 pl-2.5 border-l-2 border-emerald-300 dark:border-emerald-700/60 space-y-1 animate-fadeIn">
                  {/* Option 2a: Download in SPDX format */}
                  <button
                    type="button"
                    onClick={handleExportSPDX}
                    className="w-full text-left px-2.5 py-1.5 text-xs rounded-lg text-gray-700 dark:text-gray-200 hover:bg-blue-50 dark:hover:bg-blue-950/40 hover:text-blue-600 dark:hover:text-blue-400 flex items-center justify-between gap-2 transition-colors cursor-pointer group"
                    title="Download SBOM in SPDX 2.3 JSON format"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="w-5 h-5 rounded bg-blue-50 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
                        <FileCode className="w-3 h-3" />
                      </div>
                      <div className="min-w-0">
                        <div className="font-semibold text-gray-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 text-[11px]">
                          SPDX format
                        </div>
                        <div className="text-[9px] text-gray-400 dark:text-gray-500">
                          SPDX 2.3 JSON
                        </div>
                      </div>
                    </div>
                    <Download className="w-3.5 h-3.5 text-gray-400 group-hover:text-blue-600 dark:group-hover:text-blue-400 shrink-0" />
                  </button>

                  {/* Option 2b: Download in CYCLONE format */}
                  <button
                    type="button"
                    onClick={handleExportCycloneDX}
                    className="w-full text-left px-2.5 py-1.5 text-xs rounded-lg text-gray-700 dark:text-gray-200 hover:bg-purple-50 dark:hover:bg-purple-950/40 hover:text-purple-600 dark:hover:text-purple-400 flex items-center justify-between gap-2 transition-colors cursor-pointer group"
                    title="Download SBOM in CycloneDX 1.5 JSON format"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="w-5 h-5 rounded bg-purple-50 dark:bg-purple-900/40 text-purple-600 dark:text-purple-400 flex items-center justify-center shrink-0">
                        <Layers className="w-3 h-3" />
                      </div>
                      <div className="min-w-0">
                        <div className="font-semibold text-gray-900 dark:text-white group-hover:text-purple-600 dark:group-hover:text-purple-400 text-[11px]">
                          CYCLONE format
                        </div>
                        <div className="text-[9px] text-gray-400 dark:text-gray-500">
                          CycloneDX 1.5 JSON
                        </div>
                      </div>
                    </div>
                    <Download className="w-3.5 h-3.5 text-gray-400 group-hover:text-purple-600 dark:group-hover:text-purple-400 shrink-0" />
                  </button>
                </div>
              )}
            </div>

            {/* Optional Additional Actions: Cancel / Rescan */}
            {(canCancel || canRescan) && (
              <div className="mt-1 pt-1 border-t border-gray-100 dark:border-gray-800/80">
                {canCancel && onCancel && (
                  <button
                    type="button"
                    disabled={cancelling}
                    onClick={(e) => {
                      e.stopPropagation();
                      setIsOpen(false);
                      onCancel(scan);
                    }}
                    className="w-full text-left px-3 py-1.5 text-xs font-medium rounded-lg text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 flex items-center gap-2 transition-colors cursor-pointer disabled:opacity-50"
                  >
                    <Ban className="w-3.5 h-3.5" />
                    <span>{cancelling ? 'Stopping scan…' : 'Cancel Scan'}</span>
                  </button>
                )}

                {canRescan && onRescan && (
                  <button
                    type="button"
                    disabled={rescanning}
                    onClick={(e) => {
                      e.stopPropagation();
                      setIsOpen(false);
                      onRescan(scan);
                    }}
                    className="w-full text-left px-3 py-1.5 text-xs font-medium rounded-lg text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center gap-2 transition-colors cursor-pointer disabled:opacity-50"
                  >
                    <RotateCcw className={`w-3.5 h-3.5 ${rescanning ? 'animate-spin' : ''}`} />
                    <span>{rescanning ? 'Queuing…' : 'Rescan'}</span>
                  </button>
                )}
              </div>
            )}
          </div>,
          document.body
        )}
    </div>
  );
};
