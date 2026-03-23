import { createHash, createHmac, randomUUID } from 'crypto';
import { cookies } from 'next/headers';
import { NextRequest } from 'next/server';
import { queryOne, run } from './db';

const ADMIN_SECRET = process.env.ADMIN_SECRET || 'admin-panel-dev-secret-change-in-production';
const COOKIE_NAME = 'admin_session';
const TOKEN_EXPIRY_DAYS = 7;

export type AdminRole = 'owner' | 'manager' | 'viewer';

export interface AdminPayload {
  user_id: string;
  name: string;
  role: AdminRole;
  exp: number;
}

export interface AdminUser {
  id: string;
  name: string;
  email: string | null;
  role: AdminRole;
  active: boolean;
  last_login_at: string | null;
  created_at: string | null;
}

// Simple password hashing (SHA-256 with salt — bcrypt would be better but needs native dep)
export function hashPassword(password: string): string {
  return createHash('sha256').update(`${ADMIN_SECRET}:${password}`).digest('hex');
}

export function createToken(payload: AdminPayload): string {
  const data = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig = createHmac('sha256', ADMIN_SECRET).update(data).digest('base64url');
  return `${data}.${sig}`;
}

export function validateToken(token: string): AdminPayload | null {
  const [data, sig] = token.split('.');
  if (!data || !sig) return null;
  const expectedSig = createHmac('sha256', ADMIN_SECRET).update(data).digest('base64url');
  if (sig !== expectedSig) return null;
  try {
    const payload = JSON.parse(Buffer.from(data, 'base64url').toString()) as AdminPayload;
    if (payload.exp < Date.now() / 1000) return null;
    return payload;
  } catch { return null; }
}

export function resolveAdminFromRequest(req: NextRequest): AdminPayload | null {
  const cookie = req.cookies.get(COOKIE_NAME)?.value;
  if (cookie) {
    const payload = validateToken(cookie);
    if (payload) return payload;
  }
  const auth = req.headers.get('authorization');
  if (auth?.startsWith('Bearer ')) {
    return validateToken(auth.slice(7));
  }
  return null;
}

export function getAdminSession(): AdminPayload | null {
  const cookieStore = cookies();
  const cookie = cookieStore.get(COOKIE_NAME)?.value;
  if (!cookie) return null;
  return validateToken(cookie);
}

export function loginAdmin(nameOrEmail: string, password: string): { user: AdminUser; token: string } | null {
  const hash = hashPassword(password);
  const row = queryOne<Record<string, unknown>>(
    'SELECT * FROM admin_users WHERE (name = ? OR email = ?) AND password_hash = ? AND active = 1',
    nameOrEmail, nameOrEmail, hash,
  );
  if (!row) return null;

  const user: AdminUser = {
    id: row.id as string,
    name: row.name as string,
    email: row.email as string | null,
    role: row.role as AdminRole,
    active: true,
    last_login_at: row.last_login_at as string | null,
    created_at: row.created_at as string | null,
  };

  const exp = Math.floor(Date.now() / 1000) + TOKEN_EXPIRY_DAYS * 24 * 60 * 60;
  const token = createToken({ user_id: user.id, name: user.name, role: user.role, exp });

  run('UPDATE admin_users SET last_login_at = ? WHERE id = ?', new Date().toISOString(), user.id);
  return { user, token };
}

export function createAdmin(
  name: string, password: string, role: AdminRole = 'manager', email?: string,
): AdminUser {
  const id = randomUUID();
  const hash = hashPassword(password);
  const now = new Date().toISOString();
  run(
    'INSERT INTO admin_users (id, name, email, password_hash, role, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
    id, name, email ?? null, hash, role, now, now,
  );
  return { id, name, email: email ?? null, role, active: true, last_login_at: null, created_at: now };
}

export { COOKIE_NAME };
