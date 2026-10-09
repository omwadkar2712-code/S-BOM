import React, { useEffect, useState } from 'react';
import { AlertTriangle, Ban, CheckCircle2, Download, RotateCcw, X } from 'lucide-react';
import * as api from '../../api/client';
import type { BulkScanItemView, ScanJob, Vulnerability } from '../../types';
import { displayStatus, formatDuration, formatEventTime, pipelineSteps, stageLabel, type StepState } from './scanProgress';

interface ScanResultDetailsProps {
  job: ScanJob;
  related: ScanJob[];
  now: number;
  cancelling: boolean;
  rescanning: boolean;
  canCancel: boolean;
  canRescan: boolean;
  onClose: () => void;
  onCancel: (job: ScanJob) => void;
  onRescan: (job: ScanJob) => void;
  onOpenScan: (id: string) => void;
  onExport: (format: 'spdx' | 'cyclonedx' | 'csv', scanId: string) => void;
}

interface PreviewComponent {
  id: string;
  name: string;
  version: string;
  ecosystem: string;
  direct: boolean;
}

const STEP_STYLE: Record<StepState, string> = {
  done: 'border-emerald-200 bg-emerald-50/50 dark:bg-emerald-950/20',
  active: 'border-blue-300 bg-blue-50/60 dark:bg-blue-950/30',
  failed: 'border-red-300 bg-red-50/60 dark:bg-red-950/20',
  cancelled: 'border-slate-300 bg-slate-50 dark:bg-slate-800/40',
  pending: 'border-gray-200 dark:border-gray-800 bg-gray-50/40 dark:bg-gray-800/20',
};

function statusClass(status: string): string {
  const normalized = status.toLowerCase();
  if (normalized === 'completed') return 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300';
  if (normalized === 'failed' || normalized === 'dead_letter') return 'bg-red-50 text-red-700 dark:bg-red-950/60 dark:text-red-300';
  if (normalized === 'cancelled' || normalized === 'skipped') return 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300';
  if (normalized === 'running' || normalized === 'analyzing' || normalized === 'processing') return 'bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300';
  return 'bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300';
}

function rowUiStatus(item: BulkScanItemView, related: ScanJob[]): string {
  const child = item.scanId ? related.find((scan) => scan.id === item.scanId) : undefined;
  return child?.status || item.status.toLowerCase();
}

export const PipelineGrid: React.FC<{ job: ScanJob }> = ({ job }) => {
  const steps = pipelineSteps(job.stage, job.status, job.events);
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
      {steps.map((step, index) => (
        <div key={step.name} className={`p-3 rounded-xl border ${STEP_STYLE[step.state]}`}>
          <div className="flex items-center justify-between gap-2 mb-1">
            <span className="text-xs font-bold text-gray-900 dark:text-white">
              {index + 1}. {step.name}
            </span>
            {step.state === 'done' && <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />}
            {step.state === 'active' && <span className="w-2.5 h-2.5 rounded-full border-2 border-blue-500 border-t-transparent animate-spin shrink-0" />}
            {step.state === 'failed' && <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />}
            {step.state === 'cancelled' && <Ban className="w-4 h-4 text-slate-500 shrink-0" />}
            {step.state === 'pending' && <span className="w-2.5 h-2.5 rounded-full border-2 border-gray-300 dark:border-gray-600 shrink-0" />}
          </div>
          <p className="text-[11px] text-gray-500 dark:text-gray-400">{step.desc}</p>
        </div>
      ))}
    </div>
  );
};

