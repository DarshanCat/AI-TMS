import { createClient } from "@/lib/supabase/server";
import DailyView, { type LedgerRow } from "./DailyView";

const SAMPLE: LedgerRow[] = [
  { id: 430, ts: new Date().toISOString(), tool_id: "CR LC25 01", txn_type: "DISPATCH", qty: 1, person: "Vinay DS", machine: "", tofrom: "Sri Ram Cutting Tools", remarks: "" },
  { id: 429, ts: new Date().toISOString(), tool_id: "CF 68 07", txn_type: "SCRAP", qty: 1, person: "Vinay DS", machine: "", tofrom: "Scrap Store", remarks: "" },
  { id: 428, ts: new Date(Date.now() - 86400000).toISOString(), tool_id: "SC 1100 240 01", txn_type: "CHIPOFF", qty: 1, person: "Vinay DS", machine: "HMC", tofrom: "", remarks: "" },
  { id: 427, ts: new Date(Date.now() - 86400000).toISOString(), tool_id: "EM 1400 030 19", txn_type: "ISSUE", qty: 1, person: "Vinay DS", machine: "HMC", tofrom: "", remarks: "" },
  { id: 426, ts: new Date(Date.now() - 2 * 86400000).toISOString(), tool_id: "SC 0500 030 01", txn_type: "RECEIVE", qty: 2, person: "Vinay DS", machine: "HMC", tofrom: "", remarks: "" },
];

export default async function DailyPage() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("tool_ledger")
    .select("id,ts,tool_id,txn_type,qty,person,machine,tofrom,remarks")
    .order("ts", { ascending: false })
    .limit(5000);

  const rows = (data as LedgerRow[] | null) ?? [];
  const live = rows.length > 0;

  return (
    <div>
      <h1 className="page-title">Daily folders</h1>
      <p className="page-sub">
        {live ? "One folder per day — every transaction posted that day." : "Sample days — real folders appear as transactions are posted."}
      </p>
      <DailyView rows={live ? rows : SAMPLE} />
    </div>
  );
}