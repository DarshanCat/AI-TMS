// Field definitions mirror the six Excel log templates exactly.
export type FieldType = "text" | "number" | "date" | "select";
export type Scope = "header" | "row";

export interface FieldSpec {
  key: string;               // internal key
  label: string;             // shown to user (matches the Excel column)
  type: FieldType;
  scope: Scope;              // header = filled once; row = per tool
  options?: string[];        // for select
  placeholder?: string;
  maps?: "person" | "machine" | "tofrom" | "dc" | "condition" | "life"; // -> engine txn field
}

export interface LogSpec {
  key: string;
  txn: "INWARD" | "ISSUE" | "RECEIVE" | "CHIPOFF" | "DISPATCH" | "RECEIPT";
  title: string;
  blurb: string;
  fields: FieldSpec[];       // excludes Tool ID + Qty (always present)
}

export const LOGS: LogSpec[] = [
  {
    key: "inward", txn: "INWARD", title: "1 · Inward",
    blurb: "New / purchased tools arriving into the VSPL store.",
    fields: [
      { key: "date", label: "Date", type: "date", scope: "header" },
      { key: "newtool", label: "New Tool?", type: "select", scope: "row", options: ["N", "Y"] },
      { key: "class", label: "Class", type: "text", scope: "row" },
      { key: "supplier", label: "Supplier Name", type: "text", scope: "header", maps: "tofrom" },
      { key: "supcode", label: "Supplier Code", type: "text", scope: "header" },
      { key: "po", label: "PO No", type: "text", scope: "header" },
      { key: "grn", label: "Invoice / GRN", type: "text", scope: "header", maps: "dc" },
      { key: "price", label: "Unit Price", type: "number", scope: "row" },
      { key: "brand", label: "Brand", type: "text", scope: "row" },
      { key: "person", label: "Received By", type: "text", scope: "header", maps: "person" },
      { key: "remarks", label: "Remarks", type: "text", scope: "row" },
    ],
  },
  {
    key: "issue", txn: "ISSUE", title: "2 · Issue to operations",
    blurb: "Store → shop floor. Reduces Available, raises In Use.",
    fields: [
      { key: "date", label: "Date", type: "date", scope: "header" },
      { key: "lifeissue", label: "Tool Life at Issue", type: "number", scope: "row", maps: "life" },
      { key: "issuedto", label: "Issued To", type: "select", scope: "header", options: ["Operation", "Subcon"] },
      { key: "machine", label: "Machine / Subcontractor", type: "text", scope: "header", maps: "machine" },
      { key: "dc", label: "DC No (if subcon)", type: "text", scope: "header", maps: "dc" },
      { key: "partno", label: "Part No", type: "text", scope: "header" },
      { key: "wo", label: "Work Order No", type: "text", scope: "header" },
      { key: "person", label: "Person (Taken By)", type: "text", scope: "header", maps: "person" },
      { key: "issuedby", label: "Issued By (Store)", type: "text", scope: "header" },
      { key: "expret", label: "Expected Return Date", type: "date", scope: "header" },
      { key: "remarks", label: "Remarks", type: "text", scope: "row" },
    ],
  },
  {
    key: "return", txn: "RECEIVE", title: "3 · Return from operations",
    blurb: "Shop floor → store. Enter cumulative tool life on return.",
    fields: [
      { key: "date", label: "Date", type: "date", scope: "header" },
      { key: "lifereturn", label: "Tool Life at Return (ENTER)", type: "number", scope: "row", maps: "life" },
      { key: "returnedfrom", label: "Returned From", type: "select", scope: "header", options: ["Operation", "Subcon"] },
      { key: "machine", label: "Machine / Subcontractor", type: "text", scope: "header", maps: "machine" },
      { key: "dc", label: "DC No (if subcon)", type: "text", scope: "header", maps: "dc" },
      { key: "condition", label: "Tool Condition", type: "select", scope: "row", options: ["Good", "Worn", "Chip-off", "Broken"] },
      { key: "person", label: "Person (Returned By)", type: "text", scope: "header", maps: "person" },
      { key: "receivedby", label: "Received By (Store)", type: "text", scope: "header" },
      { key: "remarks", label: "Remarks", type: "text", scope: "row" },
    ],
  },
  {
    key: "chipoff", txn: "CHIPOFF", title: "4 · Chip-off / Broken",
    blurb: "Flag damaged tools. Chip-off → waiting regrind; Broken → waiting scrap.",
    fields: [
      { key: "date", label: "Date", type: "date", scope: "header" },
      { key: "condition", label: "Damage Condition", type: "select", scope: "row", options: ["Chip-off", "Broken"], maps: "condition" },
      { key: "lifefail", label: "Tool Life at Failure", type: "number", scope: "row", maps: "life" },
      { key: "machine", label: "Machine", type: "text", scope: "header", maps: "machine" },
      { key: "partno", label: "Part No", type: "text", scope: "header" },
      { key: "person", label: "Reported By", type: "text", scope: "header", maps: "person" },
      { key: "receivedby", label: "Received By (Store)", type: "text", scope: "header" },
      { key: "remarks", label: "Remarks", type: "text", scope: "row" },
    ],
  },
  {
    key: "dispatch", txn: "DISPATCH", title: "5 · Regrind / Scrap dispatch",
    blurb: "Send waiting-regrind tools out to a vendor (or to scrap).",
    fields: [
      { key: "date", label: "Date", type: "date", scope: "header" },
      { key: "dispatchto", label: "Dispatch To", type: "select", scope: "header", options: ["Regrind", "Scrap"] },
      { key: "vendor", label: "Regrind Vendor", type: "text", scope: "header", placeholder: "type vendor name", maps: "tofrom" },
      { key: "dc", label: "DC No", type: "text", scope: "header", maps: "dc" },
      { key: "person", label: "Sent By (Store)", type: "text", scope: "header", maps: "person" },
      { key: "remarks", label: "Remarks", type: "text", scope: "row" },
    ],
  },
  {
    key: "receipt", txn: "RECEIPT", title: "6 · Regrind receipt",
    blurb: "Reground tools coming back from the vendor into the store.",
    fields: [
      { key: "date", label: "Date", type: "date", scope: "header" },
      { key: "vendor", label: "Regrind Vendor (From)", type: "text", scope: "header", placeholder: "type vendor name", maps: "tofrom" },
      { key: "dc", label: "DC No", type: "text", scope: "header", maps: "dc" },
      { key: "lifeafter", label: "Tool Life After Regrind (ENTER)", type: "number", scope: "row", maps: "life" },
      { key: "cost", label: "Regrind Cost", type: "number", scope: "row" },
      { key: "person", label: "Received By (Store)", type: "text", scope: "header", maps: "person" },
      { key: "remarks", label: "Remarks", type: "text", scope: "row" },
    ],
  },
];