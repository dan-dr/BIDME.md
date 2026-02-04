import { describe, test, expect, mock, beforeEach, afterEach } from "bun:test";
import { BidMeError, logError, withRetry, isRateLimited } from "../utils/error-handler.ts";
import type { BidMeErrorCode } from "../utils/error-handler.ts";

describe("BidMeError", () => {
  test("creates error with code and message", () => {
    const err = new BidMeError("something failed", "ISSUE_CREATE_FAILED");
    expect(err.message).toBe("something failed");
    expect(err.code).toBe("ISSUE_CREATE_FAILED");
    expect(err.name).toBe("BidMeError");
    expect(err.retryable).toBe(false);
    expect(err.context).toBeUndefined();
  });

  test("creates error with retryable flag", () => {
    const err = new BidMeError("rate limited", "RATE_LIMITED", { retryable: true });
    expect(err.retryable).toBe(true);
  });

  test("creates error with context", () => {
    const ctx = { issueNumber: 42, attempt: 2 };
    const err = new BidMeError("failed", "UNKNOWN", { context: ctx });
    expect(err.context).toEqual(ctx);
  });

  test("creates error with cause", () => {
    const cause = new Error("original");
    const err = new BidMeError("wrapped", "UNKNOWN", { cause });
    expect(err.cause).toBe(cause);
  });

  test("is instanceof Error", () => {
    const err = new BidMeError("test", "UNKNOWN");
    expect(err).toBeInstanceOf(Error);
    expect(err).toBeInstanceOf(BidMeError);
  });
});

describe("logError", () => {
  let originalError: typeof console.error;
  let errorCalls: unknown[][];

  beforeEach(() => {
    errorCalls = [];
    originalError = console.error;
    console.error = mock((...args: unknown[]) => {
      errorCalls.push(args);
    }) as typeof console.error;
  });

  afterEach(() => {
    console.error = originalError;
  });

  test("logs BidMeError with code and message", () => {
    const err = new BidMeError("test error", "ISSUE_CREATE_FAILED");
    logError(err, "test-context");
    expect(errorCalls.length).toBeGreaterThanOrEqual(1);
    const logLine = errorCalls[0]![0] as string;
    expect(logLine).toContain("[ERROR]");
    expect(logLine).toContain("[test-context]");
    expect(logLine).toContain("ISSUE_CREATE_FAILED");
    expect(logLine).toContain("test error");
  });

  test("logs BidMeError with context", () => {
    const err = new BidMeError("test", "UNKNOWN", { context: { foo: "bar" } });
    logError(err, "ctx");
    expect(errorCalls.length).toBeGreaterThanOrEqual(2);
    const contextLine = errorCalls[1]![0] as string;
    expect(contextLine).toContain("Context:");
  });

  test("logs BidMeError with cause", () => {
    const cause = new Error("root cause");
    const err = new BidMeError("wrapped", "UNKNOWN", { cause });
    logError(err, "ctx");
    expect(errorCalls.length).toBeGreaterThanOrEqual(2);
    const causeLine = errorCalls[1]![0] as string;
    expect(causeLine).toContain("Cause:");
  });

  test("logs plain Error", () => {
    const err = new Error("plain error");
    logError(err, "plain-ctx");
    expect(errorCalls.length).toBeGreaterThanOrEqual(1);
    const logLine = errorCalls[0]![0] as string;
    expect(logLine).toContain("[plain-ctx]");
    expect(logLine).toContain("plain error");
  });

  test("logs non-Error values", () => {
    logError("string error", "str-ctx");
    expect(errorCalls.length).toBeGreaterThanOrEqual(1);
    const logLine = errorCalls[0]![0] as string;
    expect(logLine).toContain("[str-ctx]");
  });
});

describe("withRetry", () => {
  test("returns result on first success", async () => {
    const fn = mock(() => Promise.resolve(42));
    const result = await withRetry(fn, 3);
    expect(result).toBe(42);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  test("retries on failure and succeeds", async () => {
    let callCount = 0;
    const fn = mock(() => {
      callCount++;
      if (callCount < 2) throw new Error("fail");
      return Promise.resolve("ok");
    });

    const result = await withRetry(fn, 3, { delayMs: 10 });
    expect(result).toBe("ok");
    expect(fn).toHaveBeenCalledTimes(2);
  });

  test("throws after max attempts exhausted", async () => {
    const fn = mock(() => Promise.reject(new Error("always fail")));
    await expect(withRetry(fn, 2, { delayMs: 10 })).rejects.toThrow("always fail");
    expect(fn).toHaveBeenCalledTimes(2);
  });

  test("calls onRetry callback on each retry", async () => {
    let callCount = 0;
    const fn = mock(() => {
      callCount++;
      if (callCount < 3) throw new Error(`fail-${callCount}`);
      return Promise.resolve("done");
    });

    const retryCalls: Array<{ attempt: number; error: unknown }> = [];
    const result = await withRetry(fn, 3, {
      delayMs: 10,
      onRetry: (attempt, error) => retryCalls.push({ attempt, error }),
    });

    expect(result).toBe("done");
    expect(retryCalls.length).toBe(2);
    expect(retryCalls[0]!.attempt).toBe(1);
    expect(retryCalls[1]!.attempt).toBe(2);
  });

  test("uses default maxAttempts of 2", async () => {
    const fn = mock(() => Promise.reject(new Error("fail")));
    await expect(withRetry(fn, undefined, { delayMs: 10 })).rejects.toThrow("fail");
    expect(fn).toHaveBeenCalledTimes(2);
  });

  test("single attempt with maxAttempts=1", async () => {
    const fn = mock(() => Promise.reject(new Error("once")));
    await expect(withRetry(fn, 1)).rejects.toThrow("once");
    expect(fn).toHaveBeenCalledTimes(1);
  });
});

describe("isRateLimited", () => {
  test("returns true for status 403", () => {
    const err = Object.assign(new Error("forbidden"), { status: 403 });
    expect(isRateLimited(err)).toBe(true);
  });

  test("returns true for status 429", () => {
    const err = Object.assign(new Error("too many"), { status: 429 });
    expect(isRateLimited(err)).toBe(true);
  });

  test("returns false for status 404", () => {
    const err = Object.assign(new Error("not found"), { status: 404 });
    expect(isRateLimited(err)).toBe(false);
  });

  test("returns false for plain Error", () => {
    expect(isRateLimited(new Error("plain"))).toBe(false);
  });

  test("returns false for non-Error", () => {
    expect(isRateLimited("string")).toBe(false);
    expect(isRateLimited(null)).toBe(false);
    expect(isRateLimited(undefined)).toBe(false);
  });
});
