import { Request, Response, NextFunction } from 'express';
import { randomBytes, createHmac, timingSafeEqual } from 'crypto';

function csrfSecret(): string {
  const secret = process.env.CSRF_SECRET;
  if (secret) return secret;
  if (process.env.NODE_ENV === 'production') {
    throw new Error(
      'CSRF_SECRET environment variable is required in production. ' +
        'Set a long random string (>= 32 chars) before starting the server.',
    );
  }
  return randomBytes(48).toString('base64url');
}
const CSRF_COOKIE_NAME = 'csrf_token';
const CSRF_HEADER_NAME = 'x-csrf-token';

function generateCsrfToken(): string {
  return randomBytes(32).toString('base64url');
}

function signToken(token: string): string {
  return createHmac('sha256', csrfSecret()).update(token).digest('base64url');
}

function verifyToken(token: string, signature: string): boolean {
  const expected = signToken(token);
  const actualBuf = Buffer.from(signature);
  const expectedBuf = Buffer.from(expected);
  return actualBuf.length === expectedBuf.length && timingSafeEqual(actualBuf, expectedBuf);
}

/**
 * Middleware to set CSRF token cookie on GET requests
 * The token is also returned in response headers for SPA usage
 */
export function csrfCookie(req: Request, res: Response, next: NextFunction): void {
  // Only set cookie on safe methods (GET, HEAD, OPTIONS)
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
    let token = req.cookies?.[CSRF_COOKIE_NAME];
    let signature = req.cookies?.[`${CSRF_COOKIE_NAME}_sig`];
    
    if (!token || !signature || !verifyToken(token, signature)) {
      token = generateCsrfToken();
      signature = signToken(token);
    }
    
    // Set HttpOnly cookie for CSRF token
    res.cookie(CSRF_COOKIE_NAME, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
      path: '/',
    });
    
    // Set signature cookie (also HttpOnly)
    res.cookie(`${CSRF_COOKIE_NAME}_sig`, signature, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 24 * 60 * 60 * 1000,
      path: '/',
    });
    
    // Also expose token in header for SPA access
    res.setHeader('X-CSRF-Token', token);
  }
  next();
}

/**
 * Middleware to validate CSRF token on state-changing requests
 * Checks token from header or body against cookie
 */
export function csrfProtection(req: Request, res: Response, next: NextFunction): void {
  // Skip for safe methods
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
    return next();
  }
  
  // Skip for auth endpoints (login, password reset, etc.)
  const publicPaths = ['/api/auth/login', '/api/auth/reset-request', '/api/auth/admin-recovery', '/api/auth/demo-accounts'];
  if (publicPaths.some(p => req.path.startsWith(p))) {
    return next();
  }
  
  // Skip for health check and SSE
  if (req.path === '/api/health' || req.path === '/api/events') {
    return next();
  }
  
  // Get token from header (preferred) or body
  const headerToken = req.headers[CSRF_HEADER_NAME] as string | undefined;
  const bodyToken = (req.body && req.body._csrf) as string | undefined;
  const token = headerToken || bodyToken;
  
  // Get token from cookie
  const cookieToken = req.cookies?.[CSRF_COOKIE_NAME];
  const cookieSignature = req.cookies?.[`${CSRF_COOKIE_NAME}_sig`];
  
  if (!token || !cookieToken || !cookieSignature) {
    res.status(403).json({ error: 'CSRF token missing' });
    return;
  }
  
  // Verify cookie signature
  if (!verifyToken(cookieToken, cookieSignature)) {
    res.status(403).json({ error: 'Invalid CSRF token signature' });
    return;
  }
  
  // Verify token matches cookie
  if (token !== cookieToken) {
    res.status(403).json({ error: 'CSRF token mismatch' });
    return;
  }
  
  next();
}

/**
 * Get CSRF token for client-side use
 */
export function getCsrfToken(req: Request): string | undefined {
  return req.cookies?.[CSRF_COOKIE_NAME];
}