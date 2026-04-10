#!/usr/bin/env bun

const ANSI_COLORS = {
  green: "\x1b[0;32m",
  yellow: "\x1b[1;33m",
  red: "\x1b[0;31m",
  blue: "\x1b[0;34m",
  cyan: "\x1b[0;36m",
  magenta: "\x1b[0;35m",
  reset: "\x1b[0m",
  bold: "\x1b[1m",
} as const;

const PROGRESS_BAR_WIDTH = 40;
const MILLISECONDS_PER_DAY = 1000 * 60 * 60 * 24;
const MILLISECONDS_PER_HOUR = 1000 * 60 * 60;
const TOKEN_SCALE = 1_000_000;

const HEALTHY_THRESHOLD = 50;
const MODERATE_THRESHOLD = 80;

interface UsageResponse {
  active: boolean;
  provider: string;
  providerStatus: string;
  providerStatusRaw: string;
  stripeSubscriptionId: string;
  cancellationReason: string | null;
  canceledAt: string | null;
  endedAt: string | null;
  cancelAt: string | null;
  cancelAtPeriodEnd: boolean;
  limits: {
    weeklyInputTokens: number;
    dailyInputTokens: number | null;
    dailyImages: number;
  };
  allowOverage: boolean;
  period: {
    currentPeriodEnd: string;
  };
  dailyImages: {
    used: number;
    remaining: number;
    percentUsed: number;
    resetAt: number;
  };
  dailyInputTokens: null;
  weeklyInputTokens: {
    used: number;
    remaining: number;
    percentUsed: number;
    resetAt: number;
  };
  state: string;
  graceUntil: string | null;
}

interface TokenUsage {
  used: number;
  remaining: number;
  resetAt: number;
  percentUsed: number;
  limit: number;
}

interface ImageUsage {
  used: number;
  remaining: number;
  resetAt: number;
  percentUsed: number;
  limit: number;
}

interface StatusInfo {
  barColor: string;
  statusColor: string;
  status: string;
}

class NanoGptUsageClient {
  private readonly apiKey: string;

  constructor() {
    const key = process.env.NANOGPT_API_KEY;
    if (!key) {
      this.printError("NANOGPT_API_KEY environment variable is not set");
      process.exit(1);
    }
    this.apiKey = key;
  }

  async fetchUsage(): Promise<UsageResponse> {
    const response = await fetch(
      "https://nano-gpt.com/api/subscription/v1/usage",
      {
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
        },
      },
    );

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = (await response.json()) as UsageResponse;

    if ("error" in data) {
      throw new Error(`API error: ${JSON.stringify(data)}`);
    }

    return data;
  }

  private printError(message: string): void {
    console.error(`${ANSI_COLORS.red}Error: ${message}${ANSI_COLORS.reset}`);
  }
}

class UsageFormatter {
  formatNumber(value: number): string {
    return value.toLocaleString("en-US");
  }

  formatTimestamp(timestamp: number): string {
    if (!timestamp || timestamp === 0) {
      return "Unknown";
    }
    const date = new Date(timestamp);
    return date.toISOString().slice(0, 16).replace("T", " ");
  }

  formatDateOnly(isoDate: string): string {
    return isoDate.split("T")[0];
  }

  formatRemainingTime(periodEnd: string | undefined): string {
    if (!periodEnd || periodEnd === "null") {
      return "Unknown";
    }

    const periodEndDate = new Date(periodEnd);
    const now = new Date();
    const remainingMs = periodEndDate.getTime() - now.getTime();

    if (remainingMs <= 0) {
      return "Expired";
    }

    const days = Math.floor(remainingMs / MILLISECONDS_PER_DAY);
    const hours = Math.floor(
      (remainingMs % MILLISECONDS_PER_DAY) / MILLISECONDS_PER_HOUR,
    );

    return `${days}d ${hours}h`;
  }

  formatRemainingTimeMs(resetAt: number): string {
    if (!resetAt || resetAt === 0) {
      return "Unknown";
    }

    const now = Date.now();
    const remainingMs = resetAt - now;

    if (remainingMs <= 0) {
      return "Resets soon";
    }

    const days = Math.floor(remainingMs / MILLISECONDS_PER_DAY);
    const hours = Math.floor(
      (remainingMs % MILLISECONDS_PER_DAY) / MILLISECONDS_PER_HOUR,
    );

    if (days > 0) {
      return `${days}d ${hours}h`;
    }

    return `${hours}h`;
  }

  formatMillions(value: number): string {
    return (value / TOKEN_SCALE).toFixed(2);
  }
}

