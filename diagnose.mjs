import { readFileSync } from "node:fs";
import * as XLSX from "xlsx";

console.log("=== DIAGNOSTIC RUN ===");
console.log("Time:", new Date().toISOString());

const filePath = process.argv[2] || "./Tool_Inventory_VERIFIED.xlsx";
console.log("Reading:", filePath);

const buf = readFileSync(filePath);
console.log("File size (bytes):", buf.length);

const wb = XLSX.read(buf, { type: "buffer" });
console.log("Sheet names:", wb.SheetNames);

const sheet = wb.Sheets["Tool Inventory"] ?? wb.Sheets[wb.SheetNames[0]];
const rows = XLSX.utils.sheet_to_json(sheet, { defval: 0 });
console.log("Row count:", rows.length);
console.log("Headers of row 0:", Object.keys(rows[0]));

let sumAvail = 0, sumInUse = 0, sumWregr = 0, sumAtregr = 0, sumScrap = 0;
for (const r of rows) {
  sumAvail += Number(r["Available"]) || 0;
  sumInUse += Number(r["In Use"]) || 0;
  sumWregr += Number(r["Waiting Regrind"]) || 0;
  sumAtregr += Number(r["At Regrind"]) || 0;
  sumScrap += Number(r["Scrapped"]) || 0;
}
console.log("SUM Available:", sumAvail);
console.log("SUM In Use:", sumInUse);
console.log("SUM Waiting Regrind:", sumWregr);
console.log("SUM At Regrind:", sumAtregr);
console.log("SUM Scrapped:", sumScrap);
console.log("=== END DIAGNOSTIC ===");
