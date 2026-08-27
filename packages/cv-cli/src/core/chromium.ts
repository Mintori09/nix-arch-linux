import path from "node:path";
import { tmpdir } from "node:os";
import { pathToFileURL } from "node:url";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { spawn } from "node:child_process";
import { Buffer } from "node:buffer";
import { CliError, CommandExecutionError } from "../errors.ts";
import { sleep, COLORS } from "../utils.ts";
import { runCommand, shortStderr } from "./command.ts";

export type ViewportMetrics = { width: number; height: number };

export type ViewportSize = { width: number; height: number };

type ChromeJsonTarget = {
  type?: string;
  url?: string;
  webSocketDebuggerUrl?: string;
};

export function calculateViewportSize(metrics: ViewportMetrics): ViewportSize {
  if (!Number.isFinite(metrics.width) || !Number.isFinite(metrics.height)) {
    throw new CliError(
      `${COLORS.RED}Error:${COLORS.NC} Chromium returned invalid page dimensions.`,
    );
  }
  return {
    width: Math.max(1, Math.ceil(metrics.width)),
    height: Math.max(1, Math.ceil(metrics.height) + 32),
  };
}

function parseDevToolsPort(text: string): number | undefined {
  const match = text.match(
    /DevTools listening on ws:\/\/(?:127\.0\.0\.1|localhost):(\d+)\//,
  );
  if (!match) return undefined;
  return Number.parseInt(match[1], 10);
}

function waitForDevToolsPort(stream: NodeJS.ReadableStream): Promise<number> {
  return new Promise((resolve, reject) => {
    let stderr = "";
    const onData = (chunk: Buffer) => {
      stderr += chunk.toString();
      const port = parseDevToolsPort(stderr);
      if (port !== undefined) {
        cleanup();
        resolve(port);
      }
    };
    const onEnd = () => {
      cleanup();
      reject(new CommandExecutionError("chromium", shortStderr(stderr), 1));
    };
    const onError = (err: Error) => {
      cleanup();
      reject(err);
    };
    const cleanup = () => {
      stream.removeListener("data", onData);
      stream.removeListener("end", onEnd);
      stream.removeListener("error", onError);
    };
    stream.on("data", onData);
    stream.on("end", onEnd);
    stream.on("error", onError);
  });
}

function waitForPageWebSocketUrl(
  port: number,
  pageUrl: string,
): Promise<string> {
  const endpoint = `http://127.0.0.1:${port}/json/list`;
  const startedAt = Date.now();
  return (async () => {
    while (Date.now() - startedAt < 5000) {
      try {
        const targets = (await fetch(endpoint).then((r) =>
          r.json(),
        )) as ChromeJsonTarget[];
        const page = targets.find(
          (t) =>
            t.type === "page" && t.url === pageUrl && t.webSocketDebuggerUrl,
        );
        if (page?.webSocketDebuggerUrl) return page.webSocketDebuggerUrl;
      } catch {
        /* retry */
      }
      await sleep(50);
    }
    throw new CommandExecutionError(
      "chromium",
      `Timed out waiting for DevTools page target: ${pageUrl}`,
      1,
    );
  })();
}

class DevToolsSession {
  private nextId = 1;
  private pending = new Map<
    number,
    { resolve: (value: unknown) => void; reject: (reason?: unknown) => void }
  >();

  constructor(private readonly socket: WebSocket) {
    this.socket.addEventListener("message", (event) => {
      const message = JSON.parse(String(event.data)) as {
        id?: number;
        result?: unknown;
        error?: unknown;
      };
      if (!message.id) return;
      const pending = this.pending.get(message.id);
      if (!pending) return;
      this.pending.delete(message.id);
      if (message.error)
        pending.reject(new Error(JSON.stringify(message.error)));
      else pending.resolve(message.result);
    });
  }

