import React from 'react';
import { useAppState } from '../../context/AppStateContext';
import { Bell, ShieldAlert, CheckCircle2, AlertTriangle, FileText, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export const NotificationPanel: React.FC = () => {
  const { notificationPanelOpen, setNotificationPanelOpen, timelineEvents } = useAppState();
  const navigate = useNavigate();

  if (!notificationPanelOpen) return null;

  return (
    <div className="absolute right-0 top-12 z-50 w-96 bg-white dark:bg-[#111827] border border-gray-200 dark:border-gray-800 rounded-2xl shadow-2xl overflow-hidden animate-fadeIn">
      {/* Panel Header */}
      <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Bell className="w-4 h-4 text-gray-500" />
          <h3 className="font-bold text-sm text-gray-900 dark:text-white">Security Alerts & Feed</h3>
          <span className="px-1.5 py-0.5 text-[10px] font-bold bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300 rounded-full">
            {timelineEvents.length}
          </span>
        </div>
        <button
          onClick={() => setNotificationPanelOpen(false)}
          className="text-gray-400 hover:text-gray-600 p-1"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Notifications list */}
      <div className="max-h-80 overflow-y-auto divide-y divide-gray-100 dark:divide-gray-800">
        {timelineEvents.map(event => {
          const icon = event.severity === 'Critical' ? (
            <ShieldAlert className="w-4 h-4 text-red-500" />
          ) : event.severity === 'High' ? (
            <AlertTriangle className="w-4 h-4 text-orange-500" />
          ) : event.severity === 'Success' ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
          ) : (
            <FileText className="w-4 h-4 text-blue-500" />
          );

          return (
            <div
              key={event.id}
              onClick={() => {
                setNotificationPanelOpen(false);
                navigate('/monitoring');
              }}
              className="p-3.5 hover:bg-gray-50 dark:hover:bg-gray-800/80 cursor-pointer transition-colors flex items-start gap-3"
            >
              <div className="mt-0.5 shrink-0">{icon}</div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-gray-900 dark:text-white leading-snug">
                  {event.title}
                </p>
                <div className="flex items-center gap-2 mt-1 text-[11px] text-gray-400">
                  <span className="font-medium text-gray-600 dark:text-gray-300">{event.project}</span>
                  <span>•</span>
                  <span>{event.timeAgo}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Panel Footer */}
      <div className="p-2.5 bg-gray-50 dark:bg-gray-850 border-t border-gray-200 dark:border-gray-800 text-center">
        <button
          onClick={() => {
            setNotificationPanelOpen(false);
            navigate('/monitoring');
          }}
          className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline"
        >
          View all continuous monitoring logs →
        </button>
      </div>
    </div>
  );
};
