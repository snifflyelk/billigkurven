"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  CheckCircleIcon,
  ExclamationTriangleIcon,
  InformationCircleIcon,
} from "@heroicons/react/24/solid";

type ToastType = "info" | "success" | "error";

type Toast = {
  id: number;
  title: string;
  description?: string;
  type: ToastType;
  actionLabel?: string;
  onAction?: () => void | Promise<void>;
};

type ToastInput = {
  title: string;
  description?: string;
  type?: ToastType;
  actionLabel?: string;
  onAction?: () => void | Promise<void>;
};

type ToastContextValue = {
  showToast: (input: ToastInput) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

function toastTone(type: ToastType) {
  if (type === "error") {
    return "border-rose-200 bg-rose-50 text-rose-900 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-100";
  }

  if (type === "success") {
    return "border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-100";
  }

  return "border-slate-200 bg-white text-slate-900 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100";
}

function ToastStatusIcon({ type }: { type: ToastType }) {
  if (type === "error") {
    return <ExclamationTriangleIcon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />;
  }

  if (type === "success") {
    return <CheckCircleIcon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />;
  }

  return <InformationCircleIcon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />;
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const timersRef = useRef(new Map<number, number>());
  const remainingRef = useRef(new Map<number, number>());
  const startedAtRef = useRef(new Map<number, number>());

  const dismissToast = useCallback((id: number) => {
    const timerId = timersRef.current.get(id);
    if (timerId) {
      window.clearTimeout(timerId);
    }

    timersRef.current.delete(id);
    remainingRef.current.delete(id);
    startedAtRef.current.delete(id);

    setToasts((current) => current.filter((item) => item.id !== id));
  }, []);

  const scheduleDismiss = useCallback(
    (id: number, delayMs: number) => {
      const existing = timersRef.current.get(id);
      if (existing) {
        window.clearTimeout(existing);
      }

      startedAtRef.current.set(id, Date.now());
      const timeoutId = window.setTimeout(() => {
        dismissToast(id);
      }, delayMs);
      timersRef.current.set(id, timeoutId);
    },
    [dismissToast],
  );

  const pauseDismiss = useCallback((id: number) => {
    const timerId = timersRef.current.get(id);
    const startedAt = startedAtRef.current.get(id);
    const remaining = remainingRef.current.get(id) ?? 0;

    if (timerId) {
      window.clearTimeout(timerId);
      timersRef.current.delete(id);
    }

    if (startedAt) {
      const elapsed = Date.now() - startedAt;
      remainingRef.current.set(id, Math.max(0, remaining - elapsed));
      startedAtRef.current.delete(id);
    }
  }, []);

  const resumeDismiss = useCallback(
    (id: number) => {
      const remaining = remainingRef.current.get(id) ?? 0;
      if (remaining <= 0) {
        dismissToast(id);
        return;
      }

      scheduleDismiss(id, remaining);
    },
    [dismissToast, scheduleDismiss],
  );

  const showToast = useCallback((input: ToastInput) => {
    const id = Date.now() + Math.floor(Math.random() * 1000);
    const toast: Toast = {
      id,
      title: input.title,
      description: input.description,
      type: input.type ?? "info",
      actionLabel: input.actionLabel,
      onAction: input.onAction,
    };

    setToasts((current) => [...current, toast]);

    remainingRef.current.set(id, 4500);
    scheduleDismiss(id, 4500);
  }, [scheduleDismiss]);

  useEffect(() => {
    const timers = timersRef.current;
    const remaining = remainingRef.current;
    const startedAt = startedAtRef.current;

    return () => {
      for (const timerId of Array.from(timers.values())) {
        window.clearTimeout(timerId);
      }
      timers.clear();
      remaining.clear();
      startedAt.clear();
    };
  }, []);

  const value = useMemo(() => ({ showToast }), [showToast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed right-4 top-4 z-[100] flex w-[min(92vw,360px)] flex-col gap-2">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`pointer-events-auto rounded-xl border p-3 shadow-lg ${toastTone(toast.type)}`}
            onMouseEnter={() => pauseDismiss(toast.id)}
            onMouseLeave={() => resumeDismiss(toast.id)}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-start gap-2">
                <ToastStatusIcon type={toast.type} />
                <p className="text-sm font-semibold">{toast.title}</p>
              </div>
              <button
                type="button"
                className="rounded-md border border-current/25 px-1.5 py-0.5 text-[11px] font-medium transition hover:bg-black/5 dark:hover:bg-white/10"
                onClick={() => dismissToast(toast.id)}
                aria-label="Lukk varsel"
              >
                ×
              </button>
            </div>
            {toast.description ? <p className="mt-1 text-xs opacity-90">{toast.description}</p> : null}
            {toast.actionLabel && toast.onAction ? (
              <button
                type="button"
                className="mt-2 rounded-lg border border-current/25 px-2 py-1 text-xs font-medium transition hover:bg-black/5 dark:hover:bg-white/10"
                onClick={() => {
                  void toast.onAction?.();
                }}
              >
                {toast.actionLabel}
              </button>
            ) : null}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);

  if (!context) {
    throw new Error("useToast must be used within ToastProvider");
  }

  return context;
}
