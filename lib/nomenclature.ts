/**
 * TOOL NOMENCLATURE STANDARD — FINAL
 * Defines tool categories, codes, universal skeleton formats, validation, and builder.
 */

export interface ToolTypeDefinition {
  code: string;
  description: string;
  category: "Solid Carbide" | "Drill" | "Mill" | "Ream/Bore" | "Probe" | "Cavity" | "Thread" | "Holder & Adapter" | "Turning & Inserts" | "HSS Tooling";
  format: string;
  example: string;
  isDrill?: boolean;
  isToleranceAllowed?: boolean;
  isRange?: boolean;
  isTap?: boolean;
  isHolder?: boolean;
}

export const TOOL_TYPES: ToolTypeDefinition[] = [
  // Solid Carbide / Cutting
  { code: "SC", description: "Solid Carbide Drill", category: "Drill", format: "SC DDDD LLL NN", example: "SC 1200 250 01", isDrill: true },
  { code: "BD", description: "Burnishing Drill", category: "Drill", format: "BD DDDD LLL NN", example: "BD 0700 107 01", isDrill: true },
  { code: "GD", description: "Gun Drill", category: "Drill", format: "GD DDDD LLL NN", example: "GD 2450 250 01", isDrill: true },
  { code: "MD", description: "Modular Drill (diameter range)", category: "Drill", format: "MD DMIN DMAX LLL NN", example: "MD 3600 4700 210 01", isDrill: true, isRange: true },
  { code: "SD", description: "Spade Drill (diameter range)", category: "Drill", format: "SD DMIN DMAX LLL NN", example: "SD 3600 4700 210 01", isDrill: true, isRange: true },
  { code: "UD", description: "U-Drill", category: "Drill", format: "UD DDDD LLL NN", example: "UD 2450 250 01", isDrill: true },
  { code: "HD", description: "HSS Drill", category: "Drill", format: "HD DDDD LLL NN", example: "HD 0250 025 01", isDrill: true },
  { code: "EM", description: "End Mill", category: "Mill", format: "EM DDDD LLL NN", example: "EM 1400 030 01" },
  { code: "EMR", description: "End Mill (radius)", category: "Mill", format: "EMR DDDD LLL NN", example: "EMR 1400 030 01" },
  { code: "BM", description: "Ball Nose End Mill", category: "Mill", format: "BM DDDD LLL NN", example: "BM 0300 005 01" },
  { code: "SM", description: "Shoulder Mill", category: "Mill", format: "SM DDDD LLL NN", example: "SM 2500 050 01" },
  { code: "FM", description: "Face Mill", category: "Mill", format: "FM DDDD LLL NN", example: "FM 1250 060 01" },
  { code: "TC", description: "T-Slot Cutter", category: "Mill", format: "TC DDDD LLL NN", example: "TC 1100 005 01" },
  { code: "CT", description: "Chamfer Tool", category: "Mill", format: "CT DDDD LLL NN", example: "CT 1500 045 01" },
  { code: "RM", description: "Reamer", category: "Ream/Bore", format: "RM DDDD[tol] LLL NN", example: "RM 16G7 090 01", isToleranceAllowed: true },
  { code: "BT", description: "Boring / Burnishing Tool", category: "Ream/Bore", format: "BT DDDD LLL NN", example: "BT 2450 050 01" },
  { code: "BB", description: "Boring Bar", category: "Ream/Bore", format: "BB DDDD LLL NN", example: "BB 2000 060 01" },
  { code: "BBT", description: "Back Boring Tool", category: "Ream/Bore", format: "BBT 2280 025 01", example: "BBT 2280 025 01" },
  { code: "PB", description: "Blum Probe", category: "Probe", format: "PB DDDD LLL NN", example: "PB 0600 060 01" },

  // Cavity & Thread
  { code: "CR", description: "Cavity Rough", category: "Cavity", format: "CR <NAME> NN", example: "CR C-10-2 01" },
  { code: "CF", description: "Cavity Finish", category: "Cavity", format: "CF <NAME> NN", example: "CF C-10-2 01" },
  { code: "CRT", description: "Cavity Rough Top", category: "Cavity", format: "CRT T21A 01", example: "CRT T21A 01" },
  { code: "CFT", description: "Cavity Finish Top", category: "Cavity", format: "CFT T21A 01", example: "CFT T21A 01" },
  { code: "CRB", description: "Cavity Rough Bottom", category: "Cavity", format: "CRB T21A 01", example: "CRB T21A 01" },
  { code: "CFB", description: "Cavity Finish Bottom", category: "Cavity", format: "CFB T21A 01", example: "CFB T21A 01" },
  { code: "CP", description: "Cavity Port", category: "Cavity", format: "CP ECY 01", example: "CP ECY 01" },
  { code: "CD", description: "Cavity Drill", category: "Cavity", format: "CD 380 01", example: "CD 380 01" },
  { code: "CRM", description: "Cavity Reamer", category: "Cavity", format: "CRM T162A 01", example: "CRM T162A 01" },
  { code: "TR", description: "Trepanning Head", category: "Cavity", format: "TR CA148 01", example: "TR CA148 01" },
  { code: "TP", description: "Tap (ISO 2283 / DIN 2197)", category: "Thread", format: "TP THREAD LLL F NN", example: "TP M10X1.5 026 C 01", isTap: true },
  { code: "TM", description: "Thread Mill", category: "Thread", format: "TM TPI FORM LLL NN", example: "TM 12 UN 025 01" },
  { code: "SB", description: "Step Boring", category: "Ream/Bore", format: "SB DDDD/EEEE LLL NN", example: "SB 2000/2500 100 01" },
  { code: "TMH", description: "Thread Mill Holder", category: "Thread", format: "TMH DDDD PITCH D<corr> Z<n> NN", example: "TMH 2200 11W D0.02 Z3 02" },

  // Accessory / Holder
  { code: "ER", description: "ER Collet Chuck", category: "Holder & Adapter", format: "ERnn LLL NN", example: "ER32 100 01", isHolder: true },
  { code: "SLA", description: "Side-Lock (Weldon) Adapter", category: "Holder & Adapter", format: "SLAnn LLL NN", example: "SLA25 110 01", isHolder: true },
  { code: "HG", description: "Hydraulic Chuck", category: "Holder & Adapter", format: "HGnn LLL NN", example: "HG20 090 01", isHolder: true },
  { code: "SF", description: "Shrink-Fit Chuck", category: "Holder & Adapter", format: "SFnn LLL NN", example: "SF16 090 01", isHolder: true },
  { code: "FMA", description: "Face-Mill Arbor", category: "Holder & Adapter", format: "FMAnn LLL NN", example: "FMA40 060 01", isHolder: true },
  { code: "MT", description: "Morse-Taper Adapter", category: "Holder & Adapter", format: "MTn LLL NN", example: "MT03 140 01", isHolder: true },
  { code: "DC", description: "Drill-Chuck Adapter", category: "Holder & Adapter", format: "DCnn LLL NN", example: "DC13 090 01", isHolder: true },
  { code: "PM", description: "Power-Mill Adapter", category: "Holder & Adapter", format: "PMnn LLL NN", example: "PM32 100 01", isHolder: true },
  { code: "TA", description: "Tap Adapter", category: "Holder & Adapter", format: "TAnn LLL NN", example: "TA20 090 01", isHolder: true },
  { code: "BH", description: "Boring Head / Cartridge", category: "Holder & Adapter", format: "BH <CODE> NN", example: "BH 3650 01" },

  // Turning & Inserts
  { code: "TH", description: "Turning Holder (ISO)", category: "Turning & Inserts", format: "TH <ISO> NN", example: "TH TCLNL4040P19 01" },
  { code: "TI", description: "Turning Insert (ISO)", category: "Turning & Inserts", format: "TI <ISO> NN", example: "TI VBMT160404 01" },
  { code: "MI", description: "Milling Insert (ISO)", category: "Turning & Inserts", format: "MI <ISO> NN", example: "MI 9250D22 01" },
  { code: "DI", description: "Drilling Insert (dimensioned)", category: "Turning & Inserts", format: "DI DDDD <M><TT> NN", example: "DI 1200 CSP 01" },

  // HSS Tooling (Prefix H)
  { code: "HDS", description: "HSS Step / Subland Drill", category: "HSS Tooling", format: "HDS DDDD LLL NN", example: "HDS 0600 050 01", isDrill: true },
  { code: "HDC", description: "HSS Centre Drill", category: "HSS Tooling", format: "HDC DDDD LLL NN", example: "HDC 0500 040 01", isDrill: true },
  { code: "HEM", description: "HSS End Mill", category: "HSS Tooling", format: "HEM DDDD LLL NN", example: "HEM 1000 025 01" },
  { code: "HSD", description: "HSS Slot Drill (2-flute)", category: "HSS Tooling", format: "HSD DDDD LLL NN", example: "HSD 0800 020 01" },
  { code: "HBM", description: "HSS Ball Nose End Mill", category: "HSS Tooling", format: "HBM DDDD LLL NN", example: "HBM 0600 015 01" },
  { code: "HFC", description: "HSS Form / Profile Cutter", category: "HSS Tooling", format: "HFC 2000 010 01", example: "HFC 2000 010 01" },
  { code: "HRM", description: "HSS Reamer", category: "HSS Tooling", format: "HRM DDDD[tol] LLL NN", example: "HRM 12H7 050 01", isToleranceAllowed: true },
  { code: "HCS", description: "HSS Countersink", category: "HSS Tooling", format: "HCS DDDD ANG NN", example: "HCS 1000 090 01" },
  { code: "HCB", description: "HSS Counterbore", category: "HSS Tooling", format: "HCB DDDD LLL NN", example: "HCB 1100 040 01" },
  { code: "HTP", description: "HSS Tap", category: "HSS Tooling", format: "HTP THREAD LLL NN", example: "HTP M10X1.5 026 01", isTap: true },
];

