import React from 'react';
import { useAppState } from '../../context/AppStateContext';
import { CheckCircle2, AlertCircle, Info, AlertTriangle, X } from 'lucide-react';

export const ToastContainer: React.FC = () => {
  const { toasts, removeToast } = useAppState();

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-5 right-5 z-50 flex flex-col gap-2 max-w-md w-full pointer-events-none">
      {toasts.map(toast => {
        const icon = {
          success: <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />,
          error: <AlertCircle className="w-5 h-5 text-red-500 shrink-0" />,
          warning: <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0" />,
          info: <Info className="w-5 h-5 text-sky-500 shrink-0" />,
        }[toast.type];

        const borderColors = {
          success: 'border-emerald-200 dark:border-emerald-900/60',
          error: 'border-red-200 dark:border-red-900/60',
          warning: 'border-amber-200 dark:border-amber-900/60',
          info: 'border-sky-200 dark:border-sky-900/60',
        }[toast.type];

        return (
          <div
            key={toast.id}
            className={`pointer-events-auto bg-white dark:bg-[#111827] border ${borderColors} rounded-xl p-4 shadow-xl flex items-start gap-3 transition-all duration-300 transform translate-y-0`}
          >
            {icon}
            <div className="flex-1 min-w-0">
              <h4 className="text-sm font-semibold text-gray-900 dark:text-white">
                {toast.title}
              </h4>
              <p className="text-xs text-gray-600 dark:text-gray-300 mt-0.5 leading-relaxed">
                {toast.message}
              </p>
            </div>
            <button
              onClick={() => removeToast(toast.id)}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 p-1"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        );
      })}
    </div>
  );
};
