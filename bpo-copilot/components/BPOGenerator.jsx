"use client";
import React, { useState, useMemo } from "react";

/*
  BPO Generator (Next.js client component).
  Data + narrative come from server API routes so no keys touch the browser:
    - POST /api/bpo        -> { subject, comps, meta }  (ATTOM or mock)
    - POST /api/narrative  -> { subject, marketing, comps }  (falls back to template)
  The scoring / adjustment / reconciliation engine runs client-side for
  interactivity (re-scores as the agent toggles comps).
*/

// ---------------- engine + constants ----------------
const MARKET = { supply: "Over supply", trend: "Declining", pricePct: -3, ownerOcc: 55, tenantOcc: 45, avgDom: 133, activeListings: 7, sold12mo: 10, saleLow: 149000, saleHigh: 435000 };
const RULES = { gla: 40, lot: 1, year: 100, room: 5000, full: 5000, half: 2500, garage: 2500, fireplace: 2500, condition: 20000, heating: 8000, cooling: 6000 };
const MARKUP = 0.02;
const CONDITIONS = ["Poor", "Fair", "Average", "Above Average", "Good", "Excellent"];
const condRank = (c) => Math.max(0, CONDITIONS.indexOf(c));
const meetsHeat = (h) => (h === "Other" ? 0 : 1);
const meetsCool = (c) => (c === "Central" ? 1 : 0);
const monthsSince = (d) => (Date.now() - new Date(d)) / (1000 * 60 * 60 * 24 * 30.4);
const usd = (n) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(Math.round(n || 0));
const round500 = (n) => Math.round(n / 500) * 500;

function score(subject, c, med) {
  const cl = (x) => Math.max(0, Math.min(1, x));
  const dist = cl(1 - c.dist / 1.0), gla = cl(1 - Math.abs(c.gla - subject.gla) / 800), lot = cl(1 - Math.abs(c.lot - subject.lot) / 7500);
  const year = cl(1 - Math.abs(c.year - subject.year) / 60), recency = cl(1 - monthsSince(c.date) / 18), bed = cl(1 - Math.abs(c.beds - subject.beds) / 3);
  const ppsf = cl(1 - Math.abs(c.price / c.gla - med) / med / 0.5);
  return { composite: dist * 0.24 + gla * 0.22 + recency * 0.17 + year * 0.1 + lot * 0.06 + bed * 0.06 + ppsf * 0.15 };
}
function lines(subject, c, r) {
  return [
    { key: "gla", label: "Living area (GLA)", adj: (subject.gla - c.gla) * r.gla }, { key: "lot", label: "Lot size", adj: (subject.lot - c.lot) * r.lot },
    { key: "year", label: "Year built", adj: (subject.year - c.year) * r.year }, { key: "rooms", label: "Rooms", adj: (subject.rooms - c.rooms) * r.room },
    { key: "full", label: "Full baths", adj: (subject.full - c.full) * r.full }, { key: "half", label: "Half baths", adj: (subject.half - c.half) * r.half },
    { key: "garage", label: "Garage bays", adj: (subject.garage - c.garage) * r.garage }, { key: "fireplaces", label: "Fireplaces", adj: (subject.fireplaces - c.fireplaces) * r.fireplace },
    { key: "condition", label: "Condition", adj: (condRank(subject.condition) - condRank(c.condition)) * r.condition }, { key: "heating", label: "Heating", adj: (meetsHeat(subject.heating) - meetsHeat(c.heating)) * r.heating },
    { key: "cooling", label: "Cooling", adj: (meetsCool(subject.cooling) - meetsCool(c.cooling)) * r.cooling },
  ];
}
function evalComp(subject, c, r) {
  if (!c) return null;
  const L = lines(subject, c, r), net = L.reduce((s, l) => s + l.adj, 0), gross = L.reduce((s, l) => s + Math.abs(l.adj), 0);
  return { ...c, L, net, gross, adjusted: c.price + net, netPct: c.price ? net / c.price : 0, grossPct: c.price ? gross / c.price : 0 };
}
function templateNarrative(subject, sold, reconciled) {
  return {
    subject: `The subject is a ${subject.year}-built, ${subject.stories}-story detached single-family residence of approximately ${subject.gla} sq ft on a ${subject.lot} sq ft lot. It presents in ${subject.condition.toLowerCase()} condition with normal wear consistent with its age and no visible health or safety issues.`,
    marketing: `The subject sits in a ${MARKET.trend.toLowerCase()} market with ${MARKET.supply.toLowerCase()} and average marketing time near ${MARKET.avgDom} days. Financing is most likely Cash or Conventional. A recommended list price of ${usd(reconciled)} is supported by the adjusted comparable range.`,
    comps: sold.map((c) => `Located ${c.dist} mi from the subject. ${c.adjusted >= reconciled ? "Superior" : "Inferior"} on net after adjustment for living area, age and site differences. Adjusted to ${usd(c.adjusted)} (${(c.grossPct * 100).toFixed(0)}% gross).`),
  };
}

