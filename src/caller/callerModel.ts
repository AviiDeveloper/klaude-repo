import { ModelProvider, createModelProvider } from "../models/provider.js";

export interface CallerIntent {
  title: string;
  objective: string;
  acknowledgement: string;
}

export class CallerModel {
  constructor(private readonly provider: ModelProvider = createModelProvider()) {}

  async parseMessage(text: string): Promise<CallerIntent> {
    return this.provider.callerIntent(text);
  }
}
