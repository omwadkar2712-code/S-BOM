import React from 'react';
import { Info } from 'lucide-react';

interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  trend?: string;
  trendPositive?: boolean;
  icon?: React.ReactNode;
  actionButton?: React.ReactNode;
  infoTooltip?: string;
  className?: string;
  onClick?: () => void;
}

export const StatCard: React.FC<StatCardProps> = ({
  title,
  value,
  subtitle,
  trend,
  trendPositive,
  icon,
  actionButton,
  infoTooltip,
  className = '',
  onClick,
}) => {
  return (
    <div
      onClick={onClick}
      className={`bg-white dark:bg-[#111827] border border-gray-200 dark:border-gray-800 rounded-xl p-5 shadow-sm transition-all duration-150 relative flex flex-col justify-between ${
        onClick
          ? 'cursor-pointer hover:border-gray-300 dark:hover:border-gray-700 hover:shadow-xs group'
          : ''
      } ${className}`}
    >
      <div>
        <div className="flex items-center justify-between gap-2 mb-3">
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="text-[11px] font-bold tracking-wider text-gray-500 dark:text-gray-400 uppercase truncate group-hover:text-gray-900 dark:group-hover:text-gray-200 transition-colors">
              {title}
            </span>
            {infoTooltip && (
              <span title={infoTooltip} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 cursor-help">
                <Info className="w-3.5 h-3.5" />
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {actionButton}
            {icon && (
              <div className="w-7 h-7 rounded-lg flex items-center justify-center bg-gray-50 dark:bg-gray-800 border border-gray-100 dark:border-gray-700">
                {icon}
              </div>
            )}
          </div>
        </div>

        <div className="text-3xl font-extrabold text-gray-900 dark:text-white tracking-tight group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
          {value}
        </div>
      </div>

      {(trend || subtitle) && (
        <div className="mt-3 flex items-center gap-2 text-xs font-medium text-gray-500 dark:text-gray-400">
          {trend && (
            <span
              className={`font-semibold ${
                trendPositive === true
                  ? 'text-emerald-600 dark:text-emerald-400'
                  : trendPositive === false
                  ? 'text-red-600 dark:text-red-400'
                  : 'text-gray-600 dark:text-gray-400'
              }`}
            >
              {trend}
            </span>
          )}
          {subtitle && <span>{subtitle}</span>}
        </div>
      )}
    </div>
  );
};

