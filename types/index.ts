export type TxnType =
  | "INWARD" | "ISSUE" | "RECEIVE" | "CHIPOFF" | "DISPATCH" | "RECEIPT" | "SCRAP";

export interface InventoryRow {
  tool_id: string; name: string; type: string; status: string; loc: string;
  avail: number; inuse: number; wregr: number; atregr: number;
  wscrap: number; scrap: number; owned: number; life: number | null;
}

export interface Txn {
  id: string; type: TxnType; qty: number; person?: string;
  machine?: string; tofrom?: string; dc?: string; condition?: string;
  life?: number | null; remark?: string;
  newTool?: { name: string; type: string; loc: string };
}

export interface Delta {
  avail: number; inuse: number; wregr: number; atregr: number; wscrap: number; scrap: number;
}

export interface EngineResult {
  ok: boolean; checks: string[]; errors: string[]; warnings: string[];
  delta?: Delta; remark?: string;
}