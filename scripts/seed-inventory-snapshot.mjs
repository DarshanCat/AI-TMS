/**
 * Overwrite tool_inventory's live counters directly from a Tool_Inventory.xlsx
 * snapshot — the six status buckets mapped 1:1, no derivation. This is the
 * authoritative "what's actually on hand right now" source; tool_ledger
 * (via seed-ledger.mjs) stays as the historical audit trail, but a raw
 * chronological replay is NOT used to compute current counts — real-world
 * ledger data has anomalies (insufficient-stock transactions, out-of-order
 * entries) that a permissive replay doesn't correct, so it drifts from the
 * true current state. Run this AFTER seed-tools.mjs and seed-ledger.mjs.
 *
 * Usage:
 *   node --env-file=.env.local scripts/seed-inventory-snapshot.mjs ./Tool_Inventory.xlsx
 *   node --env-file=.env.local scripts/seed-inventory-snapshot.mjs ./Tool_Inventory.xlsx --commit
 */
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import * as XLSX from "xlsx";

const args = process.argv.slice(2);
const commit = args.includes("--commit");
const filePath = args.find((a) => !a.startsWith("--"));
if (!filePath) {
  console.error("Usage: node --env-file=.env.local scripts/seed-inventory-snapshot.mjs <Tool_Inventory.xlsx> [--commit]");
  process.exit(1);
}

const buf = readFileSync(filePath);
const wb = XLSX.read(buf, { type: "buffer" });
const sheet = wb.Sheets["Tool Inventory"] ?? wb.Sheets[wb.SheetNames[0]];
const rows = XLSX.utils.sheet_to_json(sheet, { defval: 0 });

const parsed = rows
  .map((r) => ({
    tool_id: String(r["Tool ID"] ?? "").trim(),
    name: String(r["Tool Name"] ?? "").trim(),
    loc: String(r["Current Location"] ?? "").trim() || "VSPL store",
    status: String(r["Status"] ?? "").trim() || "Available",
    avail: Math.max(0, Math.round(Number(r["Available"]) || 0)),
    inuse: Math.max(0, Math.round(Number(r["In Use"]) || 0)),
    wregr: Math.max(0, Math.round(Number(r["Waiting Regrind"]) || 0)),
    wscrap: Math.max(0, Math.round(Number(r["Waiting Scrap"]) || 0)),
    atregr: Math.max(0, Math.round(Number(r["At Regrind"]) || 0)),
    scrap: Math.max(0, Math.round(Number(r["Scrapped"]) || 0)),
    owned: Math.max(0, Math.round(Number(r["Owned"]) || 0)),
  }))
  .filter((r) => r.tool_id);

console.log(`Parsed ${parsed.length} rows with a Tool ID (of ${rows.length} data rows).`);
console.log("\nPreview (first 5):");
for (const r of parsed.slice(0, 5)) console.log(" ", r);

const totals = { avail: 0, inuse: 0, wregr: 0, wscrap: 0, atregr: 0, scrap: 0 };
for (const r of parsed) for (const k of Object.keys(totals)) totals[k] += r[k];
console.log("\nTotals about to be written:", totals);

if (!commit) {
  console.log("\nDry run only — nothing written. Re-run with --commit to overwrite tool_inventory counters.");
  process.exit(0);
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("\nMissing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in the environment.");
  process.exit(1);
}
const supabase = createClient(url, key);

console.log(`\nOverwriting live counters for ${parsed.length} tools in tool_inventory…`);

const BATCH = 200;
let done = 0;
for (let i = 0; i < parsed.length; i += BATCH) {
  const batch = parsed.slice(i, i + BATCH);
  const invRows = batch.map((r) => ({
    tool_id: r.tool_id, name: r.name, loc: r.loc, status: r.status,
    avail: r.avail, inuse: r.inuse, wregr: r.wregr, wscrap: r.wscrap,
    atregr: r.atregr, scrap: r.scrap, owned: r.owned,
  }));
  // Full upsert (NOT ignoreDuplicates) — we want this to overwrite
  // whatever the ledger replay left behind, since this file is the
  // authoritative current-state source.
  const { error } = await supabase.from("tool_inventory").upsert(invRows, { onConflict: "tool_id" });
  if (error) { console.error("tool_inventory upsert failed:", error.message); process.exit(1); }
  done += batch.length;
  console.log(`  ${done}/${parsed.length}`);
}

console.log("\nDone. tool_inventory now reflects the Tool_Inventory.xlsx snapshot exactly.");
console.log("tool_ledger (from seed-ledger.mjs) is left untouched as the historical audit trail.");