class StatusEvaluator {
  evaluate(percentUsed: number): StatusInfo {
    if (percentUsed < HEALTHY_THRESHOLD) {
      return {
        barColor: ANSI_COLORS.green,
        statusColor: ANSI_COLORS.green,
        status: "Healthy",
      };
    }

    if (percentUsed < MODERATE_THRESHOLD) {
      return {
        barColor: ANSI_COLORS.yellow,
        statusColor: ANSI_COLORS.yellow,
        status: "Moderate",
      };
    }

    return {
      barColor: ANSI_COLORS.red,
      statusColor: ANSI_COLORS.red,
      status: "High Usage",
    };
  }
}

class ProgressBarRenderer {
  private readonly width: number;

  constructor(width: number) {
    this.width = width;
  }

  render(used: number, total: number, color: string): string {
    if (total === 0) {
      return "░".repeat(this.width);
    }

    const filledWidth = Math.min(
      Math.max(Math.round((used / total) * this.width), 0),
      this.width,
    );
    const emptyWidth = this.width - filledWidth;

    const filled = "█".repeat(filledWidth);
    const empty = "░".repeat(emptyWidth);

    return `${color}${filled}${ANSI_COLORS.reset}${empty}`;
  }

  calculatePercentage(used: number, total: number): string {
    if (total === 0) {
      return "0.0";
    }
    return ((used / total) * 100).toFixed(1);
  }
}

class UsageReporter {
  private readonly formatter: UsageFormatter;
  private readonly statusEvaluator: StatusEvaluator;
  private readonly progressBar: ProgressBarRenderer;

  constructor() {
    this.formatter = new UsageFormatter();
    this.statusEvaluator = new StatusEvaluator();
    this.progressBar = new ProgressBarRenderer(PROGRESS_BAR_WIDTH);
  }

  printHeader(title: string, color: string): void {
    const line = "─".repeat(38);
    console.log("");
    console.log(`${ANSI_COLORS.bold}${color}╭${line}╮${ANSI_COLORS.reset}`);
    console.log(
      `${ANSI_COLORS.bold}${color}│${" ".repeat(Math.floor((38 - title.length) / 2))}${title}${" ".repeat(
        Math.ceil((38 - title.length) / 2),
      )}│${ANSI_COLORS.reset}`,
    );
    console.log(`${ANSI_COLORS.bold}${color}╰${line}╯${ANSI_COLORS.reset}`);
  }

  printTokenUsage(usage: TokenUsage): void {
    const total = usage.used + usage.remaining;
    const status = this.statusEvaluator.evaluate(usage.percentUsed);
    const percentage = this.progressBar.calculatePercentage(usage.used, total);
    const remainingTime = this.formatter.formatRemainingTimeMs(usage.resetAt);

    this.printHeader("NanoGPT Weekly Token Usage", ANSI_COLORS.cyan);

    console.log("");
    console.log(
      `  ${ANSI_COLORS.bold}Status:${ANSI_COLORS.reset} ${status.statusColor}${status.status}${ANSI_COLORS.reset}`,
    );
    console.log("");
    console.log(
      `  ${this.progressBar.render(usage.used, total, status.barColor)} ${ANSI_COLORS.bold}${percentage}%${ANSI_COLORS.reset}`,
    );
    console.log("");
    console.log(
      `  ${ANSI_COLORS.bold}Used:${ANSI_COLORS.reset}      ${ANSI_COLORS.yellow}${this.formatter.formatNumber(usage.used)}${ANSI_COLORS.reset} tokens (${this.formatter.formatMillions(usage.used)}M)`,
    );
    console.log(
      `  ${ANSI_COLORS.bold}Total:${ANSI_COLORS.reset}     ${ANSI_COLORS.cyan}${this.formatter.formatNumber(total)}${ANSI_COLORS.reset} tokens (${this.formatter.formatMillions(total)}M)`,
    );
    console.log(
      `  ${ANSI_COLORS.bold}Remaining:${ANSI_COLORS.reset} ${ANSI_COLORS.green}${this.formatter.formatNumber(usage.remaining)}${ANSI_COLORS.reset} tokens (${this.formatter.formatMillions(usage.remaining)}M)`,
    );
    console.log("");
    console.log(
      `  ${ANSI_COLORS.bold}Resets:${ANSI_COLORS.reset} ${ANSI_COLORS.blue}${this.formatter.formatTimestamp(usage.resetAt)}${ANSI_COLORS.reset} (${ANSI_COLORS.magenta}${remainingTime}${ANSI_COLORS.reset})`,
    );
  }

