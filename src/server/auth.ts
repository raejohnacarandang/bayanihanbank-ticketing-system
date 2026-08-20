/**
 * Server-only auth helpers: JWT signing/verification (HS256, no external
 * dependency — built on node:crypto), scrypt password hashing, and response
 * sanitizers so password hashes and sensitive data never reach the client.
 */
import {
  createHash,
  createHmac,
  randomBytes,
  scryptSync,
  timingSafeEqual,
} from "crypto";
import { AppState, User, UserRole } from "../types";

/**
 * Resolved lazily (not at module load) because `dotenv.config()` runs in the
 * mysql/server modules AFTER this module is imported/evaluated in the ESM
 * bundle — a top-level `process.env.JWT_SECRET` const would always capture the
 * fallback. Reading it per-call guarantees `.env` values take effect.
 *
 * In production, JWT_SECRET MUST be set. In development, a per-process random
 * fallback is used so the app still works without manual .env configuration.
 */
function jwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (secret) return secret;
  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "JWT_SECRET environment variable is required in production. " +
        "Set a long random string (>= 32 chars) before starting the server.",
    );
  }
  return randomBytes(48).toString("base64url");
}
const TOKEN_TTL_MS = 1000 * 60 * 60 * 12; // 12 hours
const DEMO_PASSWORD = "password123";

// ---------------------------------------------------------------------------
// Passwords (scrypt)
// ---------------------------------------------------------------------------

export function hashPassword(
  password: string,
  salt: string = randomBytes(16).toString("hex"),
): string {
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `scrypt$${salt}$${hash}`;
}

export function verifyPassword(password: string, stored?: string): boolean {
  if (!stored) return false;
  const [algo, salt, hash] = stored.split("$");
  if (algo !== "scrypt" || !salt || !hash) return false;
  const candidate = scryptSync(password, salt, 64);
  const expected = Buffer.from(hash, "hex");
  return (
    candidate.length === expected.length && timingSafeEqual(candidate, expected)
  );
}

// ---------------------------------------------------------------------------
// JWT (HS256)
// ---------------------------------------------------------------------------

interface TokenPayload {
  sub: string; // user id
  username: string;
  role: UserRole;
  iat: number;
  exp: number;
}

function b64url(input: string | Buffer): string {
  return Buffer.from(input).toString("base64url");
}

export function signToken(user: User): string {
  const header = b64url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const now = Math.floor(Date.now() / 1000);
  const payload: TokenPayload = {
    sub: user.id,
    username: user.username,
    role: user.role,
    iat: now,
    exp: now + Math.floor(TOKEN_TTL_MS / 1000),
  };
  const body = b64url(JSON.stringify(payload));
  const signature = createHmac("sha256", jwtSecret())
    .update(`${header}.${body}`)
    .digest("base64url");
  return `${header}.${body}.${signature}`;
}

export function verifyToken(token: string): TokenPayload | null {
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [header, body, signature] = parts;
  const expected = createHmac("sha256", jwtSecret())
    .update(`${header}.${body}`)
    .digest("base64url");
  const actual = Buffer.from(signature);
  const expectedBuf = Buffer.from(expected);
  if (
    actual.length !== expectedBuf.length ||
    !timingSafeEqual(actual, expectedBuf)
  ) {
    return null;
  }
  try {
    const payload = JSON.parse(
      Buffer.from(body, "base64url").toString(),
    ) as TokenPayload;
    if (!payload.sub || payload.exp * 1000 < Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}

/** Fingerprint of a demo seed — used only so stored tokens survive app restarts. */
export function tokenDigest(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

// ---------------------------------------------------------------------------
// Response sanitizers
// ---------------------------------------------------------------------------

/** Strip server-only fields (password hashes) from a user. */
export function publicUser(user: User): User {
  const { passwordHash: _passwordHash, ...rest } = user;
  return rest;
}

/**
 * Restrict the snapshot sent to a viewer by role. Branch users only receive
 * their own branch / requested tickets and the support staff needed by the UI.
 */
export function stateForViewer(state: AppState, viewer: User): AppState {
  const users = state.users.map(publicUser);
  const tickets = state.tickets;

  if (viewer.role === "BRANCH_USER") {
    const scopedTickets = tickets.filter(
      (t) => t.branchId === viewer.branchId || t.requesterId === viewer.id,
    );
    const supportIds = new Set(
      state.users
        .filter((u) => u.role === "IT_STAFF" || u.role === "ADMINISTRATOR")
        .map((u) => u.id),
    );
    return {
      ...state,
      users: users.filter((u) => u.id === viewer.id || supportIds.has(u.id)),
      tickets: scopedTickets,
      auditLogs: [],
      currentUser: publicUser(viewer),
    };
  }

  // IT specialists only see the tickets assigned to them (plus anything they
  // filed themselves). Unassigned tickets and tickets owned by other
  // specialists are visible only to administrators / auditors.
  if (viewer.role === "IT_STAFF") {
    const scopedTickets = tickets.filter(
      (t) => t.assignedToId === viewer.id || t.requesterId === viewer.id,
    );
    return {
      ...state,
      users,
      tickets: scopedTickets,
      currentUser: publicUser(viewer),
    };
  }

  return {
    ...state,
    users,
    currentUser: publicUser(viewer),
  };
}

export const DEFAULT_PASSWORD = DEMO_PASSWORD;
