import React, { useState } from 'react';
import {
  Users as UsersIcon,
  Info,
  UserPlus,
  Shield,
  Search,
  MoreHorizontal,
  Mail,
  CheckCircle2,
} from 'lucide-react';
import { useAppState } from '../context/AppStateContext';

export const Users: React.FC = () => {
  const { users, addToast } = useAppState();
  const [searchQuery, setSearchQuery] = useState('');
  const [inviteModalOpen, setInviteModalOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('Developer');

  const filteredUsers = users.filter(u =>
    u.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    u.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
    u.role.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleInvite = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail.trim()) return;
    addToast({
      type: 'success',
      title: 'Invitation Sent',
      message: `Invited ${inviteEmail} as ${inviteRole}.`,
    });
    setInviteEmail('');
    setInviteModalOpen(false);
  };

  return (
    <div className="space-y-6 animate-fadeIn pb-12">
      {/* Actions Toolbar */}
      <div className="flex items-center justify-end">
        <button
          onClick={() => setInviteModalOpen(true)}
          className="px-3.5 py-1.5 text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-lg shadow-sm flex items-center gap-1.5 cursor-pointer transition-colors"
        >
          <UserPlus className="w-3.5 h-3.5" />
          Invite User
        </button>
      </div>

      {/* Search and Table */}
      <div className="bg-white dark:bg-[#111827] border border-gray-200 dark:border-gray-800 rounded-xl shadow-sm overflow-hidden space-y-3 p-4">
        <div className="relative w-full max-w-sm">
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search by name, email, or role..."
            className="w-full pl-9 pr-4 py-2 text-xs bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
          <Search className="w-4 h-4 text-gray-400 absolute left-3 top-2.5" />
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="bg-gray-50/80 dark:bg-gray-800/60 border-y border-gray-200 dark:border-gray-800 text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                <th className="py-3 px-4 font-bold">TEAM MEMBER</th>
                <th className="py-3 px-3 font-bold">EMAIL</th>
                <th className="py-3 px-3 font-bold">ASSIGNED ROLE</th>
                <th className="py-3 px-3 font-bold">2FA STATUS</th>
                <th className="py-3 px-3 font-bold">LAST ACTIVE</th>
                <th className="py-3 px-4 font-bold text-right">ACTION</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-xs text-gray-500 dark:text-gray-400">
                    No data available yet.
                  </td>
                </tr>
              ) : (
                filteredUsers.map(u => (
                <tr key={u.id} className="table-row-hover">
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-2.5">
                      <div className="w-7 h-7 rounded-full bg-slate-800 text-white flex items-center justify-center font-bold text-[10px]">
                        {u.avatarText}
                      </div>
                      <span className="font-bold text-gray-900 dark:text-gray-100">
                        {u.name}
                      </span>
                    </div>
                  </td>
                  <td className="py-3 px-3 text-gray-600 dark:text-gray-400 font-mono">
                    {u.email}
                  </td>
                  <td className="py-3 px-3">
                    <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-blue-50 text-blue-800 dark:bg-blue-950 dark:text-blue-300 border border-blue-200 dark:border-blue-900">
                      {u.role}
                    </span>
                  </td>
                  <td className="py-3 px-3">
                    {u.twoFactorEnabled ? (
                      <span className="text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1 text-[11px]">
                        <CheckCircle2 className="w-3.5 h-3.5" /> Enforced
                      </span>
                    ) : (
                      <span className="text-amber-600 dark:text-amber-400 font-semibold text-[11px]">
                        Pending Setup
                      </span>
                    )}
                  </td>
                  <td className="py-3 px-3 text-gray-400">
                    {u.lastActive}
                  </td>
                  <td className="py-3 px-4 text-right">
                    <button
                      onClick={() => {
                        addToast({
                          type: 'info',
                          title: 'User Permissions',
                          message: `Editing role permissions for ${u.name}.`,
                        });
                      }}
                      className="px-2.5 py-1 text-xs font-medium rounded hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300"
                    >
                      Manage
                    </button>
                  </td>
                </tr>
              )))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Invite Modal */}
      {inviteModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white dark:bg-[#111827] border border-gray-200 dark:border-gray-800 rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-4">
            <h3 className="text-base font-bold text-gray-900 dark:text-white">
              Invite Team Member to SQUAD1
            </h3>
            <form onSubmit={handleInvite} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-600 dark:text-gray-300 uppercase tracking-wider mb-1.5">
                  Email Address *
                </label>
                <input
                  type="email"
                  required
                  value={inviteEmail}
                  onChange={e => setInviteEmail(e.target.value)}
                  placeholder="developer@talakunchi.com"
                  className="w-full px-3.5 py-2 text-sm bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-600 dark:text-gray-300 uppercase tracking-wider mb-1.5">
                  Role Permission *
                </label>
                <select
                  value={inviteRole}
                  onChange={e => setInviteRole(e.target.value)}
                  className="w-full px-3.5 py-2 text-sm bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="Admin">Admin (Full Control)</option>
                  <option value="Security Admin">Security Admin</option>
                  <option value="Security Analyst">Security Analyst</option>
                  <option value="Developer">Developer (Read & Remediate)</option>
                  <option value="Viewer">Viewer (Read-Only Auditing)</option>
                </select>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setInviteModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-gray-600 dark:text-gray-300 hover:bg-gray-100 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-lg"
                >
                  Send Invitation
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
