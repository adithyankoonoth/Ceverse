import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { AppError, isAppError, RateLimitError } from "@/domain/errors";
import { logger } from "@/lib/logger";

export type ApiSuccessBody<T> = {
  ok: true;
  data: T;
};

export type ApiErrorBody = {
  ok: false;
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
};

export function jsonOk<T>(data: T, init?: ResponseInit): NextResponse<ApiSuccessBody<T>> {
  return NextResponse.json({ ok: true, data }, { status: 200, ...init });
}

export function jsonCreated<T>(data: T, init?: ResponseInit): NextResponse<ApiSuccessBody<T>> {
  return NextResponse.json({ ok: true, data }, { status: 201, ...init });
}

export function jsonError(
  error: unknown,
  fallbackMessage = "Internal server error",
): NextResponse<ApiErrorBody> {
  if (error instanceof ZodError) {
    return NextResponse.json(
      {
        ok: false,
        error: {
          code: "VALIDATION",
          message: "Validation failed",
          details: error.flatten(),
        },
      },
      { status: 400 },
    );
  }

  if (isAppError(error)) {
    const headers: HeadersInit = {};
    if (error instanceof RateLimitError) {
      headers["Retry-After"] = String(error.retryAfterSeconds);
    }
    return NextResponse.json(
      {
        ok: false,
        error: {
          code: error.code,
          message: error.message,
          details: error.details,
        },
      },
      { status: error.status, headers },
    );
  }

  logger.error("unhandled_api_error", {
    error: error instanceof Error ? error.message : String(error),
    stack: error instanceof Error ? error.stack : undefined,
  });

  return NextResponse.json(
    {
      ok: false,
      error: {
        code: "INTERNAL",
        message: fallbackMessage,
      },
    },
    { status: 500 },
  );
}

export function assertNever(value: never): never {
  throw new AppError(`Unexpected value: ${String(value)}`, {
    code: "INTERNAL",
    status: 500,
  });
}
