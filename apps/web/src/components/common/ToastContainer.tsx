import React from 'react';
import { useToastStore, type ToastType } from '../../store/toast.store';
import { CheckCircle2, AlertCircle, AlertTriangle, Info, X, RotateCcw } from 'lucide-react';

const ICONS: Record<ToastType, React.ReactNode> = {
  success: <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />,
  error: <AlertCircle className="w-5 h-5 text-rose-500 shrink-0" />,
  warning: <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0" />,
  info: <Info className="w-5 h-5 text-indigo-500 shrink-0" />,
};

const BORDER_STYLES: Record<ToastType, string> = {
  success: 'border-emerald-200 dark:border-emerald-900/40 bg-emerald-50/80 dark:bg-emerald-950/40',
  error: 'border-rose-200 dark:border-rose-900/40 bg-rose-50/80 dark:bg-rose-950/40',
  warning: 'border-amber-200 dark:border-amber-900/40 bg-amber-50/80 dark:bg-amber-950/40',
  info: 'border-indigo-200 dark:border-indigo-900/40 bg-indigo-50/80 dark:bg-indigo-950/40',
};

export function ToastContainer() {
  const toasts = useToastStore((s) => s.toasts);
  const removeToast = useToastStore((s) => s.removeToast);

  if (toasts.length === 0) return null;

  return (
    <div
      className="fixed bottom-5 right-5 z-50 flex flex-col space-y-2.5 max-w-sm w-full pointer-events-none"
      data-testid="toast-container"
    >
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`pointer-events-auto flex items-start space-x-3 p-3.5 rounded-xl border shadow-lg backdrop-blur-md transition-all duration-200 animate-in slide-in-from-bottom-2 ${BORDER_STYLES[t.type]}`}
          role="alert"
        >
          {ICONS[t.type]}
          <div className="flex-1 min-w-0 pt-0.5">
            {t.title && (
              <h4 className="text-xs font-semibold text-zinc-900 dark:text-zinc-100 mb-0.5">
                {t.title}
              </h4>
            )}
            <p className="text-xs text-zinc-700 dark:text-zinc-300 leading-relaxed break-words">
              {t.message}
            </p>
            {t.undoAction && (
              <button
                type="button"
                onClick={() => {
                  t.undoAction?.();
                  removeToast(t.id);
                }}
                className="mt-2 inline-flex items-center space-x-1 text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Undo</span>
              </button>
            )}
          </div>
          <button
            type="button"
            onClick={() => removeToast(t.id)}
            className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 p-0.5 rounded cursor-pointer"
            aria-label="Close notification"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      ))}
    </div>
  );
}
