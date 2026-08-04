import { createClient } from "@/lib/supabase/server";

const TXN_TYPES = ["INWARD", "ISSUE", "RECEIVE", "CHIPOFF", "DISPATCH", "RECEIPT", "SCRAP"] as const;
const TXN_CHIP: Record<string, string> = {
  INWARD: "chip-avail", ISSUE: "chip-inuse", RECEIVE: "chip-avail",
  CHIPOFF: "chip-wregr", DISPATCH: "chip-atregr", RECEIPT: "chip-avail",
  SCRAP: "chip-wscrap",
};

interface LedgerRow {
  id: number; ts: string; tool_id: string; txn_type: string; qty: number;
  regrind_cost: number | null; unit_price: number | null;
}

function monthKey(ts: string) {
  const d = new Date(ts.replace(" ", "T"));
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleString("en-GB", { month: "short", year: "2-digit" });
}

const SAMPLE_NOTE = "Sample figures — live reports appear once transactions are posted.";

export default async function ReportsPage() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("tool_ledger")
    .select("id,ts,tool_id,txn_type,qty,regrind_cost,unit_price")
    .order("id", { ascending: false })
    .limit(5000);

  const rows = (data as LedgerRow[] | null) ?? [];
  const live = rows.length > 0;

  // Transaction type breakdown
  const byType = new Map<string, number>();
  for (const t of TXN_TYPES) byType.set(t, 0);
  for (const r of rows) byType.set(r.txn_type, (byType.get(r.txn_type) ?? 0) + 1);
  const maxTypeCount = Math.max(1, ...Array.from(byType.values()));

  // Top issued tools
  const issueCounts = new Map<string, number>();
  for (const r of rows) if (r.txn_type === "ISSUE") issueCounts.set(r.tool_id, (issueCounts.get(r.tool_id) ?? 0) + r.qty);
  const topIssued = Array.from(issueCounts.entries()).sort((a, b) => b[1] - a[1]).slice(0, 10);

  // Spend totals
  const regrindSpend = rows.reduce((a, r) => a + (r.regrind_cost ?? 0), 0);
  const inwardSpend = rows.filter((r) => r.txn_type === "INWARD").reduce((a, r) => a + (r.unit_price ?? 0) * r.qty, 0);

  // Monthly volume, last 6 distinct months present in the data
  const byMonth = new Map<string, number>();
  for (const r of rows) byMonth.set(monthKey(r.ts), (byMonth.get(monthKey(r.ts)) ?? 0) + 1);
  const months = Array.from(byMonth.entries()).slice(0, 6).reverse();
  const maxMonthCount = Math.max(1, ...months.map(([, c]) => c));

  const kpis = live
    ? [
        { k: "Total transactions", v: rows.length },
        { k: "Tools issued (qty)", v: Array.from(issueCounts.values()).reduce((a, b) => a + b, 0) },
        { k: "Scrapped events", v: byType.get("SCRAP") ?? 0 },
        { k: "Regrind spend", v: regrindSpend, money: true },
        { k: "New-tool spend", v: inwardSpend, money: true },
      ]
    : [
        { k: "Total transactions", v: 0 },
        { k: "Tools issued (qty)", v: 0 },
        { k: "Scrapped events", v: 0 },
        { k: "Regrind spend", v: 0, money: true },
        { k: "New-tool spend", v: 0, money: true },
      ];

  return (
    <div>
      <h1 className="page-title">Reports</h1>
      <p className="page-sub">{live ? "Computed from the full transaction ledger." : SAMPLE_NOTE}</p>

      <div className="grid-kpi">
        {kpis.map((t) => (
          <div key={t.k} className="kpi">
            <div className="k">{t.k}</div>
            <div className="v">{t.money ? `₹${t.v.toLocaleString()}` : t.v.toLocaleString()}</div>
          </div>
        ))}
      </div>

      <div className="panel" style={{ marginTop: 20 }}>
        <div className="panel-head">Transactions by type</div>
        <div className="panel-pad">
          {TXN_TYPES.map((t) => {
            const c = byType.get(t) ?? 0;
            return (
              <div key={t} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                <span className={"chip " + TXN_CHIP[t]} style={{ minWidth: 78, textAlign: "center" }}>{t}</span>
                <div style={{ flex: 1, background: "var(--panel-2)", borderRadius: 4, height: 10, overflow: "hidden" }}>
                  <div style={{ width: `${(c / maxTypeCount) * 100}%`, height: "100%", background: "var(--steel)" }} />
                </div>
                <span className="muted" style={{ fontSize: 12, minWidth: 36, textAlign: "right" }}>{c}</span>
              </div>
            );
          })}
        </div>
      </div>

      <div className="panel" style={{ marginTop: 20 }}>
        <div className="panel-head">Monthly transaction volume</div>
        <div className="panel-pad">
          {months.length === 0 ? (
            <span className="muted" style={{ fontSize: 13 }}>No data yet.</span>
          ) : (
            months.map(([m, c]) => (
              <div key={m} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                <span className="muted" style={{ minWidth: 60, fontSize: 12 }}>{m}</span>
                <div style={{ flex: 1, background: "var(--panel-2)", borderRadius: 4, height: 10, overflow: "hidden" }}>
                  <div style={{ width: `${(c / maxMonthCount) * 100}%`, height: "100%", background: "var(--steel)" }} />
                </div>
                <span className="muted" style={{ fontSize: 12, minWidth: 36, textAlign: "right" }}>{c}</span>
              </div>
            ))
          )}
        </div>
      </div>

      <div className="panel" style={{ marginTop: 20 }}>
        <div className="panel-head">Top 10 most-issued tools</div>
        <div style={{ overflow: "auto" }}>
          <table className="tbl">
            <thead><tr><th>Tool ID</th><th className="right">Times issued</th></tr></thead>
            <tbody>
              {topIssued.length === 0 ? (
                <tr><td colSpan={2} className="muted" style={{ textAlign: "center", padding: 24 }}>No issues recorded yet.</td></tr>
              ) : (
                topIssued.map(([id, c]) => (
                  <tr key={id}><td className="id">{id}</td><td className="num">{c}</td></tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}