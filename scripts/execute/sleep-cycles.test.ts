import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { addMinutes, formatTime, parseTime } from "./sleep-cycles.ts";

it("parseTime - parses valid time string", () => {
  const result = parseTime("23:00");
  assert.strictEqual(result.getHours(), 23);
  assert.strictEqual(result.getMinutes(), 0);
  assert.strictEqual(result.getSeconds(), 0);
});

it("parseTime - parses midnight", () => {
  const result = parseTime("00:00");
  assert.strictEqual(result.getHours(), 0);
  assert.strictEqual(result.getMinutes(), 0);
});

it("parseTime - parses time with leading zeros", () => {
  const result = parseTime("07:05");
  assert.strictEqual(result.getHours(), 7);
  assert.strictEqual(result.getMinutes(), 5);
});

it("parseTime - rejects invalid hour (24)", () => {
  assert.throws(() => parseTime("24:00"), Error, "Invalid time format");
});

it("parseTime - rejects invalid minute (60)", () => {
  assert.throws(() => parseTime("12:60"), Error, "Invalid time format");
});

it("parseTime - rejects negative hour", () => {
  assert.throws(() => parseTime("-1:00"), Error, "Invalid time format");
});

it("parseTime - rejects negative minute", () => {
  assert.throws(() => parseTime("12:-5"), Error, "Invalid time format");
});

it("parseTime - rejects non-numeric input", () => {
  assert.throws(() => parseTime("abc"), Error, "Invalid time format");
});

it("parseTime - rejects empty string", () => {
  assert.throws(() => parseTime(""), Error, "Invalid time format");
});

it("addMinutes - adds positive minutes", () => {
  const date = new Date(2024, 0, 1, 10, 0, 0);
  const result = addMinutes(date, 90);
  assert.strictEqual(result.getHours(), 11);
  assert.strictEqual(result.getMinutes(), 30);
});

it("addMinutes - subtracts minutes", () => {
  const date = new Date(2024, 0, 1, 10, 0, 0);
  const result = addMinutes(date, -30);
  assert.strictEqual(result.getHours(), 9);
  assert.strictEqual(result.getMinutes(), 30);
});

it("addMinutes - zero minutes returns same time", () => {
  const date = new Date(2024, 0, 1, 10, 0, 0);
  const result = addMinutes(date, 0);
  assert.strictEqual(result.getTime(), date.getTime());
});

it("addMinutes - wraps to next day", () => {
  const date = new Date(2024, 0, 1, 23, 0, 0);
  const result = addMinutes(date, 90);
  assert.strictEqual(result.getDate(), 2);
  assert.strictEqual(result.getHours(), 0);
  assert.strictEqual(result.getMinutes(), 30);
});

it("formatTime - formats time as HH:MM", () => {
  const date = new Date(2024, 0, 1, 9, 5, 0);
  assert.strictEqual(formatTime(date), "09:05");
});

it("formatTime - formats noon correctly", () => {
  const date = new Date(2024, 0, 1, 12, 0, 0);
  assert.strictEqual(formatTime(date), "12:00");
});

it("formatTime - formats midnight correctly", () => {
  const date = new Date(2024, 0, 1, 0, 0, 0);
  assert.strictEqual(formatTime(date), "00:00");
});
