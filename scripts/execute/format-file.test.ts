import { describe, expect, test } from "bun:test";

import {
  PRETTIER_ENTRYPOINT_ENV,
  resolvePrettierModuleSpecifier,
} from "./format-file";

describe("resolvePrettierModuleSpecifier", () => {
  test("falls back to bare prettier import without an injected entrypoint", () => {
    expect(resolvePrettierModuleSpecifier({})).toBe("prettier");
  });

  test("converts an injected filesystem path into a file URL", () => {
    expect(
      resolvePrettierModuleSpecifier({
        [PRETTIER_ENTRYPOINT_ENV]:
          "/nix/store/example-prettier/lib/node_modules/prettier/index.mjs",
      }),
    ).toBe(
      "file:///nix/store/example-prettier/lib/node_modules/prettier/index.mjs",
    );
  });
});
