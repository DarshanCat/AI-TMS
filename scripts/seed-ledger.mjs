/**
 * Replay the real Tool_Ledger.xlsx into Supabase — once, after seed-tools.mjs.
 *
 * Mirrors tms_engine.py's replay(): permissive, no blocking. Your engine's
 * own anomaly log shows rows that were flagged AND posted anyway ("flag
 * don't hold"). This script reproduces that exact historical state rather
 * than re-validating 430 real transactions against today's stricter rules.
 *
 * Safe by default: preview only, no writes unless --commit. Re-running with
 * --commit will duplicate ledger rows (this is a historical replay, not an
 * idempotent upsert) — so run it ONCE, after confirming the dry-run preview.
 *
 * Usage:
 *   node --env-file=.env.local scripts/seed-ledger.mjs ./Tool_Ledger.xlsx
 *   node --env-file=.env.local scripts/seed-ledger.mjs ./Tool_Ledger.xlsx --commit
 */
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import * as XLSX from "xlsx";

const args = process.argv.slice(2);
const commit = args.includes("--commit");
const filePath = args.find((a) => !a.startsWith("--"));
if (!filePath) {
  console.error("Usage: node --env-file=.env.local scripts/seed-ledger.mjs <Tool_Ledger.xlsx> [--commit]");
  process.exit(1);
}

const buf = readFileSync(filePath);
const wb = XLSX.read(buf, { type: "buffer", cellDates: true });
const sheet = wb.Sheets["Tool Ledger"] ?? wb.Sheets[wb.SheetNames[0]];
const rows = XLSX.utils.sheet_to_json(sheet, { defval: null });

console.log(`Read ${rows.length} raw ledger rows.`);

function translate(r) {
  const rawType = String(r["Txn Type"] ?? "").trim().toUpperCase();
  const iof = String(r["Issued To / From"] ?? "").trim();
  const qty = Math.abs(Number(r["Qty (+/-)"]) || 0);
  const tool_id = String(r["Tool ID"] ?? "").trim();
  const ts = r["Timestamp"] instanceof Date ? r["Timestamp"].toISOString() : new Date(r["Timestamp"]).toISOString();

  let type, tofrom = "", machine = "", condition = "";
  const supplier = String(r["Supplier"] ?? "").trim();

  if (rawType === "INWARD") {
    type = "INWARD"; tofrom = supplier;
  } else if (rawType === "CHIPOFF") {
    type = "CHIPOFF";
    const cond = String(r["Condition"] ?? "").toUpperCase();
    condition = cond.includes("BROKEN") ? "Broken" : "Chip-off";
    machine = String(r["Machine"] ?? "").trim();
  } else if (rawType === "ISSUE") {
    if (iof.toUpperCase().includes("REGRIND")) {
      type = "DISPATCH"; tofrom = supplier || "Sri Ram Cutting Tools";
    } else if (iof.toUpperCase().includes("SCRAP")) {
      type = "SCRAP"; tofrom = "Scrap Store";
    } else if (iof.toUpperCase() === "INTERNAL") {
      type = "ISSUE"; machine = String(r["Machine"] ?? "").trim();
    } else {
      type = "ISSUE"; machine = supplier || iof.replace(/^Supplier:\s*/i, "").trim();
    }
  } else if (rawType === "RETURN") {
    if (iof.toUpperCase().includes("REGRIND")) { type = "RECEIPT"; tofrom = supplier; }
    else { type = "RECEIVE"; machine = String(r["Machine"] ?? "").trim(); }
  } else {
    return null;
  }

  return {
    tool_id, type, qty, ts,
    person: String(r["Person"] ?? "").trim(),
    issued_by: String(r["Store Person"] ?? "").trim(),
    machine, tofrom, condition,
    dc: r["DC No"] != null ? String(r["DC No"]) : "",
    part_no: String(r["Part No"] ?? "").trim(),
    work_order: String(r["Work Order No"] ?? "").trim(),
    life: r["Tool Life"] != null ? Number(r["Tool Life"]) : null,
    remark: String(r["Remarks"] ?? "").trim(),
    txn_no: Number(String(r["Txn ID"] ?? "").replace(/\D/g, "")) || 0,
  };
}

