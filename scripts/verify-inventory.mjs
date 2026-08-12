/**
 * Compare live Supabase tool_inventory totals against a Tool_Inventory.xlsx
 * snapshot, bucket by bucket. Run this after a reseed + ledger replay to
 * confirm Available/In Use/etc. actually reconcile.
 *
 * Usage:
 *   node --env-file=.env.local scripts/verify-inventory.mjs ./Tool_Inventory.xlsx
 */
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import * as XLSX from "xlsx";

const filePath = process.argv[2];
if (!filePath) {
  console.error("Usage: node --env-file=.env.local scripts/verify-inventory.mjs <Tool_Inventory.xlsx>");
  process.exit(1);
}

const buf = readFileSync(filePath);
const wb = XLSX.read(buf, { type: "buffer" });
const sheet = wb.Sheets["Tool Inventory"] ?? wb.Sheets[wb.SheetNames[0]];
const rows = XLSX.utils.sheet_to_json(sheet, { defval: 0 });

const xlsxTotals = { avail: 0, inuse: 0, wregr: 0, wscrap: 0, atregr: 0, scrap: 0 };
for (const r of rows) {
  xlsxTotals.avail += Number(r["Available"]) || 0;
  xlsxTotals.inuse += Number(r["In Use"]) || 0;
  xlsxTotals.wregr += Number(r["Waiting Regrind"]) || 0;
  xlsxTotals.wscrap += Number(r["Waiting Scrap"]) || 0;
  xlsxTotals.atregr += Number(r["At Regrind"]) || 0;
  xlsxTotals.scrap += Number(r["Scrapped"]) || 0;
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in the environment.");
  process.exit(1);
}
const supabase = createClient(url, key);

let all = [];
let from = 0;
const PAGE = 1000;
for (;;) {
  const { data, error } = await supabase
    .from("tool_inventory")
    .select("avail,inuse,wregr,atregr,wscrap,scrap")
    .range(from, from + PAGE - 1);
  if (error) { console.error("Query failed:", error.message); process.exit(1); }
  all = all.concat(data);
  if (data.length < PAGE) break;
  from += PAGE;
}

const dbTotals = { avail: 0, inuse: 0, wregr: 0, wscrap: 0, atregr: 0, scrap: 0 };
for (const r of all) {
  dbTotals.avail += r.avail ?? 0;
  dbTotals.inuse += r.inuse ?? 0;
  dbTotals.wregr += r.wregr ?? 0;
  dbTotals.wscrap += r.wscrap ?? 0;
  dbTotals.atregr += r.atregr ?? 0;
  dbTotals.scrap += r.scrap ?? 0;
}

console.log(`Tool rows — Excel: ${rows.length}, Supabase: ${all.length}\n`);
console.log("Bucket".padEnd(14), "Excel".padStart(8), "Supabase".padStart(10), "Diff".padStart(8));
for (const k of Object.keys(xlsxTotals)) {
  const diff = dbTotals[k] - xlsxTotals[k];
  console.log(k.padEnd(14), String(xlsxTotals[k]).padStart(8), String(dbTotals[k]).padStart(10), String(diff).padStart(8));
}

const totalDiff = Object.keys(xlsxTotals).reduce((a, k) => a + Math.abs(dbTotals[k] - xlsxTotals[k]), 0);
console.log(totalDiff === 0 ? "\n✅ Reconciled exactly." : `\n⚠ ${totalDiff} units off in total — inspect per-bucket diffs above.`);