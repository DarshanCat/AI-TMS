"use client";

import { useState, useMemo, useEffect } from "react";
import {
  TOOL_TYPES as DEFAULT_TOOL_TYPES,
  type ToolTypeDefinition,
  buildStandardToolIdBase,
  calcDrillLengthBand,
} from "@/lib/nomenclature";

const STORAGE_KEY = "ai_tms_custom_nomenclature_types";

export default function NomenclatureModule() {
  const [types, setTypes] = useState<ToolTypeDefinition[]>(DEFAULT_TOOL_TYPES);
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("All");

  // Load custom types from browser localStorage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setTypes(parsed);
        }
      }
    } catch (e) {
      console.error("Failed to load custom nomenclature types:", e);
    }
  }, []);

  // Save changes to localStorage
  const saveTypes = (newTypes: ToolTypeDefinition[]) => {
    setTypes(newTypes);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(newTypes));
    } catch (e) {
      console.error("Failed to persist nomenclature types:", e);
    }
  };

  const resetToDefaults = () => {
    if (confirm("Reset all tool types and formats back to the standard master catalog?")) {
      saveTypes(DEFAULT_TOOL_TYPES);
      setEditingType(null);
      setIsAdding(false);
    }
  };

  // Add / Edit Modal or Inline Form State
  const [isAdding, setIsAdding] = useState(false);
  const [editingType, setEditingType] = useState<ToolTypeDefinition | null>(null);

  // Form Fields State
  const [formCode, setFormCode] = useState("");
  const [formDesc, setFormDesc] = useState("");
  const [formCat, setFormCat] = useState<ToolTypeDefinition["category"]>("Solid Carbide");
  const [formFormat, setFormFormat] = useState("XX DDDD LLL NN");
  const [formExample, setFormExample] = useState("");
  const [formIsDrill, setFormIsDrill] = useState(false);
  const [formIsTol, setFormIsTol] = useState(false);
  const [formIsTap, setFormIsTap] = useState(false);
  const [formIsRange, setFormIsRange] = useState(false);

  const startAdd = () => {
    setEditingType(null);
    setFormCode("");
    setFormDesc("");
    setFormCat("Solid Carbide");
    setFormFormat("XX DDDD LLL NN");
    setFormExample("");
    setFormIsDrill(false);
    setFormIsTol(false);
    setFormIsTap(false);
    setFormIsRange(false);
    setIsAdding(true);
  };

  const startEdit = (t: ToolTypeDefinition) => {
    setIsAdding(false);
    setEditingType(t);
    setFormCode(t.code);
    setFormDesc(t.description);
    setFormCat(t.category);
    setFormFormat(t.format);
    setFormExample(t.example);
    setFormIsDrill(Boolean(t.isDrill));
    setFormIsTol(Boolean(t.isToleranceAllowed));
    setFormIsTap(Boolean(t.isTap));
    setFormIsRange(Boolean(t.isRange));
  };

  const handleSaveForm = (e: React.FormEvent) => {
    e.preventDefault();
    const codeClean = formCode.trim().toUpperCase();
    if (!codeClean) {
      alert("Type Code is required.");
      return;
    }

    const newDef: ToolTypeDefinition = {
      code: codeClean,
      description: formDesc.trim() || codeClean,
      category: formCat,
      format: formFormat.trim() || `${codeClean} DDDD LLL NN`,
      example: formExample.trim() || `${codeClean} 1000 050 01`,
      isDrill: formIsDrill,
      isToleranceAllowed: formIsTol,
      isTap: formIsTap,
      isRange: formIsRange,
    };

    if (editingType) {
      // Editing existing
      const updated = types.map((t) => (t.code === editingType.code ? newDef : t));
      saveTypes(updated);
      setEditingType(null);
    } else {
      // Adding new
      if (types.some((t) => t.code === codeClean)) {
        alert(`Type Code "${codeClean}" already exists. Edit the existing entry or use a unique code.`);
        return;
      }
      saveTypes([newDef, ...types]);
      setIsAdding(false);
    }
  };

  const handleDelete = (code: string) => {
    if (confirm(`Are you sure you want to delete type "${code}"?`)) {
      const updated = types.filter((t) => t.code !== code);
      saveTypes(updated);
      if (editingType?.code === code) setEditingType(null);
    }
  };

  // Generator Playground State
  const [genTypeCode, setGenTypeCode] = useState("SC");
  const [genDia, setGenDia] = useState("6.8");
  const [genTol, setGenTol] = useState("");
  const [genDiaMax, setGenDiaMax] = useState("");
  const [genLen, setGenLen] = useState("35");
  const [genForm, setGenForm] = useState<"" | "A" | "B" | "C" | "D" | "E">("");
  const [genNameCode, setGenNameCode] = useState("");
  const [genVariant, setGenVariant] = useState("01");

  const categories = useMemo(() => {
    const set = new Set(types.map((t) => t.category));
    return ["All", ...Array.from(set)];
  }, [types]);

  const filteredTypes = useMemo(() => {
    return types.filter((t) => {
      const matchCat = selectedCategory === "All" || t.category === selectedCategory;
      const matchQ =
        !search.trim() ||
        t.code.toLowerCase().includes(search.toLowerCase()) ||
        t.description.toLowerCase().includes(search.toLowerCase()) ||
        t.example.toLowerCase().includes(search.toLowerCase());
      return matchCat && matchQ;
    });
  }, [types, search, selectedCategory]);

  const selectedDef = useMemo(() => {
    return types.find((t) => t.code === genTypeCode) || types[0] || DEFAULT_TOOL_TYPES[0];
  }, [types, genTypeCode]);

  // Computed Generator Tool ID
  const computedBase = useMemo(() => {
    return buildStandardToolIdBase({
      code: genTypeCode,
      dia: genDia,
      tolerance: genTol,
      diaMax: genDiaMax,
      length: genLen,
      chamferForm: genForm,
      nameCode: genNameCode,
    });
  }, [genTypeCode, genDia, genTol, genDiaMax, genLen, genForm, genNameCode]);

  const fullGeneratedId = useMemo(() => {
    const nn = (genVariant || "01").trim().padStart(2, "0");
    return `${computedBase} ${nn}`;
  }, [computedBase, genVariant]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      {/* SECTION 1: Interactive Standard Generator */}
      <div className="panel" style={{ border: "1px solid var(--steel)", overflow: "hidden" }}>
        <div className="panel-head" style={{ background: "var(--steel)", color: "#fff", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span>Universal Skeleton Generator: &lt;TYPE&gt; &lt;FIELD 1&gt; &lt;FIELD 2&gt; &lt;NN&gt;</span>
          <span style={{ fontSize: 11, background: "rgba(255,255,255,0.2)", padding: "2px 8px", borderRadius: 4 }}>ISO / VSPL Standard</span>
        </div>

        <div className="panel-pad" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 14 }}>
            <div>
              <label className="muted" style={{ fontSize: 11, display: "block", marginBottom: 4 }}>1. Tool Type</label>
              <select
                className="select"
                value={genTypeCode}
                onChange={(e) => {
                  setGenTypeCode(e.target.value);
                  const def = types.find((t) => t.code === e.target.value);
                  if (def?.isTap && !genNameCode) setGenNameCode("M10X1.5");
                }}
              >
                {types.map((t) => (
                  <option key={t.code} value={t.code}>
                    {t.code} — {t.description} ({t.category})
                  </option>
                ))}
              </select>
            </div>

            {selectedDef.isRange ? (
              <>
                <div>
                  <label className="muted" style={{ fontSize: 11, display: "block", marginBottom: 4 }}>Min Diameter (mm)</label>
                  <input className="input num" type="number" step="0.1" value={genDia} onChange={(e) => setGenDia(e.target.value)} placeholder="e.g. 36.0" />
                </div>
                <div>
                  <label className="muted" style={{ fontSize: 11, display: "block", marginBottom: 4 }}>Max Diameter (mm)</label>
                  <input className="input num" type="number" step="0.1" value={genDiaMax} onChange={(e) => setGenDiaMax(e.target.value)} placeholder="e.g. 47.0" />
                </div>
              </>
            ) : selectedDef.category === "Drill" || selectedDef.category === "Mill" || selectedDef.category === "Ream/Bore" || selectedDef.category === "Probe" || selectedDef.category === "HSS Tooling" ? (
              <>
                <div>
                  <label className="muted" style={{ fontSize: 11, display: "block", marginBottom: 4 }}>Diameter (mm)</label>
                  <input className="input num" type="number" step="0.1" value={genDia} onChange={(e) => setGenDia(e.target.value)} placeholder="e.g. 6.8" />
                </div>

                {selectedDef.isToleranceAllowed && (
                  <div>
                    <label className="muted" style={{ fontSize: 11, display: "block", marginBottom: 4 }}>Tolerance / Fit Class</label>
                    <input className="input" type="text" value={genTol} onChange={(e) => setGenTol(e.target.value.toUpperCase())} placeholder="e.g. H7, G7, E8" />
                  </div>
                )}
              </>
            ) : null}

            {selectedDef.isTap ? (
              <>
                <div>
                  <label className="muted" style={{ fontSize: 11, display: "block", marginBottom: 4 }}>Thread Specification</label>
                  <input className="input" type="text" value={genNameCode} onChange={(e) => setGenNameCode(e.target.value.toUpperCase())} placeholder="e.g. M10X1.5, 12 UN" />
                </div>
                <div>
                  <label className="muted" style={{ fontSize: 11, display: "block", marginBottom: 4 }}>Chamfer Form (ISO 2283 / DIN 2197)</label>
                  <select className="select" value={genForm} onChange={(e) => setGenForm(e.target.value as any)}>
                    <option value="">None (Standard)</option>
                    <option value="A">A — Long taper (~6-8 pitches, Through)</option>
                    <option value="B">B — Medium (~3.5-5 pitches, Through)</option>
                    <option value="C">C — Short (~2-3 pitches, Blind / Semi-bottoming)</option>
                    <option value="D">D — Medium-short (~2-3.5 pitches, Machine)</option>
                    <option value="E">E — Shortest (~1.5-2 pitches, Bottoming)</option>
                  </select>
                </div>
              </>
            ) : null}

            {/* Named / Cavity / Code tool */}
            {selectedDef.category === "Cavity" || selectedDef.category === "Holder & Adapter" || selectedDef.category === "Turning & Inserts" ? (
              <div>
                <label className="muted" style={{ fontSize: 11, display: "block", marginBottom: 4 }}>Name / Code / Cavity</label>
                <input className="input" type="text" value={genNameCode} onChange={(e) => setGenNameCode(e.target.value.toUpperCase())} placeholder={selectedDef.example.split(" ")[1] ?? "e.g. C-10-2"} />
              </div>
            ) : null}

            <div>
              <label className="muted" style={{ fontSize: 11, display: "block", marginBottom: 4 }}>
                Length (mm) {selectedDef.isDrill ? "(Auto-banded)" : ""}
              </label>
              <input className="input num" type="number" value={genLen} onChange={(e) => setGenLen(e.target.value)} placeholder="e.g. 35" />
            </div>

            <div>
              <label className="muted" style={{ fontSize: 11, display: "block", marginBottom: 4 }}>Variant NN</label>
              <input className="input num" maxLength={2} value={genVariant} onChange={(e) => setGenVariant(e.target.value)} placeholder="01" />
            </div>
          </div>

          <div style={{ background: "var(--panel-2)", border: "1px dashed var(--line)", padding: "14px 18px", borderRadius: 8, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
            <div>
              <div className="muted" style={{ fontSize: 11, textTransform: "uppercase", fontWeight: 700 }}>Generated Universal Tool ID</div>
              <div style={{ fontFamily: "var(--mono)", fontSize: 20, fontWeight: 800, color: "var(--steel)", marginTop: 4, letterSpacing: "0.05em" }}>
                {fullGeneratedId}
              </div>
            </div>
            <div style={{ fontSize: 12, color: "var(--ink-soft)", maxWidth: 360 }}>
              {selectedDef.isDrill && (
                <div>• Drill length banded to <b>{calcDrillLengthBand(Number(genLen) || 0)}</b> (10mm band &le;100mm, 20mm &gt;100mm).</div>
              )}
              {selectedDef.isTap && genForm && (
                <div>• Chamfer lead form <b>{genForm}</b> appended to specify hole type.</div>
              )}
              <div>• Format Rule: <b>{selectedDef.format}</b></div>
            </div>
          </div>
        </div>
      </div>

      {/* SECTION 2: Add or Edit Form Modal / Card */}
      {(isAdding || editingType) && (
        <div className="panel" style={{ border: "2px solid var(--steel)", background: "var(--panel)" }}>
          <div className="panel-head" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span>{editingType ? `Edit Tool Type: ${editingType.code}` : "Add New Standard Tool Type"}</span>
            <button
              className="btn-ghost"
              style={{ fontSize: 12, cursor: "pointer" }}
              onClick={() => {
                setIsAdding(false);
                setEditingType(null);
              }}
            >
              ✕ Cancel
            </button>
          </div>
          <form onSubmit={handleSaveForm} className="panel-pad" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12 }}>
              <div>
                <label className="muted" style={{ fontSize: 11, display: "block", marginBottom: 4 }}>Type Code (e.g. SC, EMR)</label>
                <input
                  className="input"
                  style={{ textTransform: "uppercase" }}
                  value={formCode}
                  onChange={(e) => setFormCode(e.target.value.toUpperCase())}
                  placeholder="e.g. CR, SC, EM"
                  disabled={Boolean(editingType)}
                  required
                />
              </div>

              <div>
                <label className="muted" style={{ fontSize: 11, display: "block", marginBottom: 4 }}>Description</label>
                <input
                  className="input"
                  value={formDesc}
                  onChange={(e) => setFormDesc(e.target.value)}
                  placeholder="e.g. High Feed Mill"
                  required
                />
              </div>

              <div>
                <label className="muted" style={{ fontSize: 11, display: "block", marginBottom: 4 }}>Category</label>
                <select className="select" value={formCat} onChange={(e) => setFormCat(e.target.value as any)}>
                  <option value="Solid Carbide">Solid Carbide</option>
                  <option value="Drill">Drill</option>
                  <option value="Mill">Mill</option>
                  <option value="Ream/Bore">Ream/Bore</option>
                  <option value="Probe">Probe</option>
                  <option value="Cavity">Cavity</option>
                  <option value="Thread">Thread</option>
                  <option value="Holder & Adapter">Holder & Adapter</option>
                  <option value="Turning & Inserts">Turning & Inserts</option>
                  <option value="HSS Tooling">HSS Tooling</option>
                </select>
              </div>

              <div>
                <label className="muted" style={{ fontSize: 11, display: "block", marginBottom: 4 }}>Standard Format Rule</label>
                <input
                  className="input"
                  value={formFormat}
                  onChange={(e) => setFormFormat(e.target.value)}
                  placeholder="XX DDDD LLL NN"
                  required
                />
              </div>

              <div>
                <label className="muted" style={{ fontSize: 11, display: "block", marginBottom: 4 }}>Example Tool ID</label>
                <input
                  className="input"
                  value={formExample}
                  onChange={(e) => setFormExample(e.target.value.toUpperCase())}
                  placeholder="SC 1200 250 01"
                  required
                />
              </div>
            </div>

            <div style={{ display: "flex", flexWrap: "wrap", gap: 16, marginTop: 4, fontSize: 12 }}>
              <label style={{ display: "inline-flex", alignItems: "center", gap: 6, cursor: "pointer" }}>
                <input type="checkbox" checked={formIsDrill} onChange={(e) => setFormIsDrill(e.target.checked)} />
                <span>Drill length banding rule applies</span>
              </label>
              <label style={{ display: "inline-flex", alignItems: "center", gap: 6, cursor: "pointer" }}>
                <input type="checkbox" checked={formIsTol} onChange={(e) => setFormIsTol(e.target.checked)} />
                <span>Allow tolerance/fit class (e.g. H7, G7)</span>
              </label>
              <label style={{ display: "inline-flex", alignItems: "center", gap: 6, cursor: "pointer" }}>
                <input type="checkbox" checked={formIsTap} onChange={(e) => setFormIsTap(e.target.checked)} />
                <span>Tap chamfer form rule applies (A-E)</span>
              </label>
              <label style={{ display: "inline-flex", alignItems: "center", gap: 6, cursor: "pointer" }}>
                <input type="checkbox" checked={formIsRange} onChange={(e) => setFormIsRange(e.target.checked)} />
                <span>Diameter range tool (DMIN DMAX)</span>
              </label>
            </div>

            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 8 }}>
              <button
                type="button"
                className="btn-ghost"
                onClick={() => {
                  setIsAdding(false);
                  setEditingType(null);
                }}
              >
                Cancel
              </button>
              <button type="submit" className="btn">
                {editingType ? "Save Changes" : "Add Tool Type"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* SECTION 3: Standard Nomenclature Master Directory */}
      <div className="panel">
        <div className="panel-head" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <span>Standard Tool Types &amp; Formats Master Table ({filteredTypes.length})</span>
            <button className="btn" style={{ padding: "5px 12px", fontSize: 12 }} onClick={startAdd}>
              + Add New Type
            </button>
            <button
              className="btn-ghost"
              style={{ padding: "5px 10px", fontSize: 12, border: "1px solid var(--line)" }}
              onClick={resetToDefaults}
              title="Reset any custom modifications back to standard factory settings"
            >
              Reset to Defaults
            </button>
          </div>

          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <select
              className="select"
              style={{ width: "auto", fontSize: 12, padding: "5px 10px" }}
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
            >
              {categories.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
            <input
              className="input"
              style={{ maxWidth: 200, fontSize: 12, padding: "5px 10px" }}
              placeholder="Search code or tool…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        <div style={{ overflowX: "auto" }}>
          <table className="tbl">
            <thead>
              <tr>
                <th style={{ width: 80 }}>Type Code</th>
                <th>Description</th>
                <th>Category</th>
                <th>Standard Skeleton Format</th>
                <th>Example Tool ID</th>
                <th style={{ width: 180 }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredTypes.map((t) => (
                <tr key={t.code}>
                  <td className="id" style={{ fontWeight: 700, color: "var(--steel)" }}>{t.code}</td>
                  <td>{t.description}</td>
                  <td><span className="chip chip-avail">{t.category}</span></td>
                  <td style={{ fontFamily: "var(--mono)", fontSize: 12, color: "var(--ink-soft)" }}>{t.format}</td>
                  <td className="id" style={{ background: "rgba(0,0,0,0.02)", padding: "4px 8px", borderRadius: 4 }}>
                    {t.example}
                  </td>
                  <td>
                    <div style={{ display: "flex", gap: 6 }}>
                      <button
                        className="btn-ghost"
                        style={{ padding: "4px 8px", fontSize: 11, cursor: "pointer", border: "1px solid var(--line)", borderRadius: 4 }}
                        onClick={() => startEdit(t)}
                        title="Edit this type definition"
                      >
                        Edit
                      </button>
                      <button
                        className="btn-ghost"
                        style={{ padding: "4px 8px", fontSize: 11, cursor: "pointer", border: "1px solid var(--line)", borderRadius: 4 }}
                        onClick={() => {
                          setGenTypeCode(t.code);
                          window.scrollTo({ top: 0, behavior: "smooth" });
                        }}
                        title="Test with the generator above"
                      >
                        Builder
                      </button>
                      <button
                        className="btn-ghost"
                        style={{ padding: "4px 8px", fontSize: 11, cursor: "pointer", border: "1px solid var(--line)", borderRadius: 4, color: "var(--danger)" }}
                        onClick={() => handleDelete(t.code)}
                        title="Delete tool type"
                      >
                        ✕
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filteredTypes.length === 0 && (
                <tr>
                  <td colSpan={6} className="muted" style={{ textAlign: "center", padding: 24 }}>
                    No matching tool types found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* SECTION 4: Standard Rules Reference Box */}
      <div className="panel panel-pad" style={{ fontSize: 13, background: "var(--panel-2)" }}>
        <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 8, color: "var(--ink)" }}>Standard Nomenclature Rules &amp; ISO Conventions</h3>
        <ul style={{ margin: 0, paddingLeft: 20, lineHeight: 1.6, color: "var(--ink-soft)" }}>
          <li><b>Case:</b> UPPERCASE only across all fields.</li>
          <li><b>Separator:</b> Single space between fields (no &ldquo;x&rdquo; or dashes as field separators).</li>
          <li><b>Diameter Field:</b> 4 digits = mm &times; 100 (e.g. &Oslash;12.00 &rarr; <code>1200</code>, &Oslash;6.80 &rarr; <code>0680</code>).</li>
          <li><b>Tolerance / Fit:</b> Reamers &amp; bored features preserve tolerance (e.g. <code>16G7</code>, <code>20H6</code>, <code>32H7</code>, <code>19E8</code>).</li>
          <li><b>Material Prefix:</b> Leading <code>H</code> designates HSS tools (<code>HD</code>, <code>HEM</code>, <code>HRM</code>, <code>HTP</code>). Carbide tools carry no material prefix.</li>
          <li><b>Drill Length Band:</b> Drills (<code>SC</code>, <code>BD</code>, <code>GD</code>, <code>MD</code>, <code>SD</code>, <code>UD</code>, <code>HD</code>, <code>HDS</code>, <code>HDC</code>) use upper-inclusive length bands (10 mm bands &le;100 mm, 20 mm bands &gt;100 mm).</li>
          <li><b>Tap Chamfer Lead Form (A&ndash;E):</b> Follows ISO 2283 / DIN 2197 after length (e.g. <code>TP M10X1.5 026 C 01</code>) for through vs. blind holes.</li>
          <li><b>Mandatory NN:</b> Every tool ID ends with a 2-digit serial variant to ensure unique tracking.</li>
        </ul>
      </div>
    </div>
  );
}
