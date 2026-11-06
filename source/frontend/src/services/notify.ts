/**
 * Notification helpers: a WebAudio chime (no audio files needed) and the
 * browser Notification API for OS-level popups. Browser notifications only
 * work on secure contexts (https or localhost); the chime and in-app toasts
 * always work.
 */

let audioCtx: AudioContext | null = null;
let audioUnlocked = false;
let pendingChimes = 0;

/** Lazily create the shared AudioContext. Only created inside a user gesture
 *  (autoplay policy), otherwise the browser logs a warning and stays muted. */
function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  const Ctor = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;
  if (!audioCtx) {
    if (!audioUnlocked) return null;
    audioCtx = new Ctor();
  }
  if (audioCtx.state === 'suspended') void audioCtx.resume();
  return audioCtx;
}

/** Unlock audio on the first user interaction (autoplay policy workaround). */
export function primeAudio(): void {
  if (typeof window === 'undefined') return;
  const unlock = () => {
    audioUnlocked = true;
    getAudioContext();
    // Replay any alarms that were requested before audio was unlocked
    // (e.g. a notification detected right at page load).
    if (pendingChimes > 0) {
      const count = Math.min(pendingChimes, 3);
      pendingChimes = 0;
      for (let i = 0; i < count; i++) {
        playChimeNow();
      }
    }
    window.removeEventListener('pointerdown', unlock);
    window.removeEventListener('keydown', unlock);
    window.removeEventListener('pointerup', unlock);
    window.removeEventListener('keyup', unlock);
    window.removeEventListener('touchstart', unlock);
  };
  window.addEventListener('pointerdown', unlock);
  window.addEventListener('keydown', unlock);
  window.addEventListener('pointerup', unlock);
  window.addEventListener('keyup', unlock);
  window.addEventListener('touchstart', unlock);
}

/** Play an urgent alarm beep (fire-alarm style repeating bursts). */
function playChimeNow(): void {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;
    const now = ctx.currentTime;

    const beep = (freq: number, start: number, duration: number, volume: number) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'square';
      osc.frequency.setValueAtTime(freq, start);
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(volume, start + 0.01);
      gain.gain.setValueAtTime(volume, start + duration - 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
      osc.connect(gain).connect(ctx.destination);
      osc.start(start);
      osc.stop(start + duration + 0.05);
    };

    // Three bursts of two quick beeps each, ~1s apart.
    for (let b = 0; b < 3; b++) {
      const t = now + b * 1.0;
      beep(1200, t, 0.18, 0.15);
      beep(1200, t + 0.3, 0.18, 0.15);
    }
  } catch {
    // Audio is unavailable or blocked — ignore silently.
  }
}

/** Play the alarm chime. Queued until the first user gesture when needed. */
export function playChime(): void {
  const ctx = getAudioContext();
  if (!ctx) {
    pendingChimes = Math.min(pendingChimes + 1, 5);
    return;
  }
  playChimeNow();
}

/** Drop any alarms that were queued before audio was unlocked (e.g. on logout
 *  or when the session turned out to be invalid). */
export function cancelPendingAlarms(): void {
  pendingChimes = 0;
}

/** True when the browser supports notifications on this (secure) context. */
export function notificationsSupported(): boolean {
  return typeof window !== 'undefined' && 'Notification' in window;
}

/** Ask the user for notification permission (call from a user gesture). */
export function requestNotificationPermission(): void {
  if (!notificationsSupported()) return;
  if (Notification.permission === 'default') {
    void Notification.requestPermission();
  }
}

/** Show an OS-level notification. No-op when permission is not granted. */
export function browserNotification(
  title: string,
  body: string,
  onClick?: () => void
): void {
  if (!notificationsSupported()) return;
  if (Notification.permission !== 'granted') return;
  try {
    const n = new Notification(title, {
      body,
      tag: `bb-notif-${Date.now()}`,
      icon: '/logo1.png',
    });
    if (onClick) {
      n.onclick = () => {
        window.focus();
        onClick();
      };
    }
  } catch {
    // Some browsers throw on constructed notification — ignore.
  }
}
