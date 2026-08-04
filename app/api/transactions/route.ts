import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { runEngine } from "@/lib/engine";
import type { Txn, InventoryRow } from "@/types";

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ ok: false, errors: ["Not authenticated"] }, { status: 401 });

  const body = (await req.json()) as { txns: Txn[] };
  const txns = body.txns ?? [];
  const results: { id: string; ok: boolean; errors: string[]; warnings: string[]; txn_id?: string }[] = [];

  for (const txn of txns) {
    const { data: inv } = await supabase
      .from("tool_inventory").select("*").eq("tool_id", txn.id).maybeSingle();

    const res = runEngine(txn, (inv as InventoryRow) ?? null);
    if (!res.ok || !res.delta) {
      results.push({ id: txn.id, ok: false, errors: res.errors, warnings: res.warnings });
      continue;
    }
    const d = res.delta;
    const { data: applied, error } = await supabase.rpc("apply_transaction", {
      p_tool_id: txn.id, p_txn_type: txn.type, p_qty: Number(txn.qty),
      p_person: txn.person ?? user.email?.split("@")[0] ?? "", p_machine: txn.machine ?? "",
      p_tofrom: txn.tofrom ?? "", p_dc: txn.dc ?? "", p_condition: txn.condition ?? "",
      p_life: txn.life ?? null, p_remarks: res.remark ?? "",
      d_avail: d.avail, d_inuse: d.inuse, d_wregr: d.wregr,
      d_atregr: d.atregr, d_wscrap: d.wscrap, d_scrap: d.scrap,
      p_new_tool: txn.newTool ?? null,
    });
    if (error) results.push({ id: txn.id, ok: false, errors: [error.message], warnings: res.warnings });
    else results.push({ id: txn.id, ok: true, errors: [], warnings: res.warnings, txn_id: (applied as { txn_id: string }).txn_id });
  }

  const posted = results.filter((r) => r.ok).length;
  return NextResponse.json({ posted, blocked: results.length - posted, results });
}