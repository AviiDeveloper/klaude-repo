import { createHash, createHmac } from 'crypto';
import { Request, Response, NextFunction } from 'express';
import { queryOne, run } from './db.js';

const SECRET = process.env.SD_SECRET ?? 'sales-dashboard-dev-secret-change-in-production';
const TOKEN_EXPIRY_DAYS = 30;

export interface AuthPayload {
  user_id: string;
  name: string;
  exp: number;
}

export function hashPin(pin: string): string {
  return createHash('sha256').update(`${SECRET}:${pin}`).digest('hex');
}

export function createToken(payload: AuthPayload): string {
  const data = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig = createHmac('sha256', SECRET).update(data).digest('base64url');
  return `${data}.${sig}`;
}

export function validateToken(token: string): AuthPayload | null {
  try {
    const [data, sig] = token.split('.');
    if (!data || !sig) return null;
    const expected = createHmac('sha256', SECRET).update(data).digest('base64url');
    if (sig !== expected) return null;
    const payload = JSON.parse(Buffer.from(data, 'base64url').toString()) as AuthPayload;
    if (payload.exp && Math.floor(Date.now() / 1000) > payload.exp) return null;
    return payload;
  } catch {
    return null;
  }
}

// Express middleware — extracts user from Bearer token
export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const auth = req.headers.authorization;
  if (!auth?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Authorization required', code: 'AUTH_REQUIRED' });
    return;
  }
  const payload = validateToken(auth.slice(7));
  if (!payload) {
    res.status(401).json({ error: 'Invalid or expired token', code: 'TOKEN_INVALID' });
    return;
  }
  // Update last active
  run('UPDATE sales_users SET last_active_at = ? WHERE id = ?', new Date().toISOString(), payload.user_id);
  (req as any).user = payload;
  next();
}

export function getUser(req: Request): AuthPayload {
  return (req as any).user;
}

export function loginUser(name: string, pin: string): { user: Record<string, unknown>; token: string } | null {
  const pinHash = hashPin(pin);
  const user = queryOne<Record<string, unknown>>(
    'SELECT * FROM sales_users WHERE LOWER(name) = LOWER(?) AND pin_hash = ? AND active = 1',
    name, pinHash,
  );
  if (!user) return null;

  const token = createToken({
    user_id: user.id as string,
    name: user.name as string,
    exp: Math.floor(Date.now() / 1000) + TOKEN_EXPIRY_DAYS * 24 * 60 * 60,
  });

  return { user, token };
}
