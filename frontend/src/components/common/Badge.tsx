import React from 'react';
import { Severity, Ecosystem, VexStatus } from '../../types';

interface BadgeProps {
  children: React.ReactNode;
  variant?: 'default' | 'critical' | 'high' | 'medium' | 'low' | 'success' | 'warning' | 'info' | 'outline' | 'neutral';
  size?: 'xs' | 'sm' | 'md';
  className?: string;
}

export const Badge: React.FC<BadgeProps> = ({
  children,
  variant = 'default',
  size = 'sm',
  className = '',
}) => {
  const sizeClasses = {
    xs: 'px-1.5 py-0.5 text-[10px] font-medium leading-none',
    sm: 'px-2 py-0.5 text-xs font-medium',
    md: 'px-2.5 py-1 text-xs font-semibold',
  }[size];

  const variantClasses = {
    default: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200 border border-gray-200 dark:border-gray-700',
    critical: 'bg-red-50 text-red-700 dark:bg-red-950/50 dark:text-red-300 border border-red-200 dark:border-red-900',
    high: 'bg-orange-50 text-orange-700 dark:bg-orange-950/50 dark:text-orange-300 border border-orange-200 dark:border-orange-900',
    medium: 'bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300 border border-amber-200 dark:border-amber-900',
    low: 'bg-sky-50 text-sky-700 dark:bg-sky-950/50 dark:text-sky-300 border border-sky-200 dark:border-sky-800',
    success: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-900',
    warning: 'bg-amber-50 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-200 dark:border-amber-800',
    info: 'bg-cyan-50 text-cyan-700 dark:bg-cyan-950/50 dark:text-cyan-300 border border-cyan-200 dark:border-cyan-900',
    outline: 'border border-gray-300 text-gray-700 dark:border-gray-600 dark:text-gray-300 bg-transparent',
    neutral: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
  }[variant];

  return (
    <span className={`inline-flex items-center gap-1 rounded-md ${sizeClasses} ${variantClasses} ${className}`}>
      {children}
    </span>
  );
};

export const SeverityBadge: React.FC<{ severity: Severity | 'Safe'; size?: 'xs' | 'sm' | 'md' }> = ({
  severity,
  size = 'sm',
}) => {
  const variantMap: Record<string, 'critical' | 'high' | 'medium' | 'low' | 'success'> = {
    Critical: 'critical',
    High: 'high',
    Medium: 'medium',
    Low: 'low',
    Safe: 'success',
  };

  return (
    <Badge variant={variantMap[severity] || 'neutral'} size={size}>
      <span
        className={`w-1.5 h-1.5 rounded-full ${
          severity === 'Critical'
            ? 'bg-red-500'
            : severity === 'High'
            ? 'bg-orange-500'
            : severity === 'Medium'
            ? 'bg-amber-500'
            : severity === 'Low'
            ? 'bg-sky-500'
            : 'bg-emerald-500'
        }`}
      />
      {severity}
    </Badge>
  );
};

export const EcosystemBadge: React.FC<{ ecosystem: Ecosystem }> = ({ ecosystem }) => {
  const colorMap: Record<string, string> = {
    npm: 'bg-red-50 text-red-600 border-red-200 dark:bg-red-950/30 dark:border-red-900/60',
    PyPI: 'bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-950/30 dark:border-sky-800',
    Maven: 'bg-indigo-50 text-indigo-600 border-indigo-200 dark:bg-indigo-950/30 dark:border-indigo-900/60',
    Go: 'bg-cyan-50 text-cyan-600 border-cyan-200 dark:bg-cyan-950/30 dark:border-cyan-900/60',
    Cargo: 'bg-orange-50 text-orange-600 border-orange-200 dark:bg-orange-950/30 dark:border-orange-900/60',
    RubyGems: 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/30 dark:border-rose-900/60',
    NuGet: 'bg-violet-50 text-violet-700 border-violet-200 dark:bg-violet-950/30 dark:border-violet-900/60',
    Packagist: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:border-emerald-900/60',
  };

  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium border ${
        colorMap[ecosystem] || 'bg-gray-50 text-gray-600 border-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-700'
      }`}
    >
      {ecosystem}
    </span>
  );
};

export const VexBadge: React.FC<{ status: VexStatus }> = ({ status }) => {
  const labelMap: Record<VexStatus, string> = {
    affected: 'Affected',
    not_affected: 'Not Affected',
    fixed: 'Fixed',
    under_investigation: 'Investigating',
  };

  const variantMap: Record<VexStatus, 'critical' | 'success' | 'info' | 'warning'> = {
    affected: 'critical',
    not_affected: 'success',
    fixed: 'info',
    under_investigation: 'warning',
  };

  return (
    <Badge variant={variantMap[status]} size="xs">
      {labelMap[status]}
    </Badge>
  );
};
