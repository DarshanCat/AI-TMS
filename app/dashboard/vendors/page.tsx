import { createClient } from "@/lib/supabase/server";
import VendorsTable, { type VendorRow } from "./VendorsTable";
import VendorScorecards, { type Scorecard } from "./VendorScorecards";

const SAMPLE: VendorRow[] = [
  { tool_id: "CR LC16 01", name: "BRAZED COATED LC16 R", type: "Cavity", vendor: "Sri Ram Cutting Tools",
    dispatched_at: "2026-07-14 10:20:00", dc: "DC-1187", qty: 1 },
  { tool_id: "SC 0880 040 02", name: "DIA 8.8x5D SC DRILL PA140", type: "Solid Carbide", vendor: "Excellence",
    dispatched_at: "2026-07-16 14:09:28", dc: "DC1133", qty: 1 },
];

const SAMPLE_SCORECARDS: Scorecard[] = [
  { vendor: "Sri Ram Cutting Tools", cycles: 12, avgTurnaroundDays: 4.2, totalCost: 8600, successRate: 0.92 },
  { vendor: "Excellence", cycles: 7, avgTurnaroundDays: 6.1, totalCost: 5100, successRate: 0.86 },
];

interface RawLedgerEvent {
  id: number; ts: string; tool_id: string; txn_type: string;
  tofrom: string | null; regrind_cost: number | null;
}

function daysBetween(a: string, b: string): number | null {
  const da = new Date(a.replace(" ", "T"));
  const db = new Date(b.replace(" ", "T"));
  if (isNaN(da.getTime()) || isNaN(db.getTime())) return null;
  return (db.getTime() - da.getTime()) / 86400000;
}

// A "regrind cycle" is a DISPATCH matched to the next RECEIPT for the same
// tool. Vendor identity, turnaround, and cost all fall out of the ledger —
// no separate vendor master needed. A cycle is marked unsuccessful only when
// the tool's very next event after that RECEIPT is a SCRAP within 30 days
// (the regrind didn't take); anything else counts as a successful cycle.
function computeScorecards(events: RawLedgerEvent[]): Scorecard[] {
  const byTool = new Map<string, RawLedgerEvent[]>();
  for (const e of events) {
    const list = byTool.get(e.tool_id) ?? [];
    list.push(e);
    byTool.set(e.tool_id, list);
  }

  interface Cycle { vendor: string; turnaroundDays: number | null; cost: number; success: boolean; }
  const cycles: Cycle[] = [];

  for (const list of byTool.values()) {
    list.sort((a, b) => a.id - b.id);
    let openDispatch: RawLedgerEvent | null = null;
    for (let i = 0; i < list.length; i++) {
      const ev = list[i];
      if (ev.txn_type === "DISPATCH") {
        openDispatch = ev;
      } else if (ev.txn_type === "RECEIPT" && openDispatch) {
        const vendor = ev.tofrom || openDispatch.tofrom || "Unknown vendor";
        const turnaroundDays = daysBetween(openDispatch.ts, ev.ts);
        const next = list[i + 1];
        const failedShortly =
          !!next && next.txn_type === "SCRAP" &&
          (daysBetween(ev.ts, next.ts) ?? 9999) <= 30;
        cycles.push({ vendor, turnaroundDays, cost: ev.regrind_cost ?? 0, success: !failedShortly });
        openDispatch = null;
      }
    }
  }

  const byVendor = new Map<string, Cycle[]>();
  for (const c of cycles) byVendor.set(c.vendor, [...(byVendor.get(c.vendor) ?? []), c]);

  return Array.from(byVendor.entries())
    .map(([vendor, list]) => {
      const withTurnaround = list.filter((c) => c.turnaroundDays !== null);
      const avgTurnaroundDays = withTurnaround.length
        ? withTurnaround.reduce((a, c) => a + (c.turnaroundDays as number), 0) / withTurnaround.length
        : null;
      return {
        vendor,
        cycles: list.length,
        avgTurnaroundDays,
        totalCost: list.reduce((a, c) => a + c.cost, 0),
        successRate: list.filter((c) => c.success).length / list.length,
      };
    })
    .sort((a, b) => b.cycles - a.cycles);
}

export default async function VendorsPage() {
  const supabase = await createClient();

  const { data: ledgerEvents } = await supabase
    .from("tool_ledger")
    .select("id,ts,tool_id,txn_type,tofrom,regrind_cost")
    .in("txn_type", ["DISPATCH", "RECEIPT", "SCRAP"])
    .order("id", { ascending: true })
    .limit(20000);

  const scorecardsLive = (ledgerEvents ?? []).length > 0;
  const scorecards = scorecardsLive
    ? computeScorecards(ledgerEvents as RawLedgerEvent[])
    : SAMPLE_SCORECARDS;

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
        Regrind partners only — subcontract job-work (AMS, MAKINO, etc.) is tracked as a tool location
        on Issue/Return and doesn&apos;t appear here.
      </p>

      <div className="panel" style={{ marginBottom: 20 }}>
        <div className="panel-head">
          Vendor scorecards
          <span className="muted" style={{ fontWeight: 400, marginLeft: 8, fontSize: 12 }}>
            turnaround, cost, and success rate — computed from completed regrind cycles
          </span>
        </div>
        <VendorScorecards rows={scorecards} live={scorecardsLive} />
      </div>

      <p className="page-sub" style={{ marginTop: 0 }}>
        {live
          ? `${rows.length.toLocaleString()} tools currently at ${vendorCount} vendor${vendorCount === 1 ? "" : "s"} · regrind in progress.`
          : "Sample rows — the live view appears once tools are dispatched to a vendor."}
      </p>
      <VendorsTable rows={view} live={live} />
    </div>
  );
}