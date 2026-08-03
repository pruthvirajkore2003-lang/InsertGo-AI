/**
 * Lightweight, non-blocking toast notifications (SPEC §9.1).
 * Stores push errors here from their catch blocks; the Toaster renders them.
 */
import { create } from "zustand";

export type ToastKind = "error" | "info" | "success";

export type Toast = {
  id: string;
  kind: ToastKind;
  message: string;
};

const AUTO_DISMISS_MS = 4000;

type ToastState = {
  toasts: Toast[];
  push: (kind: ToastKind, message: string) => void;
  dismiss: (id: string) => void;
};

export const useToastStore = create<ToastState>((set) => ({
  toasts: [],
  push: (kind, message) => {
    const id = crypto.randomUUID();
    set((s) => ({ toasts: [...s.toasts, { id, kind, message }] }));
    setTimeout(() => {
      set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }));
    }, AUTO_DISMISS_MS);
  },
  dismiss: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}));

/** Convenience for non-React call sites (store catch blocks). */
export const toast = {
  error: (message: string) => useToastStore.getState().push("error", message),
  info: (message: string) => useToastStore.getState().push("info", message),
  success: (message: string) =>
    useToastStore.getState().push("success", message),
};
