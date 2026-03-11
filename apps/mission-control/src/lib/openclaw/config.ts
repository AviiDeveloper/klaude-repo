import { queryOne, run } from '@/lib/db';

export interface OpenClawGatewayConfig {
  gateway_url: string;
  gateway_token: string;
  gateway_origin: string;
  gateway_role: string;
  gateway_scopes: string;
}

const DEFAULTS: OpenClawGatewayConfig = {
  gateway_url: process.env.OPENCLAW_GATEWAY_URL || 'ws://127.0.0.1:18789',
  gateway_token: process.env.OPENCLAW_GATEWAY_TOKEN || '',
  gateway_origin: process.env.OPENCLAW_GATEWAY_ORIGIN || 'http://localhost:3001',
  gateway_role: process.env.OPENCLAW_GATEWAY_ROLE || 'operator',
  gateway_scopes: process.env.OPENCLAW_GATEWAY_SCOPES || 'operator.read,operator.write',
};

type SettingRow = {
  setting_key: string;
  setting_value: string;
};

const KEY_MAP = {
  gateway_url: 'openclaw.gateway_url',
  gateway_token: 'openclaw.gateway_token',
  gateway_origin: 'openclaw.gateway_origin',
  gateway_role: 'openclaw.gateway_role',
  gateway_scopes: 'openclaw.gateway_scopes',
} as const;

function readSetting(key: string): string | null {
  const row = queryOne<SettingRow>(
    `SELECT setting_key, setting_value FROM app_settings WHERE setting_key = ?`,
    [key],
  );
  if (!row) return null;
  return row.setting_value;
}

export function getOpenClawGatewayConfig(): OpenClawGatewayConfig {
  return {
    gateway_url: readSetting(KEY_MAP.gateway_url) || DEFAULTS.gateway_url,
    gateway_token: readSetting(KEY_MAP.gateway_token) || DEFAULTS.gateway_token,
    gateway_origin: readSetting(KEY_MAP.gateway_origin) || DEFAULTS.gateway_origin,
    gateway_role: readSetting(KEY_MAP.gateway_role) || DEFAULTS.gateway_role,
    gateway_scopes: readSetting(KEY_MAP.gateway_scopes) || DEFAULTS.gateway_scopes,
  };
}

export function upsertOpenClawGatewayConfig(input: Partial<OpenClawGatewayConfig>): OpenClawGatewayConfig {
  const next = {
    ...getOpenClawGatewayConfig(),
    ...input,
  };

  const now = new Date().toISOString();
  const entries: Array<[string, string]> = [
    [KEY_MAP.gateway_url, next.gateway_url],
    [KEY_MAP.gateway_token, next.gateway_token],
    [KEY_MAP.gateway_origin, next.gateway_origin],
    [KEY_MAP.gateway_role, next.gateway_role],
    [KEY_MAP.gateway_scopes, next.gateway_scopes],
  ];

  for (const [key, value] of entries) {
    run(
      `
      INSERT INTO app_settings (setting_key, setting_value, updated_at)
      VALUES (?, ?, ?)
      ON CONFLICT(setting_key) DO UPDATE SET
        setting_value = excluded.setting_value,
        updated_at = excluded.updated_at
      `,
      [key, value, now],
    );
  }

  return next;
}

