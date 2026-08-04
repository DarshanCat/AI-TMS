import { NextResponse } from "next/server";
export async function GET() {
  return NextResponse.json({
    url: process.env.NEXT_PUBLIC_SUPABASE_URL ?? "MISSING",
    anonStartsWith: (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "MISSING").slice(0, 8),
  });
}