import { writeFile } from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";

const DEFAULT_USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36";

export function createRemoteImageRegex(): RegExp {
  return /!\[([^\]]*)\]\((https?:\/\/[^\s\)]+)\)/g;
}

export function hasRemoteImages(content: string): boolean {
  return createRemoteImageRegex().test(content);
}

function getExtFromContentType(contentType: string | null): string {
  if (!contentType) return "jpg";
  const type = contentType.toLowerCase().split(";")[0].trim();
  if (type.includes("jpeg") || type.includes("jpg")) return "jpg";
  if (type.includes("png")) return "png";
  if (type.includes("webp")) return "webp";
  if (type.includes("gif")) return "gif";
  if (type.includes("svg")) return "svg";
  return "jpg";
}

export async function downloadRemoteImage(
  url: string,
  destDir: string,
): Promise<string | null> {
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": DEFAULT_USER_AGENT,
        Accept: "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8",
      },
    });

    if (!res.ok) {
      return null;
    }

    const contentType = res.headers.get("content-type");
    // Ignore HTML error pages or non-image content
    if (contentType && !contentType.startsWith("image/")) {
      return null;
    }

    const buffer = await res.arrayBuffer();
    if (buffer.byteLength === 0) {
      return null;
    }

    const ext = getExtFromContentType(contentType);
    const hash = createHash("md5").update(url).digest("hex").slice(0, 12);
    const filename = `remote_${hash}.${ext}`;
    const filePath = path.join(destDir, filename);

    await writeFile(filePath, Buffer.from(buffer));
    return filePath;
  } catch {
    return null;
  }
}

export async function preprocessRemoteImages(
  content: string,
  cacheDir: string,
): Promise<string> {
  const matches = [...content.matchAll(createRemoteImageRegex())];
  if (matches.length === 0) return content;

  // Deduplicate URLs to avoid downloading the same image multiple times
  const urlMap = new Map<string, string>();

  for (const match of matches) {
    const url = match[2];
    if (!urlMap.has(url)) {
      const localPath = await downloadRemoteImage(url, cacheDir);
      if (localPath) {
        urlMap.set(url, localPath);
      }
    }
  }

  if (urlMap.size === 0) return content;

  return content.replace(createRemoteImageRegex(), (fullMatch, alt, url) => {
    const localPath = urlMap.get(url);
    if (localPath) {
      return `![${alt}](${localPath})`;
    }
    return fullMatch;
  });
}
