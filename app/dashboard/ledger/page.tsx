import { createClient } from "@/lib/supabase/server";
import LedgerTable, { type LedgerRow } from "./LedgerTable";

const SAMPLE: LedgerRow[] = [
  { id: 430, ts: "2026-07-16 14:09:28", tool_id: "CR LC25 01", txn_type: "DISPATCH", qty: 1, person: "Vinay DS", machine: "", tofrom: "Sri Ram Cutting Tools", dc: "DC-1187", condition: "", life: null, remarks: "" },
  { id: 429, ts: "2026-07-16 14:00:41", tool_id: "CF 68 07", txn_type: "SCRAP", qty: 1, person: "Vinay DS", machine: "", tofrom: "Scrap Store", dc: "", condition: "Broken", life: null, remarks: "" },
  { id: 428, ts: "2026-07-16 13:27:23", tool_id: "SC 1100 240 01", txn_type: "CHIPOFF", qty: 1, person: "Vinay DS", machine: "HMC", tofrom: "", dc: "", condition: "Chip-off", life: 52, remarks: "" },
  { id: 427, ts: "2026-07-16 13:20:00", tool_id: "EM 1400 030 19", txn_type: "ISSUE", qty: 1, person: "Vinay DS", machine: "HMC", tofrom: "Internal", dc: "", condition: "", life: null, remarks: "" },
  { id: 426, ts: "2026-07-16 13:20:00", tool_id: "SC 0500 030 01", txn_type: "RECEIVE", qty: 2, person: "Vinay DS", machine: "HMC", tofrom: "Internal", dc: "", condition: "", life: 46, remarks: "" },
  { id: 425, ts: "2026-07-10 13:00:00", tool_id: "GD 1800 260 02", txn_type: "RECEIPT", qty: 1, person: "Vinay DS", machine: "", tofrom: "Excellence", dc: "DC-1180", condition: "", life: null, remarks: "" },
  { id: 424, ts: "2026-07-10 11:15:00", tool_id: "SC 0400 100 05", txn_type: "INWARD", qty: 5, person: "Ravi S", machine: "", tofrom: "Purchase", dc: "GRN-882", condition: "", life: null, remarks: "" },
];

export default async function LedgerPage() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("tool_ledger")
    .select("id,ts,tool_id,txn_type,qty,person,machine,tofrom,dc,condition,life,remarks")
    .order("id", { ascending: false })
    .limit(1000);

  const rows = (data as LedgerRow[] | null) ?? [];
  const live = rows.length > 0;

  return (
    <div>
      <h1 className="page-title">Ledger</h1>
      <p className="page-sub">
        {live
          ? `${rows.length.toLocaleString()} transactions · append-only, newest first.`
          : "Sample transactions — the live ledger appears once entries are posted."}
      </p>
      <LedgerTable rows={live ? rows : SAMPLE} live={live} />
    </div>
  );
}