// ---------------- UI ----------------
const T = { ink: "#111c26", sub: "#5c6b76", faint: "#8b98a1", paper: "#eceff1", card: "#ffffff", line: "#dde3e7", hair: "#eef1f3", accent: "#0e5a4a", accentSoft: "#e7f0ed", accentLine: "#bcd4cd", pos: "#0f7a52", neg: "#b1503f", hi: "#f4f1e6", warn: "#b5761f", warnSoft: "#f7efdd", warnLine: "#e6cfa0" };
const label = { fontSize: 10.5, letterSpacing: "0.09em", textTransform: "uppercase", color: T.faint, fontWeight: 600 };
const mono = { fontVariantNumeric: "tabular-nums", fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace" };
const card = { background: T.card, border: `1px solid ${T.line}`, borderRadius: 14 };
const btn = (p, d) => ({ border: `1px solid ${p ? T.accent : T.line}`, background: p ? T.accent : T.card, color: p ? "#fff" : T.ink, borderRadius: 9, padding: "10px 18px", fontSize: 13.5, fontWeight: 600, cursor: d ? "not-allowed" : "pointer", opacity: d ? 0.55 : 1 });
const STEPS = ["Address", "Subject", "Comps", "Adjustments", "Opinion", "BPO"];

export default function BPOGenerator() {
  const [step, setStep] = useState(0);
  const [address, setAddress] = useState("227 N Sierra Nevada St, Stockton, CA 95205");
  const [pulling, setPulling] = useState(false);
  const [error, setError] = useState(null);
  const [data, setData] = useState(null);
  const [subject, setSubject] = useState(null);
  const [selected, setSelected] = useState([]);
  const [confirmed, setConfirmed] = useState({});
  const [narrative, setNarrative] = useState(null);
  const [narrativeState, setNarrativeState] = useState("idle");

  const pool = data?.comps || [];
  const flagged = useMemo(() => new Set(data?.meta?.missingFields || []), [data]);
  const med = useMemo(() => { const s = pool.map((c) => c.price / c.gla).sort((a, b) => a - b); return s[Math.floor(s.length / 2)] || 200; }, [pool]);
  const scored = useMemo(() => (subject ? pool.map((c) => ({ ...c, ...score(subject, c, med) })).sort((a, b) => b.composite - a.composite) : []), [subject, pool, med]);
  const autoPick = useMemo(() => scored.filter((c) => c.status === "sold").slice(0, 3).map((c) => c.id), [scored]);
  const activeSel = selected.length ? selected : autoPick;
  const evaluated = useMemo(() => (subject ? activeSel.map((id) => evalComp(subject, pool.find((c) => c.id === id), RULES)).filter(Boolean) : []), [activeSel, subject, pool]);

  const recon = useMemo(() => {
    if (!evaluated.length) return { min: 0, max: 0, weighted: 0, bestId: null };
    const adj = evaluated.map((e) => e.adjusted), w = evaluated.map((e) => 1 / (e.grossPct + 0.01)), ws = w.reduce((a, b) => a + b, 0);
    const weighted = evaluated.reduce((s, e, i) => s + e.adjusted * w[i], 0) / ws;
    let bestId = evaluated[0].id, best = Infinity; evaluated.forEach((e) => { if (e.grossPct < best) { best = e.grossPct; bestId = e.id; } });
    return { min: Math.min(...adj), max: Math.max(...adj), weighted, bestId };
  }, [evaluated]);
  const opinion = useMemo(() => { const s90 = round500(recon.weighted), s30 = round500(s90 * 0.985); return { sale90: s90, list90: round500(s90 * (1 + MARKUP)), sale30: s30, list30: round500(s30 * (1 + MARKUP)), land: round500(recon.weighted * 0.31), repairs: 0 }; }, [recon]);

  const runPull = async () => {
    setPulling(true); setError(null);
    try {
      const res = await fetch("/api/bpo", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ address }) });
      const json = await res.json();
      if (!res.ok || json.error) throw new Error(json.error || "lookup failed");
      if (!json.subject) throw new Error("No record found for that address.");
      setData(json); setSubject(json.subject); setSelected([]); setConfirmed({}); setNarrative(null); setNarrativeState("idle"); setStep(1);
    } catch (e) { setError(String(e.message || e)); }
    finally { setPulling(false); }
  };
  const setSubj = (k, v, n = true) => { setSubject((s) => ({ ...s, [k]: n ? (v === "" || isNaN(+v) ? 0 : +v) : v })); if (flagged.has(k)) setConfirmed((c) => ({ ...c, [k]: true })); };
  const toggle = (id) => { const base = selected.length ? [...selected] : [...autoPick]; const i = base.indexOf(id); if (i >= 0) base.splice(i, 1); else base.push(id); setSelected(base); };
  const genNarrative = async () => {
    setNarrativeState("loading");
    try {
      const res = await fetch("/api/narrative", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ subject, comps: evaluated, reconciled: opinion.sale90 }) });
      const json = await res.json();
      if (!res.ok || !json.subject) throw new Error();
      setNarrative(json); setNarrativeState("ai");
    } catch { setNarrative(templateNarrative(subject, evaluated, opinion.sale90)); setNarrativeState("template"); }
  };
  const go = (n) => { setStep(n); if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" }); };
  const needConfirm = [...flagged].filter((k) => !confirmed[k]);

  return (
    <div style={{ background: T.paper, minHeight: "100%", padding: "20px 14px 44px", color: T.ink, fontFamily: "ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, sans-serif" }}>
      <div style={{ maxWidth: 960, margin: "0 auto" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
          <div style={{ width: 30, height: 30, borderRadius: 8, background: T.accent, color: "#fff", display: "grid", placeItems: "center", fontWeight: 800, fontSize: 15 }}>B</div>
          <div style={{ fontWeight: 700, fontSize: 16 }}>BPO Copilot</div>
          <div style={{ marginLeft: "auto", ...label }}>{data ? (data.meta.live ? "● live data" : "● demo data") : "address in · reviewed BPO out"}</div>
        </div>

        <div style={{ display: "flex", gap: 6, marginBottom: 20, flexWrap: "wrap" }}>
          {STEPS.map((s, i) => (
            <button key={s} onClick={() => i <= step && subject && go(i)} style={{ flex: "1 1 90px", textAlign: "left", cursor: i <= step ? "pointer" : "default", background: i === step ? T.card : "transparent", border: `1px solid ${i === step ? T.accentLine : "transparent"}`, borderRadius: 9, padding: "7px 10px", opacity: i <= step ? 1 : 0.45 }}>
              <div style={{ ...mono, fontSize: 10, color: i === step ? T.accent : T.faint }}>0{i + 1}</div>
              <div style={{ fontSize: 12, fontWeight: 600, color: i <= step ? T.ink : T.faint }}>{s}</div>
            </button>
          ))}
        </div>

        {step === 0 && (
          <div style={{ ...card, padding: "36px 26px" }}>
            <div style={{ ...label, color: T.accent, marginBottom: 10 }}>New broker price opinion</div>
            <h1 style={{ fontSize: 27, fontWeight: 700, letterSpacing: "-0.02em", margin: "0 0 8px" }}>Enter a property address</h1>
            <p style={{ color: T.sub, fontSize: 14, margin: "0 0 22px", maxWidth: 560, lineHeight: 1.55 }}>We pull assessor, sales history and AVM from public records, find nearby sold comps, and draft the full BPO for your review.</p>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", maxWidth: 640 }}>
              <input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="123 Main St, City, ST 00000" style={{ flex: "1 1 320px", border: `1px solid ${T.line}`, borderRadius: 10, padding: "13px 15px", fontSize: 15, outline: "none", color: T.ink, background: T.paper }} />
              <button onClick={runPull} disabled={pulling} style={btn(true, pulling)}>{pulling ? "Pulling…" : "Generate BPO →"}</button>
            </div>
            {pulling && <div style={{ marginTop: 18, ...label, color: T.sub }}>● Fetching public records + scoring comps…</div>}
            {error && <div style={{ marginTop: 16, padding: "11px 13px", background: "#fbeeeb", border: `1px solid #e6bcb2`, borderRadius: 9, fontSize: 12.5, color: T.neg }}>{error}</div>}
            <div style={{ marginTop: 26, padding: 14, background: T.hi, borderRadius: 10, fontSize: 12.5, color: T.sub, lineHeight: 1.55, maxWidth: 640 }}>
              <b style={{ color: T.ink }}>Data source.</b> Runs on built-in mock data until you set <code>ATTOM_API_KEY</code>; then the same pipeline pulls live public records. The key stays on the server.
            </div>
          </div>
        )}

        {step === 1 && subject && (
          <Section title="Subject property" sub="Auto-filled from public records. Confirm the flagged fields — public records can't see inside." pill={data.meta.provider}>
            {needConfirm.length > 0 && (
              <div style={{ background: T.warnSoft, border: `1px solid ${T.warnLine}`, borderRadius: 10, padding: "11px 14px", marginBottom: 14, fontSize: 12.5, color: "#7a5210", lineHeight: 1.5 }}>
                <b>{needConfirm.length} field{needConfirm.length > 1 ? "s" : ""} to confirm from your inspection:</b> {needConfirm.join(", ")}. These aren't in public records — set them from what you saw on site.
              </div>
            )}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px,1fr))", gap: 1, background: T.line, border: `1px solid ${T.line}`, borderRadius: 12, overflow: "hidden" }}>
              {[["gla", "Living area (sf)"], ["lot", "Lot (sf)"], ["year", "Year built"], ["beds", "Bedrooms"], ["rooms", "Rooms"], ["full", "Full baths"], ["half", "Half baths"], ["garage", "Garage bays"], ["fireplaces", "Fireplaces"], ["stories", "Stories"]].map(([k, lbl]) => (
                <Field key={k} lbl={lbl} value={subject[k]} onChange={(v) => setSubj(k, v)} flag={flagged.has(k)} confirmed={!!confirmed[k]} />
              ))}
              {[["condition", CONDITIONS], ["heating", ["Forced Hot Water", "Central", "Electric", "Other"]], ["cooling", ["Central", "Wall", "None"]]].map(([k, opts]) => (
                <FieldSelect key={k} lbl={k[0].toUpperCase() + k.slice(1)} value={subject[k]} opts={opts} onChange={(v) => setSubj(k, v, false)} flag={flagged.has(k)} confirmed={!!confirmed[k]} />
              ))}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px,1fr))", gap: 12, marginTop: 14 }}>
              <MiniStat lbl="APN" val={subject.apn} small /><MiniStat lbl="Assessed" val={usd(subject.assessed)} />
              <MiniStat lbl="AVM" val={usd(subject.avm)} note={subject.avmLow ? `${usd(subject.avmLow)}–${usd(subject.avmHigh)}` : null} accent />
              <MiniStat lbl="Last sale" val={usd(subject.lastSale)} note={subject.lastSaleDate} small />
            </div>
            <NavRow onBack={() => go(0)} onNext={() => go(2)} nextLabel="Review comps →" />
          </Section>
        )}

        {step === 2 && subject && (
          <Section title="Comparable selection" sub={`${scored.length} sold comps, scored by proximity, recency & similarity. Top 3 auto-selected.`} pill="Sold · public records">
            <div style={{ display: "grid", gap: 8 }}>
              {scored.map((c) => { const on = activeSel.includes(c.id); return (
                <button key={c.id} onClick={() => toggle(c.id)} style={{ textAlign: "left", cursor: "pointer", display: "grid", gridTemplateColumns: "18px 1fr auto", gap: 12, alignItems: "center", background: on ? T.accentSoft : T.card, border: `1px solid ${on ? T.accentLine : T.line}`, borderRadius: 11, padding: "11px 14px" }}>
                  <div style={{ width: 18, height: 18, borderRadius: 5, border: `1.5px solid ${on ? T.accent : T.line}`, background: on ? T.accent : "transparent", display: "grid", placeItems: "center", color: "#fff", fontSize: 12 }}>{on ? "✓" : ""}</div>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: 13.5 }}>{c.address}</div>
                    <div style={{ ...mono, fontSize: 11.5, color: T.sub, marginTop: 3 }}>{usd(c.price)} · {c.dist} mi · {c.gla} sf · {c.beds}bd · {c.year} · {c.date}</div>
                  </div>
                  <div style={{ textAlign: "right" }}><div style={{ ...mono, fontWeight: 700, fontSize: 14, color: c.composite > 0.7 ? T.accent : T.ink }}>{(c.composite * 100).toFixed(0)}</div><div style={{ ...label, color: T.faint }}>match</div></div>
                </button>
              ); })}
            </div>
            <NavRow onBack={() => go(1)} onNext={() => go(3)} nextLabel={`Adjust ${activeSel.length} comps →`} />
          </Section>
        )}

        {step === 3 && subject && evaluated.length > 0 && (
          <Section title="Adjustment grid" sub="Every line computes from the rules engine." pill="Rules engine">
            <div style={{ ...card, overflow: "hidden" }}><div style={{ overflowX: "auto" }}>
              <table style={{ borderCollapse: "collapse", width: "100%", minWidth: 560 }}>
                <thead><tr>
                  <th style={{ textAlign: "left", padding: "12px 14px", ...label, background: T.card, position: "sticky", left: 0, minWidth: 130 }}>Feature</th>
                  <th style={{ padding: "10px", ...label, color: T.ink, background: T.hi, borderLeft: `1px solid ${T.line}` }}>Subject</th>
                  {evaluated.map((e) => (<th key={e.id} style={{ padding: "10px", borderLeft: `1px solid ${T.line}`, minWidth: 132, background: e.id === recon.bestId ? T.accentSoft : T.card }}><div style={{ fontSize: 11.5, fontWeight: 700 }}>{e.address.split(" ").slice(0, 2).join(" ")}</div><div style={{ ...mono, fontSize: 10.5, color: T.sub }}>{usd(e.price)}</div></th>))}
                </tr></thead>
                <tbody>
                  {lines(subject, evaluated[0], RULES).map((meta, ri) => (
                    <tr key={meta.key} style={{ borderTop: `1px solid ${T.hair}` }}>
                      <td style={{ padding: "6px 14px", fontSize: 12, position: "sticky", left: 0, background: T.card }}>{meta.label}</td>
                      <td style={{ ...mono, fontSize: 12, textAlign: "center", background: T.hi, borderLeft: `1px solid ${T.line}` }}>{String(subject[meta.key])}</td>
                      {evaluated.map((e) => { const l = e.L[ri]; return (
                        <td key={e.id} style={{ borderLeft: `1px solid ${T.line}`, padding: "5px 10px", background: e.id === recon.bestId ? T.accentSoft : T.card }}>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 6 }}>
                            <span style={{ ...mono, fontSize: 11.5, color: T.sub }}>{String(e[meta.key])}</span>
                            <span style={{ ...mono, fontSize: 11, fontWeight: 600, color: l.adj > 0 ? T.pos : l.adj < 0 ? T.neg : T.faint }}>{l.adj ? `${l.adj > 0 ? "+" : "−"}${usd(Math.abs(l.adj))}` : "—"}</span>
                          </div>
                        </td>
                      ); })}
                    </tr>
                  ))}
                  <TotalRow label="Net adj." cells={evaluated.map((e) => ({ id: e.id, main: `${e.net >= 0 ? "+" : "−"}${usd(Math.abs(e.net))}`, sub: `${(e.netPct * 100).toFixed(0)}%`, color: e.net >= 0 ? T.pos : T.neg }))} best={recon.bestId} />
                  <TotalRow label="Gross adj." cells={evaluated.map((e) => ({ id: e.id, main: usd(e.gross), sub: `${(e.grossPct * 100).toFixed(0)}%`, color: T.ink }))} best={recon.bestId} />
                  <TotalRow label="Adjusted" big cells={evaluated.map((e) => ({ id: e.id, main: usd(e.adjusted), color: e.id === recon.bestId ? T.accent : T.ink }))} best={recon.bestId} />
                </tbody>
              </table>
            </div></div>
            <NavRow onBack={() => go(2)} onNext={() => go(4)} nextLabel="Reconcile →" />
          </Section>
        )}

        {step === 4 && subject && (
          <Section title="Reconciliation & price opinion" sub="Weighted toward least-adjusted comps, cross-checked against the AVM.">
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: 12 }}>
              <MiniStat lbl="Adjusted range" val={`${usd(recon.min)} – ${usd(recon.max)}`} small />
              <MiniStat lbl="Reconciled value" val={usd(round500(recon.weighted))} accent />
              <MiniStat lbl="AVM" val={usd(subject.avm)} note={subject.avm ? `${((round500(recon.weighted) - subject.avm) / subject.avm * 100 >= 0 ? "+" : "")}${((round500(recon.weighted) - subject.avm) / subject.avm * 100).toFixed(1)}% vs opinion` : null} />
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 14 }}>
              <PriceBox title="90-day marketing" list={opinion.list90} sale={opinion.sale90} /><PriceBox title="30-day marketing" list={opinion.list30} sale={opinion.sale30} />
            </div>
            <div style={{ ...card, padding: 16, marginTop: 14 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
                <div><div style={{ fontWeight: 600, fontSize: 14 }}>Narrative sections</div><div style={{ fontSize: 12.5, color: T.sub }}>Auto-draft subject, marketing & per-comp comments.</div></div>
                <button onClick={genNarrative} disabled={narrativeState === "loading"} style={btn(true, narrativeState === "loading")}>{narrativeState === "loading" ? "Drafting…" : narrative ? "Redraft" : "Draft narrative"}</button>
              </div>
              {narrative && (<div style={{ marginTop: 14, display: "grid", gap: 10 }}>
                <NarrBlock lbl="Subject" text={narrative.subject} /><NarrBlock lbl="Marketing strategy" text={narrative.marketing} />
                {narrative.comps.map((c, i) => <NarrBlock key={i} lbl={`Comp ${i + 1} — ${evaluated[i]?.address || ""}`} text={c} />)}
                <div style={{ ...label, color: narrativeState === "ai" ? T.accent : T.warn }}>{narrativeState === "ai" ? "● Drafted by Claude" : "● Template (set ANTHROPIC_API_KEY for AI draft)"} — editable before signing</div>
              </div>)}
            </div>
            <NavRow onBack={() => go(3)} onNext={() => go(5)} nextLabel="Build BPO →" />
          </Section>
        )}

        {step === 5 && subject && (
          <BPODoc subject={subject} market={MARKET} comps={evaluated} recon={recon} opinion={opinion} narrative={narrative || templateNarrative(subject, evaluated, opinion.sale90)} onBack={() => go(4)} />
        )}
      </div>
    </div>
  );
}

