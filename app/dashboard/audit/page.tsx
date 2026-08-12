import { createClient } from "@/lib/supabase/server";
import AuditTabs, { type BrokenRow, type RegrindRow, type ScrapRow } from "./AuditTabs";

export default async function AuditPage() {
  const supabase = await createClient();
  const [{ data: broken }, { data: regrind }, { data: scrap }] = await Promise.all([
    supabase.from("broken_tools_log").select("*").order("event_date", { ascending: false }).limit(1000),
    supabase.from("regrind_dispatch_log").select("*").order("event_date", { ascending: false }).limit(1000),
    supabase.from("scrap_history_log").select("*").order("event_date", { ascending: false }).limit(1000),
  ]);

  return (
    <div>
      <h1 className="page-title">Audit Records</h1>
      <p className="page-sub">
        Reference logs loaded from the master audit export — Broken Tools, Sent to Regrinding, and Scrap History.
        Read-only; refreshed whenever a new master file is seeded.
      </p>
      <AuditTabs
        broken={(broken as BrokenRow[]) ?? []}
        regrind={(regrind as RegrindRow[]) ?? []}
        scrap={(scrap as ScrapRow[]) ?? []}
      />
    </div>
  );
}