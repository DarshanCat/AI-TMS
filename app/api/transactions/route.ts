import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { runEngine, toolIdBase } from "@/lib/engine";
import type { Txn, InventoryRow } from "@/types";

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ ok: false, errors: ["Not authenticated"] }, { status: 401 });

  const body = (await req.json()) as { txns: Txn[] };
  const txns = body.txns ?? [];
  const results: { id: string; ok: boolean; errors: string[]; warnings: string[]; txn_id?: string; rowKey?: string }[] = [];

  for (const txn of txns) {
    // Auto-generate the Tool ID for new inward tools per the nomenclature
    // standard, instead of requiring the person to type one.
    if (txn.type === "INWARD" && txn.newTool && !txn.id.trim()) {
      const nt = txn.newTool;
      const base = toolIdBase(nt.typecode ?? nt.type, nt.dia ?? undefined, nt.length ?? undefined, nt.nameCode ?? nt.name);
      const { data: existing } = await supabase
        .from("tool_master")
        .select("tool_id")
        .ilike("tool_id", `${base}%`);
      const existingIds = (existing ?? []).map((r) => r.tool_id as string);
      let nn = 1;
      const taken = new Set(existingIds.map((e) => e.toUpperCase()));
      while (taken.has(`${base} ${String(nn).padStart(2, "0")}`.toUpperCase())) nn++;
      txn.id = `${base} ${String(nn).padStart(2, "0")}`;
    }

    const { data: inv } = await supabase
      .from("tool_inventory").select("*").eq("tool_id", txn.id).maybeSingle();

    const res = runEngine(txn, (inv as InventoryRow) ?? null);
    if (!res.ok || !res.delta) {
      results.push({ id: txn.id, ok: false, errors: res.errors, warnings: res.warnings, rowKey: txn.rowKey });
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
      p_new_tool: txn.newTool ? { name: txn.newTool.name, type: txn.newTool.type, loc: txn.newTool.loc } : null,
      p_part_no: txn.part_no ?? null,
      p_work_order: txn.work_order ?? null,
      p_po_no: txn.po_no ?? null,
      p_brand: txn.brand ?? null,
      p_unit_price: txn.unit_price ?? null,
      p_regrind_cost: txn.regrind_cost ?? null,
      p_issued_by: txn.issued_by ?? null,
    });
    if (error) results.push({ id: txn.id, ok: false, errors: [error.message], warnings: res.warnings, rowKey: txn.rowKey });
    else results.push({ id: txn.id, ok: true, errors: [], warnings: res.warnings, txn_id: (applied as { txn_id: string }).txn_id, rowKey: txn.rowKey });
  }

  const posted = results.filter((r) => r.ok).length;
  return NextResponse.json({ posted, blocked: results.length - posted, results });
}