export const DRILL_CODES = new Set(["SC", "BD", "GD", "MD", "SD", "UD", "HD", "HDS", "HDC"]);

/**
 * Drill length band calculation:
 * For DRILLS the length field is a BAND, not the exact mm.
 * - 10 mm bands up to 100 mm (e.g. 41-50 -> 040, 50 -> 040, 91-100 -> 090)
 * - 20 mm bands above 100 mm (e.g. 101-120 -> 100, 130 -> 120)
 * Labelled by lower bound, UPPER-INCLUSIVE: length L -> ((L - 1) // width) * width
 */
export function calcDrillLengthBand(lengthMm: number): string {
  const L = Math.round(lengthMm);
  if (L <= 0) return "000";
  if (L <= 100) {
    const band = Math.floor((L - 1) / 10) * 10;
    return String(band).padStart(3, "0");
  } else {
    const over100 = L - 100;
    const bandOver = Math.floor((over100 - 1) / 20) * 20;
    const band = 100 + bandOver;
    return String(band).padStart(3, "0");
  }
}

/**
 * Formats diameter in standard 4-digit mm x100 (e.g., 6.8 -> 0680, 12 -> 1200)
 * Preserves tolerance fit class if present (e.g. 16G7, 20H6, 32H7, 19E8).
 */
