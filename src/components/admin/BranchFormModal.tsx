import React, { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Branch } from "../../types";
import { Building, X } from "lucide-react";
import { BranchFormState } from "./types";

export function BranchFormModal({
  mode,
  initial,
  onClose,
  onSubmit,
}: {
  mode: "create" | "edit";
  initial?: Branch;
  onClose: () => void;
  onSubmit: (form: BranchFormState) => void;
}) {
  const isEdit = mode === "edit";
  const [form, setForm] = useState<BranchFormState>(() => ({
    id: initial?.id,
    name: initial?.name || "",
    location: initial?.location || "",
    status: initial?.status || "Active",
    userCount: initial?.userCount ?? 1,
  }));

  const [error, setError] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim() || !form.location.trim()) {
      setError("Please fill in all required fields.");
      return;
    }
    onSubmit(form);
  };

  const inputClass =
    "w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-600 focus:bg-white transition";
  const labelClass =
    "block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1";

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
          className="bg-white rounded-2xl max-w-lg w-full p-6 m-auto shadow-2xl border border-slate-200 space-y-4"
          initial={{ opacity: 0, scale: 0.95, y: 8 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 8 }}
          transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-indigo-900 font-bold text-base">
              <Building className="w-5 h-5 text-indigo-600" />
              <span>{isEdit ? "Edit Branch" : "Add Branch"}</span>
            </div>
            <button
              onClick={onClose}
              className="p-1 rounded hover:bg-slate-100 text-slate-500 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-3">
            <div className="grid grid-cols-1 gap-3">
              <div className="col-span-1">
                <label className={labelClass}>Status</label>
                <select
                  value={form.status}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      status: e.target.value as "Active" | "Inactive",
                    }))
                  }
                  className={inputClass}
                >
                  <option value="Active">Active</option>
                  <option value="Inactive">Inactive</option>
                </select>
              </div>

              <div className="col-span-1 sm:col-span-2">
                <label className={labelClass}>
                  Branch Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={form.name}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, name: e.target.value }))
                  }
                  placeholder="e.g. Tiaong Branch"
                  className={inputClass}
                />
              </div>

              <div className="col-span-1 sm:col-span-2">
                <label className={labelClass}>
                  Location <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={form.location}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, location: e.target.value }))
                  }
                  placeholder="e.g. Tiaong, Quezon"
                  className={inputClass}
                />
              </div>
            </div>

            {error && (
              <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-xs">
                {error}
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-200">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 bg-slate-100 text-slate-700 font-bold text-xs rounded-lg hover:bg-slate-200 transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-5 py-2 bg-indigo-700 hover:bg-indigo-600 text-white font-bold text-xs rounded-lg transition shadow-md cursor-pointer"
              >
                {isEdit ? "Save Changes" : "Add Branch"}
              </button>
            </div>
          </form>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
