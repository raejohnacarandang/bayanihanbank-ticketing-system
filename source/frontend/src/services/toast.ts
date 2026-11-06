/**
 * Lightweight app-wide toast (confirmation) system.
 * Module-level store with a subscribe API; <Toaster /> renders it.
 */

export type ToastKind = 'success' | 'error' | 'info';

export interface ToastMessage {
  id: number;
  kind: ToastKind;
  message: string;
}

type Listener = (toasts: ToastMessage[]) => void;

const DURATION_MS = 3800;

let toasts: ToastMessage[] = [];
let sequence = 0;
const listeners = new Set<Listener>();

function emit(): void {
  const snapshot = [...toasts];
  for (const listener of listeners) listener(snapshot);
}

export function pushToast(message: string, kind: ToastKind = 'success'): void {
  const toast: ToastMessage = { id: ++sequence, kind, message };
  toasts = [...toasts, toast];
  emit();
  window.setTimeout(() => {
    toasts = toasts.filter((t) => t.id !== toast.id);
    emit();
  }, DURATION_MS);
}

export function successToast(message: string): void {
  pushToast(message, 'success');
}

export function errorToast(message: string): void {
  pushToast(message, 'error');
}

export function infoToast(message: string): void {
  pushToast(message, 'info');
}

export function dismissToast(id: number): void {
  toasts = toasts.filter((t) => t.id !== id);
  emit();
}

export function subscribeToasts(listener: Listener): () => void {
  listeners.add(listener);
  listener([...toasts]);
  return () => listeners.delete(listener);
}