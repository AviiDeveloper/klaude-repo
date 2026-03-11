export interface OutboundCallRequest {
  to: string;
  from: string;
  voiceWebhookUrl: string;
  statusWebhookUrl?: string;
}

export interface OutboundCallResponse {
  provider: "twilio";
  call_sid: string;
  status?: string;
  to: string;
  from: string;
}

export interface TelephonyDialer {
  placeOutboundCall(input: OutboundCallRequest): Promise<OutboundCallResponse>;
}

export class TwilioTelephonyDialer implements TelephonyDialer {
  constructor(
    private readonly options: {
      accountSid: string;
      authToken: string;
    },
  ) {}

  async placeOutboundCall(input: OutboundCallRequest): Promise<OutboundCallResponse> {
    const endpoint = `https://api.twilio.com/2010-04-01/Accounts/${this.options.accountSid}/Calls.json`;
    const form = new URLSearchParams({
      To: input.to,
      From: input.from,
      Url: input.voiceWebhookUrl,
      Method: "POST",
      StatusCallback: input.statusWebhookUrl ?? "",
      StatusCallbackMethod: "POST",
    });

    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        authorization: `Basic ${Buffer.from(
          `${this.options.accountSid}:${this.options.authToken}`,
        ).toString("base64")}`,
        "content-type": "application/x-www-form-urlencoded",
      },
      body: form.toString(),
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Twilio call create failed: ${response.status} ${body}`);
    }

    const json = (await response.json()) as Record<string, unknown>;
    if (!json.sid || typeof json.sid !== "string") {
      throw new Error("Twilio response missing sid");
    }

    return {
      provider: "twilio",
      call_sid: json.sid,
      status: typeof json.status === "string" ? json.status : undefined,
      to: input.to,
      from: input.from,
    };
  }
}
