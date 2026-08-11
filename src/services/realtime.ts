/**
 * Real-time subscription to server state changes via Server-Sent Events.
 * The Express server pushes an `update` event whenever a mutation commits;
 * the app reacts by re-fetching /api/state. Falls back to the existing
 * 30s polling when the stream is unavailable.
 */
const TOKEN_KEY = 'bb_it_token';

export function connectRealtime(onUpdate: () => void): () => void {
  const token = localStorage.getItem(TOKEN_KEY);
  if (!token) return () => {};

  let es: EventSource | null = null;
  try {
    es = new EventSource(`/api/events?token=${encodeURIComponent(token)}`);
    es.addEventListener('update', () => onUpdate());
  } catch {
    return () => es?.close();
  }
  return () => es?.close();
}