function Section({ title, sub, pill, children }) {
  return (<div style={{ ...card, padding: "22px 20px" }}>
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, marginBottom: 16 }}>
      <div><h2 style={{ fontSize: 20, fontWeight: 700, margin: "0 0 4px" }}>{title}</h2>{sub && <div style={{ color: T.sub, fontSize: 13, maxWidth: 620, lineHeight: 1.5 }}>{sub}</div>}</div>
      {pill && <Tag soft>{pill}</Tag>}
    </div>{children}</div>);
}
function Tag({ children, soft }) { return <span style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: "0.05em", textTransform: "uppercase", color: soft ? T.accent : "#fff", background: soft ? "transparent" : T.accent, border: `1px solid ${T.accent}`, borderRadius: 20, padding: "3px 8px", whiteSpace: "nowrap" }}>{children}</span>; }
function Field({ lbl, value, onChange, flag, confirmed }) {
  const need = flag && !confirmed;
  return (<div style={{ background: need ? T.warnSoft : T.card, padding: "9px 12px", boxShadow: need ? `inset 3px 0 0 ${T.warn}` : "none" }}>
    <div style={{ ...label, marginBottom: 3, display: "flex", gap: 5, alignItems: "center" }}>{lbl}{flag && <span style={{ fontSize: 8, color: confirmed ? T.pos : T.warn }}>{confirmed ? "✓" : "confirm"}</span>}</div>
    <input value={value} onChange={(e) => onChange(e.target.value)} inputMode="numeric" style={{ border: "none", background: "transparent", outline: "none", ...mono, fontSize: 14, color: T.ink, width: "100%" }} />
  </div>);
}
function FieldSelect({ lbl, value, opts, onChange, flag, confirmed }) {
  const need = flag && !confirmed;
  return (<div style={{ background: need ? T.warnSoft : T.card, padding: "9px 12px", boxShadow: need ? `inset 3px 0 0 ${T.warn}` : "none" }}>
    <div style={{ ...label, marginBottom: 3, display: "flex", gap: 5, alignItems: "center" }}>{lbl}{flag && <span style={{ fontSize: 8, color: confirmed ? T.pos : T.warn }}>{confirmed ? "✓" : "confirm"}</span>}</div>
    <select value={value} onChange={(e) => onChange(e.target.value)} style={{ border: "none", background: "transparent", outline: "none", fontSize: 13.5, color: T.ink, width: "100%", cursor: "pointer", appearance: "none" }}>{opts.map((o) => <option key={o}>{o}</option>)}</select>
  </div>);
}
function MiniStat({ lbl, val, note, accent, small }) {
  return (<div style={{ background: accent ? T.accent : T.card, color: accent ? "#fff" : T.ink, border: `1px solid ${accent ? T.accent : T.line}`, borderRadius: 11, padding: "11px 13px" }}>
    <div style={{ ...label, color: accent ? "rgba(255,255,255,.75)" : T.faint }}>{lbl}</div>
    <div style={{ fontSize: small ? 13 : 17, fontWeight: 700, marginTop: 4, ...mono, wordBreak: "break-word" }}>{val}</div>
    {note && <div style={{ fontSize: 11, marginTop: 2, color: accent ? "rgba(255,255,255,.8)" : T.sub }}>{note}</div>}
  </div>);
}
function TotalRow({ label: lbl, cells, best, big }) {
  return (<tr style={{ borderTop: `${big ? 2 : 1}px solid ${T.line}` }}>
    <td style={{ padding: big ? "11px 14px" : "8px 14px", ...label, color: big ? T.ink : T.sub, fontWeight: big ? 700 : 600, position: "sticky", left: 0, background: T.card }}>{lbl}</td>
    <td style={{ background: T.hi, borderLeft: `1px solid ${T.line}` }} />
    {cells.map((c) => (<td key={c.id} style={{ borderLeft: `1px solid ${T.line}`, textAlign: "center", padding: "8px 10px", background: c.id === best ? T.accentSoft : T.card }}>
      <div style={{ ...mono, fontWeight: 700, fontSize: big ? 14.5 : 12.5, color: c.color }}>{c.main}</div>{c.sub && <div style={{ ...mono, fontSize: 10, color: T.faint }}>{c.sub}</div>}
    </td>))}
  </tr>);
}
function NavRow({ onBack, onNext, nextLabel }) { return (<div style={{ display: "flex", justifyContent: "space-between", marginTop: 20 }}><button onClick={onBack} style={btn(false)}>← Back</button><button onClick={onNext} style={btn(true)}>{nextLabel}</button></div>); }
function PriceBox({ title, list, sale }) {
  return (<div style={{ ...card, padding: 15 }}><div style={{ ...label, marginBottom: 10 }}>{title}</div>
    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}><span style={{ fontSize: 12.5, color: T.sub }}>List price</span><span style={{ ...mono, fontWeight: 600, fontSize: 15 }}>{usd(list)}</span></div>
    <div style={{ display: "flex", justifyContent: "space-between" }}><span style={{ fontSize: 12.5, color: T.sub }}>Sale price</span><span style={{ ...mono, fontWeight: 700, fontSize: 15, color: T.accent }}>{usd(sale)}</span></div>
  </div>);
}
function NarrBlock({ lbl, text }) { return (<div style={{ background: T.paper, borderRadius: 9, padding: "10px 12px" }}><div style={{ ...label, marginBottom: 4 }}>{lbl}</div><div style={{ fontSize: 12.5, lineHeight: 1.55 }}>{text}</div></div>); }

