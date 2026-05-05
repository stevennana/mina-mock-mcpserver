import assert from "node:assert/strict";
import test from "node:test";
import { getBootstrapStatus, normalizeLogLevel } from "@/lib/bootstrap-status";

test("normalizeLogLevel accepts supported operator log levels", () => {
  assert.equal(normalizeLogLevel("trace"), "trace");
  assert.equal(normalizeLogLevel("debug"), "debug");
  assert.equal(normalizeLogLevel("info"), "info");
  assert.equal(normalizeLogLevel("warn"), "warn");
  assert.equal(normalizeLogLevel("error"), "error");
});

test("normalizeLogLevel defaults invalid input to info", () => {
  assert.equal(normalizeLogLevel(undefined), "info");
  assert.equal(normalizeLogLevel("verbose"), "info");
});

test("getBootstrapStatus reports prepared foundation state", () => {
  assert.equal(getBootstrapStatus().runtimeState, "prepared");
});