  printImageUsage(usage: ImageUsage): void {
    const status = this.statusEvaluator.evaluate(usage.percentUsed);
    const percentage = this.progressBar.calculatePercentage(
      usage.used,
      usage.limit,
    );
    const remainingTime = this.formatter.formatRemainingTimeMs(usage.resetAt);

    this.printHeader("NanoGPT Daily Image Usage", ANSI_COLORS.magenta);

    console.log("");
    console.log(
      `  ${ANSI_COLORS.bold}Status:${ANSI_COLORS.reset} ${status.statusColor}${status.status}${ANSI_COLORS.reset}`,
    );
    console.log("");
    console.log(
      `  ${this.progressBar.render(usage.used, usage.limit, status.barColor)} ${ANSI_COLORS.bold}${percentage}%${ANSI_COLORS.reset}`,
    );
    console.log("");
    console.log(
      `  ${ANSI_COLORS.bold}Used:${ANSI_COLORS.reset}      ${ANSI_COLORS.yellow}${usage.used}${ANSI_COLORS.reset} images`,
    );
    console.log(
      `  ${ANSI_COLORS.bold}Total:${ANSI_COLORS.reset}     ${ANSI_COLORS.cyan}${usage.limit}${ANSI_COLORS.reset} images`,
    );
    console.log(
      `  ${ANSI_COLORS.bold}Remaining:${ANSI_COLORS.reset} ${ANSI_COLORS.green}${usage.remaining}${ANSI_COLORS.reset} images`,
    );
    console.log("");
    console.log(
      `  ${ANSI_COLORS.bold}Resets:${ANSI_COLORS.reset} ${ANSI_COLORS.blue}${this.formatter.formatTimestamp(usage.resetAt)}${ANSI_COLORS.reset} (${ANSI_COLORS.magenta}${remainingTime}${ANSI_COLORS.reset})`,
    );
  }

  printSubscriptionDetails(
    state: string,
    periodEnd: string | undefined,
    remainingTime: string,
  ): void {
    this.printHeader("Subscription Details", ANSI_COLORS.cyan);

    console.log("");

    const displayState = state ?? "unknown";
    if (displayState === "active") {
      console.log(
        `  ${ANSI_COLORS.bold}Subscription:${ANSI_COLORS.reset} ${ANSI_COLORS.green}● Active${ANSI_COLORS.reset}`,
      );
    } else {
      console.log(
        `  ${ANSI_COLORS.bold}Subscription:${ANSI_COLORS.reset} ${ANSI_COLORS.red}● ${displayState}${ANSI_COLORS.reset}`,
      );
    }

    if (periodEnd && periodEnd !== "null") {
      console.log(
        `  ${ANSI_COLORS.bold}Period End:${ANSI_COLORS.reset} ${ANSI_COLORS.blue}${this.formatter.formatDateOnly(periodEnd)}${ANSI_COLORS.reset}`,
      );
      console.log(
        `  ${ANSI_COLORS.bold}Time Remaining:${ANSI_COLORS.reset} ${ANSI_COLORS.magenta}${remainingTime}${ANSI_COLORS.reset}`,
      );
    }

    console.log("");
  }
}

class NanoGptUsageApp {
  private readonly client: NanoGptUsageClient;
  private readonly reporter: UsageReporter;
  private readonly formatter: UsageFormatter;

  constructor() {
    this.client = new NanoGptUsageClient();
    this.reporter = new UsageReporter();
    this.formatter = new UsageFormatter();
  }

  async run(): Promise<void> {
    try {
      const data = await this.client.fetchUsage();

      const tokenUsage: TokenUsage = {
        used: data.weeklyInputTokens?.used ?? 0,
        remaining: data.weeklyInputTokens?.remaining ?? 0,
        resetAt: data.weeklyInputTokens?.resetAt ?? 0,
        percentUsed: data.weeklyInputTokens?.percentUsed ?? 0,
        limit: data.limits?.weeklyInputTokens ?? 0,
      };

      const imageUsage: ImageUsage = {
        used: data.dailyImages?.used ?? 0,
        remaining: data.dailyImages?.remaining ?? 0,
        resetAt: data.dailyImages?.resetAt ?? 0,
        percentUsed: data.dailyImages?.percentUsed ?? 0,
        limit: data.limits?.dailyImages ?? 100,
      };

      const remainingTime = this.formatter.formatRemainingTime(
        data.period?.currentPeriodEnd,
      );

      this.reporter.printTokenUsage(tokenUsage);
      this.reporter.printImageUsage(imageUsage);
      this.reporter.printSubscriptionDetails(
        data.state,
        data.period?.currentPeriodEnd,
        remainingTime,
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`${ANSI_COLORS.red}Error: ${message}${ANSI_COLORS.reset}`);
      process.exit(1);
    }
  }
}

const app = new NanoGptUsageApp();
app.run();
