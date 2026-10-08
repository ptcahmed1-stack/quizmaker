import { NextResponse } from "next/server";
import { startAttempt } from "@/lib/student";
import { startAttemptSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

export async function POST(req: Request, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  const parsed = startAttemptSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid request." }, { status: 400 });
  }
  try {
    const result = await startAttempt(code, parsed.data);
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
    return NextResponse.json(result.data, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    console.error("start attempt failed", err);
    return NextResponse.json({ error: "Could not start the quiz. Please try again." }, { status: 500 });
  }
}
