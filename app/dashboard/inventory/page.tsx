import { createClient } from "@/lib/supabase/server";
import InventoryTable, { type Row } from "./InventoryTable";

const SAMPLE: Row[] = [
  { tool_id: "SC 0680 035 01", name: "DIA 6.8x5D SC DRILL PA140", type: "Solid Carbide", status: "Available", loc: "VSPL store", avail: 2, inuse: 0, wregr: 0, atregr: 0, wscrap: 0, scrap: 0, owned: 2, life: null },
  { tool_id: "EM 1400 030 01", name: "DIA 14 4F SC EM", type: "Solid Carbide", status: "In Use", loc: "VSPL (HMC)", avail: 0, inuse: 1, wregr: 0, atregr: 0, wscrap: 0, scrap: 0, owned: 1, life: 46 },
  { tool_id: "CR LC16 01", name: "BRAZED COATED LC16 R", type: "Cavity", status: "At Regrind", loc: "Sri Ram Cutting Tools", avail: 0, inuse: 0, wregr: 0, atregr: 1, wscrap: 0, scrap: 0, owned: 1, life: null },
  { tool_id: "SC 0880 040 02", name: "DIA 8.8x5D SC DRILL PA140", type: "Solid Carbide", status: "Waiting Regrind", loc: "VSPL store", avail: 0, inuse: 0, wregr: 1, atregr: 0, wscrap: 0, scrap: 0, owned: 1, life: null },
  { tool_id: "GD 1150 260 01", name: "DIA 11.5x23D GD PA135", type: "Solid Carbide", status: "Available", loc: "VSPL store", avail: 2, inuse: 0, wregr: 0, atregr: 0, wscrap: 0, scrap: 0, owned: 2, life: null },
  { tool_id: "CF 68 07", name: "BRAZED COATED 68 F", type: "Cavity", status: "None/Scrapped", loc: "Scrapped / disposal", avail: 0, inuse: 0, wregr: 0, atregr: 0, wscrap: 0, scrap: 1, owned: 0, life: null },
];

export default async function InventoryPage() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("tool_inventory")
    .select("tool_id,name,type,status,loc,avail,inuse,wregr,atregr,wscrap,scrap,owned,life")
    .order("tool_id", { ascending: true })
    .limit(2000);

  const rows = (data as Row[] | null) ?? [];
  const live = rows.length > 0;

  return (
    <div>
      <h1 className="page-title">Inventory</h1>
      <p className="page-sub">
        {live ? `${rows.length.toLocaleString()} tools · projected from the ledger.` : "Sample rows — live inventory appears once your tables are populated."}
      </p>
      <InventoryTable rows={live ? rows : SAMPLE} live={live} />
    </div>
  );
}