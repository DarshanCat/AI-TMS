"use client";
import { useState } from "react";
import { LOGS, type LogSpec, type FieldSpec } from "./logs";
import ToolIdAutocomplete from "./ToolIdAutocomplete";
import { parseLogFile } from "./parseLogFile";
import PendingReturns from "./PendingReturns";

type Vals = Record<string, string>;
interface RowDraft { rowKey: string; tool_id: string; qty: string; vals: Vals; resolvedName?: string; }
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
  const [uploadWarnings, setUploadWarnings] = useState<string[]>([]);
  const [returnsRefresh, setReturnsRefresh] = useState(0);

  const headerFields = active.fields.filter((f) => f.scope === "header");
  const rowFields = active.fields.filter((f) => f.scope === "row");
  const isInward = active.key === "inward";

  function pick(log: LogSpec) {
    setActive(log); setHeader(initHeader(log)); setRows([initRow(log)]);
    setResults(null); setSummary(""); setUploadWarnings([]);
  }
  const setH = (k: string, v: string) => setHeader((h) => ({ ...h, [k]: v }));
  const setRTool = (i: number, v: string) => setRows((rs) => rs.map((r, j) => j === i ? { ...r, tool_id: v, resolvedName: undefined } : r));
  const setRQty = (i: number, v: string) => setRows((rs) => rs.map((r, j) => j === i ? { ...r, qty: v } : r));
  const setRVal = (i: number, k: string, v: string) =>
    setRows((rs) => rs.map((r, j) => j === i ? { ...r, vals: { ...r.vals, [k]: v } } : r));
  const addRow = () => setRows((rs) => [...rs, initRow(active)]);
  const delRow = (i: number) => setRows((rs) => rs.length === 1 ? rs : rs.filter((_, j) => j !== i));

  function addReturnRow(toolId: string, machine: string, person: string, qty: number) {
    setRows((rs) => {
      const base = rs.length === 1 && !rs[0].tool_id.trim() ? [] : rs;
      const row = initRow(active);
      row.tool_id = toolId;
      row.qty = String(qty);
      return [...base, row];
    });
    setHeader((h) => ({
      ...h,
      ...(!h["machine"] ? { machine: machine } : {}),
      ...(!h["person"] ? { person: person } : {}),
    }));
  }

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const parsed = await parseLogFile(file, active);
    if (parsed.rows.length === 0) {
      setSummary("No usable rows found in that file — check it matches this log type.");
      return;
    }
    setHeader((h) => ({ ...h, ...parsed.header }));
    setRows(parsed.rows.map((r) => ({ rowKey: newRowKey(), tool_id: r.tool_id, qty: r.qty, vals: r.vals })));
    setUploadWarnings(parsed.warnings);
    setResults(null);
    setSummary(`Loaded ${parsed.rows.length} rows from "${file.name}" — review before posting.`);
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
      if (!r.tool_id.trim()) return false;
      const isNewTool = isInward && r.vals["newtool"] === "Y";
      if (isNewTool && !r.vals["name"]?.trim()) {
        skippedNoName.push(r.tool_id.trim());
        return false;
      }
      return true;
    });

    const txns = eligibleRows.map((r) => {
      const cond = mapped("condition", r);
      const isDamage = active.txn === "CHIPOFF" || (active.txn === "RECEIVE" && (cond === "Chip-off" || cond === "Broken"));
      const dispatchTo = header["dispatchto"] ?? "";
      const isScrap = active.txn === "DISPATCH" && dispatchTo === "Scrap";
      const type = isDamage ? "CHIPOFF" : isScrap ? "SCRAP" : active.txn;
      const isNewTool = isInward && r.vals["newtool"] === "Y";

      return {
        id: r.tool_id.trim(),
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
      const skippedNote = skippedNoName.length ? ` · ${skippedNoName.length} skipped (missing Tool Name)` : "";
      setSummary(`Posted ${data.posted ?? 0} · blocked ${data.blocked ?? 0}${skippedNote}`);

      const failedKeys = new Set(resultList.filter((r) => !r.ok).map((r) => r.rowKey));
      setRows((rs) => {
        const remaining = rs.filter((r) => failedKeys.has(r.rowKey));
        return remaining.length > 0 ? remaining : [initRow(active)];
      });

      if (active.key === "return") setReturnsRefresh((n) => n + 1);
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
              <b>New Tool = Y</b>: type the Tool ID your team has already decided, plus Tool Name — posted exactly as typed, nothing auto-generated.{" "}
              <b>New Tool = N</b>: pick the existing tool from the search box and add a note in Remarks.
            </p>
          )}

          {uploadWarnings.length > 0 && (
            <div className="panel panel-pad" style={{ marginBottom: 12, borderColor: "var(--warn)", fontSize: 12 }}>
              {uploadWarnings.map((w, i) => <div key={i}>⚠ {w}</div>)}
            </div>
          )}

          {active.key === "return" && <PendingReturns onAdd={addReturnRow} refreshKey={returnsRefresh} />}

          {headerFields.length > 0 && (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: 12, marginBottom: 16 }}>
              {headerFields.map((f) => {
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
                  <th className="right" style={{ width: 90, minWidth: 90 }}>Qty</th>
                  {rowFields.map((f) => <th key={f.key} style={{ minWidth: 120 }}>{f.label}</th>)}
                  <th style={{ minWidth: 130 }}>Result</th>
                  <th style={{ width: 36 }}></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => {
                  const res = resultFor(r.rowKey);
                  const isNewTool = isInward && r.vals["newtool"] === "Y";
                  const remarksEmpty = !isNewTool && isInward && !r.vals["remarks"]?.trim();
                  return (
                    <tr key={r.rowKey}>
                      <td>
                        <ToolIdAutocomplete
                          value={r.tool_id}
                          onChange={(v) => setRTool(i, v)}
                          placeholder={isNewTool ? "type the ID your team decided" : "e.g. SC 0680 035 01"}
                          allowNew={isNewTool}
                          onResolved={(m) => setRows((rs) => rs.map((row, j) =>
                            j === i ? { ...row, resolvedName: m?.name ?? undefined } : row))}
                        />
                      </td>
                      {!isInward && (
                        <td className="muted" style={{ fontSize: 13 }}>{r.resolvedName ?? "—"}</td>
                      )}
                      <td style={{ minWidth: 90 }}>
                        <input
                          className="input num"
                          type="text"
                          inputMode="numeric"
                          pattern="[0-9]*"
                          style={{ width: "100%", minWidth: 70, textAlign: "right" }}
                          value={r.qty}
                          onChange={(e) => setRQty(i, e.target.value.replace(/[^0-9]/g, ""))}
                        />
                      </td>
                      {rowFields.map((f) => {
                        const dimensionOnly = ["dia", "length", "namecode", "typecode", "name", "class"].includes(f.key);
                        if (isInward && f.key === "newtool") {
                          return (
                            <td key={f.key}>
                              <Field f={f} value={r.vals[f.key] ?? ""} onChange={(v) => setRVal(i, f.key, v)} />
                            </td>
                          );
                        }
                        if (isInward && dimensionOnly && !isNewTool) {
                          return (
                            <td key={f.key}>
                              <input className="input" disabled value="—"
                                style={{ color: "var(--ink-soft)", fontSize: 12 }} />
                            </td>
                          );
                        }
                        if (isInward && f.key === "remarks") {
                          return (
                            <td key={f.key}>
                              <Field f={f} value={r.vals[f.key] ?? ""} onChange={(v) => setRVal(i, f.key, v)} />
                              {remarksEmpty && (
                                <div className="muted" style={{ fontSize: 10, color: "var(--warn)" }}>Add a note for this restock</div>
                              )}
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
            <label className="btn-ghost" style={{ border: "1px solid var(--line)", cursor: "pointer", display: "inline-flex", alignItems: "center" }}>
              ⬆ Upload log (.xlsx)
              <input type="file" accept=".xlsx,.xls" onChange={handleFileUpload} style={{ display: "none" }} />
            </label>
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