import { getAuthUrl } from "@/lib/gtm";
import { NextResponse } from "next/server";

export async function GET() {
  const url = getAuthUrl();
  return NextResponse.redirect(url);
}
