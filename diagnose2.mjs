import { readFileSync } from "node:fs";
import * as XLSX from "xlsx";

const filePath = process.argv[2] || "./Tool_Inventory_VERIFIED.xlsx";
const buf = readFileSync(filePath);
const wb = XLSX.read(buf, { type: "buffer" });
const sheet = wb.Sheets["Tool Inventory"] ?? wb.Sheets[wb.SheetNames[0]];
const rows = XLSX.utils.sheet_to_json(sheet, { defval: 0 });

console.log("Row count:", rows.length);

// Method 1: sum straight off raw rows (like diagnose.mjs did)
let rawAvail = 0, rawInUse = 0;
for (const r of rows) {
  rawAvail += Number(r["Available"]) || 0;
  rawInUse += Number(r["In Use"]) || 0;
}
console.log("RAW sum -> avail:", rawAvail, " inuse:", rawInUse);

// Method 2: exactly mirror seed-inventory-snapshot.mjs's parsed[] step
const parsed = rows
  .map((r) => ({
    tool_id: String(r["Tool ID"] ?? "").trim(),
    avail: Math.max(0, Math.round(Number(r["Available"]) || 0)),
    inuse: Math.max(0, Math.round(Number(r["In Use"]) || 0)),
  }))
  .filter((r) => r.tool_id);

console.log("Parsed count:", parsed.length);

let parsedAvail = 0, parsedInUse = 0;
for (const r of parsed) {
  parsedAvail += r.avail;
  parsedInUse += r.inuse;
}
console.log("PARSED sum -> avail:", parsedAvail, " inuse:", parsedInUse);

// If these two disagree, find exactly which rows differ
if (rawAvail !== parsedAvail || rawInUse !== parsedInUse) {
  console.log("\n!!! DIVERGENCE FOUND !!! Scanning row-by-row for mismatches...");
  let mismatches = 0;
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    const p = parsed[i];
    const rAvail = Number(r["Available"]) || 0;
    const rInUse = Number(r["In Use"]) || 0;
    if (rAvail !== p?.avail || rInUse !== p?.inuse) {
      mismatches++;
      if (mismatches <= 10) {
        console.log(`  Row ${i} [${r["Tool ID"]}]: raw(avail=${rAvail}, inuse=${rInUse}) vs parsed(avail=${p?.avail}, inuse=${p?.inuse})`);
      }
    }
  }
  console.log("Total mismatched rows:", mismatches);
} else {
  console.log("\nNo divergence — both methods agree.");
}
