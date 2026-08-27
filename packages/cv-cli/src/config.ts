import path from "node:path";
import os from "node:os";
import { existsSync, readFileSync } from "node:fs";

export interface RouteDefaults {
  css?: string;
  referenceDoc?: string;
  toc?: boolean;
  numberSections?: boolean;
  metadataFile?: string;
  wrap?: "none" | "preserve";
  extractMedia?: string;
  pageSize?: string;
}

export const BUILTIN_DEFAULTS: Record<string, Partial<RouteDefaults>> = {
  "md:pdf": { pageSize: "a4" },
};

export const CONFIG_DIR = path.join(os.homedir(), ".config", "convert-file");
export const CONFIG_PATH = path.join(CONFIG_DIR, "config.json");

function readJson(filePath: string): unknown {
  try {
    return JSON.parse(readFileSync(filePath, "utf-8"));
  } catch {
    return null;
  }
}

export function loadReferenceDocConfig(
  configDir?: string,
): Record<string, string> {
  const dir = configDir ?? CONFIG_DIR;
  const cfgPath = path.join(dir, "config.json");
  const data = readJson(cfgPath);
  if (data && typeof data === "object" && data !== null) {
    const d = data as Record<string, unknown>;
    if (
      d.referenceDocs &&
      typeof d.referenceDocs === "object" &&
      !Array.isArray(d.referenceDocs)
    ) {
      return d.referenceDocs as Record<string, string>;
    }
  }
  return {};
}

export function loadStyleConfig(configDir?: string): Record<string, string> {
  const dir = configDir ?? CONFIG_DIR;
  const cfgPath = path.join(dir, "config.json");
  const data = readJson(cfgPath);
  if (data && typeof data === "object" && data !== null) {
    const d = data as Record<string, unknown>;
    if (d.styles && typeof d.styles === "object" && !Array.isArray(d.styles)) {
      return d.styles as Record<string, string>;
    }
  }
  return {};
}

export function resolveAlias(
  style: string,
  aliases: Record<string, string>,
): string | null {
  return aliases[style] ?? null;
}

export function resolveStylePath(style: string): string | null {
  const resolved = style.startsWith("~/")
    ? path.join(os.homedir(), style.slice(2))
    : style;
  if (path.isAbsolute(resolved)) return existsSync(resolved) ? resolved : null;
  const absolute = path.resolve(process.cwd(), resolved);
  return existsSync(absolute) ? absolute : null;
}

export function loadDefaults(
  route: string,
  configDir?: string,
): Partial<{
  style: string;
  pageSize: string;
  toc: boolean;
  numberSections: boolean;
  metadataFile: string;
  wrap: "none" | "preserve";
  extractMedia: string;
  referenceDoc: string;
}> {
  const dir = configDir ?? CONFIG_DIR;
  const cfgPath = path.join(dir, "config.json");
  const data = readJson(cfgPath);
  const result: Record<string, string | boolean | undefined> = {};

  const builtin = BUILTIN_DEFAULTS[route];
  if (builtin) {
    if (builtin.pageSize) result.pageSize = builtin.pageSize;
    if (builtin.toc !== undefined) result.toc = builtin.toc;
    if (builtin.numberSections !== undefined)
      result.numberSections = builtin.numberSections;
    if (builtin.metadataFile) result.metadataFile = builtin.metadataFile;
    if (builtin.wrap) result.wrap = builtin.wrap;
    if (builtin.extractMedia) result.extractMedia = builtin.extractMedia;
    if (builtin.referenceDoc) result.referenceDoc = builtin.referenceDoc;
    if (builtin.css) {
      const resolved = resolveStylePath(builtin.css);
      if (resolved) result.style = resolved;
    }
  }

  if (data && typeof data === "object" && data !== null) {
    const d = data as Record<string, unknown>;
    if (
      d.defaults &&
      typeof d.defaults === "object" &&
      !Array.isArray(d.defaults)
    ) {
      const routeCfg = (d.defaults as Record<string, unknown>)[route] as
        | Record<string, unknown>
        | undefined;
      if (routeCfg) {
        if (routeCfg.css && typeof routeCfg.css === "string") {
          const resolved = resolveStylePath(routeCfg.css);
          if (resolved) result.style = resolved;
        }
        if (routeCfg.pageSize && typeof routeCfg.pageSize === "string")
          result.pageSize = routeCfg.pageSize;
        if (typeof routeCfg.toc === "boolean") result.toc = routeCfg.toc;
        if (typeof routeCfg.numberSections === "boolean")
          result.numberSections = routeCfg.numberSections;
        if (routeCfg.metadataFile && typeof routeCfg.metadataFile === "string")
          result.metadataFile = routeCfg.metadataFile;
        if (routeCfg.wrap && typeof routeCfg.wrap === "string")
          result.wrap = routeCfg.wrap;
        if (routeCfg.extractMedia && typeof routeCfg.extractMedia === "string")
          result.extractMedia = routeCfg.extractMedia;
        if (routeCfg.referenceDoc && typeof routeCfg.referenceDoc === "string")
          result.referenceDoc = routeCfg.referenceDoc;
      }
    }
  }

  return result as any;
}
