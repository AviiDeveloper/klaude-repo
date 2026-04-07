import { createLogger } from "./logger.js";

const log = createLogger("env");

interface EnvVar {
  name: string;
  required: boolean;
  default?: string;
  description: string;
}

const COMMON_VARS: EnvVar[] = [
  { name: "DB_PATH", required: false, default: "data/mvp.sqlite", description: "SQLite database path" },
  { name: "LOG_LEVEL", required: false, default: "info", description: "Logging level (debug|info|warn|error)" },
  { name: "MODEL_PROVIDER", required: false, default: "local", description: "AI model provider (local|openai|openrouter)" },
];

const MODE_VARS: Record<string, EnvVar[]> = {
  "mission-control": [
    { name: "MISSION_CONTROL_HOST", required: false, default: "127.0.0.1", description: "HTTP bind host" },
    { name: "MISSION_CONTROL_PORT", required: false, default: "4317", description: "HTTP bind port" },
    { name: "MISSION_CONTROL_API_TOKEN", required: false, description: "Bearer token for API auth" },
  ],
  "openclaw-bridge": [
    { name: "OPENCLAW_BRIDGE_HOST", required: false, default: "0.0.0.0", description: "Bridge bind host" },
    { name: "OPENCLAW_BRIDGE_PORT", required: false, default: "4318", description: "Bridge bind port" },
  ],
};

const OPTIONAL_SERVICES: EnvVar[] = [
  { name: "OPENROUTER_API_KEY", required: false, description: "OpenRouter API key for AI generation" },
  { name: "OPENAI_API_KEY", required: false, description: "OpenAI API key" },
  { name: "GOOGLE_PLACES_API_KEY", required: false, description: "Google Places API for lead scouting" },
  { name: "COMPANIES_HOUSE_API_KEY", required: false, description: "Companies House API for lead scouting" },
  { name: "TWILIO_ACCOUNT_SID", required: false, description: "Twilio account SID for telephony" },
  { name: "TWILIO_AUTH_TOKEN", required: false, description: "Twilio auth token for telephony" },
];

export function validateEnv(mode: string): void {
  const vars = [...COMMON_VARS, ...(MODE_VARS[mode] ?? [])];
  const missing: string[] = [];
  const resolved: Array<{ name: string; value: string; source: string }> = [];

  for (const v of vars) {
    const value = process.env[v.name];
    if (!value && v.required) {
      missing.push(`${v.name} — ${v.description}`);
    } else {
      resolved.push({
        name: v.name,
        value: value ?? v.default ?? "(not set)",
        source: value ? "env" : v.default ? "default" : "unset",
      });
    }
  }

  if (missing.length > 0) {
    log.error("missing required environment variables", { missing });
    process.exit(1);
  }

  log.info(`env validated for mode=${mode}`, {
    resolved_count: resolved.length,
  });

  // Warn about optional services
  for (const svc of OPTIONAL_SERVICES) {
    if (!process.env[svc.name]) {
      log.warn(`optional: ${svc.name} not set — ${svc.description}`);
    }
  }
}
