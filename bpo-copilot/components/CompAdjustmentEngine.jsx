"use client";
import React, { useState, useMemo } from "react";

/*
  Comp Adjustment Engine — BPO copilot core
  Seeded with the 3 sold comps from the Stockton exterior BPO
  (227 N Sierra Nevada St). Every adjustment is derived live from
  the rules bar, so editing any cell reflows the whole grid, the
  net/gross totals, the adjusted prices, and the reconciled value.

  In production, the Subject and Comp columns populate from a
  public-records/AVM vendor (subject) + the agent's own MLS (comps).
  The agent only reviews and signs.
*/

const theme = {
  ink: "#111c26",
  sub: "#5c6b76",
  faint: "#8b98a1",
  paper: "#eceff1",
  card: "#ffffff",
  line: "#dde3e7",
  hair: "#eaeef0",
  accent: "#0e5a4a",
  accentSoft: "#e7f0ed",
  pos: "#0f7a52",
  neg: "#b1503f",
  hi: "#f4f1e6",
};

const usd = (n) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(Math.round(n || 0));

const CONDITIONS = ["Poor", "Fair", "Average", "Good", "Excellent"];
const HEATING = ["Forced Hot Water", "Central", "Electric", "Other"];
const COOLING = ["Central", "Wall", "None"];

const condRank = (c) => Math.max(0, CONDITIONS.indexOf(c));
const meetsHeat = (h) => (h === "Other" ? 0 : 1);
const meetsCool = (c) => (c === "Central" ? 1 : 0);

// ---- Seed data (straight from the BPO) ----
const SUBJECT = {
  address: "227 N Sierra Nevada St",
  gla: 1576,
  lot: 7500,
  year: 1900,
  rooms: 6,
  full: 1,
  half: 1,
  garage: 0,
  fireplaces: 1,
  condition: "Average",
  heating: "Forced Hot Water",
  cooling: "Central",
};

const SEED_COMPS = [
  {
    address: "1205 N Airport Way",
    price: 378000,
    gla: 1684, lot: 5000, year: 1945, rooms: 5,
    full: 1, half: 1, garage: 2, fireplaces: 0,
    condition: "Average", heating: "Forced Hot Water", cooling: "Central",
  },
  {
    address: "1611 N Stanford Ave",
    price: 252500,
    gla: 1486, lot: 5001, year: 1922, rooms: 5,
    full: 2, half: 0, garage: 0, fireplaces: 2,
    condition: "Fair", heating: "Other", cooling: "Wall",
  },
  {
    address: "1262 N Union St",
    price: 366000,
    gla: 1452, lot: 7500, year: 1934, rooms: 6,
    full: 2, half: 0, garage: 2, fireplaces: 1,
    condition: "Average", heating: "Forced Hot Water", cooling: "Central",
  },
];

const DEFAULT_RULES = {
  gla: 40, lot: 1, year: 100, room: 5000,
  full: 5000, half: 2500, garage: 2500, fireplace: 2500,
  condition: 20000, heating: 8000, cooling: 6000,
};

const AVM = 339000; // ICE CA Value AVM from the attached report

function buildLines(subject, comp, r) {
  return [
    { key: "gla", label: "Living area (GLA)", unit: "sf", sVal: subject.gla, cVal: comp.gla,
      adj: (subject.gla - comp.gla) * r.gla },
    { key: "lot", label: "Lot size", unit: "sf", sVal: subject.lot, cVal: comp.lot,
      adj: (subject.lot - comp.lot) * r.lot },
    { key: "year", label: "Year built", unit: "", sVal: subject.year, cVal: comp.year,
      adj: (subject.year - comp.year) * r.year },
    { key: "rooms", label: "Rooms", unit: "", sVal: subject.rooms, cVal: comp.rooms,
      adj: (subject.rooms - comp.rooms) * r.room },
    { key: "full", label: "Full baths", unit: "", sVal: subject.full, cVal: comp.full,
      adj: (subject.full - comp.full) * r.full },
    { key: "half", label: "Half baths", unit: "", sVal: subject.half, cVal: comp.half,
      adj: (subject.half - comp.half) * r.half },
    { key: "garage", label: "Garage bays", unit: "", sVal: subject.garage, cVal: comp.garage,
      adj: (subject.garage - comp.garage) * r.garage },
    { key: "fireplaces", label: "Fireplaces", unit: "", sVal: subject.fireplaces, cVal: comp.fireplaces,
      adj: (subject.fireplaces - comp.fireplaces) * r.fireplace },
    { key: "condition", label: "Condition", unit: "", sVal: subject.condition, cVal: comp.condition, select: CONDITIONS,
      adj: (condRank(subject.condition) - condRank(comp.condition)) * r.condition },
    { key: "heating", label: "Heating", unit: "", sVal: subject.heating, cVal: comp.heating, select: HEATING,
      adj: (meetsHeat(subject.heating) - meetsHeat(comp.heating)) * r.heating },
    { key: "cooling", label: "Cooling", unit: "", sVal: subject.cooling, cVal: comp.cooling, select: COOLING,
      adj: (meetsCool(subject.cooling) - meetsCool(comp.cooling)) * r.cooling },
  ];
}

