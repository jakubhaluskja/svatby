import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

/** Odhlášení jedním klikem z poštovního klienta (List-Unsubscribe-Post). */
export async function POST(_: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!/^[A-Za-z0-9_-]{20,64}$/.test(token)) return new NextResponse(null, { status: 404 });
  await createAdminClient().from("households").update({ unsubscribed_at: new Date().toISOString() }).eq("token", token).is("unsubscribed_at", null);
  return new NextResponse(null, { status: 200 });
}
