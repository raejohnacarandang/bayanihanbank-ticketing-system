import React, { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { CategoryInfo } from "../../types";
import type { CreateCategoryParams } from "../../services/store";
import { Layers, X, Plus } from "lucide-react";

export function CategoryFormModal({
  mode,
  initial,
  onClose,
  onSubmit,
}: {
  mode: "create" | "edit";
  initial?: CategoryInfo;
  onClose: () => void;
  onSubmit: (category: CreateCategoryParams) => void;
}) {
  const isEdit = mode === "edit";
  const [name, setName] = useState(initial?.name ?? "");
  const [subcategories, setSubcategories] = useState<string[]>(() =>
    (initial?.subcategory ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean),
  );
  const [error, setError] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError("Category name is required.");
      return;
    }
    const subs = subcategories.map((s) => s.trim()).filter(Boolean);
    onSubmit({ name: name.trim(), subcategory: subs.join(", ") });
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
            <div className="flex items-center gap-2 text-purple-900 font-bold text-base">
              <Layers className="w-5 h-5 text-purple-600" />
              <span>{isEdit ? "Edit Category" : "Add Category"}</span>
            </div>
            <button
              onClick={onClose}
              className="p-1 rounded hover:bg-slate-100 text-slate-500 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <p className="text-xs text-slate-600 leading-relaxed">
            {isEdit
              ? "Update the category details. Changes will be reflected in the taxonomy list."
              : 'Add a new IT request category. It will appear in the taxonomy list as "Active".'}
          </p>

          <form onSubmit={handleSubmit} className="space-y-3">
            <div>
              <label className={labelClass}>
                Category Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Printer & Printing"
                className={inputClass}
              />
            </div>

            <div>
              <label className={labelClass}>Subcategories</label>
              {subcategories.length === 0 && (
                <p className="text-[11px] text-slate-500 mb-1.5">
                  No subcategories yet. Add at least one to describe the items
                  under this category.
                </p>
              )}
              <div className="space-y-2">
                {subcategories.map((sub, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <input
                      type="text"
                      value={sub}
                      onChange={(e) => {
                        const next = [...subcategories];
                        next[index] = e.target.value;
                        setSubcategories(next);
                      }}
                      placeholder={`e.g. ${index === 0 ? "Printers & consumables" : "Scanners"}`}
                      className={inputClass}
                    />
                    <button
                      type="button"
                      onClick={() =>
                        setSubcategories(
                          subcategories.filter((_, i) => i !== index),
                        )
                      }
                      className="p-2 rounded-lg bg-red-50 hover:bg-red-100 text-red-600 transition shrink-0 cursor-pointer"
                      title="Remove subcategory"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
              <button
                type="button"
                onClick={() => setSubcategories([...subcategories, ""])}
                className="mt-2 inline-flex items-center gap-1.5 px-3 py-1.5 bg-purple-50 hover:bg-purple-100 text-purple-700 font-bold text-[11px] rounded-lg transition cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Subcategory</span>
              </button>
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
                className="px-5 py-2 bg-purple-700 hover:bg-purple-600 text-white font-bold text-xs rounded-lg transition shadow-md cursor-pointer"
              >
                {isEdit ? "Save Changes" : "Add Category"}
              </button>
            </div>
          </form>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
