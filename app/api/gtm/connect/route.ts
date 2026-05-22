import { getAuthUrl } from "@/lib/gtm";
import { getSession } from "@/lib/session";
import { NextResponse } from "next/server";

export async function GET() {
  const session = await getSession();
  if (!session?.userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const url = getAuthUrl();
  return NextResponse.redirect(url);
}
