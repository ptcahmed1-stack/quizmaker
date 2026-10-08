import { NextResponse } from "next/server";
import { submitAttempt } from "@/lib/student";
import { submitAttemptSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

export async function POST(req: Request, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  const parsed = submitAttemptSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Your answers could not be read. Please try again." }, { status: 400 });
  }
  try {
    const result = await submitAttempt(code, parsed.data);
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
    return NextResponse.json(result.data, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    console.error("submit attempt failed", err);
    return NextResponse.json({ error: "Could not save your submission. Please try again." }, { status: 500 });
  }
}
