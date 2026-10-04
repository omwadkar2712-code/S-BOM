import React from 'react';

interface IconProps {
  className?: string;
}

export const DashboardIcon: React.FC<IconProps> = ({ className = 'w-6 h-6' }) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    <rect x="3" y="3" width="18" height="18" rx="2.5" />
    <path d="M9.5 3v18" />
    <path d="M9.5 12h11.5" />
  </svg>
);

export const AssessmentsIcon: React.FC<IconProps> = ({ className = 'w-6 h-6' }) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    <rect x="5" y="4" width="14" height="17" rx="2.5" />
    <path d="M9 2.5h6a1 1 0 0 1 1 1v1.5H8V3.5a1 1 0 0 1 1-1Z" />
    <path d="m9 13 2.5 2.5 4-4.5" />
  </svg>
);

export const VulnerabilitiesIcon: React.FC<IconProps> = ({ className = 'w-6 h-6' }) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    <path d="M2 9a3 3 0 0 1 0 6v2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2a3 3 0 0 1 0-6V7a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2Z" />
    <rect x="8" y="8.5" width="8" height="7" rx="1.5" />
  </svg>
);

export const AssetsIcon: React.FC<IconProps> = ({ className = 'w-6 h-6' }) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    {/* Computer Monitor / Workstation */}
    <rect x="2.5" y="3.5" width="19" height="13.5" rx="2" />
    {/* Stacked Server Units */}
    <path d="M6.5 7.5h11" />
    <path d="M6.5 10.5h11" />
    <circle cx="12" cy="13.5" r="1" fill="currentColor" />
    {/* Stand */}
    <path d="M12 17v4" />
    <path d="M8 21h8" />
  </svg>
);

export const SettingsIcon: React.FC<IconProps> = ({ className = 'w-6 h-6' }) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
);

export const UserStarIcon: React.FC<IconProps> = ({ className = 'w-6 h-6' }) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    {/* User Avatar */}
    <circle cx="9.5" cy="8" r="3.5" />
    <path d="M3 19.5a6.5 6.5 0 0 1 11-3" />
    {/* Star */}
    <polygon points="18 13.5 19.3 16.2 22.3 16.5 20.1 18.5 20.7 21.5 18 19.9 15.3 21.5 15.9 18.5 13.7 16.5 16.7 16.2 18 13.5" />
  </svg>
);

export const ExceptionIcon: React.FC<IconProps> = ({ className = 'w-6 h-6' }) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    <path d="M14 2.5H6a2 2 0 0 0-2 2v15a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8.5Z" />
    <polyline points="14 2.5 14 8.5 20 8.5" />
    <line x1="8" y1="9" x2="11" y2="9" />
    <line x1="8" y1="12.5" x2="16" y2="12.5" />
    {/* Alert Warning Circle at bottom */}
    <circle cx="12" cy="17.5" r="2.2" />
    <line x1="12" y1="16.5" x2="12" y2="17.7" />
    <circle cx="12" cy="18.8" r="0.3" fill="currentColor" />
  </svg>
);

export const ToolsViewIcon: React.FC<IconProps> = ({ className = 'w-6 h-6' }) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    {/* Circle with Cable Terminal Tabs */}
    <circle cx="12" cy="12" r="8" />
    {/* Lightning Bolt */}
    <path d="M13 7l-3 5.5h3L11 17l4-6h-3.5L13 7z" />
    {/* Plug Pins at left and right */}
    <path d="M4 12H1.5" />
    <path d="M22.5 12H20" />
    <path d="M2.5 10.5v3" />
    <path d="M21.5 10.5v3" />
  </svg>
);

export const HistoricIcon: React.FC<IconProps> = ({ className = 'w-6 h-6' }) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    <rect x="4.5" y="2.5" width="15" height="19" rx="2" />
    <line x1="8" y1="6" x2="12" y2="6" />
    {/* Bar Chart & Trend */}
    <path d="M7.5 17h9" />
    <rect x="8" y="14" width="1.8" height="3" fill="currentColor" fillOpacity="0.25" />
    <rect x="11" y="12" width="1.8" height="5" fill="currentColor" fillOpacity="0.25" />
    <rect x="14" y="10" width="1.8" height="7" fill="currentColor" fillOpacity="0.25" />
    <path d="M8 13.5l3-3 2.5 2 3-4" />
  </svg>
);