  send<T>(method: string, params: Record<string, unknown> = {}): Promise<T> {
    const id = this.nextId++;
    const promise = new Promise<T>((resolve, reject) => {
      this.pending.set(id, { resolve: (value) => resolve(value as T), reject });
    });
    this.socket.send(JSON.stringify({ id, method, params }));
    return promise;
  }

  close(): void {
    this.socket.close();
  }
}

async function openDevToolsSession(
  webSocketUrl: string,
): Promise<DevToolsSession> {
  const socket = new WebSocket(webSocketUrl);
  await new Promise<void>((resolve, reject) => {
    socket.addEventListener("open", () => resolve(), { once: true });
    socket.addEventListener(
      "error",
      () => reject(new Error("DevTools WebSocket failed")),
      { once: true },
    );
  });
  return new DevToolsSession(socket);
}

async function waitForDocumentReady(session: DevToolsSession): Promise<void> {
  const startedAt = Date.now();
  while (Date.now() - startedAt < 5000) {
    const result = await session.send<{ result: { value?: string } }>(
      "Runtime.evaluate",
      {
        expression: "document.readyState",
        returnByValue: true,
      },
    );
    if (result.result.value === "complete") return;
    await sleep(50);
  }
  throw new CommandExecutionError(
    "chromium",
    "Timed out waiting for document.readyState=complete",
    1,
  );
}

export async function captureMhtmlScreenshot(
  input: string,
  output: string,
  context: {
    dryRun: boolean;
    passthroughArgs: string[];
    route: string;
    flags: { style?: string; metadataFile?: string };
  },
): Promise<void> {
  const pageUrl = pathToFileURL(input).href;
  if (context.dryRun) {
    await runCommand(
      [
        "chromium",
        "--headless",
        "--disable-gpu",
        "--disable-dev-shm-usage",
        "--hide-scrollbars",
        "--remote-debugging-port=0",
        "--remote-allow-origins=*",
        ...context.passthroughArgs,
        pageUrl,
      ],
      { dryRun: true },
    );
    return;
  }
  const userDataDir = await mkdtemp(path.join(tmpdir(), "cv-chromium-"));
  const proc = spawn(
    "chromium",
    [
      "--headless",
      "--disable-gpu",
      "--disable-dev-shm-usage",
      "--hide-scrollbars",
      "--remote-debugging-port=0",
      "--remote-allow-origins=*",
      `--user-data-dir=${userDataDir}`,
      ...context.passthroughArgs,
      pageUrl,
    ],
    { stdio: ["ignore", "ignore", "pipe"] },
  );
  const exitedPromise = new Promise<number>((r) => proc.on("close", r));
  try {
    const port = await waitForDevToolsPort(proc.stderr!);
    const webSocketUrl = await waitForPageWebSocketUrl(port, pageUrl);
    const session = await openDevToolsSession(webSocketUrl);
    try {
      await session.send("Page.enable");
      await waitForDocumentReady(session);
      await session.send("Runtime.evaluate", {
        expression: "document.fonts ? document.fonts.ready : Promise.resolve()",
        awaitPromise: true,
      });
      const metrics = await session.send<{ contentSize: ViewportMetrics }>(
        "Page.getLayoutMetrics",
      );
      const viewport = calculateViewportSize(metrics.contentSize);
      await session.send("Emulation.setDeviceMetricsOverride", {
        width: viewport.width,
        height: viewport.height,
        deviceScaleFactor: 1,
        mobile: false,
      });
      const screenshot = await session.send<{ data: string }>(
        "Page.captureScreenshot",
        {
          format: "png",
          fromSurface: true,
          clip: {
            x: 0,
            y: 0,
            width: viewport.width,
            height: viewport.height,
            scale: 1,
          },
        },
      );
      await writeFile(output, Buffer.from(screenshot.data, "base64"));
    } finally {
      session.close();
    }
  } finally {
    proc.kill();
    await exitedPromise.catch(() => undefined);
    await rm(userDataDir, { recursive: true, force: true });
  }
}
