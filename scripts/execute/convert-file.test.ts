import { describe, expect, test } from "bun:test";

import {
  buildSpinnerLabel,
  clearSpinnerLine,
  renderSpinnerFrame,
  shouldEnableSpinner,
} from "./convert-file";

describe("buildSpinnerLabel", () => {
  test("renders a minimal route label", () => {
    expect(buildSpinnerLabel("mp4:mp3")).toBe("Converting mp4 -> mp3...");
  });
});

describe("terminal spinner helpers", () => {
  test("renders a spinner frame on one line", () => {
    expect(renderSpinnerFrame(0, "Converting mp4 -> mp3...")).toBe(
      "\r\x1b[2K\x1b[90m-\x1b[0m Converting mp4 -> mp3...",
    );
  });

  test("clears the active terminal line", () => {
    expect(clearSpinnerLine()).toBe("\r\x1b[2K");
  });
});

describe("shouldEnableSpinner", () => {
  test("disables spinner for dry runs", () => {
    expect(shouldEnableSpinner({ dryRun: true, isTTY: true })).toBe(false);
  });

  test("disables spinner for non-tty output", () => {
    expect(shouldEnableSpinner({ dryRun: false, isTTY: false })).toBe(false);
  });

  test("enables spinner for tty conversions", () => {
    expect(shouldEnableSpinner({ dryRun: false, isTTY: true })).toBe(true);
  });
});
