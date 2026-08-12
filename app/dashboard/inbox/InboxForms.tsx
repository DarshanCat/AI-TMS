"use client";
import { useState } from "react";
import { LOGS, type LogSpec, type FieldSpec } from "./logs";
import ToolIdAutocomplete from "./ToolIdAutocomplete";

type Vals = Record<string, string>;
interface RowDraft { rowKey: string; tool_id: string; qty: string; vals: Vals; generatedId?: string; resolvedName?: string; }
interface PostResult { id: string; ok: boolean; errors: string[]; warnings: string[]; txn_id?: string; rowKey?: string; }

const today = () => new Date().toISOString().slice(0, 10);
let keyCounter = 0;
const newRowKey = () => `row-${Date.now()}-${keyCounter++}`;

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
  return { rowKey: newRowKey(), tool_id: "", qty: "1", vals: v };
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
  const isInward = active.key === "inward";

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


  async function generateId(i: number) {
    const r = rows[i];
    const typecode = r.vals["typecode"]?.trim();
    if (!typecode) { setSummary("Fill Type Code first."); return; }
    const params = new URLSearchParams({
      typecode,
      dia: r.vals["dia"] ?? "", length: r.vals["length"] ?? "", namecode: r.vals["namecode"] ?? "",
    });
    try {
      const res = await fetch(`/api/generate-tool-id?${params}`);
      const data = await res.json();
      if (data.id) setRows((rs) => rs.map((row, j) => j === i ? { ...row, generatedId: data.id } : row));
      else setSummary(data.error ?? "Could not generate ID.");
    } catch {
      setSummary("Network error generating ID.");
    }
  }

  function mapped(name: string, row: RowDraft): string {
    const f = active.fields.find((x) => x.maps === name);
    if (!f) return "";
    return (f.scope === "header" ? header[f.key] : row.vals[f.key]) ?? "";
  }

  async function post() {
    setBusy(true); setResults(null); setSummary("");
    const skippedNoName: string[] = [];

    const eligibleRows = rows.filter((r) => {
      const isNewInward = isInward && r.vals["newtool"] === "Y";
      // new tools don't need a typed Tool ID (it's auto-generated) — they need a name instead
      if (isNewInward) {
        if (!r.vals["name"]?.trim()) { skippedNoName.push(r.tool_id.trim() || "(new tool)"); return false; }
        return true;
      }
      return !!r.tool_id.trim();
    });

    const txns = eligibleRows.map((r) => {
      const cond = mapped("condition", r);
      const isDamage = active.txn === "CHIPOFF" || (active.txn === "RECEIVE" && (cond === "Chip-off" || cond === "Broken"));
      const dispatchTo = header["dispatchto"] ?? "";
      const isScrap = active.txn === "DISPATCH" && dispatchTo === "Scrap";
      const type = isDamage ? "CHIPOFF" : isScrap ? "SCRAP" : active.txn;
      const isNewTool = isInward && r.vals["newtool"] === "Y";

      return {
        id: isNewTool ? (r.generatedId ?? "") : r.tool_id.trim(), // uses the previewed ID if generated, else server auto-generates
        type,
        qty: Number(r.qty || "0"),
        person: mapped("person", r),
        machine: mapped("machine", r),
        tofrom: isScrap ? "Scrap Store" : mapped("tofrom", r),
        dc: mapped("dc", r),
        condition: isDamage ? (cond === "Broken" ? "Broken" : "Chip-off") : "",
        life: (() => { const l = mapped("life", r); return l ? Number(l) : null; })(),
        remark: r.vals["remarks"] ?? "",
        part_no: header["partno"] ?? r.vals["partno"] ?? "",
        work_order: header["wo"] ?? "",
        po_no: header["po"] ?? "",
        brand: r.vals["brand"] ?? "",
        unit_price: r.vals["price"] ? Number(r.vals["price"]) : null,
        regrind_cost: r.vals["cost"] ? Number(r.vals["cost"]) : null,
        issued_by: header["issuedby"] ?? "",
        rowKey: r.rowKey,
        ...(isNewTool
          ? {
              newTool: {
                name: r.vals["name"].trim(),
                type: r.vals["class"]?.trim() || "",
                loc: "VSPL store",
                typecode: r.vals["typecode"]?.trim() || "",
                dia: r.vals["dia"] ? Number(r.vals["dia"]) : null,
                length: r.vals["length"] ? Number(r.vals["length"]) : null,
                nameCode: r.vals["namecode"]?.trim() || "",
                supplierCode: header["supcode"]?.trim() || "",
              },
            }
          : {}),
      };
    });

    if (txns.length === 0) {
      setBusy(false);
      setSummary(skippedNoName.length
        ? `${skippedNoName.length} row(s) need a Tool Name (New Tool = Y) before posting.`
        : "Add at least one tool ID.");
      return;
    }

    try {
      const res = await fetch("/api/transactions", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ txns }),
      });
      const data = await res.json();
      const resultList: PostResult[] = data.results ?? [];
      setResults(resultList);

      // stamp the system-generated ID back onto its row for display
      setRows((rs) => rs.map((r) => {
        const match = resultList.find((res) => res.rowKey === r.rowKey);
        return match?.ok ? { ...r, generatedId: match.id } : r;
      }));

      const skippedNote = skippedNoName.length ? ` · ${skippedNoName.length} skipped (missing Tool Name)` : "";
      setSummary(`Posted ${data.posted ?? 0} · blocked ${data.blocked ?? 0}${skippedNote}`);
    } catch {
      setSummary("Network error — is the dev server running?");
    } finally { setBusy(false); }
  }

  const resultFor = (rowKey: string) => results?.find((r) => r.rowKey === rowKey);

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
          {isInward && (
            <p className="muted" style={{ marginTop: -6, fontSize: 12 }}>
              For a <b>new</b> tool, leave Tool ID blank — set New Tool = Y and fill Type Code + Diameter + Length
              (or Name/Code for non-dimensioned types like taps). The system generates the ID per the nomenclature standard.
            </p>
          )}

          {headerFields.length > 0 && (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: 12, marginBottom: 16 }}>
              {headerFields.map((f) => {
                // "Machine / Subcontractor" is one shared field either way — but
                // what it actually asks for depends on Operation vs Subcon, so
                // relabel it live rather than leave a static, ambiguous label.
                let label = f.label;
                let placeholder = f.placeholder;
                if (f.key === "machine" && (active.key === "issue" || active.key === "return")) {
                  const toggleKey = active.key === "issue" ? "issuedto" : "returnedfrom";
                  const isSubcon = header[toggleKey] === "Subcon";
                  label = isSubcon ? "Subcontractor Company" : "Machine";
                  placeholder = isSubcon ? "e.g. Excellence, Yajamana Industries" : "e.g. HMC, VMC-1";
                }
                return (
                  <div key={f.key}>
                    <label className="muted" style={{ fontSize: 11, display: "block", marginBottom: 4 }}>{label}</label>
                    <Field f={{ ...f, placeholder }} value={header[f.key] ?? ""} onChange={(v) => setH(f.key, v)} />
                  </div>
                );
              })}
            </div>
          )}

          <div style={{ overflow: "auto" }}>
            <table className="tbl" style={{ marginBottom: 12 }}>
              <thead>
                <tr>
                  <th style={{ minWidth: 200 }}>Tool ID</th>
                  {!isInward && <th style={{ minWidth: 160 }}>Tool Name</th>}
                  <th className="right" style={{ width: 70 }}>Qty</th>
                  {rowFields.map((f) => <th key={f.key} style={{ minWidth: 120 }}>{f.label}</th>)}
                  <th style={{ minWidth: 130 }}>Result</th>
                  <th style={{ width: 36 }}></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => {
                  const res = resultFor(r.rowKey);
                  const isNewInward = isInward && r.vals["newtool"] === "Y";
                  return (
                    <tr key={r.rowKey}>
                      <td>
                        {isNewInward ? (
                          <div style={{ display: "flex", gap: 6 }}>
                            <input className="input" disabled
                              value={r.generatedId ?? "Not generated yet"}
                              style={{ color: r.generatedId ? "var(--ink)" : "var(--ink-soft)", fontStyle: r.generatedId ? "normal" : "italic" }} />
                            <button type="button" className="btn-ghost"
                              style={{ border: "1px solid var(--line)", cursor: "pointer", fontSize: 11, whiteSpace: "nowrap", padding: "0 8px" }}
                              onClick={() => generateId(i)}>
                              Generate
                            </button>
                          </div>
                        ) : (
                          <ToolIdAutocomplete
                            value={r.tool_id}
                            onChange={(v) => setRTool(i, v)}
                            placeholder="e.g. SC 0680 035 01"
                            allowNew={false}
                            onResolved={(m) => setRows((rs) => rs.map((row, j) =>
                              j === i ? { ...row, resolvedName: m?.name ?? undefined } : row))}
                          />
                        )}
                      </td>
                      {!isInward && (
                        <td className="muted" style={{ fontSize: 13 }}>
                          {r.resolvedName ?? "—"}
                        </td>
                      )}
                      <td><input className="input num" type="number" min={1}
                        value={r.qty} onChange={(e) => setRQty(i, e.target.value)} /></td>
                      {rowFields.map((f) => {
                        const dimensionOnly = ["dia", "length", "namecode", "typecode"].includes(f.key);
                        if (isInward && dimensionOnly && r.vals["newtool"] !== "Y") {
                          return (
                            <td key={f.key}>
                              <input className="input" disabled value="Set New Tool = Y"
                                style={{ color: "var(--ink-soft)", fontStyle: "italic", fontSize: 12 }} />
                            </td>
                          );
                        }
                        return (
                          <td key={f.key}>
                            <Field f={f} value={r.vals[f.key] ?? ""} onChange={(v) => setRVal(i, f.key, v)} />
                          </td>
                        );
                      })}
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
            {results.filter((r) => !r.ok).map((r, i) => (
              <div key={i} style={{ fontSize: 13, marginBottom: 6 }}>
                <span className="id">{r.id || "(new tool)"}</span> — <span style={{ color: "var(--danger)" }}>{r.errors.join("; ")}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
}