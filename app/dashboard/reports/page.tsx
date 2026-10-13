import { createClient } from "@/lib/supabase/server";
import ReportsDashboard, {
  type MasterToolReportRow,
  type IssuedToolReportRow,
} from "./ReportsDashboard";

const TXN_TYPES = ["INWARD", "ISSUE", "RECEIVE", "CHIPOFF", "DISPATCH", "RECEIPT", "SCRAP"] as const;

interface LedgerRow {
  id: number;
  ts: string;
  tool_id: string;
  txn_type: string;
  qty: number;
  regrind_cost: number | null;
  unit_price: number | null;
  person: string | null;
  machine: string | null;
  tofrom: string | null;
  issued_by: string | null;
}

interface InventoryRow {
  tool_id: string;
  name: string | null;
  type: string | null;
  status: string;
  loc: string | null;
  avail: number;
  inuse: number;
  wregr: number;
  atregr: number;
  wscrap: number;
  scrap: number;
  owned: number;
  life: number | null;
}

function computeDaysOut(issuedAt: string): { daysOut: number; expectedReturn: string; isOverdue: boolean } {
  if (!issuedAt) return { daysOut: 0, expectedReturn: "—", isOverdue: false };
  const issueDate = new Date(issuedAt.replace(" ", "T"));
  if (isNaN(issueDate.getTime())) return { daysOut: 0, expectedReturn: "—", isOverdue: false };
  const now = Date.now();
  const daysOut = Math.max(0, Math.floor((now - issueDate.getTime()) / (1000 * 60 * 60 * 24)));
  const expDate = new Date(issueDate.getTime() + 7 * 24 * 60 * 60 * 1000);
  const expectedReturn = expDate.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
  return { daysOut, expectedReturn, isOverdue: daysOut >= 14 };
}

export default async function ReportsPage() {
  const supabase = await createClient();

  // 1. Fetch complete Master Inventory
  const { data: invData } = await supabase
    .from("tool_inventory")
    .select("tool_id,name,type,status,loc,avail,inuse,wregr,atregr,wscrap,scrap,owned,life")
    .order("tool_id", { ascending: true })
    .limit(5000);

  const inventoryRows = (invData as InventoryRow[] | null) ?? [];

  // 2. Fetch Ledger transactions for movement analytics and active issue resolution
  const { data: ledgerData } = await supabase
    .from("tool_ledger")
    .select("id,ts,tool_id,txn_type,qty,regrind_cost,unit_price,person,machine,tofrom,issued_by")
    .order("id", { ascending: false })
    .limit(5000);

  const ledgerRows = (ledgerData as LedgerRow[] | null) ?? [];

  // Map of latest ISSUE event per tool_id for currently in-use tools
  const latestIssueByTool = new Map<string, LedgerRow>();
  for (const row of ledgerRows) {
    if (row.txn_type === "ISSUE" && !latestIssueByTool.has(row.tool_id)) {
      latestIssueByTool.set(row.tool_id, row);
    }
  }

  // 3. Build Master Data report rows
  const masterRows: MasterToolReportRow[] = inventoryRows.map((r) => ({
    tool_id: r.tool_id,
    name: r.name,
    type: r.type,
    status: r.status,
    loc: r.loc,
    avail: r.avail ?? 0,
    inuse: r.inuse ?? 0,
    wregr: r.wregr ?? 0,
    atregr: r.atregr ?? 0,
    wscrap: r.wscrap ?? 0,
    scrap: r.scrap ?? 0,
    owned: r.owned ?? 0,
    life: r.life ?? null,
  }));

  // 4. Build Issued Tools report rows (Where tools are placed)
  const issuedRows: IssuedToolReportRow[] = inventoryRows
    .filter((r) => (r.inuse ?? 0) > 0)
    .map((r) => {
      const issue = latestIssueByTool.get(r.tool_id);
      const issuedAt = issue?.ts ?? "";
      const { daysOut, expectedReturn, isOverdue } = computeDaysOut(issuedAt);

      const issuedTo = issue?.machine || issue?.tofrom || r.loc || "Shop Floor / Machine";
      const person = issue?.person || "—";
      const issuedBy = issue?.issued_by || "Store";

      return {
        tool_id: r.tool_id,
        name: r.name,
        type: r.type,
        inuse_qty: r.inuse ?? 0,
        issued_to: issuedTo,
        person,
        issued_by: issuedBy,
        issued_at: issuedAt,
        expected_return: expectedReturn,
        days_out: daysOut,
        is_overdue: isOverdue,
      };
    });

  // 5. Analytics computations
  const byType = new Map<string, number>();
  for (const t of TXN_TYPES) byType.set(t, 0);
  for (const r of ledgerRows) byType.set(r.txn_type, (byType.get(r.txn_type) ?? 0) + 1);
  const typeBreakdown: [string, number][] = Array.from(byType.entries());

  const issueCounts = new Map<string, number>();
  for (const r of ledgerRows) {
    if (r.txn_type === "ISSUE") {
      issueCounts.set(r.tool_id, (issueCounts.get(r.tool_id) ?? 0) + r.qty);
    }
  }
  const topIssued: [string, number][] = Array.from(issueCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div>
        <h1 className="page-title">Reports &amp; Intelligence</h1>
        <p className="page-sub">
          Comprehensive master tool inventory, tracking where issued tools are placed (machine &amp; subcontractor), and movement analytics with Excel export.
        </p>
      </div>

      <ReportsDashboard
        masterRows={masterRows}
        issuedRows={issuedRows}
        totalTransactions={ledgerRows.length}
        topIssued={topIssued}
        typeBreakdown={typeBreakdown}
      />
    </div>
  );
}