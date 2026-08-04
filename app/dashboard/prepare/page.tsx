import { createClient } from "@/lib/supabase/server";
import PrepareActions, { type PrepRow } from "./PrepareActions";

interface InvRow { tool_id: string; name: string | null; loc: string | null; inuse: number; atregr: number; wregr: number; }
interface LedgerLite {
  tool_id: string; txn_type: string; ts: string;
  person: string | null; machine: string | null; tofrom: string | null; issued_by: string | null;
}

function latestByTool(events: LedgerLite[], type: string): Map<string, LedgerLite> {
  const m = new Map<string, LedgerLite>();
  for (const e of events) {
    if (e.txn_type !== type) continue;
    const prev = m.get(e.tool_id);
    if (!prev || new Date(e.ts) > new Date(prev.ts)) m.set(e.tool_id, e);
  }
  return m;
}

export default async function PreparePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const person = user?.email?.split("@")[0] ?? "";

  const { data: inv } = await supabase
    .from("tool_inventory")
    .select("tool_id,name,loc,inuse,atregr,wregr")
    .or("inuse.gt.0,atregr.gt.0,wregr.gt.0")
    .limit(3000);

  const rows = (inv as InvRow[] | null) ?? [];
  const inUseRows = rows.filter((r) => r.inuse > 0);
  const atVendorRows = rows.filter((r) => r.atregr > 0);
  const waitingRows = rows.filter((r) => r.wregr > 0);

  const relevantIds = rows.map((r) => r.tool_id);
  let issuedMap = new Map<string, LedgerLite>();
  let dispatchMap = new Map<string, LedgerLite>();
  if (relevantIds.length > 0) {
    const { data: ev } = await supabase
      .from("tool_ledger")
      .select("tool_id,txn_type,ts,person,machine,tofrom,issued_by")
      .in("tool_id", relevantIds)
      .in("txn_type", ["ISSUE", "DISPATCH"])
      .order("ts", { ascending: false })
      .limit(4000);
    const events = (ev as LedgerLite[] | null) ?? [];
    issuedMap = latestByTool(events, "ISSUE");
    dispatchMap = latestByTool(events, "DISPATCH");
  }

  const toPrep = (r: InvRow, map: Map<string, LedgerLite>): PrepRow => {
    const e = map.get(r.tool_id);
    return {
      tool_id: r.tool_id, name: r.name,
      where: (e?.machine || e?.tofrom || r.loc) ?? "—",
      since: e?.ts ?? null, by: e?.person ?? null, issuedBy: e?.issued_by ?? null,
    };
  };

  const inUse = inUseRows.map((r) => toPrep(r, issuedMap));
  const atVendor = atVendorRows.map((r) => toPrep(r, dispatchMap));
  const waitingRegrind = waitingRows.map((r) => ({ tool_id: r.tool_id, name: r.name, where: r.loc ?? "VSPL store", since: null, by: null, issuedBy: null }));

  const daysOut = (ts: string | null) => ts ? Math.max(0, Math.round((Date.now() - new Date(ts).getTime()) / 86400000)) : null;
  const overdueCount = [...inUse, ...atVendor].filter((r) => (daysOut(r.since) ?? 0) >= 14).length;
  const dueSoonCount = [...inUse, ...atVendor].filter((r) => { const d = daysOut(r.since); return d != null && d >= 7 && d < 14; }).length;

  const totalOut = inUse.length + atVendor.length;
  const noData = rows.length === 0;

  return (
    <div>
      <h1 className="page-title">Prepare — take back</h1>
      <p className="page-sub">
        Today&apos;s worklist. Tools out 7+ days are flagged due-soon, 14+ days overdue —
        check with who took it and who issued it before chasing it down. Each action posts through the engine.
      </p>

      <div className="grid-kpi" style={{ marginBottom: 20 }}>
        <div className="kpi accent"><div className="k">Tools out</div><div className="v">{totalOut}</div></div>
        <div className="kpi"><div className="k">Due soon (7d+)</div><div className="v">{dueSoonCount}</div></div>
        <div className="kpi"><div className="k">Overdue (14d+)</div><div className="v">{overdueCount}</div></div>
        <div className="kpi"><div className="k">Waiting dispatch</div><div className="v">{waitingRegrind.length}</div></div>
      </div>

      {noData ? (
        <div className="panel panel-pad muted" style={{ fontSize: 13 }}>
          Nothing is currently out. This fills in once tools are issued, dispatched, or flagged for regrind.
        </div>
      ) : (
        <PrepareActions inUse={inUse} atVendor={atVendor} waitingRegrind={waitingRegrind} person={person} />
      )}
    </div>
  );
}