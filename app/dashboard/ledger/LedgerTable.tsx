"use client";
import { useMemo, useState } from "react";

export interface LedgerRow {
  id: number; ts: string; tool_id: string; txn_type: string; qty: number;
  person: string | null; machine: string | null; tofrom: string | null;
  dc: string | null; condition: string | null; life: number | null; remarks: string | null;
}

// each transaction type gets a chip colour that matches its meaning
const TXN_CHIP: Record<string, string> = {
  INWARD: "chip-avail", ISSUE: "chip-inuse", RECEIVE: "chip-avail",
  CHIPOFF: "chip-wregr", DISPATCH: "chip-atregr", RECEIPT: "chip-avail",
  SCRAP: "chip-wscrap",
};

const TYPES = ["All", "INWARD", "ISSUE", "RECEIVE", "CHIPOFF", "DISPATCH", "RECEIPT", "SCRAP"];

function fmtTs(ts: string) {
  // keep it compact: "16 Jul 14:09"
  const d = new Date(ts.replace(" ", "T"));
  if (isNaN(d.getTime())) return ts;
  return d.toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}

export default function LedgerTable({ rows, live }: { rows: LedgerRow[]; live: boolean }) {
  const [q, setQ] = useState("");
  const [type, setType] = useState("All");

  const view = useMemo(() => {
    let out = rows;
    if (type !== "All") out = out.filter((r) => r.txn_type === type);
    if (q.trim()) {
      const s = q.toLowerCase();
      out = out.filter((r) =>
        r.tool_id.toLowerCase().includes(s) ||
        (r.person ?? "").toLowerCase().includes(s) ||
        (r.dc ?? "").toLowerCase().includes(s));
    }
    return out;
  }, [rows, q, type]);

  return (
    <>
      <div className="toolbar">
        <input className="input" style={{ maxWidth: 280 }} placeholder="Search tool ID, person, or DC…"
          value={q} onChange={(e) => setQ(e.target.value)} />
        <select className="select" style={{ maxWidth: 180 }} value={type} onChange={(e) => setType(e.target.value)}>
          {TYPES.map((t) => <option key={t}>{t}</option>)}
        </select>
        <div className="spacer" />
        <span className="muted" style={{ fontSize: 12 }}>
          {view.length.toLocaleString()} shown{!live && " (sample)"}
        </span>
      </div>

      <div className="panel" style={{ overflow: "auto", maxHeight: "70vh" }}>
        <table className="tbl">
          <thead>
            <tr>
              <th>When</th>
              <th>Tool ID</th>
              <th>Type</th>
              <th className="right">Qty</th>
              <th>Person</th>
              <th>Machine</th>
              <th>To / From</th>
              <th>DC / GRN</th>
              <th className="right">Life</th>
              <th>Remarks</th>
            </tr>
          </thead>
          <tbody>
            {view.map((r) => (
              <tr key={r.id}>
                <td className="muted" style={{ whiteSpace: "nowrap" }}>{fmtTs(r.ts)}</td>
                <td className="id">{r.tool_id}</td>
                <td><span className={"chip " + (TXN_CHIP[r.txn_type] ?? "chip-scrap")}>{r.txn_type}</span></td>
                <td className="num">{r.qty}</td>
                <td>{r.person}</td>
                <td className="muted">{r.machine || "—"}</td>
                <td className="muted">{r.tofrom || "—"}</td>
                <td className="id">{r.dc || "—"}</td>
                <td className="num">{r.life ?? "—"}</td>
                <td className="muted" style={{ maxWidth: 220, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {r.remarks || ""}
                </td>
              </tr>
            ))}
            {view.length === 0 && (
              <tr><td colSpan={10} className="muted" style={{ textAlign: "center", padding: 24 }}>No transactions match.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}