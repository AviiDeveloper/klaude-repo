import type { NotificationPayload, NotificationTransport } from "./notificationTransport.js";

export interface TelegramTransportConfig {
  botToken: string;
  defaultChatId: string;
  allowedChatIds?: string[];
  webhookSecret?: string;
}

const SEVERITY_EMOJI: Record<string, string> = {
  critical: "\u{1F534}",
  warning: "\u{1F7E0}",
  info: "\u{1F535}",
};

const REASON_LABEL: Record<string, string> = {
  missing_input: "Missing Input",
  task_blocked: "Task Blocked",
  task_failed: "Task Failed",
  approval_denied: "Approval Denied",
  pipeline_blocked: "Pipeline Blocked",
  budget_exceeded: "Budget Exceeded",
  approval_required: "Approval Required",
};

function escapeHtml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export class TelegramTransport implements NotificationTransport {
  readonly name = "telegram";

  constructor(private readonly config: TelegramTransportConfig) {}

  async send(payload: NotificationPayload): Promise<{ ok: boolean; detail?: string }> {
    const emoji = SEVERITY_EMOJI[payload.severity] || "\u{1F535}";
    const reason = REASON_LABEL[payload.reason] || payload.reason;

    let text = `${emoji} <b>${escapeHtml(reason)}</b>\n\n`;
    text += escapeHtml(payload.message);
    if (payload.task_id) {
      text += `\n\nTask: <code>${payload.task_id}</code>`;
    }

    return this.sendMessage(this.config.defaultChatId, text);
  }

  async sendMessage(
    chatId: string | number,
    text: string,
    parseMode: "HTML" | "MarkdownV2" = "HTML",
  ): Promise<{ ok: boolean; detail?: string }> {
    try {
      const res = await fetch(this.apiUrl("sendMessage"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          text,
          parse_mode: parseMode,
          disable_web_page_preview: true,
        }),
      });
      if (!res.ok) {
        const body = await res.text();
        console.error(`[TelegramTransport] sendMessage failed: ${res.status} ${body}`);
        return { ok: false, detail: `${res.status} ${body}` };
      }
      return { ok: true };
    } catch (err) {
      console.error("[TelegramTransport] sendMessage error:", err);
      return { ok: false, detail: String(err) };
    }
  }

  async sendMessageWithButtons(
    chatId: string | number,
    text: string,
    buttons: Array<Array<{ text: string; callback_data: string }>>,
    parseMode: "HTML" | "MarkdownV2" = "HTML",
  ): Promise<{ ok: boolean; detail?: string }> {
    try {
      const res = await fetch(this.apiUrl("sendMessage"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          text,
          parse_mode: parseMode,
          disable_web_page_preview: true,
          reply_markup: { inline_keyboard: buttons },
        }),
      });
      if (!res.ok) {
        const body = await res.text();
        return { ok: false, detail: `${res.status} ${body}` };
      }
      return { ok: true };
    } catch (err) {
      return { ok: false, detail: String(err) };
    }
  }

  async answerCallbackQuery(callbackQueryId: string, text?: string): Promise<boolean> {
    try {
      const res = await fetch(this.apiUrl("answerCallbackQuery"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ callback_query_id: callbackQueryId, text }),
      });
      return res.ok;
    } catch {
      return false;
    }
  }

  async editMessageText(
    chatId: string | number,
    messageId: number,
    text: string,
    parseMode: "HTML" | "MarkdownV2" = "HTML",
  ): Promise<boolean> {
    try {
      const res = await fetch(this.apiUrl("editMessageText"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          message_id: messageId,
          text,
          parse_mode: parseMode,
          disable_web_page_preview: true,
        }),
      });
      return res.ok;
    } catch {
      return false;
    }
  }

  async setWebhook(url: string, secretToken?: string): Promise<{ ok: boolean; description?: string }> {
    try {
      const body: Record<string, unknown> = { url };
      if (secretToken) body.secret_token = secretToken;
      const res = await fetch(this.apiUrl("setWebhook"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = (await res.json()) as { ok: boolean; description?: string };
      return { ok: data.ok, description: data.description };
    } catch (err) {
      return { ok: false, description: String(err) };
    }
  }

  isChatAllowed(chatId: string | number): boolean {
    const id = String(chatId);
    if (id === this.config.defaultChatId) return true;
    return this.config.allowedChatIds?.includes(id) ?? false;
  }

  get defaultChatId(): string {
    return this.config.defaultChatId;
  }

  get webhookSecret(): string | undefined {
    return this.config.webhookSecret;
  }

  private apiUrl(method: string): string {
    return `https://api.telegram.org/bot${this.config.botToken}/${method}`;
  }
}

export class NoopTelegramTransport implements NotificationTransport {
  readonly name = "telegram-noop";

  async send(_payload: NotificationPayload): Promise<{ ok: boolean; detail?: string }> {
    return { ok: true, detail: "telegram not configured" };
  }
}
