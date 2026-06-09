import { NextResponse } from "next/server";

export async function GET() {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  return NextResponse.json({
    NEXT_PUBLIC_APP_URL: appUrl,
    redirect_uri: `${appUrl}/api/gtm/callback`,
  });
}
