import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { runEngine, toolIdBase } from "@/lib/engine";
import type { Txn, InventoryRow } from "@/types";

export async function POST(req: Request) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ ok: false, posted: 0, blocked: 0, errors: ["Not authenticated"], results: [] }, { status: 401 });
    }

    let body: { txns?: Txn[] };
    try {
      body = (await req.json()) as { txns?: Txn[] };
    } catch {
      return NextResponse.json({ ok: false, posted: 0, blocked: 0, errors: ["Invalid JSON request body"], results: [] }, { status: 400 });
    }

    if (!body || !Array.isArray(body.txns)) {
      return NextResponse.json({ ok: false, posted: 0, blocked: 0, errors: ["Missing or invalid 'txns' array in request body"], results: [] }, { status: 400 });
    }

    const txns = body.txns;
    if (txns.length === 0) {
      return NextResponse.json({ posted: 0, blocked: 0, results: [] });
    }

    const results: { id: string; ok: boolean; errors: string[]; warnings: string[]; txn_id?: string; rowKey?: string }[] = [];

    for (const txn of txns) {
      // Auto-generate the Tool ID for new inward tools per the nomenclature
      // standard, instead of requiring the person to type one.
      if (txn.type === "INWARD" && txn.newTool && !txn.id?.trim()) {
        const nt = txn.newTool;
        const base = toolIdBase(nt.typecode ?? nt.type, nt.dia ?? undefined, nt.length ?? undefined, nt.nameCode ?? nt.name);
        const { data: existing, error: masterErr } = await supabase
          .from("tool_master")
          .select("tool_id")
          .ilike("tool_id", `${base}%`);

        if (masterErr) {
          results.push({
            id: txn.id || "(new)",
            ok: false,
            errors: [`Database error looking up tool master: ${masterErr.message}`],
            warnings: [],
            rowKey: txn.rowKey,
          });
          continue;
        }

        const existingIds = (existing ?? []).map((r) => r.tool_id as string);
        let nn = 1;
        const taken = new Set(existingIds.map((e) => e.toUpperCase()));
        while (taken.has(`${base} ${String(nn).padStart(2, "0")}`.toUpperCase())) nn++;
        txn.id = `${base} ${String(nn).padStart(2, "0")}`;
      }

      const toolId = (txn.id ?? "").trim();
      const { data: inv, error: invErr } = await supabase
        .from("tool_inventory")
        .select("*")
        .eq("tool_id", toolId)
        .maybeSingle();

      if (invErr) {
        results.push({
          id: toolId,
          ok: false,
          errors: [`Database error fetching inventory for "${toolId}": ${invErr.message}`],
          warnings: [],
          rowKey: txn.rowKey,
        });
        continue;
      }

      const res = runEngine(txn, (inv as InventoryRow) ?? null);
      if (!res.ok || !res.delta) {
        results.push({ id: toolId, ok: false, errors: res.errors, warnings: res.warnings, rowKey: txn.rowKey });
        continue;
      }

      const d = res.delta;
      const { data: applied, error: rpcErr } = await supabase.rpc("apply_transaction", {
        p_tool_id: toolId,
        p_txn_type: txn.type,
        p_qty: Number(txn.qty),
        p_person: txn.person ?? user.email?.split("@")[0] ?? "",
        p_machine: txn.machine ?? "",
        p_tofrom: txn.tofrom ?? "",
        p_dc: txn.dc ?? "",
        p_condition: txn.condition ?? "",
        p_life: txn.life ?? null,
        p_remarks: res.remark ?? "",
        d_avail: d.avail,
        d_inuse: d.inuse,
        d_wregr: d.wregr,
        d_atregr: d.atregr,
        d_wscrap: d.wscrap,
        d_scrap: d.scrap,
        p_new_tool: txn.newTool
          ? {
              name: txn.newTool.name,
              type: txn.newTool.type,
              loc: txn.newTool.loc,
              typecode: txn.newTool.typecode ?? "",
              dia: txn.newTool.dia ?? "",
              length: txn.newTool.length ?? "",
            }
          : null,
        p_part_no: txn.part_no ?? null,
        p_work_order: txn.work_order ?? null,
        p_po_no: txn.po_no ?? null,
        p_brand: txn.brand ?? null,
        p_unit_price: txn.unit_price ?? null,
        p_regrind_cost: txn.regrind_cost ?? null,
        p_issued_by: txn.issued_by ?? null,
      });

      if (rpcErr) {
        results.push({ id: toolId, ok: false, errors: [`Transaction failed: ${rpcErr.message}`], warnings: res.warnings, rowKey: txn.rowKey });
      } else {
        results.push({
          id: toolId,
          ok: true,
          errors: [],
          warnings: res.warnings,
          txn_id: (applied as { txn_id: string })?.txn_id,
          rowKey: txn.rowKey,
        });
      }
    }

    const posted = results.filter((r) => r.ok).length;
    return NextResponse.json({ posted, blocked: results.length - posted, results });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ ok: false, posted: 0, blocked: 0, errors: [message], results: [] }, { status: 500 });
  }
}