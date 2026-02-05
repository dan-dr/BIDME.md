export type BidMeErrorCode =
  | "CONFIG_MISSING"
  | "CONFIG_INVALID"
  | "ISSUE_CREATE_FAILED"
  | "ISSUE_UPDATE_FAILED"
  | "ISSUE_CLOSE_FAILED"
  | "PIN_FAILED"
  | "UNPIN_FAILED"
  | "COMMENT_FETCH_FAILED"
  | "COMMENT_NOT_FOUND"
  | "REACTION_FETCH_FAILED"
  | "BID_PARSE_FAILED"
  | "BID_VALIDATION_FAILED"
  | "RATE_LIMITED"
  | "README_UPDATE_FAILED"
  | "PAYMENT_FAILED"
  | "PERIOD_DATA_MISSING"
  | "PERIOD_DATA_INVALID"
  | "CONCURRENT_WRITE"
  | "UNKNOWN";

export class BidMeError extends Error {
  code: BidMeErrorCode;
  context?: Record<string, unknown>;
  retryable: boolean;

  constructor(
    message: string,
    code: BidMeErrorCode,
    options?: { retryable?: boolean; context?: Record<string, unknown>; cause?: unknown },
  ) {
    super(message, { cause: options?.cause });
    this.name = "BidMeError";
    this.code = code;
    this.retryable = options?.retryable ?? false;
    this.context = options?.context;
  }
}

export function logError(error: unknown, context: string): void {
  const timestamp = new Date().toISOString();
  const prefix = `[${timestamp}] [ERROR] [${context}]`;

  if (error instanceof BidMeError) {
    console.error(`${prefix} ${error.code}: ${error.message}`);
    if (error.context) {
      console.error(`  Context:`, JSON.stringify(error.context));
    }
    if (error.cause) {
      console.error(`  Cause:`, error.cause);
    }
  } else if (error instanceof Error) {
    console.error(`${prefix} ${error.message}`);
    if (error.cause) {
      console.error(`  Cause:`, error.cause);
    }
  } else {
    console.error(`${prefix}`, error);
  }
}

export async function withRetry<T>(
  fn: () => Promise<T>,
  maxAttempts: number = 2,
  options?: { delayMs?: number; onRetry?: (attempt: number, error: unknown) => void },
): Promise<T> {
  const delayMs = options?.delayMs ?? 1000;
  let lastError: unknown;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (attempt < maxAttempts) {
        options?.onRetry?.(attempt, error);
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
    }
  }

  throw lastError;
}

export function isRateLimited(error: unknown): boolean {
  if (error instanceof Error && "status" in error) {
    return (error as { status: number }).status === 403 || (error as { status: number }).status === 429;
  }
  return false;
}
