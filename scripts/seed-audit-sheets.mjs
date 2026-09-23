/**
 * Load the three report sheets from Tool_Master.xlsx (Broken Tools, Sent to
 * Regrinding, Scrap History) into their own reference tables. These are
 * audit snapshots, not append-only — each run fully replaces prior content.
 *
 * Usage:
 *   node --env-file=.env.local scripts/seed-audit-sheets.mjs ./Tool_Master.xlsx
 *   node --env-file=.env.local scripts/seed-audit-sheets.mjs ./Tool_Master.xlsx --commit
 */
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import * as XLSX from "xlsx";

const args = process.argv.slice(2);
const commit = args.includes("--commit");
const filePath = args.find((a) => !a.startsWith("--"));
if (!filePath) {
  console.error("Usage: node --env-file=.env.local scripts/seed-audit-sheets.mjs <Tool_Master.xlsx> [--commit]");
  process.exit(1);
}

const buf = readFileSync(filePath);
const wb = XLSX.read(buf, { type: "buffer", cellDates: true });

function sheetRows(name) {
  const sheet = wb.Sheets[name];
  if (!sheet) { console.log(`  (sheet "${name}" not found — skipping)`); return []; }
  return XLSX.utils.sheet_to_json(sheet, { defval: null });
}

const toDate = (v) => (v instanceof Date ? v.toISOString().slice(0, 10) : v ? String(v).slice(0, 10) : null);

const broken = sheetRows("Broken Tools").map((r) => ({
  tool_id: String(r["Tool ID"] ?? "").trim(),
  event_date: toDate(r["Date"]),
  qty: r["Qty"] != null ? Number(r["Qty"]) : null,
  condition: r["Condition"] ?? null,
  machine: r["Machine"] ?? null,
  reported_by: r["Reported By"] ?? null,
  received_by: r["Received By"] ?? null,
  remarks: r["Remarks"] ?? null,
})).filter((r) => r.tool_id);

const regrind = sheetRows("Sent to Regrinding").map((r) => ({
  tool_id: String(r["Tool ID"] ?? "").trim(),
  event_date: toDate(r["Date"]),
  qty: r["Qty"] != null ? Number(r["Qty"]) : null,
  vendor: r["Regrind Vendor"] ?? null,
  dc_no: r["DC No"] != null ? String(r["DC No"]) : null,
  sent_by: r["Sent By"] ?? null,
  remarks: r["Remarks"] ?? null,
})).filter((r) => r.tool_id);

const scrap = sheetRows("Scrap History").map((r) => ({
  tool_id: String(r["Tool ID"] ?? "").trim(),
  event_date: toDate(r["Date"]),
  qty: r["Qty"] != null ? Number(r["Qty"]) : null,
  status: r["Status"] ?? null,
  condition_vendor: r["Condition/Vendor"] ?? null,
  dc_no: r["DC No"] != null ? String(r["DC No"]) : null,
  person: r["Person"] ?? null,
  remarks: r["Remarks"] ?? null,
})).filter((r) => r.tool_id);

console.log(`Broken Tools: ${broken.length} rows`);
console.log(`Sent to Regrinding: ${regrind.length} rows`);
console.log(`Scrap History: ${scrap.length} rows`);
console.log("\nPreview (first 2 of each):");
console.log("Broken:", broken.slice(0, 2));
console.log("Regrind:", regrind.slice(0, 2));
console.log("Scrap:", scrap.slice(0, 2));

if (!commit) {
  console.log("\nDry run only — nothing written. Re-run with --commit to load these into Supabase.");
  process.exit(0);
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) { console.error("Missing Supabase env vars."); process.exit(1); }
const supabase = createClient(url, key);

async function replace(table, rows) {
  const { error: delErr } = await supabase.from(table).delete().gte("id", 0);
  if (delErr) { console.error(`${table} delete failed:`, delErr.message); process.exit(1); }
  if (rows.length === 0) return;
  const { error: insErr } = await supabase.from(table).insert(rows);
  if (insErr) { console.error(`${table} insert failed:`, insErr.message); process.exit(1); }
  console.log(`${table}: loaded ${rows.length} rows`);
}

await replace("broken_tools_log", broken);
await replace("regrind_dispatch_log", regrind);
await replace("scrap_history_log", scrap);

console.log("\nDone.");