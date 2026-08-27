import path from "node:path";

export interface ResolvedDeckInfo {
  masterOutputName: string;
  items: {
    inputPath: string;
    deckName: string;
  }[];
}

export function sanitizeDeckFileName(deckName: string): string {
  return deckName
    .replace(/::/g, "__")
    .replace(/[/\\?%*:|"<>]/g, "_")
    .trim();
}

export function resolveDeckAndOutputNames(
  rawInputPaths: string[],
  customDeckName?: string,
): ResolvedDeckInfo {
  if (rawInputPaths.length === 0) {
    throw new Error("Missing input paths.");
  }

  const isMultiple = rawInputPaths.length > 1;
  const firstNormalized = path.normalize(rawInputPaths[0]);
  const firstBaseName = path.basename(firstNormalized, path.extname(firstNormalized));
  const firstPathParts = firstNormalized.split(path.sep).filter(Boolean);
  const hasParentFolder = firstPathParts.length >= 2;
  const parentFolder = hasParentFolder ? firstPathParts[firstPathParts.length - 2] : null;

  const allShareSameParentFolder =
    hasParentFolder &&
    rawInputPaths.every((p) => {
      const parts = path.normalize(p).split(path.sep).filter(Boolean);
      return parts.length >= 2 && parts[parts.length - 2] === parentFolder;
    });

  let masterOutputName = firstBaseName;

  if (customDeckName) {
    masterOutputName = sanitizeDeckFileName(customDeckName);
  } else if (isMultiple) {
    if (allShareSameParentFolder && parentFolder) {
      masterOutputName = parentFolder;
    } else {
      masterOutputName = `${firstBaseName}_combined`;
    }
  }

  const items = rawInputPaths.map((inputPath) => {
    const normalizedPath = path.normalize(inputPath);
    const fileBaseName = path.basename(normalizedPath, path.extname(normalizedPath));
    const pathParts = normalizedPath.split(path.sep).filter(Boolean);

    let deckName = fileBaseName;
    if (customDeckName) {
      if (isMultiple) {
        deckName = `${customDeckName}::${fileBaseName}`;
      } else {
        deckName = customDeckName;
      }
    } else {
      if (pathParts.length >= 2) {
        const folderParts = pathParts.slice(0, -1);
        deckName = `${folderParts.join("::")}::${fileBaseName}`;
      }
    }

    return {
      inputPath,
      deckName,
    };
  });

  return {
    masterOutputName,
    items,
  };
}
