import React, { useState } from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  Scan,
  FileDown,
  Boxes,
  ShieldAlert,
  Ticket,
  FileCheck2,
  ShieldCheck,
  GitFork,
  Activity,
  Network,
  // Users,
  // Settings,
} from 'lucide-react';
import { Squad1Logo } from './Squad1Logo';

interface SidebarProps {
  isOpen?: boolean;
  setIsOpen?: (open: boolean) => void;
}

interface NavMenuItem {
  id: string;
  name: string;
  to: string;
  icon: React.FC<{ className?: string }>;
}

const NAV_ITEMS: NavMenuItem[] = [
  {
    id: 'dashboard',
    name: 'Dashboard',
    to: '/dashboard',
    icon: LayoutDashboard,
  },
  {
    id: 'security-scans',
    name: 'Security Scans',
    to: '/security-scans',
    icon: Scan,
  },
  {
    id: 'export-center',
    name: 'Export Center',
    to: '/export-center',
    icon: FileDown,
  },
  {
    id: 'software-inventory',
    name: 'Software Inventory (SBOM)',
    to: '/software-inventory',
    icon: Boxes,
  },
  {
    id: 'vulnerabilities',
    name: 'Vulnerability Management',
    to: '/vulnerabilities',
    icon: ShieldAlert,
  },
  {
    id: 'remediation',
    name: 'Remediation Tickets',
    to: '/remediation',
    icon: Ticket,
  },
  {
    id: 'compliance',
    name: 'Regulatory Compliance',
    to: '/compliance',
    icon: FileCheck2,
  },
  {
    id: 'policies',
    name: 'Security Policies',
    to: '/policies',
    icon: ShieldCheck,
  },
  {
    id: 'supply-chain',
    name: 'Supply Chain & Provenance',
    to: '/supply-chain',
    icon: GitFork,
  },
  {
    id: 'monitoring',
    name: 'Continuous Monitoring',
    to: '/monitoring',
    icon: Activity,
  },
  {
    id: 'integrations',
    name: 'Enterprise Integrations',
    to: '/integrations',
    icon: Network,
  },
  /*
  // Commented out as requested for now
  {
    id: 'users',
    name: 'Users & Access',
    to: '/users',
    icon: Users,
  },
  {
    id: 'settings',
    name: 'Organization Settings',
    to: '/settings',
    icon: Settings,
  },
  */
];

export const Sidebar: React.FC<SidebarProps> = () => {
  const [isHovered, setIsHovered] = useState<boolean>(false);
  const navigate = useNavigate();
  const location = useLocation();

  const isRouteActive = (path: string) => {
    if (path === '/dashboard') {
      return location.pathname === '/' || location.pathname === '/dashboard';
    }
    return location.pathname.startsWith(path);
  };

  return (
    <aside
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className={`fixed top-0 left-0 bottom-0 z-40 bg-[#f4f6fa] dark:bg-[#0d131f] border-r border-gray-200 dark:border-gray-800 flex flex-col transition-all duration-300 ease-in-out select-none ${
        isHovered
          ? 'w-[250px] shadow-2xl shadow-blue-950/20'
          : 'w-[72px] shadow-xs'
      }`}
    >
      {/* Top Logo Section matching exact h-16 (64px) height of the top navigation bar */}
      <div
        onClick={() => navigate('/dashboard')}
        className={`h-16 shrink-0 bg-white dark:bg-[#111827] border-b border-gray-200 dark:border-gray-800 flex items-center cursor-pointer overflow-hidden transition-all duration-300 ${
          isHovered ? 'px-4' : 'px-0 justify-center'
        }`}
      >
        <Squad1Logo collapsed={!isHovered} />
      </div>

      {/* Navigation Items List with proper spacing to eliminate excess blank space */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden py-2.5 px-2 space-y-1 scrollbar-none">
        {NAV_ITEMS.map((item) => {
          const active = isRouteActive(item.to);
          const IconComponent = item.icon;

          return (
            <NavLink
              key={item.id}
              to={item.to}
              className={`group flex items-center h-11 px-2 rounded-lg transition-all duration-150 relative ${
                active
                  ? 'bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 font-bold shadow-2xs border border-blue-200/80 dark:border-blue-800/80'
                  : 'text-gray-700 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-white dark:hover:bg-gray-800/70 font-medium'
              }`}
            >
              {/* Left active accent bar */}
              {active && (
                <span className="absolute left-0 top-2 bottom-2 w-1 bg-blue-600 rounded-r" />
              )}

              {/* Icon Container with Enlarged Icon (w-6 h-6) */}
              <div className="w-9 h-9 shrink-0 flex items-center justify-center">
                <IconComponent
                  className={`w-6 h-6 stroke-[1.85] transition-transform duration-150 group-hover:scale-105 ${
                    active
                      ? 'text-blue-600 dark:text-blue-400'
                      : 'text-[#3e5e8e] dark:text-[#8ba7cd] group-hover:text-blue-600 dark:group-hover:text-blue-400'
                  }`}
                />
              </div>

              {/* Item Label (fits cleanly without truncation) */}
              <div
                className={`flex-1 flex items-center ml-2.5 overflow-hidden whitespace-nowrap transition-all duration-300 ease-in-out ${
                  isHovered
                    ? 'opacity-100 max-w-[185px] translate-x-0'
                    : 'opacity-0 max-w-0 -translate-x-2 pointer-events-none'
                }`}
              >
                <span className="text-[13px] font-semibold tracking-tight group-hover:text-blue-600 dark:group-hover:text-blue-400">
                  {item.name}
                </span>
              </div>
            </NavLink>
          );
        })}



        {/* 
          // Commented out Users & Access and Organization Settings for now as requested:
          // <NavLink to="/users" ...>Users & Access</NavLink>
          // <NavLink to="/settings" ...>Organization Settings</NavLink>
        */}
      </div>
    </aside>
  );
};
