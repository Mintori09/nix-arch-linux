export const DAEMON_HOST = process.env.DAEMON_HOST ?? "127.0.0.1";
export const DAEMON_PORT = process.env.AI_BRIDGE_PORT ?? "58721";
export const DAEMON_URL = `http://${DAEMON_HOST}:${DAEMON_PORT}`;
export const AI_BRIDGE_PROMPTS_DIR =
  process.env.AI_BRIDGE_PROMPTS_DIR ?? "~/.config/ai-bridge/prompts/";
