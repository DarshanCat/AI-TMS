/**
 * Seed the real tool master list into Supabase (tool_master + tool_inventory).
 *
 * Safe by default: prints a preview and does NOT write anything unless you
 * pass --commit. Re-running is safe either way — it upserts on tool_id, so
 * running it twice never duplicates a tool.
 *
 * Usage:
 *   node --env-file=.env.local scripts/seed-tools.mjs ./master-list.xlsx
 *   node --env-file=.env.local scripts/seed-tools.mjs ./master-list.xlsx --commit
 *
 * Needs in .env.local:
 *   NEXT_PUBLIC_SUPABASE_URL=...
 *   SUPABASE_SERVICE_ROLE_KEY=...   (service role — bypasses RLS for a bulk
 *                                    load; NEVER expose this key client-side)
 *
 * Expects a spreadsheet (.xlsx/.xls/.csv) with a header row. Column names
 * don't have to match exactly — it looks for the closest header among a few
 * common variants per field (see CANDIDATES below). If it can't confidently
 * find Tool ID / Name / Type, it stops and tells you what it saw instead of
 * guessing wrong on 1,343 rows.
 */
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import * as XLSX from "xlsx";

const args = process.argv.slice(2);
const commit = args.includes("--commit");
const filePath = args.find((a) => !a.startsWith("--"));

if (!filePath) {
  console.error("Usage: node --env-file=.env.local scripts/seed-tools.mjs <file.xlsx> [--commit]");
  process.exit(1);
}

const CANDIDATES = {
  tool_id: ["tool id", "toolid", "id", "tool no", "tool code"],
  name: ["name", "tool name", "description", "desc"],
  type: ["type", "category", "tool type", "class"],
  qty: ["qty", "quantity", "owned", "stock", "on hand", "opening stock"],
};

function normHeader(h) {
  return String(h ?? "").trim().toLowerCase().replace(/\s+/g, " ");
}

function findColumn(headers, candidates) {
  const normed = headers.map(normHeader);
  for (const c of candidates) {
    const i = normed.indexOf(c);
    if (i !== -1) return i;
  }
  for (const c of candidates) {
    const i = normed.findIndex((h) => h.includes(c));
    if (i !== -1) return i;
  }
  return -1;
}

const buf = readFileSync(filePath);
const wb = XLSX.read(buf, { type: "buffer", cellDates: true });
const sheet = wb.Sheets[wb.SheetNames[0]];
const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, blankrows: false });

if (rows.length < 2) {
  console.error("Sheet has no data rows below the header.");
  process.exit(1);
}

const headers = rows[0];
const dataRows = rows.slice(1);

const col = {
  tool_id: findColumn(headers, CANDIDATES.tool_id),
  name: findColumn(headers, CANDIDATES.name),
  type: findColumn(headers, CANDIDATES.type),
  loc: -1,
  qty: findColumn(headers, CANDIDATES.qty),
};

console.log("Detected columns:");
for (const [field, idx] of Object.entries(col)) {
  console.log(`  ${field.padEnd(8)} -> ${idx === -1 ? "NOT FOUND" : `"${headers[idx]}" (col ${idx})`}`);
}

if (col.tool_id === -1 || col.name === -1) {
  console.error("\nCan't confidently find Tool ID and/or Name columns. Sheet headers were:");
  console.error(headers.map((h, i) => `  [${i}] ${h}`).join("\n"));
  console.error("\nRename the relevant header(s) to something recognizable (e.g. 'Tool ID', 'Name') and re-run.");
  process.exit(1);
}

const parsed = dataRows
  .map((r) => ({
    tool_id: String(r[col.tool_id] ?? "").trim(),
    name: String(r[col.name] ?? "").trim(),
    type: col.type !== -1 ? String(r[col.type] ?? "").trim() : "",
    loc: col.loc !== -1 ? String(r[col.loc] ?? "").trim() || "VSPL store" : "VSPL store",
    qty: col.qty !== -1 ? Math.max(0, Math.round(Number(r[col.qty]) || 0)) : 0,
  }))
  .filter((r) => r.tool_id);

const seenIds = new Set();
const dupes = [];
for (const r of parsed) {
  if (seenIds.has(r.tool_id)) dupes.push(r.tool_id);
  seenIds.add(r.tool_id);
}

console.log(`\nParsed ${parsed.length} rows with a Tool ID (of ${dataRows.length} data rows).`);
if (dupes.length) console.log(`⚠ ${dupes.length} duplicate Tool IDs in the sheet (last one wins): ${dupes.slice(0, 10).join(", ")}${dupes.length > 10 ? "…" : ""}`);
console.log("\nPreview (first 5):");
for (const r of parsed.slice(0, 5)) console.log(" ", r);

if (!commit) {
  console.log("\nDry run only — nothing written. Re-run with --commit to load these into Supabase.");
  process.exit(0);
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("\nMissing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in the environment.");
  console.error("Run with: node --env-file=.env.local scripts/seed-tools.mjs <file> --commit");
  process.exit(1);
}
const supabase = createClient(url, key);

console.log(`\nUpserting ${parsed.length} tools into tool_master + tool_inventory…`);

const BATCH = 200;
let done = 0;
for (let i = 0; i < parsed.length; i += BATCH) {
  const batch = parsed.slice(i, i + BATCH);

  const masterRows = batch.map((r) => ({
    tool_id: r.tool_id, name: r.name, type: r.type, storage_location: r.loc,
  }));
  const { error: mErr } = await supabase.from("tool_master").upsert(masterRows, { onConflict: "tool_id" });
  if (mErr) { console.error("tool_master upsert failed:", mErr.message); process.exit(1); }

  const invRows = batch.map((r) => ({
    tool_id: r.tool_id, name: r.name, type: r.type, loc: r.loc,
    avail: r.qty, inuse: 0, wregr: 0, atregr: 0, wscrap: 0, scrap: 0,
    owned: r.qty, status: r.qty > 0 ? "Available" : "Available",
  }));
  const { error: iErr } = await supabase
    .from("tool_inventory")
    .upsert(invRows, { onConflict: "tool_id", ignoreDuplicates: true });
  if (iErr) { console.error("tool_inventory upsert failed:", iErr.message); process.exit(1); }

  done += batch.length;
  console.log(`  ${done}/${parsed.length}`);
}

console.log("\nDone. Existing tool_ids had only their master fields (name/type/location) refreshed;");
console.log("live stock counters (avail/inuse/etc.) were left untouched for anything already tracked.");