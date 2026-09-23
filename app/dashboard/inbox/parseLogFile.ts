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
  if (raw.length < 2) {
    warnings.push("File has no data rows.");
    return { header: {}, rows: [], warnings };
  }

  const excelHeaders = (raw[0] as unknown[]).map((h) => String(h ?? ""));
  const dataRows = raw.slice(1);

  const toolIdCol = findColumn(excelHeaders, "Tool ID");
  const qtyCol = findColumn(excelHeaders, "Qty");
  if (toolIdCol === -1 && log.key !== "inward") {
    warnings.push('Could not find a "Tool ID" column — check that the file matches this log type.');
  }

  const fieldCols = new Map<string, number>();
  for (const f of log.fields) {
    const col = findColumn(excelHeaders, f.label);
    if (col !== -1) fieldCols.set(f.key, col);
    else warnings.push(`Column for "${f.label}" not found in sheet — leave blank or fill manually if needed.`);
  }

  const fmtVal = (v: unknown) => (v instanceof Date ? v.toISOString().slice(0, 10) : v == null ? "" : String(v).trim());

  const header: Record<string, string> = {};
  for (const f of log.fields.filter((f) => f.scope === "header")) {
    const col = fieldCols.get(f.key);
    header[f.key] = col != null && dataRows[0] ? fmtVal(dataRows[0][col]) : "";
  }

  const seenIds = new Set<string>();
  const rows: { tool_id: string; qty: string; vals: Record<string, string> }[] = [];

  dataRows.forEach((r, idx) => {
    const excelRowNum = idx + 2; // header is row 1
    const rawToolId = toolIdCol !== -1 ? fmtVal(r[toolIdCol]) : "";
    const rawQty = qtyCol !== -1 ? fmtVal(r[qtyCol]) : "1";

    // Skip purely empty lines
    if (!rawToolId && (!r || r.every((c) => c == null || String(c).trim() === ""))) {
      return;
    }

    if (!rawToolId && log.key !== "inward") {
      warnings.push(`Row ${excelRowNum}: Missing Tool ID — row was skipped.`);
      return;
    }

    // Explicit quantity validation — never silently coerce 0 -> 1 or -5 -> 5
    let cleanQty = "1";
    if (rawQty) {
      const num = Number(rawQty);
      if (!Number.isFinite(num) || !Number.isInteger(num) || num <= 0) {
        warnings.push(`Row ${excelRowNum}: Invalid quantity "${rawQty}" for Tool ID "${rawToolId || "(new)"}". Quantities must be positive whole numbers.`);
        cleanQty = rawQty; // Retain exact invalid value so UI validation & engine can surface the error
      } else {
        cleanQty = String(num);
      }
    } else {
      warnings.push(`Row ${excelRowNum}: Quantity column was empty for Tool ID "${rawToolId}". Defaulted to 1.`);
    }

    if (rawToolId) {
      const upper = rawToolId.toUpperCase();
      if (seenIds.has(upper)) {
        warnings.push(`Row ${excelRowNum}: Tool ID "${rawToolId}" appears multiple times in this file.`);
      }
      seenIds.add(upper);
    }

    const vals: Record<string, string> = {};
    for (const f of log.fields.filter((f) => f.scope === "row")) {
      const col = fieldCols.get(f.key);
      vals[f.key] = col != null ? fmtVal(r[col]) : "";
    }

    // If the sheet already names a Tool ID, treat it as an existing tool to
    // look up/correct via fuzzy search — not a "generate a new ID" case.
    if ("newtool" in vals && rawToolId) {
      vals["newtool"] = "N";
    }

    rows.push({
      tool_id: rawToolId,
      qty: cleanQty,
      vals,
    });
  });

  return { header, rows, warnings };
}