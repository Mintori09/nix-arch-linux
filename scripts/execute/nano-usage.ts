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
const MILLISECONDS_PER_MINUTE = 1000 * 60;
const MILLISECONDS_PER_SECOND = 1000;

const TOKEN_SCALE = 1_000_000;

const HEALTHY_THRESHOLD_PERCENT = 50;
const MODERATE_THRESHOLD_PERCENT = 80;

const MONDAY_7AM_HOUR = 7;
const MINUTES_PER_HOUR = 60;
const HOURS_PER_DAY = 24;
const DAYS_PER_WEEK = 7;

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

class NanoGptApiClient {
  private readonly apiKey: string;
  private readonly baseUrl = "https://nano-gpt.com/api";

  constructor() {
    const key = process.env.NANOGPT_API_KEY;
    if (!key) {
      this.printErrorAndExit("NANOGPT_API_KEY environment variable is not set");
    }
    this.apiKey = key;
  }

  async fetchUsage(): Promise<UsageResponse> {
    const response = await fetch(`${this.baseUrl}/subscription/v1/usage`, {
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = (await response.json()) as UsageResponse;

    if ("error" in data) {
      throw new Error(`API error: ${JSON.stringify(data)}`);
    }

    return data;
  }

  private printErrorAndExit(message: string): never {
    console.error(`${ANSI_COLORS.red}Error: ${message}${ANSI_COLORS.reset}`);
    process.exit(1);
  }
}

class NumberFormatter {
  formatWithCommas(value: number): string {
    return value.toLocaleString("en-US");
  }

  formatInMillions(value: number): string {
    return (value / TOKEN_SCALE).toFixed(2);
  }
}

class TimeFormatter {
  formatIsoTimestamp(timestamp: number): string {
    if (!Number.isFinite(timestamp) || timestamp <= 0) {
      return "Unknown";
    }
    const date = new Date(timestamp);
    return date.toISOString().slice(0, 16).replace("T", " ");
  }

  formatWeeklyResetTimestamp(timestamp: number): string {
    if (!Number.isFinite(timestamp) || timestamp <= 0) {
      return "Unknown";
    }
    const date = new Date(timestamp);
    const dateStr = date.toISOString().slice(0, 10);
    return `${dateStr} 07:00`;
  }

  formatIsoDateOnly(isoDate: string): string {
    return isoDate.split("T")[0];
  }

  formatRemainingTimeUntil(periodEnd: string | undefined): string {
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

  formatShortDurationFromNow(resetAt: number): string {
    if (!Number.isFinite(resetAt) || resetAt <= 0) {
      return "Unknown";
    }

    const now = Date.now();
    const remainingMs = resetAt - now;

    if (remainingMs <= 0) {
      return "Resets soon";
    }

    if (remainingMs < MILLISECONDS_PER_MINUTE) {
      const seconds = Math.ceil(remainingMs / MILLISECONDS_PER_SECOND);
      return seconds <= 5 ? "now" : `${seconds}s`;
    }

    if (remainingMs < MILLISECONDS_PER_HOUR) {
      const minutes = Math.ceil(remainingMs / MILLISECONDS_PER_MINUTE);
      return `${minutes}m`;
    }

    const days = Math.floor(remainingMs / MILLISECONDS_PER_DAY);
    const hours = Math.floor(
      (remainingMs % MILLISECONDS_PER_DAY) / MILLISECONDS_PER_HOUR,
    );
    const minutes = Math.floor(
      (remainingMs % MILLISECONDS_PER_HOUR) / MILLISECONDS_PER_MINUTE,
    );

    if (days > 0) {
      return minutes > 0
        ? `${days}d ${hours}h ${minutes}m`
        : `${days}d ${hours}h`;
    }

    return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`;
  }
}

class WeeklyResetCalculator {
  calculateDaysUntilNextMonday7AM(): number {
    const now = new Date();
    const dayOfWeek = now.getDay();
    const hour = now.getHours();
    const minute = now.getMinutes();

    const daysSinceMonday = (dayOfWeek + 6) % 7;

    const currentMinutes =
      daysSinceMonday * HOURS_PER_DAY * MINUTES_PER_HOUR +
      hour * MINUTES_PER_HOUR +
      minute;
    const targetMinutes = MONDAY_7AM_HOUR * MINUTES_PER_HOUR;

    let minutesUntil: number;

    if (currentMinutes < targetMinutes) {
      minutesUntil = targetMinutes - currentMinutes;
    } else {
      minutesUntil =
        DAYS_PER_WEEK * HOURS_PER_DAY * MINUTES_PER_HOUR -
        currentMinutes +
        targetMinutes;
    }

    return minutesUntil / (HOURS_PER_DAY * MINUTES_PER_HOUR);
  }
}

class DailyBudgetCalculator {
  private readonly weeklyResetCalculator = new WeeklyResetCalculator();

  calculateDailyBudget(remainingTokens: number): number {
    const remainingDays =
      this.weeklyResetCalculator.calculateDaysUntilNextMonday7AM();

    if (remainingDays <= 0) {
      return 0;
    }

    return Math.floor(remainingTokens / remainingDays);
  }
}

class UsageStatusEvaluator {
  evaluate(percentUsed: number): StatusInfo {
    if (percentUsed < HEALTHY_THRESHOLD_PERCENT) {
      return {
        barColor: ANSI_COLORS.green,
        statusColor: ANSI_COLORS.green,
        status: "Healthy",
      };
    }

    if (percentUsed < MODERATE_THRESHOLD_PERCENT) {
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
  constructor(private readonly width: number) {}

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

class BoxRenderer {
  private readonly width = 38;

  render(title: string, color: string): void {
    const line = "─".repeat(this.width);
    const paddingLeft = Math.floor((this.width - title.length) / 2);
    const paddingRight = Math.ceil((this.width - title.length) / 2);

    console.log("");
    console.log(`${ANSI_COLORS.bold}${color}╭${line}╮${ANSI_COLORS.reset}`);
    console.log(
      `${ANSI_COLORS.bold}${color}│${" ".repeat(paddingLeft)}${title}${" ".repeat(paddingRight)}│${ANSI_COLORS.reset}`,
    );
    console.log(`${ANSI_COLORS.bold}${color}╰${line}╯${ANSI_COLORS.reset}`);
  }
}

class TokenUsageReporter {
  private readonly boxRenderer = new BoxRenderer();
  private readonly statusEvaluator = new UsageStatusEvaluator();
  private readonly progressBarRenderer = new ProgressBarRenderer(
    PROGRESS_BAR_WIDTH,
  );
  private readonly numberFormatter = new NumberFormatter();
  private readonly timeFormatter = new TimeFormatter();
  private readonly dailyBudgetCalculator = new DailyBudgetCalculator();

  report(usage: TokenUsage): void {
    const total = usage.used + usage.remaining;
    const status = this.statusEvaluator.evaluate(usage.percentUsed);
    const percentage = this.progressBarRenderer.calculatePercentage(
      usage.used,
      total,
    );
    const remainingTime = this.timeFormatter.formatShortDurationFromNow(
      usage.resetAt,
    );
    const dailyBudget = this.dailyBudgetCalculator.calculateDailyBudget(
      usage.remaining,
    );

    this.boxRenderer.render("NanoGPT Weekly Token Usage", ANSI_COLORS.cyan);

    console.log("");
    console.log(
      `  ${ANSI_COLORS.bold}Status:${ANSI_COLORS.reset} ${status.statusColor}${status.status}${ANSI_COLORS.reset}`,
    );
    console.log("");
    console.log(
      `  ${this.progressBarRenderer.render(usage.used, total, status.barColor)} ${ANSI_COLORS.bold}${percentage}%${ANSI_COLORS.reset}`,
    );
    console.log("");
    console.log(
      `  ${ANSI_COLORS.bold}Used:${ANSI_COLORS.reset}      ${ANSI_COLORS.yellow}${this.numberFormatter.formatWithCommas(usage.used)}${ANSI_COLORS.reset} tokens (${this.numberFormatter.formatInMillions(usage.used)}M)`,
    );
    console.log(
      `  ${ANSI_COLORS.bold}Total:${ANSI_COLORS.reset}     ${ANSI_COLORS.cyan}${this.numberFormatter.formatWithCommas(total)}${ANSI_COLORS.reset} tokens (${this.numberFormatter.formatInMillions(total)}M)`,
    );
    console.log(
      `  ${ANSI_COLORS.bold}Remaining:${ANSI_COLORS.reset} ${ANSI_COLORS.green}${this.numberFormatter.formatWithCommas(usage.remaining)}${ANSI_COLORS.reset} tokens (${this.numberFormatter.formatInMillions(usage.remaining)}M)`,
    );
    console.log("");
    console.log(
      `  ${ANSI_COLORS.bold}Daily Budget:${ANSI_COLORS.reset} ${ANSI_COLORS.magenta}${this.numberFormatter.formatWithCommas(dailyBudget)}${ANSI_COLORS.reset} tokens/day (${this.numberFormatter.formatInMillions(dailyBudget)}M)`,
    );
    console.log(
      `  ${ANSI_COLORS.bold}Resets:${ANSI_COLORS.reset} ${ANSI_COLORS.blue}${this.timeFormatter.formatWeeklyResetTimestamp(usage.resetAt)}${ANSI_COLORS.reset} (${ANSI_COLORS.magenta}${remainingTime}${ANSI_COLORS.reset})`,
    );
  }
}

class ImageUsageReporter {
  private readonly boxRenderer = new BoxRenderer();
  private readonly statusEvaluator = new UsageStatusEvaluator();
  private readonly progressBarRenderer = new ProgressBarRenderer(
    PROGRESS_BAR_WIDTH,
  );
  private readonly timeFormatter = new TimeFormatter();

  report(usage: ImageUsage): void {
    const status = this.statusEvaluator.evaluate(usage.percentUsed);
    const percentage = this.progressBarRenderer.calculatePercentage(
      usage.used,
      usage.limit,
    );
    const remainingTime = this.timeFormatter.formatShortDurationFromNow(
      usage.resetAt,
    );

    this.boxRenderer.render("NanoGPT Daily Image Usage", ANSI_COLORS.magenta);

    console.log("");
    console.log(
      `  ${ANSI_COLORS.bold}Status:${ANSI_COLORS.reset} ${status.statusColor}${status.status}${ANSI_COLORS.reset}`,
    );
    console.log("");
    console.log(
      `  ${this.progressBarRenderer.render(usage.used, usage.limit, status.barColor)} ${ANSI_COLORS.bold}${percentage}%${ANSI_COLORS.reset}`,
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
      `  ${ANSI_COLORS.bold}Resets:${ANSI_COLORS.reset} ${ANSI_COLORS.blue}${this.timeFormatter.formatWeeklyResetTimestamp(usage.resetAt)}${ANSI_COLORS.reset} (${ANSI_COLORS.magenta}${remainingTime}${ANSI_COLORS.reset})`,
    );
  }
}

class SubscriptionReporter {
  private readonly boxRenderer = new BoxRenderer();
  private readonly timeFormatter = new TimeFormatter();

  report(
    state: string,
    periodEnd: string | undefined,
    remainingTime: string,
  ): void {
    this.boxRenderer.render("Subscription Details", ANSI_COLORS.cyan);

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
        `  ${ANSI_COLORS.bold}Period End:${ANSI_COLORS.reset} ${ANSI_COLORS.blue}${this.timeFormatter.formatIsoDateOnly(periodEnd)}${ANSI_COLORS.reset}`,
      );
      console.log(
        `  ${ANSI_COLORS.bold}Time Remaining:${ANSI_COLORS.reset} ${ANSI_COLORS.magenta}${remainingTime}${ANSI_COLORS.reset}`,
      );
    }

    console.log("");
  }
}

class NanoGptUsageApp {
  private readonly apiClient = new NanoGptApiClient();
  private readonly tokenReporter = new TokenUsageReporter();
  private readonly imageReporter = new ImageUsageReporter();
  private readonly subscriptionReporter = new SubscriptionReporter();
  private readonly timeFormatter = new TimeFormatter();

  async run(): Promise<void> {
    try {
      const data = await this.apiClient.fetchUsage();

      const tokenUsage = this.extractTokenUsage(data);
      const imageUsage = this.extractImageUsage(data);
      const remainingTime = this.timeFormatter.formatRemainingTimeUntil(
        data.period?.currentPeriodEnd,
      );

      this.tokenReporter.report(tokenUsage);
      this.imageReporter.report(imageUsage);
      this.subscriptionReporter.report(
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

  private extractTokenUsage(data: UsageResponse): TokenUsage {
    return {
      used: data.weeklyInputTokens?.used ?? 0,
      remaining: data.weeklyInputTokens?.remaining ?? 0,
      resetAt: data.weeklyInputTokens?.resetAt ?? 0,
      percentUsed: data.weeklyInputTokens?.percentUsed ?? 0,
      limit: data.limits?.weeklyInputTokens ?? 0,
    };
  }

  private extractImageUsage(data: UsageResponse): ImageUsage {
    return {
      used: data.dailyImages?.used ?? 0,
      remaining: data.dailyImages?.remaining ?? 0,
      resetAt: data.dailyImages?.resetAt ?? 0,
      percentUsed: data.dailyImages?.percentUsed ?? 0,
      limit: data.limits?.dailyImages ?? 100,
    };
  }
}

const app = new NanoGptUsageApp();
app.run();