function BPODoc({ subject, market, comps, recon, opinion, narrative, onBack }) {
  const Row = ({ k, v }) => (<div style={{ display: "flex", justifyContent: "space-between", padding: "5px 0", borderBottom: `1px solid ${T.hair}`, fontSize: 12.5 }}><span style={{ color: T.sub }}>{k}</span><span style={{ ...mono, fontWeight: 600 }}>{v}</span></div>);
  const H = ({ children }) => <div style={{ ...label, color: T.accent, margin: "18px 0 8px", borderBottom: `2px solid ${T.accentLine}`, paddingBottom: 5 }}>{children}</div>;
  return (<div>
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14, flexWrap: "wrap", gap: 10 }}>
      <div><div style={{ ...label, color: T.accent }}>Review-ready draft</div><h2 style={{ fontSize: 21, fontWeight: 700, margin: "3px 0 0" }}>Broker Price Opinion</h2></div>
      <div style={{ display: "flex", gap: 8 }}><button onClick={onBack} style={btn(false)}>← Back</button><button onClick={() => typeof window !== "undefined" && window.print()} style={btn(true)}>Export / Print</button></div>
    </div>
    <div style={{ ...card, padding: "26px 28px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", borderBottom: `2px solid ${T.ink}`, paddingBottom: 12, flexWrap: "wrap", gap: 10 }}>
        <div><div style={{ fontSize: 19, fontWeight: 700 }}>{subject.address}</div><div style={{ color: T.sub, fontSize: 13 }}>{subject.city}, {subject.state} {subject.zip} · APN {subject.apn}</div></div>
        <div style={{ textAlign: "right" }}><div style={{ ...label }}>Opinion of value (as-is)</div><div style={{ ...mono, fontSize: 26, fontWeight: 800, color: T.accent }}>{usd(opinion.sale90)}</div></div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 26 }}>
        <div><H>Subject</H><Row k="Style" v={`${subject.stories}-story SFR`} /><Row k="Living area" v={`${subject.gla} sf`} /><Row k="Lot" v={`${subject.lot} sf`} /><Row k="Year built" v={subject.year} /><Row k="Beds / baths" v={`${subject.beds} / ${subject.full}.${subject.half ? 5 : 0}`} /><Row k="Condition" v={subject.condition} /><Row k="Assessed / AVM" v={`${usd(subject.assessed)} / ${usd(subject.avm)}`} /></div>
        <div><H>Neighborhood & market</H><Row k="Market trend" v={`${market.trend} (${market.pricePct}%/yr)`} /><Row k="Housing supply" v={market.supply} /><Row k="Avg marketing time" v={`${market.avgDom} days`} /><Row k="Owner / tenant" v={`${market.ownerOcc}% / ${market.tenantOcc}%`} /><Row k="Sale range" v={`${usd(market.saleLow)}–${usd(market.saleHigh)}`} /></div>
      </div>
      <H>Comparable sales</H>
      <div style={{ overflowX: "auto" }}><table style={{ width: "100%", borderCollapse: "collapse", minWidth: 460, fontSize: 12 }}>
        <thead><tr>{["Address", "Dist", "GLA", "Sold", "Net adj", "Adjusted"].map((h) => <th key={h} style={{ textAlign: h === "Address" ? "left" : "right", padding: "6px 8px", borderBottom: `1px solid ${T.line}`, ...label }}>{h}</th>)}</tr></thead>
        <tbody>{comps.map((c) => (<tr key={c.id} style={{ borderBottom: `1px solid ${T.hair}` }}>
          <td style={{ padding: "7px 8px", fontWeight: 600 }}>{c.address}</td><td style={{ ...mono, textAlign: "right", padding: "7px 8px", color: T.sub }}>{c.dist}</td><td style={{ ...mono, textAlign: "right", padding: "7px 8px", color: T.sub }}>{c.gla}</td>
          <td style={{ ...mono, textAlign: "right", padding: "7px 8px" }}>{usd(c.price)}</td><td style={{ ...mono, textAlign: "right", padding: "7px 8px", color: c.net >= 0 ? T.pos : T.neg }}>{c.net >= 0 ? "+" : "−"}{usd(Math.abs(c.net))}</td>
          <td style={{ ...mono, textAlign: "right", padding: "7px 8px", fontWeight: 700, color: c.id === recon.bestId ? T.accent : T.ink }}>{usd(c.adjusted)}</td>
        </tr>))}</tbody>
      </table></div>
      <H>Price opinion</H>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24, fontSize: 12.5 }}>
        <div><Row k="As-is list (90-day)" v={usd(opinion.list90)} /><Row k="As-is sale (90-day)" v={usd(opinion.sale90)} /><Row k="Land value" v={usd(opinion.land)} /></div>
        <div><Row k="As-is list (30-day)" v={usd(opinion.list30)} /><Row k="As-is sale (30-day)" v={usd(opinion.sale30)} /><Row k="Total repairs" v={usd(opinion.repairs)} /></div>
      </div>
      <H>Narrative</H>
      <p style={{ fontSize: 12.5, lineHeight: 1.6, margin: "0 0 10px" }}><b>Subject. </b>{narrative.subject}</p>
      <p style={{ fontSize: 12.5, lineHeight: 1.6, margin: "0 0 10px" }}><b>Marketing. </b>{narrative.marketing}</p>
      {narrative.comps.map((c, i) => <p key={i} style={{ fontSize: 12.5, lineHeight: 1.6, margin: "0 0 8px" }}><b>{comps[i]?.address}. </b>{c}</p>)}
      <div style={{ marginTop: 22, padding: 14, background: T.hi, borderRadius: 10, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
        <div style={{ fontSize: 12, color: T.sub, maxWidth: 460, lineHeight: 1.5 }}>Draft generated for review. A licensed agent must verify all data, adjust as needed, and sign — a BPO is the broker's opinion and cannot be issued by software alone.</div>
        <button style={{ ...btn(true), background: T.ink, borderColor: T.ink }}>Review & sign →</button>
      </div>
    </div>
  </div>);
}
