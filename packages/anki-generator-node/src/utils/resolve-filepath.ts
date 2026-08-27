import path from "node:path";
import os from "node:os";

export default function getFileData(inputPath: string) {
  let resolvedPath;

  // 1. Fallback if no path was provided
  if (!inputPath) {
    console.log("Please add file input.");
    process.exit(-1);
  }
  // 2. Handle home directory expansion (~/)
  else if (inputPath.startsWith("~")) {
    resolvedPath = path.join(os.homedir(), inputPath.slice(1));
  }
  // 3. Handle absolute or relative paths
  else {
    resolvedPath = path.isAbsolute(inputPath)
      ? path.normalize(inputPath)
      : path.resolve(process.cwd(), inputPath);
  }

  // Extract just the file name (e.g., "neovim.json") from the final path
  const fileName = path.basename(resolvedPath);

  return {
    fileName: fileName,
    jsonPath: resolvedPath,
  };
}
