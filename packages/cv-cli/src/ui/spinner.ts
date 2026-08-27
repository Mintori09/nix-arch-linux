import type { ConvertContext } from "../converters/index.ts";
import { COLORS } from "../utils.ts";

// 1. Sử dụng chấm dots hiện đại hơn
const SPINNER_FRAMES = [
  "⠋",
  "⠙",
  "⠹",
  "⠸",
  "⠼",
  "⠴",
  "⠦",
  "⠧",
  "⠇",
  "⠏",
] as const;
const SPINNER_INTERVAL_MS = 80;
const SPINNER_DELAY_MS = 300;

function buildSpinnerLabel(route: string): string {
  const [inputExt, outputExt] = route.split(":");
  return `Converting ${COLORS.CYAN}${inputExt}${COLORS.NC} -> ${COLORS.CYAN}${outputExt}${COLORS.NC}...`;
}

// Hàm render linh hoạt cho cả lúc chạy và lúc kết thúc
function updateLine(content: string): void {
  process.stdout.write(`\r\x1b[2K${content}`);
}

function shouldEnableSpinner(options: {
  dryRun: boolean;
  isTTY?: boolean;
}): boolean {
  return (
    !options.dryRun && options.isTTY === true && process.env.NO_SPINNER !== "1"
  );
}

export async function withSpinner<T>(
  context: ConvertContext,
  task: () => Promise<T>,
): Promise<T> {
  if (
    !shouldEnableSpinner({
      dryRun: context.dryRun,
      isTTY: process.stdout.isTTY,
    })
  ) {
    return task();
  }

  const label = buildSpinnerLabel(context.route);
  const startTime = performance.now();

  let frameIndex = 0;
  let timer: ReturnType<typeof setInterval> | undefined;

  const render = () => {
    const frame = SPINNER_FRAMES[frameIndex % SPINNER_FRAMES.length];
    updateLine(`${COLORS.MAGENTA}${frame}${COLORS.NC} ${label}`);
    frameIndex += 1;
  };

  const delay = setTimeout(() => {
    render();
    timer = setInterval(render, SPINNER_INTERVAL_MS);
  }, SPINNER_DELAY_MS);

  try {
    const result = await task();

    clearTimeout(delay);
    if (timer) clearInterval(timer);

    const duration = ((performance.now() - startTime) / 1000).toFixed(2);
    updateLine(
      `${COLORS.GREEN}✔${COLORS.NC} ${label} ${COLORS.GRAY}(${duration}s)${COLORS.NC}\n`,
    );

    return result;
  } catch (error) {
    clearTimeout(delay);
    if (timer) clearInterval(timer);

    updateLine(
      `${COLORS.RED}✖${COLORS.NC} ${label} ${COLORS.RED}Failed${COLORS.NC}\n`,
    );
    throw error;
  }
}
