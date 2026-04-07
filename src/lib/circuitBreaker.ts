import { createLogger } from "./logger.js";

type CircuitState = "closed" | "open" | "half-open";

interface CircuitBreakerOptions {
  threshold?: number;  // failures before opening (default: 5)
  resetMs?: number;    // ms before trying half-open (default: 60000)
}

export class CircuitBreaker {
  private state: CircuitState = "closed";
  private failures = 0;
  private lastFailureAt = 0;
  private readonly threshold: number;
  private readonly resetMs: number;
  private readonly log;

  constructor(
    private readonly name: string,
    options: CircuitBreakerOptions = {},
  ) {
    this.threshold = options.threshold ?? 5;
    this.resetMs = options.resetMs ?? 60_000;
    this.log = createLogger(`circuit:${name}`);
  }

  async call<T>(fn: () => Promise<T>): Promise<T> {
    if (this.state === "open") {
      if (Date.now() - this.lastFailureAt > this.resetMs) {
        this.state = "half-open";
        this.log.info("transitioning to half-open");
      } else {
        throw new Error(`Circuit breaker '${this.name}' is open`);
      }
    }

    try {
      const result = await fn();
      if (this.state === "half-open") {
        this.log.info("circuit restored to closed");
        this.state = "closed";
        this.failures = 0;
      }
      return result;
    } catch (error) {
      this.failures++;
      this.lastFailureAt = Date.now();

      if (this.failures >= this.threshold) {
        this.state = "open";
        this.log.warn(`circuit opened after ${this.failures} failures`, {
          error: String(error),
        });
      }

      throw error;
    }
  }

  getState(): CircuitState {
    return this.state;
  }

  reset(): void {
    this.state = "closed";
    this.failures = 0;
  }
}
