"use client";
import { useState } from "react";
import { LOGS, type LogSpec, type FieldSpec } from "./logs";

type Vals = Record<string, string>;
interface RowDraft { tool_id: string; qty: string; vals: Vals; }
interface PostResult { id: string; ok: boolean; errors: string[]; warnings: string[]; txn_id?: string; }

const today = () => new Date().toISOString().slice(0, 10);

function initHeader(log: LogSpec): Vals {
  const v: Vals = {};
  log.fields.filter((f) => f.scope === "header").forEach((f) => {
    v[f.key] = f.type === "date" ? today() : f.type === "select" ? (f.options?.[0] ?? "") : "";
  });
  return v;
}
function initRow(log: LogSpec): RowDraft {
  const v: Vals = {};
  log.fields.filter((f) => f.scope === "row").forEach((f) => {
    v[f.key] = f.type === "select" ? (f.options?.[0] ?? "") : "";
  });
  return { tool_id: "", qty: "1", vals: v };
}

function Field({ f, value, onChange }: { f: FieldSpec; value: string; onChange: (v: string) => void }) {
  if (f.type === "select")
    return (
      <select className="select" value={value} onChange={(e) => onChange(e.target.value)}>
        {f.options!.map((o) => <option key={o}>{o}</option>)}
      </select>
    );
  return (
    <input className={"input" + (f.type === "number" ? " num" : "")}
      type={f.type === "number" ? "number" : f.type === "date" ? "date" : "text"}
      placeholder={f.placeholder ?? ""} value={value} onChange={(e) => onChange(e.target.value)} />
  );
}

