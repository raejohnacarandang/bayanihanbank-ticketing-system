import React, { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { CheckCircle2, XCircle, Info, X } from 'lucide-react';
import { ToastMessage, subscribeToasts, dismissToast } from '../../services/toast';

const KIND_STYLES: Record<ToastMessage['kind'], { ring: string; icon: React.ReactNode }> = {
  success: {
    ring: 'border-emerald-300 bg-emerald-50 text-emerald-800',
    icon: <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />,
  },
  error: {
    ring: 'border-red-300 bg-red-50 text-red-800',
    icon: <XCircle className="w-4 h-4 text-red-600 shrink-0" />,
  },
  info: {
    ring: 'border-slate-300 bg-slate-50 text-slate-800',
    icon: <Info className="w-4 h-4 text-slate-600 shrink-0" />,
  },
};

export const Toaster: React.FC = () => {
  const [items, setItems] = useState<ToastMessage[]>([]);

  useEffect(() => subscribeToasts(setItems), []);

  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[80] flex flex-col items-center gap-2 w-full max-w-sm px-4 pointer-events-none">
      <AnimatePresence>
        {items.map((toast) => (
          <motion.div
            key={toast.id}
            initial={{ opacity: 0, y: 16, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.97 }}
            transition={{ type: 'spring', damping: 26, stiffness: 380 }}
            className={`pointer-events-auto w-full flex items-start gap-2.5 rounded-xl border px-3.5 py-3 shadow-lg ${KIND_STYLES[toast.kind].ring}`}
          >
            {KIND_STYLES[toast.kind].icon}
            <p className="flex-1 text-xs font-semibold leading-snug">{toast.message}</p>
            <button type="button"
              onClick={() => dismissToast(toast.id)}
              className="text-slate-400 hover:text-slate-600 transition cursor-pointer"
              title="Dismiss"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
};