export const ScanResultDetails: React.FC<ScanResultDetailsProps> = ({
  job,
  related,
  now,
  cancelling,
  rescanning,
  canCancel,
  canRescan,
  onClose,
  onCancel,
  onRescan,
  onOpenScan,
  onExport,
}) => {
  const [events, setEvents] = useState<ScanJob['events']>(job.events || []);
  const [components, setComponents] = useState<PreviewComponent[]>([]);
  const [vulns, setVulns] = useState<Vulnerability[]>([]);
  const [loadingResults, setLoadingResults] = useState(false);
  const [componentTotal, setComponentTotal] = useState(job.componentsFound || 0);
  const [vulnTotal, setVulnTotal] = useState(job.cvesFound || 0);
  const [severityTotals, setSeverityTotals] = useState({
    criticals: job.criticals || 0,
    highs: job.highs || 0,
    mediums: job.mediums || 0,
    lows: job.lows || 0,
  });
  const viewJob: ScanJob = { ...job, events: events?.length ? events : job.events };
  const settled = job.status === 'completed' || job.status === 'failed' || job.status === 'cancelled';
  const duration = formatDuration(job.startedAt, settled ? job.completedAt : undefined, now);
  const items = [...(job.bulkItems || [])].sort((a, b) => a.rowNumber - b.rowNumber);
  const childTotals = related.reduce(
    (sum, scan) => ({
      components: sum.components + (scan.componentsFound || 0),
      cves: sum.cves + (scan.cvesFound || 0),
      criticals: sum.criticals + (scan.criticals || 0),
      highs: sum.highs + (scan.highs || 0),
      mediums: sum.mediums + (scan.mediums || 0),
      lows: sum.lows + (scan.lows || 0),
    }),
    { components: 0, cves: 0, criticals: 0, highs: 0, mediums: 0, lows: 0 },
  );

  useEffect(() => {
    if (job.isBulkAggregate) {
      setEvents(job.events || []);
      return;
    }
    let cancelled = false;
    setEvents(job.events || []);
    api.scanEvents(job.id).then((rows) => {
      if (cancelled || !rows.length) return;
      setEvents(rows.map((event) => ({
        id: event.id,
        stage: event.stage,
        message: event.message,
        createdAt: event.created_at,
      })));
    }).catch(() => {
      // Stage log stays on whatever the live poller already stored.
    });
    return () => {
      cancelled = true;
    };
  }, [job.id, job.isBulkAggregate]);

  useEffect(() => {
    if (job.isBulkAggregate || job.status !== 'completed') {
      setComponents([]);
      setVulns([]);
      setSeverityTotals({
        criticals: job.criticals || 0,
        highs: job.highs || 0,
        mediums: job.mediums || 0,
        lows: job.lows || 0,
      });
      return;
    }
    let cancelled = false;
    setLoadingResults(true);
    (async () => {
      try {
        const [comps, matches] = await Promise.all([
          api.scanComponents(job.id),
          api.scanVulnerabilities(job.id).catch(() => []),
        ]);
        if (cancelled) return;
        const mappedVulns = api.mapVulns(matches, comps || [], job.targetProject);
        setComponentTotal((comps || []).length);
        setVulnTotal(mappedVulns.length);
        setSeverityTotals({
          criticals: mappedVulns.filter((item) => item.severity === 'Critical').length,
          highs: mappedVulns.filter((item) => item.severity === 'High').length,
          mediums: mappedVulns.filter((item) => item.severity === 'Medium').length,
          lows: mappedVulns.filter((item) => item.severity === 'Low').length,
        });
        setComponents((comps || []).slice(0, 8).map((component) => ({
          id: component.id,
          name: component.name,
          version: component.version,
          ecosystem: component.ecosystem,
          direct: component.direct,
        })));
        setVulns(mappedVulns.slice(0, 8));
      } catch {
        if (!cancelled) {
          setComponents([]);
          setComponentTotal(job.componentsFound || 0);
          setVulns([]);
          setVulnTotal(job.cvesFound || 0);
          setSeverityTotals({
            criticals: job.criticals || 0,
            highs: job.highs || 0,
            mediums: job.mediums || 0,
            lows: job.lows || 0,
          });
        }
      } finally {
        if (!cancelled) setLoadingResults(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [job.id, job.status, job.isBulkAggregate, job.targetProject]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 animate-fadeIn">
      <div className="bg-white dark:bg-[#111827] rounded-xl max-w-4xl w-full max-h-[88vh] overflow-y-auto p-6 shadow-2xl border border-gray-200 dark:border-gray-800 space-y-4">
        <div className="flex items-start justify-between gap-3 pb-3 border-b border-gray-100 dark:border-gray-800">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-base font-bold text-gray-900 dark:text-white truncate">
                {job.targetProject}
              </h3>
              <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${statusClass(job.status)}`}>
                {displayStatus(job.status)}
              </span>
              <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300">
                {job.scanType}
              </span>
            </div>
            <p className="text-xs text-gray-500 mt-1">
              {job.appService || 'Application'} · {job.releaseTag || 'UNKNOWN'} · <span className="font-mono">{job.id}</span>
            </p>
          </div>
          <button type="button" onClick={onClose} className="p-1 text-gray-400 hover:text-gray-600 cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        {job.errorMessage && (job.status === 'failed' || job.status === 'cancelled') && (
          <div className="rounded-lg border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-950/30 px-3 py-2 text-xs text-red-800 dark:text-red-200">
            <span className="font-bold">{job.errorCode || 'Error'}: </span>
            {job.errorMessage}
          </div>
        )}

        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
          <Meta label="Source" value={job.source} mono />
          <Meta label="Stage" value={stageLabel(job.stage)} />
          <Meta label="Duration" value={duration} />
          <Meta
            label="Progress"
            value={`${job.progress}%`}
          />
        </div>

        {!job.isBulkAggregate && <PipelineGrid job={viewJob} />}

        {job.isBulkAggregate ? (
          <BulkRows items={items} related={related} totals={childTotals} onOpenScan={onOpenScan} />
        ) : (
          <SingleResults
            job={{
              ...job,
              componentsFound: componentTotal || job.componentsFound,
              cvesFound: vulnTotal || job.cvesFound,
              criticals: severityTotals.criticals,
              highs: severityTotals.highs,
              mediums: severityTotals.mediums,
              lows: severityTotals.lows,
            }}
            loading={loadingResults}
            components={components}
            vulns={vulns}
          />
        )}

        {(viewJob.events || []).length > 0 && (
          <div className="bg-gray-950 rounded-xl p-3 text-xs font-mono text-gray-300 space-y-1 max-h-40 overflow-y-auto">
            <p className="text-[11px] text-gray-500 pb-1">Stage log</p>
            {viewJob.events!.map((event) => (
              <p key={event.id}>
                <span className="text-gray-600">[{formatEventTime(event.createdAt)}]</span> {event.stage}: {event.message}
              </p>
            ))}
          </div>
        )}

        <div className="flex flex-wrap justify-end gap-2 pt-3 border-t border-gray-100 dark:border-gray-800">
          <button type="button" onClick={onClose} className="px-4 py-2 text-xs font-semibold border border-gray-200 dark:border-gray-700 rounded-lg text-gray-700 dark:text-gray-300 cursor-pointer">
            Close
          </button>
          {job.bulkId && !job.isBulkAggregate && (
            <button
              type="button"
              onClick={() => onOpenScan(job.bulkId as string)}
              className="px-4 py-2 text-xs font-semibold border border-gray-200 dark:border-gray-700 rounded-lg text-gray-700 dark:text-gray-300 cursor-pointer"
            >
              View batch
            </button>
          )}
          {canCancel && (
            <button
              type="button"
              disabled={cancelling}
              onClick={() => onCancel(job)}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-lg border border-slate-200 dark:border-slate-600 text-slate-700 dark:text-slate-200 disabled:opacity-50 cursor-pointer"
            >
              <Ban className="w-3.5 h-3.5" />
              {cancelling ? 'Stopping' : 'Cancel scan'}
            </button>
          )}
          {canRescan && !job.isBulkAggregate && (
            <button
              type="button"
              disabled={rescanning}
              onClick={() => onRescan(job)}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-lg border border-slate-200 dark:border-slate-600 text-slate-700 dark:text-slate-200 disabled:opacity-50 cursor-pointer"
            >
              <RotateCcw className={`w-3.5 h-3.5 ${rescanning ? 'animate-spin' : ''}`} />
              {rescanning ? 'Queuing' : 'Rescan'}
            </button>
          )}
          {job.status === 'completed' && (
            <>
              <button type="button" onClick={() => onExport('spdx', job.id)} className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white rounded-lg cursor-pointer">
                <Download className="w-3.5 h-3.5" /> SPDX
              </button>
              <button type="button" onClick={() => onExport('cyclonedx', job.id)} className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-bold border border-blue-200 text-blue-700 dark:text-blue-300 rounded-lg cursor-pointer">
                CycloneDX
              </button>
              <button type="button" onClick={() => onExport('csv', job.id)} className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-bold border border-gray-200 dark:border-gray-700 rounded-lg text-gray-700 dark:text-gray-200 cursor-pointer">
                CSV
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

const Meta: React.FC<{ label: string; value: string; mono?: boolean }> = ({ label, value, mono }) => (
  <div className="rounded-lg bg-gray-50 dark:bg-gray-800/50 px-3 py-2 min-w-0">
    <p className="text-[10px] uppercase tracking-wide text-gray-500">{label}</p>
    <p className={`text-gray-900 dark:text-white font-semibold truncate ${mono ? 'font-mono' : ''}`} title={value}>
      {value || '—'}
    </p>
  </div>
);

const SingleResults: React.FC<{
  job: ScanJob;
  loading: boolean;
  components: PreviewComponent[];
  vulns: Vulnerability[];
}> = ({ job, loading, components, vulns }) => (
  <div className="space-y-3">
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
      <Stat label="Components" value={job.componentsFound || 0} />
      <Stat label="Findings" value={job.cvesFound || 0} />
      <Stat label="Critical" value={job.criticals || 0} tone="text-red-600 dark:text-red-400" />
      <Stat label="High" value={job.highs || 0} tone="text-orange-500 dark:text-orange-400" />
      <Stat label="Medium" value={job.mediums || 0} tone="text-amber-500 dark:text-amber-400" />
      <Stat label="Low" value={job.lows || 0} tone="text-sky-500 dark:text-sky-400" />
    </div>
    {job.status === 'completed' && (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden">
          <p className="px-3 py-2 text-[11px] font-bold uppercase tracking-wide text-gray-500 border-b border-gray-100 dark:border-gray-800">
            Components
          </p>
          {loading ? (
            <p className="px-3 py-4 text-xs text-gray-500">Loading snapshot…</p>
          ) : components.length === 0 ? (
            <p className="px-3 py-4 text-xs text-gray-500">No components were recorded for this scan.</p>
          ) : (
            <ul className="divide-y divide-gray-100 dark:divide-gray-800">
              {components.map((component) => (
                <li key={component.id} className="px-3 py-2 flex items-center justify-between gap-2 text-xs">
                  <span className="font-semibold text-gray-900 dark:text-white truncate">{component.name}</span>
                  <span className="text-gray-500 font-mono shrink-0">{component.version} · {component.ecosystem}{component.direct ? ' · direct' : ''}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden">
          <p className="px-3 py-2 text-[11px] font-bold uppercase tracking-wide text-gray-500 border-b border-gray-100 dark:border-gray-800">
            Vulnerabilities
          </p>
          {loading ? (
            <p className="px-3 py-4 text-xs text-gray-500">Loading findings…</p>
          ) : vulns.length === 0 ? (
            <p className="px-3 py-4 text-xs text-gray-500">No vulnerability matches on this snapshot.</p>
          ) : (
            <ul className="divide-y divide-gray-100 dark:divide-gray-800">
              {vulns.map((vuln) => (
                <li key={vuln.id} className="px-3 py-2 text-xs">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono font-semibold text-gray-900 dark:text-white">{vuln.cve}</span>
                    <span className={vuln.severity === 'Critical' ? 'text-red-600 font-bold' : vuln.severity === 'High' ? 'text-orange-500 font-bold' : 'text-gray-500'}>
                      {vuln.severity}
                    </span>
                  </div>
                  <p className="text-gray-500 truncate">{vuln.package} {vuln.version}{vuln.fixVersion ? ` · fix ${vuln.fixVersion}` : ''}</p>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    )}
  </div>
);

const BulkRows: React.FC<{
  items: BulkScanItemView[];
  related: ScanJob[];
  totals: { components: number; cves: number; criticals: number; highs: number; mediums: number; lows: number };
  onOpenScan: (id: string) => void;
}> = ({ items, related, totals, onOpenScan }) => {
  const counts = items.reduce(
    (sum, item) => {
      const status = rowUiStatus(item, related);
      if (status === 'completed') sum.completed += 1;
      else if (status === 'failed' || status === 'dead_letter') sum.failed += 1;
      else if (status === 'skipped') sum.skipped += 1;
      else if (status === 'cancelled') sum.cancelled += 1;
      else if (status === 'running' || status === 'analyzing') sum.running += 1;
      else sum.queued += 1;
      return sum;
    },
    { completed: 0, failed: 0, skipped: 0, cancelled: 0, running: 0, queued: 0 },
  );
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <Stat label="Completed" value={counts.completed} />
        <Stat label="Running / queued" value={counts.running + counts.queued} />
        <Stat label="Failed" value={counts.failed} tone="text-red-600 dark:text-red-400" />
        <Stat label="Skipped" value={counts.skipped + counts.cancelled} />
      </div>
      <p className="text-[11px] text-gray-500">
        Batch totals from finished rows: {totals.components} components, {totals.cves} findings, {totals.criticals} critical, {totals.highs} high, {totals.mediums} medium, {totals.lows} low.
      </p>
      <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-800">
        <table className="w-full text-left text-xs min-w-[640px]">
          <thead>
            <tr className="text-gray-500 border-b border-gray-100 dark:border-gray-800">
              <th className="px-3 py-2 font-semibold">Row</th>
              <th className="px-3 py-2 font-semibold">Project</th>
              <th className="px-3 py-2 font-semibold">Repository</th>
              <th className="px-3 py-2 font-semibold">Status</th>
              <th className="px-3 py-2 font-semibold text-right">Result</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
            {items.map((item) => {
              const status = rowUiStatus(item, related);
              const child = item.scanId ? related.find((scan) => scan.id === item.scanId) : undefined;
              return (
                <tr key={`${item.rowNumber}-${item.scanId || item.repositoryUrl}`}>
                  <td className="px-3 py-2 font-mono text-gray-500">{item.rowNumber || '—'}</td>
                  <td className="px-3 py-2">
                    <span className="font-semibold text-gray-900 dark:text-white block">{item.projectName || '—'}</span>
                    <span className="text-[10px] text-gray-500">{item.applicationName} {item.version}</span>
                  </td>
                  <td className="px-3 py-2 font-mono text-gray-600 dark:text-gray-300 max-w-[220px] truncate" title={item.repositoryUrl}>
                    {item.repositoryUrl || '—'}
                  </td>
                  <td className="px-3 py-2">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${statusClass(status)}`}>
                      {displayStatus(status)}
                    </span>
                    {item.errorMessage && status !== 'completed' && status !== 'running' && status !== 'queued' && (
                      <p className="text-[10px] text-red-600 dark:text-red-400 mt-1 max-w-[240px]">{item.errorMessage}</p>
                    )}
                  </td>
                  <td className="px-3 py-2 text-right">
                    {child ? (
                      <button type="button" onClick={() => onOpenScan(child.id)} className="text-blue-600 dark:text-blue-400 font-semibold hover:underline cursor-pointer">
                        {child.componentsFound || 0} components
                      </button>
                    ) : (
                      <span className="text-gray-400">—</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

const Stat: React.FC<{ label: string; value: number; tone?: string }> = ({ label, value, tone }) => (
  <div className="rounded-lg border border-gray-200 dark:border-gray-800 px-3 py-2">
    <p className="text-[10px] uppercase tracking-wide text-gray-500">{label}</p>
    <p className={`text-lg font-bold ${tone || 'text-gray-900 dark:text-white'}`}>{value}</p>
  </div>
);
