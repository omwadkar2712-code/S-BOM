import React from 'react';
import { useAppState } from '../../context/AppStateContext';
import { useNavigate } from 'react-router-dom';
import { User, Shield, KeyRound, LogOut, Check } from 'lucide-react';

export const UserMenuModal: React.FC = () => {
  const { userMenuOpen, setUserMenuOpen, addToast } = useAppState();
  const navigate = useNavigate();

  if (!userMenuOpen) return null;

  return (
    <div className="absolute right-0 top-12 z-50 w-72 bg-white dark:bg-[#111827] border border-gray-200 dark:border-gray-800 rounded-2xl shadow-2xl overflow-hidden animate-fadeIn">
      {/* Header with user info */}
      <div className="p-4 bg-gray-50 dark:bg-gray-850 border-b border-gray-200 dark:border-gray-800">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-sm shadow-sm">
            AM
          </div>
          <div className="min-w-0">
            <h4 className="font-bold text-sm text-gray-900 dark:text-white truncate">Asha Mehta</h4>
            <p className="text-xs text-gray-500 truncate">asha@talakunchi.com</p>
            <span className="inline-block px-1.5 py-0.2 mt-1 text-[10px] font-semibold bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300 rounded">
              Security Admin
            </span>
          </div>
        </div>
      </div>

      {/* Menu links */}
      <div className="p-2 text-xs text-gray-700 dark:text-gray-300 space-y-1">
        <button
          onClick={() => {
            setUserMenuOpen(false);
            navigate('/profile');
          }}
          className="w-full px-3 py-2 rounded-lg flex items-center gap-2.5 hover:bg-gray-100 dark:hover:bg-gray-800 text-left font-medium"
        >
          <User className="w-4 h-4 text-gray-500" />
          My Profile & Credentials
        </button>
        <button
          onClick={() => {
            setUserMenuOpen(false);
            navigate('/users');
          }}
          className="w-full px-3 py-2 rounded-lg flex items-center gap-2.5 hover:bg-gray-100 dark:hover:bg-gray-800 text-left font-medium"
        >
          <Shield className="w-4 h-4 text-gray-500" />
          Role Permissions (RBAC)
        </button>
        <button
          onClick={() => {
            setUserMenuOpen(false);
            navigate('/settings');
          }}
          className="w-full px-3 py-2 rounded-lg flex items-center gap-2.5 hover:bg-gray-100 dark:hover:bg-gray-800 text-left font-medium"
        >
          <KeyRound className="w-4 h-4 text-gray-500" />
          API Tokens & Integrations
        </button>
      </div>

      {/* Logout */}
      <div className="p-2 border-t border-gray-200 dark:border-gray-800">
        <button
          onClick={() => {
            setUserMenuOpen(false);
            addToast({
              type: 'info',
              title: 'Signed Out',
              message: 'Session terminated. In demo mode you remain as Security Admin.',
            });
          }}
          className="w-full px-3 py-2 rounded-lg flex items-center gap-2.5 hover:bg-red-50 dark:hover:bg-red-950/40 text-red-600 font-medium text-xs text-left"
        >
          <LogOut className="w-4 h-4 text-red-600" />
          Log Out
        </button>
      </div>
    </div>
  );
};
