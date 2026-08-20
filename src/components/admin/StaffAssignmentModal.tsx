import React, { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { User, Branch, BranchAssignment } from "../../types";
import { MapPin, X, CalendarClock } from "lucide-react";
import { DURATION_OPTIONS, buildAssignment } from "./types";

export function StaffAssignmentModal({
  staff,
  branches,
  onClose,
  onSave,
}: {
  staff: User;
  branches: Branch[];
  onClose: () => void;
  onSave: (assignments: BranchAssignment[]) => void;
}) {
  const existing = staff.assignments || [];
  const [selections, setSelections] = useState<Record<string, number>>(() => {
    const map: Record<string, number> = {};
    for (const a of existing) map[a.branchId] = a.durationMonths;
    return map;
  });

  const toggle = (branchId: string) => {
    setSelections((prev) => {
      const next = { ...prev };
      if (branchId in next) {
        delete next[branchId];
      } else {
        next[branchId] = 3;
      }
      return next;
    });
  };

  const setDuration = (branchId: string, months: number) => {
    setSelections((prev) => ({ ...prev, [branchId]: months }));
  };

  const handleSave = () => {
    const assignments: BranchAssignment[] = branches
      .filter((b) => b.id in selections)
      .map((b) => buildAssignment(b.id, b.name, selections[b.id]));
    onSave(assignments);
  };

  const selectedCount = Object.keys(selections).length;

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
          className="bg-white rounded-2xl max-w-2xl w-full p-6 m-auto shadow-2xl border border-slate-200 space-y-4"
          initial={{ opacity: 0, scale: 0.95, y: 8 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 8 }}
          transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sky-900 font-bold text-base">
              <MapPin className="w-5 h-5 text-sky-600" />
              <span>Assign Branches — {staff.name}</span>
            </div>
            <button
              onClick={onClose}
              className="p-1 rounded hover:bg-slate-100 text-slate-500 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <p className="text-xs text-slate-600 leading-relaxed">
            Select which branch(es) this IT specialist member is assigned to and
            set how long each assignment lasts. Expired assignments appear in red
            on the roster.
          </p>

          <div className="max-h-80 overflow-y-auto space-y-2 pr-1">
            {branches.map((b) => {
              const checked = b.id in selections;
              return (
                <div
                  key={b.id}
                  className={`p-3 rounded-xl border transition flex flex-col sm:flex-row sm:items-center gap-3 ${
                    checked
                      ? "bg-sky-50/70 border-sky-300"
                      : "bg-slate-50 border-slate-200"
                  }`}
                >
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggle(b.id)}
                      className="w-4 h-4 rounded text-sky-600 focus:ring-emerald-500 cursor-pointer"
                    />
                    <div className="min-w-0">
                      <div className="font-bold text-slate-900 text-sm">
                        {b.name}
                      </div>
                      <div className="text-[11px] text-slate-500">
                        {b.location}
                      </div>
                    </div>
                  </div>

                  {checked && (
                    <div className="flex items-center gap-2 shrink-0">
                      <CalendarClock className="w-3.5 h-3.5 text-sky-600" />
                      <select
                        value={selections[b.id]}
                        onChange={(e) =>
                          setDuration(b.id, Number(e.target.value))
                        }
                        className="px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-lg text-slate-700 font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer"
                      >
                        {DURATION_OPTIONS.map((m) => (
                          <option key={m} value={m}>
                            {m} month{m > 1 ? "s" : ""}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {selectedCount > 0 && (
            <div className="p-3 bg-sky-50 border border-sky-200 rounded-xl text-xs text-sky-900">
              <strong>{selectedCount}</strong> branch
              {selectedCount > 1 ? "es" : ""} selected. Assignments will take
              effect immediately and show the expiry date on the roster.
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-200">
            <button
              onClick={onClose}
              className="px-4 py-2 bg-slate-100 text-slate-700 font-bold text-xs rounded-lg hover:bg-slate-200 transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              className="px-5 py-2 bg-sky-700 hover:bg-sky-600 text-white font-bold text-xs rounded-lg transition shadow-md cursor-pointer"
            >
              Save Assignments
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
