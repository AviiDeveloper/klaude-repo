import { PostQueueRecord } from "./types.js";

export interface PostDispatchAdapter {
  readonly platform: PostQueueRecord["platform"];
  dispatch(payload: Record<string, unknown>): Promise<{ success: boolean; detail: string }>;
}

export class WebhookDispatchAdapter implements PostDispatchAdapter {
  constructor(
    readonly platform: PostQueueRecord["platform"],
    private readonly endpoint: string,
    private readonly secret?: string,
  ) {}

  async dispatch(payload: Record<string, unknown>): Promise<{ success: boolean; detail: string }> {
    const headers: Record<string, string> = {
      "content-type": "application/json",
      "x-platform": this.platform,
    };
    if (this.secret) {
      headers["x-adapter-secret"] = this.secret;
    }
    const response = await fetch(this.endpoint, {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
    });
    if (!response.ok) {
      const body = await response.text();
      return { success: false, detail: `${response.status} ${body}` };
    }
    return { success: true, detail: "dispatched" };
  }
}

export class NoopDispatchAdapter implements PostDispatchAdapter {
  constructor(readonly platform: PostQueueRecord["platform"]) {}

  async dispatch(payload: Record<string, unknown>): Promise<{ success: boolean; detail: string }> {
    return {
      success: true,
      detail: `noop dispatch for ${this.platform} payload=${JSON.stringify(payload).slice(0, 80)}`,
    };
  }
}
