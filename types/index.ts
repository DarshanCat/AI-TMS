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
  newTool?: {
    name: string; type: string; loc: string;
    typecode?: string; dia?: number | null; length?: number | null; nameCode?: string;
  };
  part_no?: string; work_order?: string; po_no?: string;
  brand?: string; unit_price?: number | null; regrind_cost?: number | null;
  issued_by?: string;
  // client-side correlation key — lets the UI match a result back to its row
  // even when the server assigns a brand-new, system-generated Tool ID.
  rowKey?: string;
}