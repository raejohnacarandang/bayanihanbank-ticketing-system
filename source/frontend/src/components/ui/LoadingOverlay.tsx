import { useEffect, useRef, useState } from "react";
import { storage } from "../../services/storageService";

/** Keep the loader on screen at least this long so fast requests don't flicker. */
const MIN_VISIBLE_MS = 350;
/** Matches the `.loading-screen.done` fade-out transition in index.css. */
const FADE_OUT_MS = 500;

/**
 * Presentational branded loading screen. Used both for the first-load/app-boot
 * state and (via LoadingOverlay) while user-triggered API requests are in
 * flight. Background polls (storage.refresh) are marked silent and never
 * trigger this.
 */
export function LoadingScreen({ leaving = false }: { leaving?: boolean }) {
  return (
    <div
      className={`loading-screen${leaving ? " done" : ""}`}
      role="status"
      aria-label="Loading"
    >
      <div className="loading-card">
        <div className="loading-card-inner">
          <div className="loading-badge">
            <svg className="loading-logo-fallback" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
              <path d="M20 15 H55 C70 15, 80 25, 80 38 C80 50, 70 55, 55 55 H20 Z" fill="#FFFFFF" />
              <path d="M20 50 H58 C74 50, 85 60, 85 75 C85 88, 72 90, 55 90 H20 Z" fill="#F59E0B" />
              <circle cx="50" cy="30" r="7" fill="#043E30" />
              <path d="M36 28 Q50 20 64 28 L50 32 Z" fill="#043E30" />
              <path d="M18 50 H88 V56 H18 Z" fill="#043E30" />
            </svg>
            <img
              className="loading-logo"
              src="/logo1.png"
              alt="Bayanihan Bank"
              onError={(e) => {
                e.currentTarget.style.display = "none";
              }}
            />
          </div>
          <div className="loading-brand">
            BAYANIHAN <span className="loading-brand-accent">BANK</span>
          </div>
          <div className="loading-subtitle">IT Service Desk</div>
          <div className="loading-shine" aria-hidden="true"></div>
          <div className="loading-spinner" aria-hidden="true"></div>
          <div className="loading-tagline">
            Loading your secure workspace
            <span className="loading-dots">
              <span>.</span>
              <span>.</span>
              <span>.</span>
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Full-screen branded loading screen shown while user-triggered API requests
 * are in flight. The visible duration follows the real network round-trip
 * (with a small minimum so fast responses still register).
 */
export function LoadingOverlay() {
  const [count, setCount] = useState(storage.getPendingCount());
  const [mounted, setMounted] = useState(count > 0);
  const [leaving, setLeaving] = useState(false);
  const shownAtRef = useRef<number>(0);
  const timersRef = useRef<number[]>([]);

  // Baseline timestamp for the minimum-visible window (set after first paint).
  useEffect(() => {
    if (shownAtRef.current === 0) shownAtRef.current = Date.now();
  }, []);

  useEffect(() => storage.onPendingChange(setCount), []);

  useEffect(() => {
    const clearTimers = () => {
      for (const t of timersRef.current) window.clearTimeout(t);
      timersRef.current = [];
    };

    if (count > 0) {
      clearTimers();
      setLeaving(false);
      if (!mounted) {
        shownAtRef.current = Date.now();
        setMounted(true);
      }
      return clearTimers;
    }

    if (!mounted) return clearTimers;

    const elapsed = Date.now() - shownAtRef.current;
    const wait = Math.max(0, MIN_VISIBLE_MS - elapsed);
    const hideTimer = window.setTimeout(() => {
      setLeaving(true);
      const unmountTimer = window.setTimeout(() => setMounted(false), FADE_OUT_MS);
      timersRef.current.push(unmountTimer);
    }, wait);
    timersRef.current.push(hideTimer);

    return clearTimers;
  }, [count, mounted]);

  if (!mounted) return null;
  return <LoadingScreen leaving={leaving} />;
}
