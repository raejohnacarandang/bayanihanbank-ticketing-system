import React, { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { BayanihanLogo } from "../components/BayanihanLogo";
import { Button } from "../components/ui/Button";
import {
  ShieldCheck,
  Lock,
  User as UserIcon,
  AlertCircle,
  ArrowRight,
  Eye,
  EyeOff,
  X,
  KeyRound,
} from "lucide-react";

interface LoginViewProps {
  onLogin: (username: string, password: string) => Promise<void>;
  onRequestPasswordReset?: (
    username: string,
  ) => Promise<{ requiresRecoveryKey?: boolean }>;
  onAdminRecovery?: (
    username: string,
    key: string,
  ) => Promise<{ oneTimePassword: string }>;
}

interface SavedAccount {
  username: string;
  password: string;
}

const SAVED_ACCOUNTS_KEY = "bb_saved_creds";
const MAX_SAVED_ACCOUNTS = 5;

const readSavedAccounts = (): SavedAccount[] => {
  try {
    const raw = localStorage.getItem(SAVED_ACCOUNTS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as SavedAccount | SavedAccount[];
    const list = Array.isArray(parsed) ? parsed : [parsed];
    return list.filter(
      (a) => a && typeof a.username === "string" && a.username.length > 0,
    );
  } catch {
    return [];
  }
};

const writeSavedAccounts = (accounts: SavedAccount[]): void => {
  localStorage.setItem(SAVED_ACCOUNTS_KEY, JSON.stringify(accounts));
};

export const LoginView: React.FC<LoginViewProps> = ({
  onLogin,
  onRequestPasswordReset,
  onAdminRecovery,
}) => {
  const [savedAccounts, setSavedAccounts] = useState<SavedAccount[]>(() =>
    readSavedAccounts(),
  );
  const [username, setUsername] = useState(savedAccounts[0]?.username ?? "");
  const [password, setPassword] = useState(savedAccounts[0]?.password ?? "");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [showForgotModal, setShowForgotModal] = useState(false);
  const [resetUsername, setResetUsername] = useState("");
  const [resetStatus, setResetStatus] = useState<
    "idle" | "submitting" | "success" | "error"
  >("idle");
  const [resetMessage, setResetMessage] = useState("");
  const [recoveryKey, setRecoveryKey] = useState("");
  const [oneTimePassword, setOneTimePassword] = useState("");
  const [recoveryMode, setRecoveryMode] = useState(false);

  const submitResetRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetUsername.trim() || resetStatus === "submitting") return;
    setResetStatus("submitting");
    setResetMessage("");
    try {
      if (!onRequestPasswordReset) throw new Error("unavailable");
      const res = await onRequestPasswordReset(resetUsername.trim());
      if (res?.requiresRecoveryKey) {
        setRecoveryMode(true);
        setResetStatus("idle");
        setResetMessage(
          "This is an administrator account. Enter the recovery key issued to the IT operations team.",
        );
        return;
      }
      setResetStatus("success");
      setResetMessage(
        "Reset request submitted. Your IT administrator will set a new password for you.",
      );
    } catch {
      setResetStatus("error");
      setResetMessage(
        "No account found with that username. Please check and try again, or contact the IT Helpdesk.",
      );
    }
  };

  const submitRecovery = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!recoveryKey.trim() || resetStatus === "submitting") return;
    setResetStatus("submitting");
    setResetMessage("");
    try {
      if (!onAdminRecovery) throw new Error("unavailable");
      const res = await onAdminRecovery(
        resetUsername.trim(),
        recoveryKey.trim(),
      );
      setOneTimePassword(res.oneTimePassword);
      setResetStatus("success");
      setResetMessage(
        "Password reset. Sign in with the one-time password below — you will be required to set a new password on first login.",
      );
    } catch {
      setResetStatus("error");
      setResetMessage(
        "Recovery failed. Check the recovery key or contact the IT operations team.",
      );
    }
  };

  const closeForgotModal = () => {
    setShowForgotModal(false);
    setResetStatus("idle");
    setResetMessage("");
    setResetUsername("");
    setRecoveryKey("");
    setOneTimePassword("");
    setRecoveryMode(false);
  };

  const saveAccount = (user: string, pass: string) => {
    setSavedAccounts((prev) => {
      const next = [
        { username: user, password: pass },
        ...prev.filter((a) => a.username.toLowerCase() !== user.toLowerCase()),
      ].slice(0, MAX_SAVED_ACCOUNTS);
      writeSavedAccounts(next);
      return next;
    });
  };

  const performLogin = async (user: string, pass: string) => {
    setErrorMessage("");
    try {
      await onLogin(user, pass);
      if (rememberMe) saveAccount(user, pass);
    } catch {
      setErrorMessage("Invalid username or password.");
    }
  };

  const handleSelectAccount = (account: SavedAccount) => {
    setUsername(account.username);
    setPassword(account.password);
    void performLogin(account.username, account.password);
  };

  const handleRemoveAccount = (acctUsername: string) => {
    setSavedAccounts((prev) => {
      const next = prev.filter(
        (a) => a.username.toLowerCase() !== acctUsername.toLowerCase(),
      );
      writeSavedAccounts(next);
      return next;
    });
    if (username.toLowerCase() === acctUsername.toLowerCase()) {
      setUsername("");
      setPassword("");
    }
  };

  const handleClearAllSaved = () => {
    localStorage.removeItem(SAVED_ACCOUNTS_KEY);
    setSavedAccounts([]);
    setUsername("");
    setPassword("");
  };

  const handleLoginSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    void performLogin(username, password);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-950 via-slate-950 to-emerald-950 text-slate-100 flex flex-col justify-between p-4 sm:p-6 lg:p-8">
      {/* Main Login Card Container */}
      <div className="my-auto max-w-md mx-auto w-full space-y-6 pt-6 pb-8">
        {/* Bank Brand Identity Header */}
        <motion.div
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
          className="text-center space-y-3"
        >
          <div className="flex justify-center">
            <BayanihanLogo
              size="xl"
              showSubtitle
              subtitleText="IT Service Desk Portal"
            />
          </div>
          <p className="text-xs text-emerald-200/80 max-w-xs mx-auto leading-relaxed">
            Centralized IT Support & Service Management for Branches and Main IT
          </p>
        </motion.div>

        {/* Login Form Card */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.15, ease: [0.16, 1, 0.3, 1] }}
          className="bg-white text-slate-900 rounded-2xl shadow-[var(--shadow-pop)] p-6 sm:p-8 border border-slate-200"
        >
          {savedAccounts.length > 0 && (
            <div className="mb-4 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider">
                  Saved Accounts
                </span>
                <button
                  type="button"
                  onClick={handleClearAllSaved}
                  className="text-[10px] font-bold text-slate-400 hover:text-red-600 underline cursor-pointer"
                >
                  Clear all
                </button>
              </div>
              <div className="space-y-1.5">
                {savedAccounts.map((account) => (
                  <div
                    key={account.username}
                    className="flex items-center gap-1.5 p-1.5 rounded-lg border border-emerald-200 bg-emerald-50/60"
                  >
                    <button
                      type="button"
                      onClick={() => handleSelectAccount(account)}
                      className="flex-1 flex items-center gap-2.5 text-left cursor-pointer"
                    >
                      <div className="w-8 h-8 rounded-full bg-emerald-700 text-white flex items-center justify-center shrink-0">
                        <UserIcon className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <div className="text-xs font-bold text-slate-800 truncate">
                          {account.username}
                        </div>
                        <div className="text-[10px] text-emerald-600">
                          Click to sign in as this account
                        </div>
                      </div>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleRemoveAccount(account.username)}
                      className="p-1.5 rounded-md text-slate-400 hover:text-red-600 hover:bg-red-50 transition cursor-pointer shrink-0"
                      title={`Remove ${account.username}`}
                      aria-label={`Remove ${account.username}`}
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          <form onSubmit={handleLoginSubmit} className="space-y-4">
            {errorMessage && (
              <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-xs flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                <span>{errorMessage}</span>
              </div>
            )}

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Username
              </label>
              <div className="relative">
                <UserIcon className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                <input
                  type="text"
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="e.g. branch.user or it.staff"
                  className="w-full pl-9 pr-3 py-2.5 bg-slate-50 border border-slate-300 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-600 focus:bg-white transition"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Password
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-9 pr-10 py-2.5 bg-slate-50 border border-slate-300 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-600 focus:bg-white transition"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((s) => !s)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-slate-400 hover:text-emerald-700 transition cursor-pointer"
                  title={showPassword ? "Hide password" : "Show password"}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? (
                    <EyeOff className="w-4 h-4" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between text-xs">
              <label className="flex items-center gap-2 text-slate-600 cursor-pointer">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="rounded text-emerald-600 focus:ring-emerald-500"
                />
                <span>Remember me</span>
              </label>

              <button
                type="button"
                onClick={() => setShowForgotModal(true)}
                className="text-emerald-700 hover:text-emerald-900 font-bold cursor-pointer"
              >
                Forgot Password?
              </button>
            </div>

            <Button
              type="submit"
              variant="primary"
              size="lg"
              className="w-full justify-center"
            >
              <span>Access IT Portal</span>
              <ArrowRight className="w-4 h-4" />
            </Button>
          </form>
        </motion.div>
      </div>

      {/* Forgot Password Modal */}
      <AnimatePresence>
      {showForgotModal && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs p-4 flex overflow-y-auto"
          onClick={closeForgotModal}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 8 }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            onClick={(e) => e.stopPropagation()}
            className="bg-white text-slate-900 rounded-2xl max-w-sm w-full p-6 m-auto space-y-4 shadow-2xl border border-slate-200"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-emerald-900 font-bold text-base">
                <ShieldCheck className="w-5 h-5 text-emerald-600" />
                <span>Reset Password</span>
              </div>
              <button
                onClick={closeForgotModal}
                className="p-1 rounded hover:bg-slate-100 text-slate-500 cursor-pointer"
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {resetStatus === "success" ? (
              <div className="space-y-3">
                <p className="text-xs text-slate-600 leading-relaxed">
                  <strong className="text-emerald-700">
                    Request received.
                  </strong>{" "}
                  {resetMessage}
                </p>
                {oneTimePassword && (
                  <div className="p-4 rounded-lg bg-emerald-50 border border-emerald-300 text-center space-y-2">
                    <p className="text-[10px] uppercase tracking-wider font-bold text-emerald-700">
                      One-time password
                    </p>
                    <p className="font-mono text-lg font-black text-emerald-900 break-all">
                      {oneTimePassword}
                    </p>
                    <p className="text-[10px] text-emerald-700 leading-relaxed">
                      Copy it now — it is shown only once. You will be forced to
                      set a new password on first login.
                    </p>
                  </div>
                )}
                <button
                  onClick={closeForgotModal}
                  className="w-full py-2 bg-emerald-950 text-white font-semibold text-xs rounded-lg hover:bg-emerald-900 transition cursor-pointer"
                >
                  Done
                </button>
              </div>
            ) : recoveryMode ? (
              <form onSubmit={submitRecovery} className="space-y-3">
                <div className="flex items-center gap-2 p-3 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-xs">
                  <KeyRound className="w-4 h-4 shrink-0" />
                  <span>
                    Account <strong>{resetUsername}</strong> is an
                    administrator. Enter the recovery key.
                  </span>
                </div>
                <div className="relative">
                  <KeyRound className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="password"
                    value={recoveryKey}
                    onChange={(e) => setRecoveryKey(e.target.value)}
                    placeholder="Recovery key"
                    autoFocus
                    className="w-full pl-9 pr-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-600"
                  />
                </div>
                {resetStatus === "error" && (
                  <div className="flex items-start gap-2 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-xs">
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                    <span>{resetMessage}</span>
                  </div>
                )}
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setRecoveryMode(false);
                      setResetStatus("idle");
                      setResetMessage("");
                    }}
                    className="px-3 py-2 rounded-lg text-xs font-bold text-slate-600 hover:bg-slate-100 transition cursor-pointer"
                  >
                    Back
                  </button>
                  <Button
                    type="submit"
                    variant="primary"
                    disabled={
                      !recoveryKey.trim() || resetStatus === "submitting"
                    }
                    className="flex-1"
                  >
                    {resetStatus === "submitting"
                      ? "Resetting…"
                      : "Reset Password"}
                  </Button>
                </div>
              </form>
            ) : (
              <form onSubmit={submitResetRequest} className="space-y-3">
                <p className="text-xs text-slate-600 leading-relaxed">
                  Enter the username for your Bayanihan Bank account. Your IT
                  administrator will be notified and will issue you a new
                  password.
                </p>
                <div className="relative">
                  <UserIcon className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={resetUsername}
                    onChange={(e) => setResetUsername(e.target.value)}
                    placeholder="Your username"
                    autoFocus
                    className="w-full pl-9 pr-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-600"
                  />
                </div>
                {resetStatus === "error" && (
                  <div className="flex items-start gap-2 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-xs">
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                    <span>{resetMessage}</span>
                  </div>
                )}
                <Button
                  type="submit"
                  variant="primary"
                  disabled={
                    !resetUsername.trim() || resetStatus === "submitting"
                  }
                  className="w-full"
                >
                  {resetStatus === "submitting"
                    ? "Submitting…"
                    : "Submit Reset Request"}
                </Button>
              </form>
            )}
          </motion.div>
        </motion.div>
      )}
      </AnimatePresence>

      {/* Footer Disclaimer */}
      <footer className="text-center text-emerald-300/70 text-[11px] py-4 border-t border-emerald-900/80">
        Bayanihan Bank © 2026
      </footer>
    </div>
  );
};
