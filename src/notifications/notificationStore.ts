export type NotificationChannel = "notify_user" | "call_user";
export type NotificationSeverity = "info" | "warning" | "critical";
export type NotificationReason =
  | "missing_input"
  | "task_blocked"
  | "task_failed"
  | "approval_denied"
  | "pipeline_blocked"
  | "pipeline_recovery"
  | "budget_exceeded"
  | "approval_required";
export type NotificationStatus = "pending" | "acknowledged";

export interface NotificationRecord {
  id: string;
  event_id: string;
  created_at: string;
  acknowledged_at?: string;
  channel: NotificationChannel;
  reason: NotificationReason;
  message: string;
  severity: NotificationSeverity;
  status: NotificationStatus;
  task_id?: string;
  session_id: string;
  user_id: string;
}

export interface NotificationFilter {
  channel?: NotificationChannel;
  reason?: NotificationReason;
  severity?: NotificationSeverity;
  status?: NotificationStatus;
  task_id?: string;
  session_id?: string;
  limit?: number;
}

export interface NotificationStore {
  append(record: Omit<NotificationRecord, "id" | "status">): Promise<NotificationRecord>;
  list(filter?: NotificationFilter): Promise<NotificationRecord[]>;
  acknowledge(id: string): Promise<NotificationRecord | undefined>;
}
