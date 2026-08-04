"use client";
import { useMemo, useState } from "react";

export interface ScrapRow {
  tool_id: string; name: string | null; type: string | null; loc: string | null;
  scrapped_at: string; scrapped_qty: number; person: string | null;
  condition: string | null; remarks: string | null;
}

function fmtTs(ts: string) {
  if (ts === "—") return ts;
  const d = new Date(ts.replace(" ", "T"));
  if (isNaN(d.getTime())) return ts;
  return d.toLocaleString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

export default function ScrapTable({ rows, live }: { rows: ScrapRow[]; live: boolean }) {
  const [q, setQ] = useState("");

  const view = useMemo(() => {
    if (!q.trim()) return rows;
    const s = q.toLowerCase();
    return rows.filter((r) =>
      r.tool_id.toLowerCase().includes(s) || (r.name ?? "").toLowerCase().includes(s) || (r.person ?? "").toLowerCase().includes(s));
  }, [rows, q]);

  return (
    <>
      <div className="toolbar">
        <input className="input" style={{ maxWidth: 280 }} placeholder="Search tool ID, name, or person…"
          value={q} onChange={(e) => setQ(e.target.value)} />
        <div className="spacer" />
        <span className="muted" style={{ fontSize: 12 }}>{view.length.toLocaleString()} shown{!live && " (sample)"}</span>
      </div>

      <div className="panel" style={{ overflow: "auto", maxHeight: "70vh" }}>
        <table className="tbl">
          <thead>
            <tr>
              <th>Tool ID</th><th>Name</th><th>Type</th><th>Scrapped</th>
              <th className="right">Qty</th><th>Reason</th><th>By</th><th>Remarks</th>
            </tr>
          </thead>
          <tbody>
            {view.map((r) => (
              <tr key={r.tool_id}>
                <td className="id">{r.tool_id}</td>
                <td>{r.name}</td>
                <td className="muted">{r.type}</td>
                <td className="muted">{fmtTs(r.scrapped_at)}</td>
                <td className="num">{r.scrapped_qty}</td>
                <td><span className="chip chip-wscrap">{r.condition || "—"}</span></td>
                <td className="muted">{r.person || "—"}</td>
                <td className="muted">{r.remarks || "—"}</td>
              </tr>
            ))}
            {view.length === 0 && (
              <tr><td colSpan={8} className="muted" style={{ textAlign: "center", padding: 24 }}>No scrapped tools on record.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}