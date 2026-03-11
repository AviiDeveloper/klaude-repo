import { timingSafeEqual } from 'crypto';
import { NextResponse } from 'next/server';

const AGENT_TOKEN_ENV = 'MISSION_CONTROL_AGENT_TOKEN';

function configuredToken(): string | null {
  const token = process.env[AGENT_TOKEN_ENV];
  if (!token) {
    return null;
  }
  const trimmed = token.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function parseProvidedToken(request: Request): string | null {
  const authHeader = request.headers.get('authorization');
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.slice('Bearer '.length).trim();
    if (token.length > 0) {
      return token;
    }
  }

  const headerToken = request.headers.get('x-mission-control-agent-token');
  if (headerToken && headerToken.trim().length > 0) {
    return headerToken.trim();
  }

  return null;
}

function secureEquals(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left, 'utf-8');
  const rightBuffer = Buffer.from(right, 'utf-8');
  if (leftBuffer.length !== rightBuffer.length) {
    return false;
  }
  return timingSafeEqual(leftBuffer, rightBuffer);
}

export function requireAgentApiToken(request: Request): NextResponse | null {
  const expectedToken = configuredToken();
  if (!expectedToken) {
    return null;
  }

  const providedToken = parseProvidedToken(request);
  if (!providedToken || !secureEquals(expectedToken, providedToken)) {
    return NextResponse.json(
      {
        error: 'Unauthorized',
        hint: `Set ${AGENT_TOKEN_ENV} and send it as Authorization: Bearer <token>.`,
      },
      { status: 401 },
    );
  }

  return null;
}

export function getAgentApiAuthHeaders(): Record<string, string> {
  const token = configuredToken();
  if (!token) {
    return {};
  }
  return { Authorization: `Bearer ${token}` };
}

export function isAgentApiTokenEnabled(): boolean {
  return configuredToken() !== null;
}
