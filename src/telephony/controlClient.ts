export interface TelephonyControlClient {
  placeCall(input: {
    to: string;
    from?: string;
    session_id?: string;
    user_id?: string;
  }): Promise<unknown>;
  listMediaSessions(): Promise<unknown>;
}

export class BridgeTelephonyControlClient implements TelephonyControlClient {
  constructor(private readonly baseUrl: string) {}

  async placeCall(input: {
    to: string;
    from?: string;
    session_id?: string;
    user_id?: string;
  }): Promise<unknown> {
    const response = await fetch(`${this.baseUrl}/telephony/call`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(input),
    });
    const json = (await response.json()) as unknown;
    if (!response.ok) {
      throw new Error(JSON.stringify(json));
    }
    return json;
  }

  async listMediaSessions(): Promise<unknown> {
    const response = await fetch(`${this.baseUrl}/telephony/media/sessions`);
    const json = (await response.json()) as unknown;
    if (!response.ok) {
      throw new Error(JSON.stringify(json));
    }
    return json;
  }
}
