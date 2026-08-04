 import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { toolIdBase } from "@/lib/engine";

export async function GET(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const typecode = searchParams.get("typecode") ?? "";
  const dia = searchParams.get("dia");
  const length = searchParams.get("length");
  const namecode = searchParams.get("namecode") ?? "";

  if (!typecode.trim()) return NextResponse.json({ error: "Type Code is required" }, { status: 400 });

  const base = toolIdBase(typecode, dia ? Number(dia) : undefined, length ? Number(length) : undefined, namecode);
  const { data: existing } = await supabase
    .from("tool_master")
    .select("tool_id")
    .ilike("tool_id", `${base}%`);

  const taken = new Set((existing ?? []).map((r) => (r.tool_id as string).toUpperCase()));
  let nn = 1;
  while (taken.has(`${base} ${String(nn).padStart(2, "0")}`.toUpperCase())) nn++;
  const id = `${base} ${String(nn).padStart(2, "0")}`;

  return NextResponse.json({ id });
}