export default function CompAdjustmentEngine() {
  const [subject, setSubject] = useState(SUBJECT);
  const [comps, setComps] = useState(SEED_COMPS);
  const [rules, setRules] = useState(DEFAULT_RULES);
  const [showRules, setShowRules] = useState(false);

  const results = useMemo(() => {
    return comps.map((comp) => {
      const lines = buildLines(subject, comp, rules);
      const net = lines.reduce((s, l) => s + l.adj, 0);
      const gross = lines.reduce((s, l) => s + Math.abs(l.adj), 0);
      const adjusted = comp.price + net;
      return {
        comp, lines, net, gross, adjusted,
        netPct: comp.price ? net / comp.price : 0,
        grossPct: comp.price ? gross / comp.price : 0,
      };
    });
  }, [subject, comps, rules]);

  const bestIdx = useMemo(() => {
    let idx = 0, best = Infinity;
    results.forEach((r, i) => { if (r.grossPct < best) { best = r.grossPct; idx = i; } });
    return idx;
  }, [results]);

  const reconciliation = useMemo(() => {
    const adj = results.map((r) => r.adjusted);
    const min = Math.min(...adj), max = Math.max(...adj);
    // Gross-weighted: less-adjusted comps carry more weight
    const weights = results.map((r) => 1 / (r.grossPct + 0.01));
    const wsum = weights.reduce((a, b) => a + b, 0);
    const weighted = results.reduce((s, r, i) => s + r.adjusted * weights[i], 0) / wsum;
    return { min, max, weighted };
  }, [results]);

  const num = (v) => (v === "" || isNaN(Number(v)) ? 0 : Number(v));
  const setSubj = (k, v, isNum = true) => setSubject((s) => ({ ...s, [k]: isNum ? num(v) : v }));
  const setComp = (i, k, v, isNum = true) =>
    setComps((cs) => cs.map((c, ci) => (ci === i ? { ...c, [k]: isNum ? num(v) : v } : c)));

  // ---- shared styles ----
  const label = { fontSize: 10.5, letterSpacing: "0.09em", textTransform: "uppercase", color: theme.faint, fontWeight: 600 };
  const mono = { fontVariantNumeric: "tabular-nums", fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace" };
  const cellInput = {
    width: "100%", border: "none", background: "transparent", textAlign: "right",
    color: theme.ink, fontSize: 13.5, padding: "6px 8px", outline: "none", ...mono,
  };
  const selInput = { ...cellInput, textAlign: "right", appearance: "none", cursor: "pointer" };

  const AdjChip = ({ v }) => {
    if (!v) return <span style={{ color: theme.faint, fontSize: 11.5, ...mono }}>—</span>;
    const up = v > 0;
    return (
      <span style={{ ...mono, fontSize: 11.5, fontWeight: 600, color: up ? theme.pos : theme.neg }}>
        {up ? "+" : "−"}{usd(Math.abs(v)).replace("$", "$")}
      </span>
    );
  };

  return (
    <div style={{ background: theme.paper, minHeight: "100%", padding: "20px 14px 40px", color: theme.ink,
      fontFamily: "ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, sans-serif" }}>
      <div style={{ maxWidth: 940, margin: "0 auto" }}>

        {/* Header */}
        <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between",
          gap: 16, flexWrap: "wrap", marginBottom: 18 }}>
          <div>
            <div style={{ ...label, color: theme.accent, marginBottom: 6 }}>Comp Adjustment Engine · BPO copilot core</div>
            <div style={{ fontSize: 25, fontWeight: 700, letterSpacing: "-0.02em", lineHeight: 1.05 }}>
              {subject.address}
            </div>
            <div style={{ color: theme.sub, fontSize: 13, marginTop: 5 }}>
              Stockton, CA 95205 · seeded from your BPO — edit any cell to watch it recompute
            </div>
          </div>
          <button onClick={() => setShowRules((s) => !s)}
            style={{ border: `1px solid ${theme.line}`, background: theme.card, color: theme.ink,
              borderRadius: 8, padding: "9px 13px", fontSize: 12.5, fontWeight: 600, cursor: "pointer" }}>
            {showRules ? "Hide" : "Edit"} adjustment rules
          </button>
        </div>

        {/* Rules bar */}
        {showRules && (
          <div style={{ background: theme.card, border: `1px solid ${theme.line}`, borderRadius: 12,
            padding: 14, marginBottom: 16, display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(130px, 1fr))", gap: 10 }}>
            {[
              ["gla", "GLA / sf"], ["lot", "Lot / sf"], ["year", "Year / yr"], ["room", "Room"],
              ["full", "Full bath"], ["half", "Half bath"], ["garage", "Garage bay"], ["fireplace", "Fireplace"],
              ["condition", "Condition / grade"], ["heating", "Heating"], ["cooling", "Cooling"],
            ].map(([k, lbl]) => (
              <label key={k} style={{ display: "block" }}>
                <div style={{ ...label, marginBottom: 3 }}>{lbl}</div>
                <div style={{ display: "flex", alignItems: "center", border: `1px solid ${theme.line}`,
                  borderRadius: 7, background: theme.paper, padding: "0 8px" }}>
                  <span style={{ color: theme.faint, fontSize: 12 }}>$</span>
                  <input value={rules[k]} onChange={(e) => setRules((r) => ({ ...r, [k]: num(e.target.value) }))}
                    style={{ ...cellInput, textAlign: "left", padding: "6px 4px" }} inputMode="decimal" />
                </div>
              </label>
            ))}
          </div>
        )}

        {/* Grid */}
        <div style={{ background: theme.card, border: `1px solid ${theme.line}`, borderRadius: 14,
          overflow: "hidden" }}>
          <div style={{ overflowX: "auto" }}>
            <table style={{ borderCollapse: "collapse", width: "100%", minWidth: 720 }}>
              <thead>
                <tr>
                  <th style={{ textAlign: "left", padding: "14px 16px", ...label, position: "sticky", left: 0,
                    background: theme.card, zIndex: 2, minWidth: 150 }}>Feature</th>
                  <th style={{ padding: "10px 12px", background: theme.hi, borderLeft: `1px solid ${theme.line}` }}>
                    <div style={{ ...label, color: theme.ink }}>Subject</div>
                    <div style={{ fontSize: 11, color: theme.sub, marginTop: 2, fontWeight: 500 }}>227 N Sierra Nevada</div>
                  </th>
                  {comps.map((c, i) => (
                    <th key={i} style={{ padding: "10px 12px", borderLeft: `1px solid ${theme.line}`,
                      background: i === bestIdx ? theme.accentSoft : theme.card, minWidth: 172 }}>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 6 }}>
                        <div style={{ ...label, color: theme.ink }}>Comp {i + 1}</div>
                        {i === bestIdx && (
                          <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.06em", color: theme.accent,
                            background: "#fff", border: `1px solid ${theme.accent}`, borderRadius: 20, padding: "2px 7px" }}>
                            MOST COMPARABLE
                          </span>
                        )}
                      </div>
                      <input value={c.address} onChange={(e) => setComp(i, "address", e.target.value, false)}
                        style={{ border: "none", background: "transparent", color: theme.sub, fontSize: 11,
                          width: "100%", outline: "none", marginTop: 2, fontWeight: 500 }} />
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {/* Sale price row */}
                <tr style={{ borderTop: `1px solid ${theme.line}` }}>
                  <td style={{ padding: "10px 16px", ...label, color: theme.ink, position: "sticky", left: 0,
                    background: theme.card }}>Sale price</td>
                  <td style={{ background: theme.hi, borderLeft: `1px solid ${theme.line}`, textAlign: "right",
                    padding: "8px 12px", color: theme.faint, ...mono, fontSize: 12 }}>—</td>
                  {comps.map((c, i) => (
                    <td key={i} style={{ borderLeft: `1px solid ${theme.line}`,
                      background: i === bestIdx ? theme.accentSoft : theme.card }}>
                      <div style={{ display: "flex", alignItems: "center", padding: "0 6px" }}>
                        <span style={{ color: theme.faint, fontSize: 12 }}>$</span>
                        <input value={c.price} onChange={(e) => setComp(i, "price", e.target.value)}
                          style={{ ...cellInput, fontWeight: 700 }} inputMode="numeric" />
                      </div>
                    </td>
                  ))}
                </tr>

                {/* Feature rows */}
                {buildLines(subject, comps[0], rules).map((_, rowIdx) => {
                  const rowKey = buildLines(subject, comps[0], rules)[rowIdx].key;
                  const meta = buildLines(subject, comps[0], rules)[rowIdx];
                  return (
                    <tr key={rowKey} style={{ borderTop: `1px solid ${theme.hair}` }}>
                      <td style={{ padding: "6px 16px", fontSize: 12.5, color: theme.ink, position: "sticky",
                        left: 0, background: theme.card }}>
                        {meta.label}{meta.unit ? <span style={{ color: theme.faint }}> ({meta.unit})</span> : null}
                      </td>
                      {/* subject cell */}
                      <td style={{ background: theme.hi, borderLeft: `1px solid ${theme.line}` }}>
                        {meta.select ? (
                          <select value={subject[rowKey]} onChange={(e) => setSubj(rowKey, e.target.value, false)}
                            style={selInput}>
                            {meta.select.map((o) => <option key={o}>{o}</option>)}
                          </select>
                        ) : (
                          <input value={subject[rowKey]} onChange={(e) => setSubj(rowKey, e.target.value)}
                            style={cellInput} inputMode="numeric" />
                        )}
                      </td>
                      {/* comp cells */}
                      {results.map((res, i) => {
                        const line = res.lines[rowIdx];
                        return (
                          <td key={i} style={{ borderLeft: `1px solid ${theme.line}`,
                            background: i === bestIdx ? theme.accentSoft : theme.card, padding: "2px 8px" }}>
                            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                              {meta.select ? (
                                <select value={comps[i][rowKey]} onChange={(e) => setComp(i, rowKey, e.target.value, false)}
                                  style={{ ...selInput, width: "auto", flex: 1, textAlign: "left", paddingLeft: 0 }}>
                                  {meta.select.map((o) => <option key={o}>{o}</option>)}
                                </select>
                              ) : (
                                <input value={comps[i][rowKey]} onChange={(e) => setComp(i, rowKey, e.target.value)}
                                  style={{ ...cellInput, textAlign: "left", flex: 1, paddingLeft: 0 }} inputMode="numeric" />
                              )}
                              <AdjChip v={line.adj} />
                            </div>
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}

                {/* Totals */}
                <tr style={{ borderTop: `2px solid ${theme.line}` }}>
                  <td style={{ padding: "11px 16px", ...label, color: theme.ink, position: "sticky", left: 0,
                    background: theme.card }}>Net adjustment</td>
                  <td style={{ background: theme.hi, borderLeft: `1px solid ${theme.line}` }} />
                  {results.map((r, i) => (
                    <td key={i} style={{ borderLeft: `1px solid ${theme.line}`, textAlign: "right", padding: "9px 12px",
                      background: i === bestIdx ? theme.accentSoft : theme.card }}>
                      <div style={{ ...mono, fontWeight: 600, fontSize: 13,
                        color: r.net >= 0 ? theme.pos : theme.neg }}>
                        {r.net >= 0 ? "+" : "−"}{usd(Math.abs(r.net))}
                      </div>
                      <div style={{ ...mono, fontSize: 10.5, color: theme.faint }}>
                        {(r.netPct * 100).toFixed(0)}%
                      </div>
                    </td>
                  ))}
                </tr>
                <tr style={{ borderTop: `1px solid ${theme.hair}` }}>
                  <td style={{ padding: "9px 16px", ...label, color: theme.sub, position: "sticky", left: 0,
                    background: theme.card }}>Gross adjustment</td>
                  <td style={{ background: theme.hi, borderLeft: `1px solid ${theme.line}` }} />
                  {results.map((r, i) => (
                    <td key={i} style={{ borderLeft: `1px solid ${theme.line}`, textAlign: "right", padding: "7px 12px",
                      background: i === bestIdx ? theme.accentSoft : theme.card }}>
                      <div style={{ ...mono, fontSize: 12.5, color: theme.ink }}>{usd(r.gross)}</div>
                      <div style={{ ...mono, fontSize: 10.5, color: theme.faint }}>{(r.grossPct * 100).toFixed(0)}%</div>
                    </td>
                  ))}
                </tr>
                <tr style={{ borderTop: `1px solid ${theme.line}` }}>
                  <td style={{ padding: "13px 16px", fontWeight: 700, fontSize: 13, position: "sticky", left: 0,
                    background: theme.card }}>Adjusted price</td>
                  <td style={{ background: theme.hi, borderLeft: `1px solid ${theme.line}` }} />
                  {results.map((r, i) => (
                    <td key={i} style={{ borderLeft: `1px solid ${theme.line}`, textAlign: "right", padding: "11px 12px",
                      background: i === bestIdx ? theme.accentSoft : theme.card }}>
                      <span style={{ ...mono, fontWeight: 700, fontSize: 15.5,
                        color: i === bestIdx ? theme.accent : theme.ink }}>{usd(r.adjusted)}</span>
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* Reconciliation */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12,
          marginTop: 16 }}>
          <Stat lbl="Adjusted range" val={`${usd(reconciliation.min)} – ${usd(reconciliation.max)}`} />
          <Stat lbl="Gross-weighted value" val={usd(reconciliation.weighted)} accent />
          <Stat lbl="Most comparable" val={usd(results[bestIdx].adjusted)}
            note={comps[bestIdx].address} />
          <Stat lbl="ICE AVM (reference)" val={usd(AVM)}
            note={`${((reconciliation.weighted - AVM) / AVM * 100 >= 0 ? "+" : "")}${((reconciliation.weighted - AVM) / AVM * 100).toFixed(1)}% vs your value`} />
        </div>

        <p style={{ fontSize: 11.5, color: theme.faint, marginTop: 16, lineHeight: 1.6 }}>
          Quantitative lines (GLA, lot, year, rooms, baths, garage, fireplaces) compute straight from the rules bar.
          Condition steps by grade; heating and cooling are treated as meets-standard tests — matching how your
          Stockton report was built. In the full copilot, these columns arrive pre-filled from public records + the
          agent&rsquo;s MLS, and this grid becomes a review screen, not a data-entry screen.
        </p>
      </div>
    </div>
  );
}

function Stat({ lbl, val, note, accent }) {
  return (
    <div style={{ background: accent ? theme.accent : theme.card, color: accent ? "#fff" : theme.ink,
      border: `1px solid ${accent ? theme.accent : theme.line}`, borderRadius: 12, padding: "13px 15px" }}>
      <div style={{ fontSize: 10.5, letterSpacing: "0.09em", textTransform: "uppercase", fontWeight: 600,
        color: accent ? "rgba(255,255,255,0.75)" : theme.faint }}>{lbl}</div>
      <div style={{ fontSize: 18, fontWeight: 700, marginTop: 5, fontVariantNumeric: "tabular-nums",
        letterSpacing: "-0.01em" }}>{val}</div>
      {note && <div style={{ fontSize: 11, marginTop: 3, color: accent ? "rgba(255,255,255,0.8)" : theme.sub }}>{note}</div>}
    </div>
  );
}
