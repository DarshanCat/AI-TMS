import { createClient } from "@/lib/supabase/server";
import ScrapTable, { type ScrapRow } from "./ScrapTable";

const SAMPLE: ScrapRow[] = [
  { tool_id: "CF 68 07", name: "BRAZED COATED 68 F", type: "Cavity", loc: "Scrapped / disposal",
    scrapped_at: "2026-07-16 14:00:41", scrapped_qty: 1, person: "Vinay DS", condition: "Broken", remarks: "" },
];

export default async function ScrapRegisterPage() {
  const supabase = await createClient();

  // Live scrap register = current tool_inventory rows sitting in scrap,
  // joined to their most recent SCRAP ledger entry for the who/when/why.
  const { data: inv } = await supabase
    .from("tool_inventory")
    .select("tool_id,name,type,loc,scrap")
    .gt("scrap", 0)
    .order("tool_id", { ascending: true })
    .limit(2000);

  const invRows = inv ?? [];
  let rows: ScrapRow[] = [];
  const live = invRows.length > 0;

  if (live) {
    const ids = invRows.map((r) => r.tool_id);
    const { data: ledger } = await supabase
      .from("tool_ledger")
      .select("tool_id,ts,qty,person,condition,remarks")
      .in("tool_id", ids)
      .eq("txn_type", "SCRAP")
      .order("ts", { ascending: false });

    const lastScrapByTool = new Map<string, { ts: string; qty: number; person: string | null; condition: string | null; remarks: string | null }>();
    for (const l of ledger ?? []) {
      if (!lastScrapByTool.has(l.tool_id)) lastScrapByTool.set(l.tool_id, l);
    }

    rows = invRows.map((r) => {
      const last = lastScrapByTool.get(r.tool_id);
      return {
        tool_id: r.tool_id,
        name: r.name,
        type: r.type,
        loc: r.loc,
        scrapped_at: last?.ts ?? "—",
        scrapped_qty: last?.qty ?? r.scrap,
        person: last?.person ?? null,
        condition: last?.condition ?? null,
        remarks: last?.remarks ?? null,
      };
    });
  }

  return (
    <div>
      <h1 className="page-title">Scrap Register</h1>
      <p className="page-sub">
        {live
          ? `${rows.length.toLocaleString()} scrapped tools · read-only record, kept for audit — nothing here is ever deleted.`
          : "Sample row — the live register appears once a tool is scrapped."}
        {" "}Re-inward the same Tool ID to bring it back into live stock.
      </p>
      <ScrapTable rows={live ? rows : SAMPLE} live={live} />
    </div>
  );
}