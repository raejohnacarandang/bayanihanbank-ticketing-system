import React, { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { User, Branch, UserRole } from "../../types";
import { Users, X, AlertTriangle, Eye, EyeOff } from "lucide-react";
import { UserFormState, ROLE_OPTIONS } from "./types";

export function UserFormModal({
  mode,
  initial,
  branches,
  currentUserId,
  onClose,
  onSubmit,
}: {
  mode: "create" | "edit";
  initial?: User;
  branches: Branch[];
  currentUserId?: string;
  onClose: () => void;
  onSubmit: (form: UserFormState) => void;
}) {
  const isEdit = mode === "edit";
  const [form, setForm] = useState<UserFormState>(() => ({
    id: initial?.id,
    name: initial?.name || "",
    username: initial?.username || "",
    role: initial?.role || "BRANCH_USER",
    email: initial?.email || "",
    branchId: initial?.branchId || branches[0]?.id,
    branchName: initial?.branchName || (branches[0] ? branches[0].name : ""),
    department: initial?.department || "",
    password: "",
  }));

  const [error, setError] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const handleBranchChange = (branchId: string) => {
    const b = branches.find((x) => x.id === branchId);
    setForm((f) => ({ ...f, branchId, branchName: b?.name || "" }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim() || !form.username.trim() || !form.email.trim()) {
      setError("Please fill in all required fields.");
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) {
      setError("Please enter a valid email address.");
      return;
    }
    if (form.role === "BRANCH_USER" && !form.branchId) {
      setError("Please select a branch for this user.");
      return;
    }
    if (form.password && form.password.length < 6) {
      setError("Password must be at least 6 characters long.");
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
            <div className="flex items-center gap-2 text-purple-900 font-bold text-base">
              <Users className="w-5 h-5 text-purple-600" />
              <span>{isEdit ? "Edit User Account" : "Create User Account"}</span>
            </div>
            <button
              onClick={onClose}
              className="p-1 rounded hover:bg-slate-100 text-slate-500 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {isEdit && initial?.passwordResetRequested && (
            <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-xs">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-amber-600" />
              <span>
                This user has <strong>requested a password reset</strong>. Set a
                new password below so they can log in again — the badge clears
                once you save one.
              </span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="col-span-1 sm:col-span-2">
                <label className={labelClass}>
                  Full Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={form.name}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, name: e.target.value }))
                  }
                  placeholder="e.g. Maria Santos"
                  className={inputClass}
                />
              </div>

              <div>
                <label className={labelClass}>
                  Username <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={form.username}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, username: e.target.value }))
                  }
                  placeholder="e.g. maria.santos"
                  className={inputClass}
                />
              </div>

              <div>
                <label className={labelClass}>
                  Role <span className="text-red-500">*</span>
                </label>
                <select
                  value={form.role}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, role: e.target.value as UserRole }))
                  }
                  className={inputClass}
                >
                  {ROLE_OPTIONS.map((r) => (
                    <option key={r.value} value={r.value}>
                      {r.label}
                    </option>
                  ))}
                </select>
              </div>

              {form.role === "BRANCH_USER" ? (
                <div className="col-span-1 sm:col-span-2">
                  <label className={labelClass}>
                    Branch <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={form.branchId || ""}
                    onChange={(e) => handleBranchChange(e.target.value)}
                    className={inputClass}
                  >
                    {branches.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name}
                      </option>
                    ))}
                  </select>
                </div>
              ) : (
                <div className="col-span-1 sm:col-span-2">
                  <label className={labelClass}>Department</label>
                  <input
                    type="text"
                    value={form.department || ""}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, department: e.target.value }))
                    }
                    placeholder={
                      form.role === "IT_STAFF"
                        ? "Main IT Department"
                        : form.role === "AUDITOR"
                          ? "Internal Audit Department"
                          : "System Administration"
                    }
                    className={inputClass}
                  />
                </div>
              )}

              <div className="col-span-1 sm:col-span-2">
                <label className={labelClass}>
                  Email <span className="text-red-500">*</span>
                </label>
                <input
                  type="email"
                  required
                  value={form.email}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, email: e.target.value }))
                  }
                  placeholder="e.g. maria.santos@bayanihanbank.demo"
                  className={inputClass}
                />
              </div>

              <div className="col-span-1 sm:col-span-2">
                <label className={labelClass}>
                  {isEdit
                    ? "New Password (leave blank to keep current)"
                    : "Initial Password"}
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    value={form.password}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, password: e.target.value }))
                    }
                    placeholder={
                      isEdit ? "••••••••" : `Default: password123 (min 6 chars)`
                    }
                    className={`${inputClass} pr-10`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded hover:bg-slate-200 text-slate-500 cursor-pointer"
                    title={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? (
                      <EyeOff className="w-4 h-4" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                  </button>
                </div>
                <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">
                  {isEdit
                    ? "Setting a new password forces the user to change it on their next login."
                    : "If left blank, the default password is password123. The user must change it on first login."}
                </p>
              </div>
            </div>

            {error && (
              <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-xs">
                {error}
              </div>
            )}

            {isEdit && form.id === currentUserId && (
              <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-[11px] flex items-start gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                <span>
                  This is the currently logged-in administrator. Role and deletion
                  cannot be changed for this account.
                </span>
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
                {isEdit ? "Save Changes" : "Create Account"}
              </button>
            </div>
          </form>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
