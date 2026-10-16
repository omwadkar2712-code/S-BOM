import React, { useState } from 'react';
import { useAppState } from '../../context/AppStateContext';
import { CheckCircle2, AlertCircle, Info, AlertTriangle, X, Layers, Bell } from 'lucide-react';

export const ToastContainer: React.FC = () => {
  const { toasts, removeToast } = useAppState();
  const [isHovered, setIsHovered] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);

  if (toasts.length === 0) return null;

  // Most recent toast at the top
  const orderedToasts = [...toasts].reverse();
  const hasMultiple = orderedToasts.length > 1;
  const showExpanded = hasMultiple && (isHovered || isExpanded);

  const handleClearAll = () => {
    toasts.forEach((t) => removeToast(t.id));
    setIsExpanded(false);
  };

  return (
    <div
      className="fixed top-20 right-6 z-50 max-w-sm sm:max-w-md w-full pointer-events-none select-none transition-all duration-300"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Header bar when stack is expanded */}
      {showExpanded && (
        <div className="pointer-events-auto mb-2 px-3 py-1.5 bg-white/95 dark:bg-[#111827]/95 backdrop-blur-md border border-gray-200 dark:border-gray-800 rounded-xl shadow-md flex items-center justify-between text-xs animate-in fade-in slide-in-from-top-2 duration-150">
          <div className="flex items-center gap-1.5 text-gray-700 dark:text-gray-200 font-bold">
            <Bell className="w-3.5 h-3.5 text-blue-500" />
            <span>Notifications ({orderedToasts.length})</span>
          </div>
          <button
            type="button"
            onClick={handleClearAll}
            className="text-[11px] font-semibold text-gray-500 hover:text-red-600 dark:text-gray-400 dark:hover:text-red-400 cursor-pointer transition-colors"
          >
            Dismiss all
          </button>
        </div>
      )}

      {/* Notifications container: Stacked or Expanded */}
      <div className={showExpanded ? 'flex flex-col gap-2 pointer-events-auto' : 'relative'}>
        {orderedToasts.map((toast, index) => {
          // If not expanded and beyond top 3, hide
          if (!showExpanded && index > 2) return null;

          const icon = {
            success: <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />,
            error: <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />,
            warning: <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />,
            info: <Info className="w-4 h-4 text-blue-500 shrink-0" />,
          }[toast.type];

          const iconBg = {
            success: 'bg-emerald-50 dark:bg-emerald-950/60 border-emerald-200/60 dark:border-emerald-900/40',
            error: 'bg-red-50 dark:bg-red-950/60 border-red-200/60 dark:border-red-900/40',
            warning: 'bg-amber-50 dark:bg-amber-950/60 border-amber-200/60 dark:border-amber-900/40',
            info: 'bg-blue-50 dark:bg-blue-950/60 border-blue-200/60 dark:border-blue-900/40',
          }[toast.type];

          const borderColors = {
            success: 'border-emerald-200/90 dark:border-emerald-900/60 shadow-emerald-500/5',
            error: 'border-red-200/90 dark:border-red-900/60 shadow-red-500/5',
            warning: 'border-amber-200/90 dark:border-amber-900/60 shadow-amber-500/5',
            info: 'border-blue-200/90 dark:border-blue-900/60 shadow-blue-500/5',
          }[toast.type];

          // Stack transform styles when collapsed
          const stackStyle: React.CSSProperties = !showExpanded && hasMultiple
            ? index === 0
              ? { position: 'relative', zIndex: 30 }
              : index === 1
              ? {
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  transform: 'translateY(10px) scale(0.96)',
                  opacity: 0.85,
                  zIndex: 20,
                  pointerEvents: 'none',
                }
              : {
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  transform: 'translateY(20px) scale(0.92)',
                  opacity: 0.65,
                  zIndex: 10,
                  pointerEvents: 'none',
                }
            : {};

          return (
            <div
              key={toast.id}
              style={stackStyle}
              className={`pointer-events-auto bg-white/95 dark:bg-[#111827]/95 backdrop-blur-md border ${borderColors} rounded-2xl p-3.5 shadow-2xl flex items-start gap-3 transition-all duration-300 ${
                index === 0 && !showExpanded ? 'animate-in fade-in slide-in-from-right-4 duration-200' : ''
              }`}
            >
              <div className={`p-1.5 rounded-xl border ${iconBg} shrink-0 mt-0.5`}>
                {icon}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <h4 className="text-xs font-bold text-gray-900 dark:text-white truncate">
                    {toast.title}
                  </h4>
                  {/* Stack badge indicator on front toast when collapsed */}
                  {!showExpanded && hasMultiple && index === 0 && (
                    <button
                      type="button"
                      onClick={() => setIsExpanded(true)}
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 dark:bg-blue-950/70 dark:text-blue-300 border border-blue-200 dark:border-blue-800 hover:bg-blue-100 transition-colors cursor-pointer shadow-2xs"
                      title="Click to expand stack"
                    >
                      <Layers className="w-3 h-3" />
                      <span>+{orderedToasts.length - 1} more</span>
                    </button>
                  )}
                </div>
                <p className="text-xs text-gray-600 dark:text-gray-300 mt-0.5 leading-relaxed">
                  {toast.message}
                </p>
              </div>

              <button
                type="button"
                onClick={() => removeToast(toast.id)}
                className="text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors cursor-pointer shrink-0"
                title="Dismiss"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
};
