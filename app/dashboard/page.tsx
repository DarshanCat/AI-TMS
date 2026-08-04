import { createClient } from "@/lib/supabase/server";

const TXN_CHIP: Record<string, string> = {
  INWARD: "chip-avail", ISSUE: "chip-inuse", RECEIVE: "chip-avail",
  CHIPOFF: "chip-wregr", DISPATCH: "chip-atregr", RECEIPT: "chip-avail",
  SCRAP: "chip-wscrap",
};

function fmtTs(ts: string) {
  const d = new Date(ts.replace(" ", "T"));
  if (isNaN(d.getTime())) return ts;
  return d.toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: inv } = await supabase
    .from("tool_inventory")
    .select("avail,inuse,wregr,atregr,scrap");

  const { data: recent } = await supabase
    .from("tool_ledger")
    .select("id,ts,tool_id,txn_type,qty,person,tofrom")
    .order("ts", { ascending: false })
    .limit(10);

  const rows = inv ?? [];
  const has = rows.length > 0;
  const sum = (k: "avail" | "inuse" | "wregr" | "atregr" | "scrap") =>
    rows.reduce((a, r) => a + (r[k] as number), 0);

  // live data when present; representative sample while data is being structured
  const kpis = has
    ? [
        { k: "Tools tracked", v: rows.length, accent: true },
        { k: "Available", v: sum("avail") },
        { k: "In use", v: sum("inuse") },
        { k: "Waiting regrind", v: sum("wregr") },
        { k: "At vendor", v: sum("atregr") },
        { k: "Scrapped", v: sum("scrap") },
      ]
    : [
        { k: "Tools tracked", v: 1343, accent: true },
        { k: "Available", v: 1240 },
        { k: "In use", v: 290 },
        { k: "Waiting regrind", v: 38 },
        { k: "At vendor", v: 8 },
        { k: "Scrapped", v: 45 },
      ];

  return (
    <div>
      <h1 className="page-title">Dashboard</h1>
      <p className="page-sub">
        {has ? "Live tool inventory across the crib." : "Sample figures — live data loads once your tables are populated."}
      </p>

      <div className="grid-kpi">
        {kpis.map((t) => (
          <div key={t.k} className={"kpi" + (t.accent ? " accent" : "")}>
            <div className="k">{t.k}</div>
            <div className="v">{t.v.toLocaleString()}</div>
          </div>
        ))}
      </div>

      <div className="panel" style={{ marginTop: 20 }}>
        <div className="panel-head">Recent activity</div>
        {recent && recent.length > 0 ? (
          <div style={{ overflow: "auto" }}>
            <table className="tbl">
              <thead>
                <tr><th>When</th><th>Tool ID</th><th>Type</th><th className="right">Qty</th><th>Person</th><th>To / From</th></tr>
              </thead>
              <tbody>
                {recent.map((r) => (
                  <tr key={r.id}>
                    <td className="muted" style={{ whiteSpace: "nowrap" }}>{fmtTs(r.ts)}</td>
                    <td className="id">{r.tool_id}</td>
                    <td><span className={"chip " + (TXN_CHIP[r.txn_type] ?? "chip-scrap")}>{r.txn_type}</span></td>
                    <td className="num">{r.qty}</td>
                    <td>{r.person}</td>
                    <td className="muted">{r.tofrom || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="panel-pad muted" style={{ fontSize: 13 }}>
            Today&apos;s transactions, regrind queue, and pending returns will appear here once entries are posted in the Inbox.
          </div>
        )}
      </div>
    </div>
  );
}