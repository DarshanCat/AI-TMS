import { createClient } from "@/lib/supabase/server";
import { forecastAll, DEFAULT_CONFIG, type StockRow, type LedgerEvent } from "@/lib/forecast";

const SAMPLE_STOCK: StockRow[] = [
  { tool_id: "SC 0680 035 01", name: "DIA 6.8x5D SC DRILL", avail: 2, status: "Available" },
  { tool_id: "SC 0500 030 01", name: "DIA 5x6D SC DRILL", avail: 6, status: "Available" },
  { tool_id: "EM 1400 030 01", name: "DIA 14 4F SC EM", avail: 1, status: "Available" },
  { tool_id: "GD 1150 260 01", name: "DIA 11.5x23D GD", avail: 12, status: "Available" },
];
const daysAgo = (n: number) => new Date(Date.now() - n * 86400000).toISOString();
const SAMPLE_EVENTS: LedgerEvent[] = [
  { tool_id: "SC 0680 035 01", txn_type: "SCRAP", qty: 1, ts: daysAgo(28) },
  { tool_id: "SC 0680 035 01", txn_type: "CHIPOFF", qty: 1, ts: daysAgo(14), condition: "Broken" },
  { tool_id: "SC 0680 035 01", txn_type: "SCRAP", qty: 1, ts: daysAgo(4) },
  { tool_id: "SC 0500 030 01", txn_type: "SCRAP", qty: 1, ts: daysAgo(40) },
  { tool_id: "SC 0500 030 01", txn_type: "SCRAP", qty: 1, ts: daysAgo(10) },
  { tool_id: "EM 1400 030 01", txn_type: "CHIPOFF", qty: 1, ts: daysAgo(20), condition: "Broken" },
];

const CHIP = { now: "chip-wscrap", soon: "chip-wregr", ok: "chip-avail" } as const;
const LABEL = { now: "Reorder now", soon: "Reorder soon", ok: "Healthy" } as const;

export default async function ForecastingPage() {
  const supabase = await createClient();
  const [{ data: stockData }, { data: evData }] = await Promise.all([
    supabase.from("tool_inventory").select("tool_id,name,avail,status").neq("status", "None/Scrapped").limit(3000),
    supabase.from("tool_ledger").select("tool_id,txn_type,qty,ts,condition").in("txn_type", ["ISSUE", "CHIPOFF", "SCRAP"]).limit(8000),
  ]);

  const stock = (stockData as StockRow[] | null) ?? [];
  const events = (evData as LedgerEvent[] | null) ?? [];
  const live = stock.length > 0;

  const forecasts = forecastAll(
    live ? stock : SAMPLE_STOCK,
    live ? events : SAMPLE_EVENTS,
  );
  const needing = forecasts.filter((f) => f.reorderQty > 0);

  return (
    <div>
      <h1 className="page-title">Forecasting &amp; smart reorder</h1>
      <p className="page-sub">
        {live
          ? "Consumption rates and stock-out projections computed from ledger depletion events."
          : "Sample projection — real figures build once consumption is posted."}
        {" "}Lead time {DEFAULT_CONFIG.leadTimeDays}d + {DEFAULT_CONFIG.safetyDays}d safety.
      </p>

      <div className="grid-kpi" style={{ marginBottom: 18 }}>
        <div className="kpi accent"><div className="k">Tools analysed</div><div className="v">{forecasts.length}</div></div>
        <div className="kpi"><div className="k">Reorder now</div><div className="v">{forecasts.filter(f => f.urgency === "now").length}</div></div>
        <div className="kpi"><div className="k">Reorder soon</div><div className="v">{forecasts.filter(f => f.urgency === "soon").length}</div></div>
        <div className="kpi"><div className="k">Total pcs to order</div><div className="v">{needing.reduce((a, f) => a + f.reorderQty, 0)}</div></div>
      </div>

      <div className="panel" style={{ overflow: "auto", maxHeight: "62vh" }}>
        <table className="tbl">
          <thead>
            <tr>
              <th>Tool ID</th><th>Name</th>
              <th className="right">On hand</th>
              <th className="right">Rate /day</th>
              <th className="right">Days cover</th>
              <th>Stock-out</th>
              <th>Status</th>
              <th className="right">Order</th>
              <th>Why</th>
            </tr>
          </thead>
          <tbody>
            {forecasts.map((f) => (
              <tr key={f.tool_id}>
                <td className="id">{f.tool_id}</td>
                <td>{f.name}</td>
                <td className="num">{f.avail}</td>
                <td className="num">{f.perDay > 0 ? f.perDay.toFixed(2) : "—"}</td>
                <td className="num">{f.daysCover != null ? Math.round(f.daysCover) : "—"}</td>
                <td className="muted">{f.stockOut ?? "—"}</td>
                <td><span className={"chip " + CHIP[f.urgency]}>{LABEL[f.urgency]}</span></td>
                <td className="num" style={{ fontWeight: f.reorderQty ? 700 : 400 }}>{f.reorderQty || "—"}</td>
                <td className="muted" style={{ fontSize: 12, maxWidth: 260 }}>{f.reason}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}