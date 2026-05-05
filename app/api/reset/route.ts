import { NextResponse } from "next/server";
import { resetToDefaults } from "@/lib/reset/service";
import { ResetAuthorizationError } from "@/lib/reset/types";

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function asNullableString(value: unknown) {
  return typeof value === "string" && value.trim() ? value : null;
}

export async function POST(request: Request) {
  try {
    const body = asRecord(await request.json());
    const result = await resetToDefaults({
      rootPassword: asNullableString(body.rootPassword),
      confirmation: asNullableString(body.confirmation),
    });
    return NextResponse.json({ ok: true, result });
  } catch (error) {
    if (error instanceof ResetAuthorizationError) {
      return NextResponse.json(
        {
          error: "reset_confirmation_failed",
          message: "Enter the root password and exact confirmation text to reset defaults.",
        },
        { status: 403 },
      );
    }

    console.error(error);
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }
}
