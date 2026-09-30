import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle, CheckCircle2, X, XCircle } from 'lucide-react';
import { emitToast, onToast } from '@/lib/errors';
import type { ToastMessage, ToastVariant } from '@/types';

const AUTO_DISMISS_MS = 4000;

const STYLES: Record<ToastVariant, { container: string; icon: ReactNode }> = {
  success: {
    container: 'border-emerald-200 bg-emerald-50 text-emerald-900',
    icon: <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600" />,
  },
  error: {
    container: 'border-red-200 bg-red-50 text-red-900',
    icon: <XCircle className="h-5 w-5 shrink-0 text-red-600" />,
  },
  warning: {
    container: 'border-amber-200 bg-amber-50 text-amber-900',
    icon: <AlertTriangle className="h-5 w-5 shrink-0 text-amber-600" />,
  },
};

export const toast = {
  success: (message: string) => emitToast('success', message),
  error: (message: string) => emitToast('error', message),
  warning: (message: string) => emitToast('warning', message),
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const nextId = useRef(1);

  const dismiss = useCallback((id: number) => {
    setToasts((current) => current.filter((t) => t.id !== id));
  }, []);

  useEffect(
    () =>
      onToast((variant, message) => {
        setToasts((current) => {
          // Collapse identical toasts fired in a burst (e.g. several queries failing together).
          if (current.some((t) => t.message === message && t.variant === variant)) return current;
          const id = nextId.current++;
          window.setTimeout(() => dismiss(id), AUTO_DISMISS_MS);
          return [...current.slice(-4), { id, variant, message }];
        });
      }),
    [dismiss],
  );

  return (
    <>
      {children}
      {createPortal(
        <div className="pointer-events-none fixed right-4 top-4 z-[60] flex w-full max-w-sm flex-col gap-2">
          {toasts.map((t) => (
            <div
              key={t.id}
              role="status"
              className={`pointer-events-auto flex animate-slide-in-right items-start gap-3 rounded-xl border px-4 py-3 text-sm shadow-lg ${STYLES[t.variant].container}`}
            >
              {STYLES[t.variant].icon}
              <p className="flex-1 font-medium">{t.message}</p>
              <button
                type="button"
                onClick={() => dismiss(t.id)}
                className="opacity-60 hover:opacity-100"
                aria-label="Dismiss notification"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>,
        document.body,
      )}
    </>
  );
}
