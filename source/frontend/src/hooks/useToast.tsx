import { useState, useCallback } from 'react';


export type ToastType = 'info' | 'success' | 'warning' | 'error';

export interface Toast {
  id: string;
  type: ToastType;
  title: string;
  message?: string;
  duration?: number;
  action?: {
    label: string;
    onClick: () => void;
  };
  undo?: {
    label: string;
    onClick: () => void;
    timeout?: number;
  };
  createdAt: number;
}

interface ToastState {
  toasts: Toast[];
  addToast: (toast: Omit<Toast, 'id' | 'createdAt'>) => string;
  removeToast: (id: string) => void;
  clearToasts: () => void;
}

let toastState: ToastState = {
  toasts: [],
  addToast: () => '',
  removeToast: () => {},
  clearToasts: () => {},
};

const listeners: Set<() => void> = new Set();

const notify = () => {
  listeners.forEach(listener => listener());
};

export function useToast() {
  const [, setTick] = useState(0);

  const addToast = useCallback((toast: Omit<Toast, 'id' | 'createdAt'>) => {
    const id = crypto.randomUUID();
    const newToast: Toast = {
      ...toast,
      id,
      createdAt: Date.now(),
      duration: toast.duration ?? 5000,
    };
    toastState.toasts = [...toastState.toasts, newToast];
    notify();
    setTick(t => t + 1);
    
    if (newToast.undo && newToast.undo.timeout) {
      setTimeout(() => {
        toastState.toasts = toastState.toasts.map(t => 
          t.id === id ? { ...t, undo: undefined } : t
        );
        notify();
        setTick(t => t + 1);
      }, newToast.undo.timeout);
    }
    
    return id;
  }, []);

  const removeToast = useCallback((id: string) => {
    toastState.toasts = toastState.toasts.filter(t => t.id !== id);
    notify();
    setTick(t => t + 1);
  }, []);

  const clearToasts = useCallback(() => {
    toastState.toasts = [];
    notify();
    setTick(t => t + 1);
  }, []);

  useState(() => {
    listeners.add(() => setTick(t => t + 1));
    return () => listeners.delete(() => setTick(t => t + 1));
  });

  return {
    toasts: toastState.toasts,
    addToast,
    removeToast,
    clearToasts,
    success: (title: string, message?: string, options?: { undo?: Toast['undo']; action?: Toast['action'] }) => 
      addToast({ type: 'success', title, message, ...options }),
    error: (title: string, message?: string, options?: { undo?: Toast['undo']; action?: Toast['action'] }) => 
      addToast({ type: 'error', title, message, ...options }),
    warning: (title: string, message?: string, options?: { undo?: Toast['undo']; action?: Toast['action'] }) => 
      addToast({ type: 'warning', title, message, ...options }),
    info: (title: string, message?: string, options?: { undo?: Toast['undo']; action?: Toast['action'] }) => 
      addToast({ type: 'info', title, message, ...options }),
  };
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
