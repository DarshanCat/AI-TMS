import { createClient } from "@/lib/supabase/server";

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: inv } = await supabase
    .from("tool_inventory")
    .select("avail,inuse,wregr,atregr,scrap");

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
        <div className="panel-pad muted" style={{ fontSize: 13 }}>
          Today&apos;s transactions, regrind queue, and pending returns will appear here once the Inbox is wired up.
        </div>
      </div>
    </div>
  );
}