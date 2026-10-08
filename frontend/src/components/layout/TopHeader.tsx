import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  Search,
  Moon,
  Sun,
  Bell,
  ArrowLeft,
} from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';
import { useAppState } from '../../context/AppStateContext';
import { NotificationPanel } from '../common/NotificationPanel';
import { UserMenuModal } from '../common/UserMenuModal';

interface TopHeaderProps {
  onMenuClick?: () => void;
  sidebarOpen?: boolean;
}

export const TopHeader: React.FC<TopHeaderProps> = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { toggleTheme, isDark } = useTheme();
  const {
    setSearchModalOpen,
    notificationPanelOpen,
    setNotificationPanelOpen,
    userMenuOpen,
    setUserMenuOpen,
    timelineEvents,
  } = useAppState();

  const getPageTitle = () => {
    if (location.pathname === '/' || location.pathname === '/dashboard') {
      return 'Executive Dashboard';
    }
    if (location.pathname.startsWith('/security-scans')) {
      if (location.pathname === '/security-scans/live') return 'Live Jobs';
      if (location.pathname === '/security-scans/schedules') return 'Scheduled Scans';
      if (location.pathname === '/security-scans/history') return 'Scan History';
      if (location.pathname === '/security-scans/new') return 'Launch Security Scan';
      return 'Security Scans';
    }
    if (location.pathname.startsWith('/vulnerabilities')) {
      return 'Vulnerability Management';
    }
    switch (location.pathname) {
      case '/software-inventory/add':
        return 'Add Inventory Component';
      case '/software-inventory':
      case '/software-inventory/components':
        return 'Software Inventory';
      case '/software-inventory/projects':
        return 'Projects & Microservices';
      case '/software-inventory/artifacts':
        return 'Software Inventory';
      case '/vulnerabilities':
        return 'Vulnerability Management';
      case '/remediation':
        return 'Remediation Tickets';
      case '/compliance':
        return 'Regulatory Compliance';
      case '/export-center':
        return 'Export Center';
      case '/policies':
        return 'Security Policies';
      case '/supply-chain':
        return 'Supply Chain & Provenance';
      case '/monitoring':
        return 'Continuous Monitoring';
      case '/integrations':
        return 'Enterprise Integrations';
      case '/profile':
        return 'My Profile';
      case '/users':
        return 'Users & Access';
      case '/settings':
        return 'Organization Settings';
      default:
        return 'SQUAD1 SBOM';
    }
  };

  return (
    <header className="sticky top-0 z-30 h-16 bg-white/95 dark:bg-[#111827]/95 backdrop-blur-md border-b border-gray-200 dark:border-gray-800 px-4 sm:px-6 lg:px-8 flex items-center justify-between gap-4">
      {/* Left: Professional Page Title */}
      <div className="flex items-center gap-3 shrink-0">
        {location.pathname === '/software-inventory/add' && (
          <button
            type="button"
            onClick={() => navigate('/software-inventory')}
            className="p-1.5 -ml-1 rounded-lg text-gray-500 hover:text-blue-600 dark:text-gray-400 dark:hover:text-blue-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors cursor-pointer"
            title="Back to Software Inventory"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
        )}
        <h1 className="text-lg sm:text-xl font-bold tracking-tight text-[#1e3a8a] dark:text-[#93c5fd]">
          {getPageTitle()}
        </h1>
      </div>

      {/* Right: Small Compact Search + Sophisticated Clearly Visible Controls */}
      <div className="flex items-center gap-2.5 sm:gap-3 shrink-0">
        {/* Small Compact Search Bar */}
        <div
          onClick={() => setSearchModalOpen(true)}
          className="flex items-center w-36 sm:w-48 md:w-52 h-9 px-3 bg-gray-50 dark:bg-gray-800/80 hover:bg-gray-100 dark:hover:bg-gray-750 border border-gray-200 dark:border-gray-700/80 rounded-lg text-xs text-gray-400 cursor-pointer transition-all shadow-2xs hover:border-gray-300 dark:hover:border-gray-600 group shrink-0"
          title="Quick Search (Ctrl + K)"
        >
          <Search className="w-3.5 h-3.5 text-gray-400 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors shrink-0 mr-2" />
          <span className="truncate text-gray-400 dark:text-gray-400 group-hover:text-gray-600 dark:group-hover:text-gray-200 font-medium">
            Search...
          </span>
          <kbd className="hidden sm:inline-flex ml-auto text-[10px] font-mono font-semibold px-1.5 py-0.5 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded text-gray-400 dark:text-gray-300 shadow-2xs">
            CTRL K
          </kbd>
        </div>

        {/* Subtle Vertical Divider */}
        <div className="h-5 w-px bg-gray-200 dark:bg-gray-700 mx-0.5 shrink-0" />

        {/* Theme Toggle Button - Clearly Visible */}
        <button
          type="button"
          onClick={toggleTheme}
          className="w-9 h-9 rounded-lg border border-gray-200 dark:border-gray-700/80 bg-gray-50/90 dark:bg-gray-800/80 hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200 flex items-center justify-center transition-all cursor-pointer shadow-2xs hover:border-gray-300 dark:hover:border-gray-600 shrink-0"
          title={isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
          aria-label={isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
        >
          {isDark ? (
            <Sun className="w-4.5 h-4.5 text-amber-500 hover:rotate-45 transition-transform" />
          ) : (
            <Moon className="w-4.5 h-4.5 text-slate-700 dark:text-slate-200 hover:-rotate-12 transition-transform" />
          )}
        </button>

        {/* Notification Bell Button - Clearly Visible */}
        <div className="relative shrink-0">
          <button
            type="button"
            onClick={() => {
              setNotificationPanelOpen(!notificationPanelOpen);
              setUserMenuOpen(false);
            }}
            className="w-9 h-9 rounded-lg border border-gray-200 dark:border-gray-700/80 bg-gray-50/90 dark:bg-gray-800/80 hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200 flex items-center justify-center relative transition-all cursor-pointer shadow-2xs hover:border-gray-300 dark:hover:border-gray-600"
            title="Notifications"
            aria-label="Notifications"
          >
            <Bell className="w-4.5 h-4.5" />
            <span className="absolute -top-1 -right-1 min-w-[17px] h-[17px] px-1 rounded-full bg-blue-600 text-white text-[9.5px] font-black flex items-center justify-center ring-2 ring-white dark:ring-gray-900 shadow-xs">
              3
            </span>
          </button>
          <NotificationPanel />
        </div>

        {/* Circular Avatar JD - Clearly Visible & Sophisticated */}
        <div className="relative shrink-0">
          <button
            type="button"
            onClick={() => {
              setUserMenuOpen(!userMenuOpen);
              setNotificationPanelOpen(false);
            }}
            className="relative w-9 h-9 rounded-full bg-gradient-to-br from-[#1e3a8a] to-[#2563eb] text-white flex items-center justify-center font-black text-xs ring-2 ring-blue-500/20 dark:ring-blue-400/30 hover:ring-blue-500/50 transition-all shadow-xs cursor-pointer"
            title="Asha Mehta (Security Admin)"
          >
            JD
            <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-emerald-500 ring-2 ring-white dark:ring-gray-900" />
          </button>
          <UserMenuModal />
        </div>
      </div>
    </header>
  );
};