const translated = rows.map(translate).filter(Boolean).sort((a, b) => a.txn_no - b.txn_no);
const skipped = rows.length - translated.length;
console.log(`Translated ${translated.length} rows${skipped ? ` (skipped ${skipped} unrecognized)` : ""}.`);

const byType = {};
for (const t of translated) byType[t.type] = (byType[t.type] ?? 0) + 1;
console.log("By type:", byType);
console.log("\nPreview (first 5):");
for (const t of translated.slice(0, 5)) console.log(" ", t);

if (!commit) {
  console.log("\nDry run only — nothing written. Re-run with --commit to replay these into Supabase.");
  process.exit(0);
}

function deltaFor(type, qty, pool) {
  const d = { avail: 0, inuse: 0, wregr: 0, atregr: 0, wscrap: 0, scrap: 0 };
  switch (type) {
    case "INWARD": d.avail = qty; break;
    case "ISSUE": d.avail = -qty; d.inuse = qty; break;
    case "RECEIVE": d.inuse = -qty; d.avail = qty; break;
    case "CHIPOFF": {
      const fromUse = Math.min(pool.inuse, qty), fromAvail = qty - fromUse;
      d.inuse = -fromUse; d.avail = -fromAvail;
      break;
    }
    case "DISPATCH": d.wregr = -qty; d.atregr = qty; break;
    case "RECEIPT": d.atregr = -qty; d.avail = qty; break;
    case "SCRAP": {
      const fromWs = Math.min(pool.wregr, qty);
      d.wregr = -fromWs; d.wscrap = -(qty - fromWs); d.scrap = qty;
      break;
    }
  }
  return d;
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("\nMissing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in the environment.");
  process.exit(1);
}
const supabase = createClient(url, key);

const pool = new Map();
async function getPool(tool_id) {
  if (pool.has(tool_id)) return pool.get(tool_id);
  const { data } = await supabase.from("tool_inventory").select("avail,inuse,wregr,atregr,wscrap,scrap").eq("tool_id", tool_id).maybeSingle();
  const p = data ?? { avail: 0, inuse: 0, wregr: 0, atregr: 0, wscrap: 0, scrap: 0 };
  pool.set(tool_id, p);
  return p;
}

console.log(`\nReplaying ${translated.length} transactions in chronological order…`);
let done = 0, failed = 0;
for (const t of translated) {
  const p = await getPool(t.tool_id);
  if (!p) { failed++; console.log(`  ✗ ${t.tool_id}: not in master, skipped`); continue; }

  let d;
  if (t.type === "CHIPOFF") {
    d = deltaFor("CHIPOFF", t.qty, p);
    if (t.condition === "Broken") d.wscrap = t.qty; else d.wregr = t.qty;
  } else {
    d = deltaFor(t.type, t.qty, p);
  }

  const { error } = await supabase.rpc("apply_transaction", {
    p_tool_id: t.tool_id, p_txn_type: t.type, p_qty: t.qty,
    p_person: t.person, p_machine: t.machine, p_tofrom: t.tofrom,
    p_dc: t.dc, p_condition: t.condition, p_life: t.life,
    p_remarks: t.remark, d_avail: d.avail, d_inuse: d.inuse, d_wregr: d.wregr,
    d_atregr: d.atregr, d_wscrap: d.wscrap, d_scrap: d.scrap,
    p_new_tool: null, p_part_no: t.part_no, p_work_order: t.work_order,
    p_po_no: null, p_brand: null, p_unit_price: null, p_regrind_cost: null,
    p_issued_by: t.issued_by,
    p_ts: t.ts,
  });

  if (error) { failed++; console.log(`  ✗ ${t.tool_id} (${t.type}): ${error.message}`); continue; }

  for (const k of Object.keys(d)) p[k] = (p[k] ?? 0) + d[k];
  done++;
  if (done % 50 === 0) console.log(`  ${done}/${translated.length}`);
}

console.log(`\nDone. ${done} posted, ${failed} failed.`);