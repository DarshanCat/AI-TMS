"use client";
import { useMemo, useState } from "react";

export interface Row {
  tool_id: string; name: string | null; type: string | null; status: string;
  loc: string | null; avail: number; inuse: number; wregr: number;
  atregr: number; wscrap: number; scrap: number; owned: number; life: number | null;
}

const CHIP: Record<string, string> = {
  "Available": "chip-avail", "In Use": "chip-inuse", "Waiting Regrind": "chip-wregr",
  "At Regrind": "chip-atregr", "Waiting Scrap": "chip-wscrap", "None/Scrapped": "chip-scrap",
};

export default function InventoryTable({ rows, live }: { rows: Row[]; live: boolean }) {
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("All");
  const [sortKey, setSortKey] = useState<keyof Row>("tool_id");
  const [asc, setAsc] = useState(true);

  const statuses = useMemo(
    () => ["All", ...Array.from(new Set(rows.map((r) => r.status))).sort()],
    [rows],
  );

  const view = useMemo(() => {
    let out = rows;
    if (status !== "All") out = out.filter((r) => r.status === status);
    if (q.trim()) {
      const s = q.toLowerCase();
      out = out.filter((r) =>
        r.tool_id.toLowerCase().includes(s) || (r.name ?? "").toLowerCase().includes(s));
    }
    out = [...out].sort((a, b) => {
      const x = a[sortKey], y = b[sortKey];
      const c = typeof x === "number" && typeof y === "number"
        ? x - y : String(x ?? "").localeCompare(String(y ?? ""));
      return asc ? c : -c;
    });
    return out;
  }, [rows, q, status, sortKey, asc]);

  const sortBy = (k: keyof Row) => {
    if (k === sortKey) setAsc(!asc);
    else { setSortKey(k); setAsc(true); }
  };
  const arrow = (k: keyof Row) => (k === sortKey ? (asc ? " ▲" : " ▼") : "");

  return (
    <>
      <div className="toolbar">
        <input className="input" style={{ maxWidth: 280 }} placeholder="Search tool ID or name…"
          value={q} onChange={(e) => setQ(e.target.value)} />
        <select className="select" style={{ maxWidth: 200 }} value={status} onChange={(e) => setStatus(e.target.value)}>
          {statuses.map((s) => <option key={s}>{s}</option>)}
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
              <th style={{ cursor: "pointer" }} onClick={() => sortBy("tool_id")}>Tool ID{arrow("tool_id")}</th>
              <th style={{ cursor: "pointer" }} onClick={() => sortBy("name")}>Name{arrow("name")}</th>
              <th style={{ cursor: "pointer" }} onClick={() => sortBy("type")}>Type{arrow("type")}</th>
              <th style={{ cursor: "pointer" }} onClick={() => sortBy("status")}>Status{arrow("status")}</th>
              <th>Location</th>
              <th className="right" style={{ cursor: "pointer" }} onClick={() => sortBy("avail")}>Avail{arrow("avail")}</th>
              <th className="right">In use</th>
              <th className="right">W.Regr</th>
              <th className="right">Owned</th>
              <th className="right">Life</th>
            </tr>
          </thead>
          <tbody>
            {view.map((r) => (
              <tr key={r.tool_id}>
                <td className="id">{r.tool_id}</td>
                <td>{r.name}</td>
                <td className="muted">{r.type}</td>
                <td><span className={"chip " + (CHIP[r.status] ?? "chip-scrap")}>{r.status}</span></td>
                <td className="muted">{r.loc}</td>
                <td className="num">{r.avail}</td>
                <td className="num">{r.inuse}</td>
                <td className="num">{r.wregr}</td>
                <td className="num">{r.owned}</td>
                <td className="num">{r.life ?? "—"}</td>
              </tr>
            ))}
            {view.length === 0 && (
              <tr><td colSpan={10} className="muted" style={{ textAlign: "center", padding: 24 }}>No tools match.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}