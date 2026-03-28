/**
 * MSA Weight Release Monitor
 *
 * Checks GitHub (EverMind-AI/MSA) and HuggingFace daily for model weight releases.
 * Sends a Telegram notification when weights are detected.
 */

import type { SQLiteMemoryStore } from "./sqliteMemoryStore.js";

const GITHUB_API = "https://api.github.com/repos/EverMind-AI/MSA/contents";
const HF_API = "https://huggingface.co/api/models?author=EverMind-AI&search=MSA";
const HF_SEARCH_API = "https://huggingface.co/api/models?search=memory+sparse+attention&limit=10";

const MONITOR_KEY = "msa_weight_monitor";

interface MonitorState {
  last_check: string;
  github_file_count: number;
  github_has_weights: boolean;
  hf_model_count: number;
  last_notified: string | null;
}

interface CheckResult {
  changed: boolean;
  source: string;
  url: string;
  details: string;
}

export class MSAWeightMonitor {
  constructor(
    private readonly store: SQLiteMemoryStore,
    private readonly telegramBotToken?: string,
    private readonly telegramChatId?: string,
  ) {}

  /**
   * Run the daily check. Returns true if weights were detected.
   */
  async check(): Promise<boolean> {
    const previousState = this.getState();
    const results: CheckResult[] = [];

    // Check GitHub repo for new files (weights, checkpoints, models directories)
    try {
      const githubResult = await this.checkGitHub(previousState);
      if (githubResult) results.push(githubResult);
    } catch (err) {
      console.error("[MSA Monitor] GitHub check failed:", err);
    }

    // Check HuggingFace for new models by EverMind-AI
    try {
      const hfResult = await this.checkHuggingFace(previousState);
      if (hfResult) results.push(hfResult);
    } catch (err) {
      console.error("[MSA Monitor] HuggingFace check failed:", err);
    }

    // Check HuggingFace general search for community uploads
    try {
      const hfSearchResult = await this.checkHuggingFaceSearch();
      if (hfSearchResult) results.push(hfSearchResult);
    } catch (err) {
      console.error("[MSA Monitor] HuggingFace search check failed:", err);
    }

    // Notify if any changes detected
    if (results.length > 0) {
      await this.notify(results);
      return true;
    }

    // Update state with no changes
    this.updateState({
      last_check: new Date().toISOString(),
      github_file_count: previousState?.github_file_count || 0,
      github_has_weights: previousState?.github_has_weights || false,
      hf_model_count: previousState?.hf_model_count || 0,
      last_notified: previousState?.last_notified || null,
    });

    console.log("[MSA Monitor] No changes detected.");
    return false;
  }

  private async checkGitHub(prev: MonitorState | null): Promise<CheckResult | null> {
    const resp = await fetch(GITHUB_API, {
      headers: { Accept: "application/vnd.github.v3+json", "User-Agent": "MSA-Monitor/1.0" },
    });
    if (!resp.ok) return null;

    const contents = (await resp.json()) as Array<{ name: string; type: string }>;
    const weightIndicators = ["weights", "checkpoints", "models", "model", "ckpt"];
    const hasWeights = contents.some(
      (item) =>
        weightIndicators.some((w) => item.name.toLowerCase().includes(w)) ||
        item.name.endsWith(".safetensors") ||
        item.name.endsWith(".bin") ||
        item.name.endsWith(".pt"),
    );

    // Check if README no longer says "Coming Soon"
    const readmeResp = await fetch(
      "https://raw.githubusercontent.com/EverMind-AI/MSA/main/README.md",
      { headers: { "User-Agent": "MSA-Monitor/1.0" } },
    );
    const readmeText = readmeResp.ok ? await readmeResp.text() : "";
    const comingSoonRemoved =
      prev?.github_has_weights === false &&
      !readmeText.includes("Coming Soon") &&
      readmeText.length > 100;

    if (hasWeights || comingSoonRemoved) {
      this.updateState({
        last_check: new Date().toISOString(),
        github_file_count: contents.length,
        github_has_weights: true,
        hf_model_count: prev?.hf_model_count || 0,
        last_notified: new Date().toISOString(),
      });

      return {
        changed: true,
        source: "GitHub",
        url: "https://github.com/EverMind-AI/MSA",
        details: hasWeights
          ? "Weight files detected in repository"
          : "README no longer says 'Coming Soon' — code/weights may be available",
      };
    }

    return null;
  }

  private async checkHuggingFace(prev: MonitorState | null): Promise<CheckResult | null> {
    const resp = await fetch(HF_API, {
      headers: { "User-Agent": "MSA-Monitor/1.0" },
    });
    if (!resp.ok) return null;

    const models = (await resp.json()) as Array<{ modelId: string; id: string }>;
    const prevCount = prev?.hf_model_count || 0;

    if (models.length > prevCount) {
      this.updateState({
        last_check: new Date().toISOString(),
        github_file_count: prev?.github_file_count || 0,
        github_has_weights: prev?.github_has_weights || false,
        hf_model_count: models.length,
        last_notified: new Date().toISOString(),
      });

      const newModel = models[0];
      return {
        changed: true,
        source: "HuggingFace",
        url: `https://huggingface.co/${newModel.modelId || newModel.id}`,
        details: `New MSA model published by EverMind-AI: ${newModel.modelId || newModel.id}`,
      };
    }

    return null;
  }

  private async checkHuggingFaceSearch(): Promise<CheckResult | null> {
    const resp = await fetch(HF_SEARCH_API, {
      headers: { "User-Agent": "MSA-Monitor/1.0" },
    });
    if (!resp.ok) return null;

    const models = (await resp.json()) as Array<{
      modelId: string;
      id: string;
      downloads: number;
    }>;

    // Look for models with significant downloads that match MSA
    const msaModels = models.filter(
      (m) =>
        (m.modelId || m.id || "").toLowerCase().includes("msa") &&
        m.downloads > 10,
    );

    if (msaModels.length > 0) {
      const top = msaModels[0];
      return {
        changed: true,
        source: "HuggingFace (community)",
        url: `https://huggingface.co/${top.modelId || top.id}`,
        details: `Community MSA model found: ${top.modelId || top.id} (${top.downloads} downloads)`,
      };
    }

    return null;
  }

  private async notify(results: CheckResult[]): Promise<void> {
    const lines = [
      "🧠 *MSA-4B Weight Release Detected!*",
      "",
      "Time to deploy Phase B of the memory system.",
      "",
    ];

    for (const result of results) {
      lines.push(`*Source:* ${result.source}`);
      lines.push(`*URL:* ${result.url}`);
      lines.push(`*Details:* ${result.details}`);
      lines.push("");
    }

    lines.push("_Run Phase B deployment to upgrade from BM25 to MSA sparse attention._");
    const message = lines.join("\n");

    if (this.telegramBotToken && this.telegramChatId) {
      try {
        const url = `https://api.telegram.org/bot${this.telegramBotToken}/sendMessage`;
        await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: this.telegramChatId,
            text: message,
            parse_mode: "Markdown",
          }),
        });
        console.log("[MSA Monitor] Telegram notification sent.");
      } catch (err) {
        console.error("[MSA Monitor] Telegram notification failed:", err);
      }
    } else {
      console.log("[MSA Monitor] No Telegram config — logging to console:");
      console.log(message);
    }
  }

  private getState(): MonitorState | null {
    const raw = this.store.getMonitorState(MONITOR_KEY);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as MonitorState;
    } catch {
      return null;
    }
  }

  private updateState(state: MonitorState): void {
    this.store.setMonitorState(MONITOR_KEY, JSON.stringify(state));
  }
}
