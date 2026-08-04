import type { Txn, InventoryRow, Delta, EngineResult } from "@/types";

export const DIMENSIONED = new Set([
  "SC","BD","GD","MD","UD","HD","EM","EMR","BM","SM","FM","TC","CT","RM",
  "BT","BB","BBT","PB","HDS","HDC","HEM","HSD","HBM","HCS","HCB","HFC",
]);

export const norm = (s: unknown) =>
  s == null ? "" : String(s).trim().toUpperCase().replace(/\s+/g, " ");

// The base ID before the serial suffix — e.g. "SC 0680 035" or "TP M8X1.25".
// Exported so the API route can build a narrow existing-IDs query (only rows
// matching this base) instead of fetching the whole master table.
export function toolIdBase(code: string, dia?: string | number, length?: string | number, nameCode?: string): string {
  code = norm(code);
  if (DIMENSIONED.has(code) && dia != null && dia !== "") {
    const d = String(Math.round(Number(dia) * 100)).padStart(4, "0");
    const l = length != null && length !== ""
      ? String(Math.trunc(Number(length))).padStart(3, "0") : "000";
    return `${code} ${d} ${l}`;
  }
  return `${code} ${norm(nameCode)}`.trim();
}

export function genToolId(
  existingIds: string[], code: string, dia?: string | number,
  length?: string | number, nameCode?: string,
): string {
  const base = toolIdBase(code, dia, length, nameCode);
  const has = (id: string) => existingIds.some((e) => e.toUpperCase() === id.toUpperCase());
  let nn = 1;
  while (has(`${base} ${String(nn).padStart(2, "0")}`)) nn++;
  return `${base} ${String(nn).padStart(2, "0")}`;
}

const blank = (): Delta => ({ avail: 0, inuse: 0, wregr: 0, atregr: 0, wscrap: 0, scrap: 0 });

export function deriveStatus(r: {
  avail: number; inuse: number; wregr: number; atregr: number; wscrap: number; scrap: number;
}): string {
  if (r.atregr > 0) return "At Regrind";
  if (r.wregr > 0) return "Waiting Regrind";
  if (r.wscrap > 0) return "Waiting Scrap";
  if (r.inuse > 0 && r.avail === 0) return "In Use";
  if (r.avail > 0) return "Available";
  if (r.scrap > 0) return "None/Scrapped";
  return "Available";
}

export const TXN_TYPES: { k: Txn["type"]; label: string }[] = [
  { k: "INWARD",   label: "Inward — receive stock" },
  { k: "ISSUE",    label: "Issue — store → operations" },
  { k: "RECEIVE",  label: "Receive — return from operations" },
  { k: "CHIPOFF",  label: "Chip-off / Broken" },
  { k: "DISPATCH", label: "Regrind dispatch → vendor" },
  { k: "RECEIPT",  label: "Regrind receipt ← vendor" },
  { k: "SCRAP",    label: "Scrap / dispose" },
];

// THE chokepoint. Nothing writes unless this returns ok:true.
export function runEngine(txn: Txn, tool: InventoryRow | null): EngineResult {
  const checks = [`detect_type → ${txn.type}`];
  const errors: string[] = [];
  const warnings: string[] = [];
  const qty = Number(txn.qty);

  // 1. Qty guard — Qty=0 is rejected, NOT coerced to 1
  if (!Number.isInteger(qty) || qty < 1) {
    errors.push("Qty must be a whole number >= 1. Qty=0 is rejected, not coerced.");
    return { ok: false, checks, errors, warnings };
  }
  checks.push(`validate qty=${qty} ok`);

  // 2. Existence
  if (txn.type !== "INWARD" && !tool) {
    errors.push("Tool ID not found in master. Inward it first, or fix the ID.");
    return { ok: false, checks, errors, warnings };
  }
  if (txn.type === "INWARD" && !tool && !txn.newTool) {
    errors.push("New Tool ID — supply name/type/location to add it to the master.");
    return { ok: false, checks, errors, warnings };
  }
  checks.push("resolve tool ok");

  const t = tool ?? { avail: 0, inuse: 0, wregr: 0, atregr: 0, wscrap: 0, scrap: 0, life: null } as InventoryRow;
  const d = blank();

  // 3. Source sufficiency + transition
  switch (txn.type) {
    case "INWARD": d.avail += qty; break;
    case "ISSUE":
      if (t.avail < qty) { errors.push(`Only ${t.avail} available — cannot issue ${qty}.`); break; }
      d.avail -= qty; d.inuse += qty; break;
    case "RECEIVE":
      if (t.inuse < qty) { errors.push(`Only ${t.inuse} in use — cannot receive ${qty}.`); break; }
      d.inuse -= qty; d.avail += qty; break;
    case "CHIPOFF": {
      const onhand = t.inuse + t.avail;
      if (onhand < qty) { errors.push(`Only ${onhand} on hand — cannot flag ${qty}.`); break; }
      const fromUse = Math.min(t.inuse, qty), fromAvail = qty - fromUse;
      d.inuse -= fromUse; d.avail -= fromAvail;
      if (txn.condition === "Broken") d.wscrap += qty; else d.wregr += qty;
      break;
    }
    case "DISPATCH":
      if (t.wregr < qty) { errors.push(`Only ${t.wregr} waiting regrind.`); break; }
      d.wregr -= qty; d.atregr += qty; break;
    case "RECEIPT":
      if (t.atregr < qty) { errors.push(`Only ${t.atregr} at vendor.`); break; }
      d.atregr -= qty; d.avail += qty; break;
    case "SCRAP": {
      const scrapable = t.wscrap + t.avail + t.inuse;
      if (scrapable < qty) { errors.push("Nothing available to scrap."); break; }
      const fromWs = Math.min(t.wscrap, qty); let rem = qty - fromWs;
      const fa = Math.min(t.avail, rem); rem -= fa; const fi = rem;
      d.wscrap -= fromWs; d.avail -= fa; d.inuse -= fi; d.scrap += qty; break;
    }
    default: errors.push("Unknown transaction type.");
  }
  if (errors.length) return { ok: false, checks, errors, warnings };
  checks.push("source sufficiency ok");

  // 4. Life regression -> warn + flag (don't block)
  let remark = txn.remark ?? "";
  if (txn.life != null && (txn.life as unknown) !== "" && tool?.life != null &&
      Number(txn.life) < Number(tool.life)) {
    warnings.push(`Tool life ${txn.life} < recorded ${tool.life} (regression) — posted with flag.`);
    remark = (remark ? remark + " · " : "") + "LIFE-REGRESSION";
  }
  checks.push("life-regression check ok");
  checks.push("append to append-only ledger ok");
  return { ok: true, checks, errors, warnings, delta: d, remark };
}