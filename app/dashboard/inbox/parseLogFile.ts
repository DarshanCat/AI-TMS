import * as XLSX from "xlsx";
import type { LogSpec } from "./logs";

function normHeader(h: unknown): string {
  return String(h ?? "").trim().toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

// match an Excel column to a field by comparing normalized label text
function findColumn(excelHeaders: string[], label: string): number {
  const normLabel = normHeader(label);
  const normed = excelHeaders.map(normHeader);
  let i = normed.indexOf(normLabel);
  if (i !== -1) return i;
  i = normed.findIndex((h) => h.includes(normLabel) || normLabel.includes(h));
  return i;
}

export interface ParsedLog {
  header: Record<string, string>;
  rows: { tool_id: string; qty: string; vals: Record<string, string> }[];
  warnings: string[];
}

export async function parseLogFile(file: File, log: LogSpec): Promise<ParsedLog> {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { cellDates: true });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const raw: unknown[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, blankrows: false });

  const warnings: string[] = [];
  if (raw.length < 2) { warnings.push("File has no data rows."); return { header: {}, rows: [], warnings }; }

  const excelHeaders = (raw[0] as unknown[]).map((h) => String(h ?? ""));
  const dataRows = raw.slice(1);

  const toolIdCol = findColumn(excelHeaders, "Tool ID");
  const qtyCol = findColumn(excelHeaders, "Qty");
  if (toolIdCol === -1) warnings.push('Could not find a "Tool ID" column — check the file matches this log type.');

  const fieldCols = new Map<string, number>();
  for (const f of log.fields) {
    const col = findColumn(excelHeaders, f.label);
    if (col !== -1) fieldCols.set(f.key, col);
    else warnings.push(`Column for "${f.label}" not found — leave it blank and fill manually if needed.`);
  }

  const fmtVal = (v: unknown) => (v instanceof Date ? v.toISOString().slice(0, 10) : v == null ? "" : String(v).trim());

  const header: Record<string, string> = {};
  for (const f of log.fields.filter((f) => f.scope === "header")) {
    const col = fieldCols.get(f.key);
    header[f.key] = col != null ? fmtVal(dataRows[0][col]) : "";
  }

  const rows = dataRows
    .filter((r) => toolIdCol !== -1 && r[toolIdCol] != null && String(r[toolIdCol]).trim() !== "")
    .map((r) => {
      const vals: Record<string, string> = {};
      for (const f of log.fields.filter((f) => f.scope === "row")) {
        const col = fieldCols.get(f.key);
        vals[f.key] = col != null ? fmtVal(r[col]) : "";
      }
      // If the sheet already names a Tool ID, treat it as an existing tool to
      // look up/correct via fuzzy search — not a "generate a new ID" case.
      // Operators mark "New Tool = Y" out of habit even for restocks, so the
      // sheet's Y/N flag isn't reliable here; presence of a Tool ID is.
      if ("newtool" in vals) vals["newtool"] = "N";
      return {
        tool_id: fmtVal(r[toolIdCol]),
        qty: qtyCol !== -1 && r[qtyCol] != null ? String(Math.abs(Number(r[qtyCol]) || 1)) : "1",
        vals,
      };
    });

  return { header, rows, warnings };
}