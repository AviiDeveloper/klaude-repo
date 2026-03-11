import { randomUUID } from "node:crypto";
import {
  InterfaceController,
  InterfaceMessageInput,
} from "../interface/controller.js";

export async function runLocalAdapter(
  controller: InterfaceController,
): Promise<void> {
  const input: InterfaceMessageInput = {
    session_id: "local-session-001",
    user_id: "local-user-001",
    text: "Create runtime bootstrap task",
    source: "local",
  };

  const result = await controller.handleMessage(input);
  console.log("mode local");
  console.log("event", randomUUID(), "message_received");
  console.log("outbound.events", result.messages.length);
  for (const message of result.messages) {
    console.log("outbound", message.text);
  }
  if (result.approvalRequests.length > 0) {
    console.log("approval.requests", result.approvalRequests.length);
  }
}
