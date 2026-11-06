import React from "react";
import { AnimatePresence, motion } from "motion/react";
import { AlertTriangle } from "lucide-react";
import { DeleteTarget } from "./types";
import { useDialogA11y } from "../ui/useDialogA11y";

export function DeleteConfirmModal({
  target,
  onClose,
  onConfirm,
}: {
  target: DeleteTarget;
  onClose: () => void;
  onConfirm: () => void;
}) {
  const panelRef = useDialogA11y<HTMLDivElement>(true, onClose);

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs p-4 flex overflow-y-auto"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.15 }}
        onClick={onClose}
      >
        <motion.div
          ref={panelRef}
          role="dialog"
          aria-modal="true"
          aria-label="Confirm deletion"
          tabIndex={-1}
          className="bg-white rounded-2xl max-w-sm w-full p-6 m-auto shadow-2xl border border-slate-200 space-y-4 outline-none"
          initial={{ opacity: 0, scale: 0.95, y: 8 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 8 }}
          transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center gap-2 text-red-900 font-bold text-base">
            <AlertTriangle className="w-5 h-5 text-red-600" />
            <span>Confirm Deletion</span>
          </div>
          <p className="text-xs text-slate-600 leading-relaxed">
            Are you sure you want to delete{" "}
            <strong className="text-slate-900">
              {target.type === "user"
                ? `user ${target.name}`
                : target.type === "branch"
                  ? `branch "${target.name}"`
                  : `ticket "${target.name}"`}
            </strong>
            ?{" "}
            {target.type === "ticket" ? (
              <>
                Its comments, timeline, and notifications will be removed too
                {target.meta ? ` (${target.meta})` : ""}. This cannot be undone.
              </>
            ) : (
              "This action will be recorded in the audit log."
            )}
          </p>
          <div className="flex justify-end gap-2 pt-2 border-t border-slate-200">
            <button type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-100 text-slate-700 font-bold text-xs rounded-lg hover:bg-slate-200 transition cursor-pointer"
            >
              Cancel
            </button>
            <button type="button"
              onClick={onConfirm}
              className="px-5 py-2 bg-red-700 hover:bg-red-600 text-white font-bold text-xs rounded-lg transition shadow-md cursor-pointer"
            >
              Delete
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
