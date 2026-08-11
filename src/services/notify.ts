/**
 * Notification helpers: a WebAudio chime (no audio files needed) and the
 * browser Notification API for OS-level popups. Browser notifications only
 * work on secure contexts (https or localhost); the chime and in-app toasts
 * always work.
 */

let audioCtx: AudioContext | null = null;

/** Lazily create the shared AudioContext (must follow a user gesture). */
function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  const Ctor = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;
  if (!audioCtx) audioCtx = new Ctor();
  if (audioCtx.state === 'suspended') void audioCtx.resume();
  return audioCtx;
}

/** Unlock audio on the first user interaction (autoplay policy workaround). */
export function primeAudio(): void {
  if (typeof window === 'undefined') return;
  const unlock = () => {
    getAudioContext();
    window.removeEventListener('pointerdown', unlock);
    window.removeEventListener('keydown', unlock);
  };
  window.addEventListener('pointerdown', unlock);
  window.addEventListener('keydown', unlock);
}

/** Play a short two-tone notification chime. */
export function playChime(): void {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;
    const now = ctx.currentTime;

    const note = (freq: number, start: number, duration: number, volume: number) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, start);
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(volume, start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
      osc.connect(gain).connect(ctx.destination);
      osc.start(start);
      osc.stop(start + duration + 0.05);
    };

    note(880, now, 0.12, 0.18);
    note(1174.66, now + 0.14, 0.22, 0.18);
  } catch {
    // Audio is unavailable or blocked — ignore silently.
  }
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
