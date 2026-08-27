import fs from "node:fs";
import path from "node:path";

export interface WatcherHandle {
  stop: () => void;
}

export function watchFiles(
  filePaths: string[],
  onChange: (changedPath: string) => void | Promise<void>,
  debounceMs = 300,
): WatcherHandle {
  const watchers: fs.FSWatcher[] = [];
  let timer: NodeJS.Timeout | null = null;
  const pendingChanges = new Set<string>();

  const trigger = (targetPath: string) => {
    pendingChanges.add(targetPath);
    if (timer) clearTimeout(timer);
    timer = setTimeout(async () => {
      const files = Array.from(pendingChanges);
      pendingChanges.clear();
      for (const file of files) {
        try {
          await onChange(file);
        } catch (err) {
          console.error(`Error in file watch callback for ${file}:`, err);
        }
      }
    }, debounceMs);
  };

  for (const filePath of filePaths) {
    if (!fs.existsSync(filePath)) continue;
    try {
      const watcher = fs.watch(filePath, (_eventType) => {
        trigger(filePath);
      });
      watchers.push(watcher);
    } catch (err) {
      console.warn(`Could not watch file ${filePath}:`, err);
    }
  }

  return {
    stop: () => {
      if (timer) clearTimeout(timer);
      watchers.forEach((w) => w.close());
    },
  };
}
