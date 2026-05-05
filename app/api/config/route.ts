import { NextResponse } from "next/server";
import {
  getPublicOperatorConfig,
  OperatorConfigAuthorizationError,
  OperatorConfigValidationError,
  updateOperatorBaseUrl,
} from "@/lib/operator/config";

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function asNullableString(value: unknown) {
  return typeof value === "string" ? value : null;
}

export async function GET(request: Request) {
  return NextResponse.json(await getPublicOperatorConfig(request));
}

export async function POST(request: Request) {
  try {
    const body = asRecord(await request.json());
    await updateOperatorBaseUrl({
      rootPassword: asNullableString(body.rootPassword),
      baseUrl: asNullableString(body.baseUrl),
    });
    return NextResponse.json({ ok: true, config: await getPublicOperatorConfig(request) });
  } catch (error) {
    if (error instanceof OperatorConfigAuthorizationError) {
      return NextResponse.json(
        {
          error: "invalid_root_password",
          message: "Enter the root password to change the base URL override.",
        },
        { status: 403 },
      );
    }
    if (error instanceof OperatorConfigValidationError) {
      return NextResponse.json(
        {
          error: "validation_failed",
          message: error.message,
          fieldErrors: error.fieldErrors,
        },
        { status: 400 },
      );
    }
    console.error(error);
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }
}
