import { createClient } from "@/lib/supabase/server";

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: inv } = await supabase
    .from("tool_inventory")
    .select("avail,inuse,wregr,atregr,wscrap,scrap")
    .limit(5000);

  const rows = inv ?? [];
  const has = rows.length > 0;
  const sum = (k: "avail" | "inuse" | "wregr" | "atregr" | "wscrap" | "scrap") =>
    rows.reduce((a, r) => a + (Number(r[k]) || 0), 0);

  // Live KPI totals computed from tool_inventory
  const kpis = [
    { k: "Tools tracked", v: rows.length, accent: true },
    { k: "Available", v: sum("avail") },
    { k: "In use", v: sum("inuse") },
    { k: "Waiting regrind", v: sum("wregr") },
    { k: "Waiting scrap", v: sum("wscrap") },
    { k: "At vendor", v: sum("atregr") },
    { k: "Scrapped", v: sum("scrap") },
  ];

  return (
    <div>
      <h1 className="page-title">Dashboard</h1>
      <p className="page-sub">
        {has ? "Live tool inventory across the crib." : "Live tool inventory across the crib. (0 tools currently registered)"}
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
        <div className="panel-pad muted" style={{ fontSize: 13 }}>
          Today&apos;s transactions, regrind queue, and pending returns will appear here once the Inbox is wired up.
        </div>
      </div>
    </div>
  );
}