export function formatDiameter(dia: string | number, tolerance?: string): string {
  const diaStr = String(dia).trim();
  const tolStr = (tolerance ?? "").trim().toUpperCase();

  // If already contains tolerance (e.g. "16G7" or "12H7")
  const matchTol = diaStr.match(/^(\d+(?:\.\d+)?)([A-Z]\d+)$/i);
  if (matchTol) {
    const numPart = matchTol[1];
    const tolPart = matchTol[2].toUpperCase();
    const d = String(Math.round(Number(numPart) * 100)).padStart(4, "0");
    return `${d}${tolPart}`;
  }

  const num = Number(diaStr);
  if (!Number.isNaN(num) && num > 0) {
    const d = String(Math.round(num * 100)).padStart(4, "0");
    return tolStr ? `${d}${tolStr}` : d;
  }

  return diaStr.toUpperCase();
}

/**
 * Builds the standard Tool ID Base before NN variant suffix
 */
export function buildStandardToolIdBase(opts: {
  code: string;
  dia?: string | number;
  tolerance?: string;
  diaMax?: string | number; // for MD/SD range
  length?: string | number;
  chamferForm?: "A" | "B" | "C" | "D" | "E" | "";
  nameCode?: string;
}): string {
  const code = (opts.code ?? "").trim().toUpperCase();
  const typeDef = TOOL_TYPES.find((t) => t.code === code);

  // Range drills: MD / SD (XX DMIN DMAX LLL)
  if (typeDef?.isRange && opts.dia && opts.diaMax) {
    const dmin = formatDiameter(opts.dia);
    const dmax = formatDiameter(opts.diaMax);
    const lenVal = opts.length != null ? Number(opts.length) : 0;
    const l = calcDrillLengthBand(lenVal);
    return `${code} ${dmin} ${dmax} ${l}`;
  }

  // Dimensioned types:
  if (typeDef?.category === "Drill" || typeDef?.category === "Mill" || typeDef?.category === "Ream/Bore" || typeDef?.category === "Probe" || typeDef?.category === "HSS Tooling") {
    if (opts.dia != null && opts.dia !== "") {
      const d = formatDiameter(opts.dia, opts.tolerance);
      const lenVal = opts.length != null ? Number(opts.length) : 0;
      const isDrill = DRILL_CODES.has(code);
      const l = isDrill ? calcDrillLengthBand(lenVal) : String(Math.trunc(lenVal)).padStart(3, "0");
      return `${code} ${d} ${l}`;
    }
  }

  // Taps: TP / HTP (XX THREAD LLL [F])
  if (typeDef?.isTap) {
    const thread = (opts.nameCode ?? "").trim().toUpperCase();
    const lenVal = opts.length != null ? String(Math.trunc(Number(opts.length))).padStart(3, "0") : "000";
    const form = (opts.chamferForm ?? "").trim().toUpperCase();
    return form ? `${code} ${thread} ${lenVal} ${form}` : `${code} ${thread} ${lenVal}`;
  }

  // Default named/code tools (Cavity, Turning, Holders):
  const namePart = (opts.nameCode ?? "").trim().toUpperCase();
  if (namePart) {
    if (opts.length != null && opts.length !== "") {
      const lenVal = String(Math.trunc(Number(opts.length))).padStart(3, "0");
      return `${code} ${namePart} ${lenVal}`;
    }
    return `${code} ${namePart}`;
  }

  return code;
}
