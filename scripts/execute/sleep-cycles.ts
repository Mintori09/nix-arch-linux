#!/usr/bin/env bun
import { parseArgs } from "util";

const SLEEP_CYCLE_MINUTES = 90;
const FALL_ASLEEP_MINUTES = 15;

const COLORS = {
  CYAN: "\x1b[36m",
  GREEN: "\x1b[32m",
  YELLOW: "\x1b[33m",
  BLUE: "\x1b[34m",
  MAGENTA: "\x1b[35m",
  RESET: "\x1b[0m",
};

function parseTime(timeStr: string): Date {
  const now = new Date();
  const [hours, minutes] = timeStr.split(":").map(Number);

  if (
    isNaN(hours) ||
    isNaN(minutes) ||
    hours < 0 ||
    hours > 23 ||
    minutes < 0 ||
    minutes > 59
  ) {
    throw new Error(
      `Invalid time format: ${timeStr}. Use HH:MM (24-hour format)`,
    );
  }

  const date = new Date(now);
  date.setHours(hours, minutes, 0, 0);
  return date;
}

function formatTime(date: Date): string {
  return date.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

function addMinutes(date: Date, minutes: number): Date {
  return new Date(date.getTime() + minutes * 60000);
}

function calculateWakeUpTimes(sleepTime: Date): void {
  console.log(
    `\n${COLORS.CYAN}If you go to sleep at ${formatTime(sleepTime)}:${COLORS.RESET}\n`,
  );

  // Account for time to fall asleep
  const actualSleepTime = addMinutes(sleepTime, FALL_ASLEEP_MINUTES);

  console.log(
    `${COLORS.YELLOW}(Assuming ${FALL_ASLEEP_MINUTES} min to fall asleep, sleep starts at ${formatTime(actualSleepTime)})${COLORS.RESET}\n`,
  );

  console.log(`${COLORS.GREEN}Recommended wake-up times:${COLORS.RESET}`);

  for (let cycles = 2; cycles <= 6; cycles++) {
    const wakeTime = addMinutes(actualSleepTime, cycles * SLEEP_CYCLE_MINUTES);
    const hours = (cycles * SLEEP_CYCLE_MINUTES) / 60;
    const quality =
      cycles === 2 ? "Minimum" : cycles === 5 ? "Recommended" : "Optimal";
    const color =
      cycles === 2 ? COLORS.YELLOW : cycles === 5 ? COLORS.GREEN : COLORS.CYAN;

    console.log(
      `  ${color}${formatTime(wakeTime)}${COLORS.RESET} - ${cycles} cycles (${hours}h) - ${quality}`,
    );
  }
}

function calculateSleepTimes(wakeTime: Date): void {
  console.log(
    `\n${COLORS.CYAN}If you want to wake up at ${formatTime(wakeTime)}:${COLORS.RESET}\n`,
  );

  console.log(
    `${COLORS.YELLOW}(Assuming ${FALL_ASLEEP_MINUTES} min to fall asleep)${COLORS.RESET}\n`,
  );

  console.log(`${COLORS.GREEN}Recommended bed times:${COLORS.RESET}`);

  for (let cycles = 6; cycles >= 2; cycles--) {
    const totalSleepMinutes = cycles * SLEEP_CYCLE_MINUTES;
    const bedTime = addMinutes(
      wakeTime,
      -(totalSleepMinutes + FALL_ASLEEP_MINUTES),
    );
    const hours = totalSleepMinutes / 60;
    const quality =
      cycles === 2 ? "Minimum" : cycles === 5 ? "Recommended" : "Optimal";
    const color =
      cycles === 2 ? COLORS.YELLOW : cycles === 5 ? COLORS.GREEN : COLORS.CYAN;

    console.log(
      `  ${color}${formatTime(bedTime)}${COLORS.RESET} - ${cycles} cycles (${hours}h) - ${quality}`,
    );
  }
}

function showHelp(): void {
  console.log(`
${COLORS.CYAN}Sleep Cycle Calculator${COLORS.RESET}

Usage: bun run sleep-cycles.ts [options]

Options:
  -t, --time <HH:MM>    Time to calculate from (24-hour format)
  -m, --mode <mode>     Calculation mode: "sleep" (when to wake) or "wake" (when to sleep)
                        Default: "sleep" (calculate wake-up times)

Examples:
  bun run sleep-cycles.ts -t 23:00           # Calculate wake times if sleeping at 11 PM
  bun run sleep-cycles.ts -t 23:00 -m sleep  # Same as above (explicit)
  bun run sleep-cycles.ts -t 07:00 -m wake   # Calculate sleep times to wake at 7 AM
`);
}

function main(): void {
  const { values } = parseArgs({
    args: Bun.argv.slice(2),
    options: {
      time: { type: "string", short: "t" },
      mode: { type: "string", short: "m", default: "sleep" },
      help: { type: "boolean", short: "h" },
    },
    strict: true,
    allowPositionals: false,
  });

  if (values.help || !values.time) {
    showHelp();
    process.exit(values.help ? 0 : 1);
  }

  const mode = values.mode as string;
  if (mode !== "sleep" && mode !== "wake") {
    console.error(`Error: mode must be "sleep" or "wake", got "${mode}"`);
    process.exit(1);
  }

  try {
    const time = parseTime(values.time as string);

    if (mode === "sleep") {
      calculateWakeUpTimes(time);
    } else {
      calculateSleepTimes(time);
    }

    console.log(); // Empty line at end
  } catch (error) {
    console.error(
      `Error: ${error instanceof Error ? error.message : String(error)}`,
    );
    process.exit(1);
  }
}

main();
