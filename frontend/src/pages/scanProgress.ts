import type { ScanEventView, ScanStatus } from '../types';

export type StepState = 'pending' | 'active' | 'done' | 'failed' | 'cancelled';

export interface PipelineStep {
  name: string;
  desc: string;
  state: StepState;
}

const GROUPS: { name: string; desc: string; stages: string[] }[] = [
  {
    name: 'Source Ingest',
    desc: 'Reading the upload or GitHub archive',
    stages: ['QUEUED', 'PENDING', 'VALIDATING', 'EXTRACTING'],
  },
  {
    name: 'Dependency Resolution',
    desc: 'Detecting manifests and normalising packages',
    stages: ['DETECTING_MANIFESTS', 'PARSING', 'RESOLVING_DEPENDENCIES', 'NORMALIZING'],
  },
  {
    name: 'Vulnerability Telemetry',
    desc: 'Matching packages to known vulnerabilities',
    stages: ['ANALYZING_VULNERABILITIES'],
  },
  {
    name: 'SBOM Snapshot',
    desc: 'Saving the bill of materials',
    stages: ['GENERATING_SBOM', 'GENERATING_EXPORT', 'COMPLETED'],
  },
];

function workStage(stage: string | undefined, status: ScanStatus, events?: { stage: string }[]): string {
  const current = stage || 'QUEUED';
  if (status !== 'failed' && status !== 'cancelled' && current !== 'FAILED' && current !== 'CANCELLED') {
    return current;
  }
  const prior = [...(events || [])].reverse().find((event) => event.stage && event.stage !== 'FAILED' && event.stage !== 'CANCELLED');
  return prior?.stage || 'EXTRACTING';
}

export function pipelineSteps(stage: string | undefined, status: ScanStatus, events?: { stage: string }[]): PipelineStep[] {
  if (status === 'completed') {
    return GROUPS.map((group) => ({ name: group.name, desc: group.desc, state: 'done' }));
  }
  const current = workStage(stage, status, events);
  let index = GROUPS.findIndex((group) => group.stages.includes(current));
  if (index < 0) index = 0;
  return GROUPS.map((group, i) => {
    let state: StepState = 'pending';
    if (i < index) state = 'done';
    else if (i === index && status === 'failed') state = 'failed';
    else if (i === index && status === 'cancelled') state = 'cancelled';
    else if (i === index) state = 'active';
    return { name: group.name, desc: group.desc, state };
  });
}

export function stageLabel(stage?: string): string {
  if (!stage) return 'Queued';
  const known: Record<string, string> = {
    QUEUED: 'Queued',
    PENDING: 'Queued',
    VALIDATING: 'Validating source',
    EXTRACTING: 'Unpacking source',
    DETECTING_MANIFESTS: 'Detecting manifests',
    PARSING: 'Parsing manifests',
    RESOLVING_DEPENDENCIES: 'Resolving dependencies',
    NORMALIZING: 'Normalising components',
    ANALYZING_VULNERABILITIES: 'Correlating vulnerabilities',
    GENERATING_SBOM: 'Writing SBOM snapshot',
    GENERATING_EXPORT: 'Preparing export',
    COMPLETED: 'Completed',
    FAILED: 'Failed',
    CANCELLED: 'Cancelled',
    PROCESSING: 'Processing rows',
    COMPLETED_WITH_ERRORS: 'Completed with row errors',
  };
  return known[stage] || stage.replace(/_/g, ' ').toLowerCase();
}

export function formatDuration(started?: string, completed?: string, now = Date.now()): string {
  if (!started) return 'Not started';
  const start = Date.parse(started);
  if (Number.isNaN(start)) return 'Not started';
  const endRaw = completed ? Date.parse(completed) : now;
  const end = Number.isNaN(endRaw) ? now : endRaw;
  const secs = Math.max(0, Math.floor((end - start) / 1000));
  const hours = Math.floor(secs / 3600);
  const minutes = Math.floor((secs % 3600) / 60);
  const seconds = secs % 60;
  if (hours > 0) return `${hours}h ${minutes}m`;
  if (minutes > 0) return `${minutes}m ${seconds}s`;
  return `${seconds}s`;
}

export function formatEventTime(value?: string): string {
  if (!value) return '--:--:--';
  const parsed = Date.parse(value);
  if (Number.isNaN(parsed)) return value.substring(11, 19) || value;
  return new Date(parsed).toLocaleTimeString();
}

export function displayStatus(status: string): string {
  const normalized = status.toLowerCase();
  if (normalized === 'dead_letter') return 'Failed';
  if (normalized === 'completed_with_errors') return 'Completed with errors';
  if (!normalized) return 'Unknown';
  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
}

export function isOpenStatus(status: ScanStatus): boolean {
  return status === 'queued' || status === 'running' || status === 'analyzing';
}

export function eventLines(events?: ScanEventView[]): { id: string; time: string; text: string }[] {
  return (events || []).map((event) => ({
    id: event.id,
    time: formatEventTime(event.createdAt),
    text: `${event.stage}: ${event.message}`,
  }));
}
