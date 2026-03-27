import { createHmac } from 'crypto';

const ADMIN_SECRET = process.env.SD_SECRET || 'sales-dashboard-dev-secret-change-in-production';

export function validateAdminToken(token: string): boolean {
  const [data, sig] = token.split('.');
  if (!data || !sig) return false;
  const expectedSig = createHmac('sha256', ADMIN_SECRET).update(data).digest('base64url');
  if (sig !== expectedSig) return false;
  try {
    const payload = JSON.parse(Buffer.from(data, 'base64url').toString());
    return payload.role === 'admin' && payload.exp > Date.now() / 1000;
  } catch {
    return false;
  }
}
