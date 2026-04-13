import { NextResponse } from "next/server";
import { precacheCurrentSeason } from "@/lib/precache";

// Allow up to 5 minutes on Vercel Pro/Enterprise (cron jobs support 300s)
export const maxDuration = 300;

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;

  if (secret) {
    const auth = request.headers.get("authorization");
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  try {
    const result = await precacheCurrentSeason();
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
