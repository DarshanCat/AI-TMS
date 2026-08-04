"use client";
import { useMemo, useState } from "react";
import * as XLSX from "xlsx";

export interface LedgerRow {
  id: number; ts: string; tool_id: string; txn_type: string; qty: number;
  person: string | null; machine: string | null; tofrom: string | null; remarks: string | null;
}

const CHIP: Record<string, string> = {
  INWARD: "chip-avail", ISSUE: "chip-inuse", RECEIVE: "chip-avail",
  CHIPOFF: "chip-wregr", DISPATCH: "chip-atregr", RECEIPT: "chip-avail", SCRAP: "chip-wscrap",
};
const dateKey = (ts: string) => (ts ? ts.slice(0, 10) : "undated");
const today = new Date().toISOString().slice(0, 10);
const yday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
const dayLabel = (d: string) => (d === today ? "Today" : d === yday ? "Yesterday" : "");
const weekday = (d: string) => { try { return new Date(d + "T00:00").toLocaleDateString(undefined, { weekday: "long" }); } catch { return ""; } };
const timeOf = (ts: string) => { const d = new Date(ts); return isNaN(d.getTime()) ? "—" : d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }); };

function breakdown(rows: LedgerRow[]): [string, number][] {
  const c: Record<string, number> = {};
  rows.forEach((r) => { c[r.txn_type] = (c[r.txn_type] ?? 0) + 1; });
  return Object.entries(c).sort((a, b) => b[1] - a[1]);
}

export default function DailyView({ rows }: { rows: LedgerRow[] }) {
  const [sel, setSel] = useState<string | null>(null);

  const byDate = useMemo(() => {
    const m = new Map<string, LedgerRow[]>();
    for (const r of rows) {
      const d = dateKey(r.ts);
      if (!m.has(d)) m.set(d, []);
      m.get(d)!.push(r);
    }
    return m;
  }, [rows]);
  const dates = useMemo(() => [...byDate.keys()].sort().reverse(), [byDate]);

  function exportDay(d: string, dayRows: LedgerRow[]) {
    const data = dayRows.map((r) => ({
      "Txn ID": `TX-${r.id}`, Timestamp: r.ts, "Tool ID": r.tool_id, Type: r.txn_type,
      Qty: r.qty, Machine: r.machine ?? "", "To / From": r.tofrom ?? "",
      Person: r.person ?? "", Remarks: r.remarks ?? "",
    }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(data), "Transactions");
    XLSX.writeFile(wb, `TMS_Daily_${d}.xlsx`);
  }

  if (!sel) {
    return (
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(210px,1fr))", gap: 12 }}>
        {dates.map((d) => {
          const dayRows = byDate.get(d)!;
          return (
            <button key={d} onClick={() => setSel(d)} className="panel"
              style={{ textAlign: "left", cursor: "pointer", padding: 14, background: "var(--panel)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                <span style={{ fontSize: 20 }}>🗂</span>
                {dayLabel(d) && <span className="chip chip-inuse">{dayLabel(d)}</span>}
              </div>
              <div className="id" style={{ fontWeight: 700 }}>{d}</div>
              <div className="muted" style={{ fontSize: 12, marginBottom: 8 }}>{weekday(d)}</div>
              <div style={{ fontSize: 13, marginBottom: 8 }}><b>{dayRows.length}</b> transaction{dayRows.length !== 1 ? "s" : ""}</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                {breakdown(dayRows).slice(0, 4).map(([t, n]) => (
                  <span key={t} className={"chip " + (CHIP[t] ?? "chip-scrap")} style={{ fontSize: 10 }}>{t} {n}</span>
                ))}
              </div>
            </button>
          );
        })}
        {dates.length === 0 && <div className="muted" style={{ padding: 24 }}>No transactions yet.</div>}
      </div>
    );
  }

  const dayRows = [...(byDate.get(sel) ?? [])].sort((a, b) => b.ts.localeCompare(a.ts));

  return (
    <div>
      <div className="toolbar">
        <button className="btn-ghost" style={{ border: "1px solid var(--line)", cursor: "pointer" }} onClick={() => setSel(null)}>← All days</button>
        <div>
          <div className="id" style={{ fontWeight: 700, fontSize: 16 }}>
            {sel} {dayLabel(sel) && <span style={{ color: "var(--accent)" }}>· {dayLabel(sel)}</span>}
          </div>
          <div className="muted" style={{ fontSize: 12 }}>{weekday(sel)} · {dayRows.length} transactions</div>
        </div>
        <div className="spacer" />
        <button className="btn" onClick={() => exportDay(sel, dayRows)}>⬇ Export day (.xlsx)</button>
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 14 }}>
        {breakdown(dayRows).map(([t, n]) => (
          <span key={t} className={"chip " + (CHIP[t] ?? "chip-scrap")}>{t} · {n}</span>
        ))}
      </div>

      <div className="panel" style={{ overflow: "auto", maxHeight: "62vh" }}>
        <table className="tbl">
          <thead><tr><th>Time</th><th>Txn</th><th>Tool ID</th><th>Type</th><th className="right">Qty</th><th>To / From</th><th>By</th><th>Remarks</th></tr></thead>
          <tbody>
            {dayRows.map((r) => (
              <tr key={r.id}>
                <td className="muted" style={{ fontSize: 12 }}>{timeOf(r.ts)}</td>
                <td className="id">TX-{r.id}</td>
                <td className="id">{r.tool_id}</td>
                <td><span className={"chip " + (CHIP[r.txn_type] ?? "chip-scrap")}>{r.txn_type}</span></td>
                <td className="num">{r.qty}</td>
                <td className="muted" style={{ fontSize: 12 }}>{r.tofrom || r.machine || "—"}</td>
                <td>{r.person || "—"}</td>
                <td className="muted" style={{ fontSize: 11.5 }}>{r.remarks || ""}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}