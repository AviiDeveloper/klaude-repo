import type { NotificationRecord } from "../notificationStore.js";

export interface NotificationPayload {
  reason: NotificationRecord["reason"];
  message: string;
  severity: NotificationRecord["severity"];
  channel: NotificationRecord["channel"];
  task_id?: string;
  session_id?: string;
  user_id?: string;
}

export interface NotificationTransport {
  readonly name: string;
  send(payload: NotificationPayload): Promise<{ ok: boolean; detail?: string }>;
}
