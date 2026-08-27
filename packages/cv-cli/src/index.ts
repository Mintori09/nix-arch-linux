#!/usr/bin/env tsx
import { run } from "./cv.ts";
import { isMain, COLORS } from "./utils.ts";
import { CliError, CommandExecutionError } from "./errors.ts";

if (isMain(import.meta.url)) {
  (async () => {
    try {
      await run();
    } catch (err) {
      if (err instanceof CommandExecutionError) {
        console.error(`\n${COLORS.RED}Conversion failed:${COLORS.NC}`);
        console.error(
          `${COLORS.YELLOW}Command:${COLORS.NC} ${err.command}\n${COLORS.YELLOW}Exit code:${COLORS.NC} ${err.exitCode}\n${COLORS.YELLOW}stderr:${COLORS.NC}\n${err.stderr}`,
        );
        process.exit(1);
      }
      if (err instanceof CliError) {
        console.error(err.message);
        process.exit(err.exitCode);
      }
      console.error(`\n${COLORS.RED}Conversion failed:${COLORS.NC}`, err);
      process.exit(1);
    }
  })();
}