export default function InboxForms() {
  const [active, setActive] = useState<LogSpec>(LOGS[0]);
  const [header, setHeader] = useState<Vals>(() => initHeader(LOGS[0]));
  const [rows, setRows] = useState<RowDraft[]>(() => [initRow(LOGS[0])]);
  const [results, setResults] = useState<PostResult[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [summary, setSummary] = useState("");

  const headerFields = active.fields.filter((f) => f.scope === "header");
  const rowFields = active.fields.filter((f) => f.scope === "row");

  function pick(log: LogSpec) {
    setActive(log); setHeader(initHeader(log)); setRows([initRow(log)]);
    setResults(null); setSummary("");
  }
  const setH = (k: string, v: string) => setHeader((h) => ({ ...h, [k]: v }));
  const setRTool = (i: number, v: string) => setRows((rs) => rs.map((r, j) => j === i ? { ...r, tool_id: v } : r));
  const setRQty = (i: number, v: string) => setRows((rs) => rs.map((r, j) => j === i ? { ...r, qty: v } : r));
  const setRVal = (i: number, k: string, v: string) =>
    setRows((rs) => rs.map((r, j) => j === i ? { ...r, vals: { ...r.vals, [k]: v } } : r));
  const addRow = () => setRows((rs) => [...rs, initRow(active)]);
  const delRow = (i: number) => setRows((rs) => rs.length === 1 ? rs : rs.filter((_, j) => j !== i));

  // pull an engine field (person/machine/tofrom/dc/condition/life) from header+row values
  function mapped(name: string, row: RowDraft): string {
    const f = active.fields.find((x) => x.maps === name);
    if (!f) return "";
    return (f.scope === "header" ? header[f.key] : row.vals[f.key]) ?? "";
  }

  async function post() {
    setBusy(true); setResults(null); setSummary("");
    const txns = rows.filter((r) => r.tool_id.trim()).map((r) => {
      const cond = mapped("condition", r);
      // Return log: only chip-off/broken conditions become CHIPOFF-style; "Good" is a plain receive
      const isDamage = active.txn === "CHIPOFF" || (active.txn === "RECEIVE" && (cond === "Chip-off" || cond === "Broken"));
      return {
        id: r.tool_id.trim(),
        type: isDamage ? "CHIPOFF" : active.txn,
        qty: Number(r.qty || "0"),
        person: mapped("person", r),
        machine: mapped("machine", r),
        tofrom: mapped("tofrom", r),
        dc: mapped("dc", r),
        condition: isDamage ? (cond === "Broken" ? "Broken" : "Chip-off") : "",
        life: (() => { const l = mapped("life", r); return l ? Number(l) : null; })(),
        remark: r.vals["remarks"] ?? "",
      };
    });

    if (txns.length === 0) { setBusy(false); setSummary("Add at least one tool ID."); return; }

    try {
      const res = await fetch("/api/transactions", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ txns }),
      });
      const data = await res.json();
      setResults(data.results ?? []);
      setSummary(`Posted ${data.posted ?? 0} · blocked ${data.blocked ?? 0}`);
    } catch {
      setSummary("Network error — is the dev server running?");
    } finally { setBusy(false); }
  }

  const resultFor = (id: string) => results?.find((r) => r.id === id);

  return (
    <>
      <div className="toolbar">
        {LOGS.map((l) => (
          <button key={l.key}
            className={l.key === active.key ? "btn" : "btn-ghost"}
            style={{ padding: "7px 12px", fontSize: 12, borderRadius: 6, cursor: "pointer",
                     border: l.key === active.key ? "1px solid var(--steel)" : "1px solid var(--line)" }}
            onClick={() => pick(l)}>
            {l.title.split(" · ")[0]}
          </button>
        ))}
      </div>

      <div className="panel" style={{ marginBottom: 16 }}>
        <div className="panel-head">{active.title}</div>
        <div className="panel-pad">
          <p className="muted" style={{ marginTop: 0, fontSize: 13 }}>{active.blurb}</p>

          {headerFields.length > 0 && (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: 12, marginBottom: 16 }}>
              {headerFields.map((f) => (
                <div key={f.key}>
                  <label className="muted" style={{ fontSize: 11, display: "block", marginBottom: 4 }}>{f.label}</label>
                  <Field f={f} value={header[f.key] ?? ""} onChange={(v) => setH(f.key, v)} />
                </div>
              ))}
            </div>
          )}

          <div style={{ overflow: "auto" }}>
            <table className="tbl" style={{ marginBottom: 12 }}>
              <thead>
                <tr>
                  <th style={{ minWidth: 200 }}>Tool ID</th>
                  <th className="right" style={{ width: 70 }}>Qty</th>
                  {rowFields.map((f) => <th key={f.key} style={{ minWidth: 120 }}>{f.label}</th>)}
                  <th style={{ minWidth: 120 }}>Result</th>
                  <th style={{ width: 36 }}></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => {
                  const res = resultFor(r.tool_id.trim());
                  return (
                    <tr key={i}>
                      <td><input className="input" placeholder="e.g. SC 0680 035 01"
                        value={r.tool_id} onChange={(e) => setRTool(i, e.target.value)} /></td>
                      <td><input className="input num" type="number" min={1}
                        value={r.qty} onChange={(e) => setRQty(i, e.target.value)} /></td>
                      {rowFields.map((f) => (
                        <td key={f.key}>
                          <Field f={f} value={r.vals[f.key] ?? ""} onChange={(v) => setRVal(i, f.key, v)} />
                        </td>
                      ))}
                      <td style={{ fontSize: 12 }}>
                        {res ? (res.ok
                          ? <span className="chip chip-avail">{res.txn_id}</span>
                          : <span className="chip chip-wscrap" title={res.errors.join(" ")}>blocked</span>
                        ) : <span className="muted">—</span>}
                        {res && res.warnings.length > 0 &&
                          <span className="chip chip-wregr" style={{ marginLeft: 6 }} title={res.warnings.join(" ")}>flag</span>}
                      </td>
                      <td><button className="btn-ghost" style={{ padding: "4px 8px", cursor: "pointer" }} onClick={() => delRow(i)}>✕</button></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="toolbar" style={{ marginBottom: 0 }}>
            <button className="btn-ghost" style={{ border: "1px solid var(--line)", cursor: "pointer" }} onClick={addRow}>+ Add row</button>
            <div className="spacer" />
            {summary && <span className="muted" style={{ fontSize: 13 }}>{summary}</span>}
            <button className="btn" onClick={post} disabled={busy}>{busy ? "Posting…" : "Post all"}</button>
          </div>
        </div>
      </div>

      {results && results.some((r) => !r.ok) && (
        <div className="panel">
          <div className="panel-head">Blocked rows</div>
          <div className="panel-pad">
            {results.filter((r) => !r.ok).map((r) => (
              <div key={r.id} style={{ fontSize: 13, marginBottom: 6 }}>
                <span className="id">{r.id}</span> — <span style={{ color: "var(--danger)" }}>{r.errors.join("; ")}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
}