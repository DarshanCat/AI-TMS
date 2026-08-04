import { createClient } from "@/lib/supabase/server";
import VendorsTable, { type VendorRow } from "./VendorsTable";

const SAMPLE: VendorRow[] = [
  { tool_id: "CR LC16 01", name: "BRAZED COATED LC16 R", type: "Cavity", vendor: "Sri Ram Cutting Tools",
    dispatched_at: "2026-07-14 10:20:00", dc: "DC-1187", qty: 1 },
  { tool_id: "SC 0880 040 02", name: "DIA 8.8x5D SC DRILL PA140", type: "Solid Carbide", vendor: "Excellence",
    dispatched_at: "2026-07-16 14:09:28", dc: "DC1133", qty: 1 },
];

export default async function VendorsPage() {
  const supabase = await createClient();

  // At-vendor = current tool_inventory rows sitting in atregr, joined to the
  // most recent DISPATCH ledger entry for when/DC.
  const { data: inv } = await supabase
    .from("tool_inventory")
    .select("tool_id,name,type,loc,atregr")
    .gt("atregr", 0)
    .order("loc", { ascending: true })
    .limit(2000);

  const invRows = inv ?? [];
  let rows: VendorRow[] = [];
  const live = invRows.length > 0;

  if (live) {
    const ids = invRows.map((r) => r.tool_id);
    const { data: ledger } = await supabase
      .from("tool_ledger")
      .select("tool_id,ts,qty,dc,tofrom")
      .in("tool_id", ids)
      .eq("txn_type", "DISPATCH")
      .order("ts", { ascending: false });

    const lastDispatchByTool = new Map<string, { ts: string; qty: number; dc: string | null; tofrom: string | null }>();
    for (const l of ledger ?? []) {
      if (!lastDispatchByTool.has(l.tool_id)) lastDispatchByTool.set(l.tool_id, l);
    }

    rows = invRows.map((r) => {
      const last = lastDispatchByTool.get(r.tool_id);
      return {
        tool_id: r.tool_id,
        name: r.name,
        type: r.type,
        vendor: last?.tofrom || r.loc || "Unknown vendor",
        dispatched_at: last?.ts ?? "—",
        dc: last?.dc ?? null,
        qty: last?.qty ?? r.atregr,
      };
    });
  }

  const view = live ? rows : SAMPLE;
  const vendorCount = new Set(view.map((r) => r.vendor)).size;

  return (
    <div>
      <h1 className="page-title">Vendors</h1>
      <p className="page-sub">
        {live
          ? `${rows.length.toLocaleString()} tools at ${vendorCount} vendor${vendorCount === 1 ? "" : "s"} · regrind in progress.`
          : "Sample rows — the live view appears once tools are dispatched to a vendor."}
      </p>
      <VendorsTable rows={view} live={live} />
    </div>
  );
}