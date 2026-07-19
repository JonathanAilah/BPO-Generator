"use client";
import React, { useState, useMemo } from "react";

/*
  Connect your MLS — data-connection settings screen.

  SECURITY MODEL (production):
    - OAuth preferred: agent authorizes, we never see a secret.
    - Token/secret path: sent ONCE over TLS to the backend, encrypted at
      rest in a secrets manager (KMS), refreshed server-side, never stored
      in the browser and never returned to the client.
    - "Test connection" runs server-side ($metadata + a 1-row Property query).

  This prototype keeps everything in-memory and SIMULATES the test — no
  credentials are transmitted or persisted.
*/

const T = {
  ink: "#111c26", sub: "#5c6b76", faint: "#8b98a1",
  paper: "#eceff1", card: "#ffffff", line: "#dde3e7", hair: "#eef1f3",
  accent: "#0e5a4a", accentSoft: "#e7f0ed", accentLine: "#bcd4cd",
  pos: "#0f7a52", neg: "#b1503f", hi: "#f4f1e6", warn: "#b5761f", warnSoft: "#f7efdd",
};

const PROVIDERS = {
  mlsgrid: {
    name: "MLS Grid", tag: "Recommended", oauth: false, coverage: "40+ MLSs · one agreement",
    baseUrl: "https://api.mlsgrid.com/v2",
    fields: [{ k: "token", label: "API token", secret: true, ph: "Bearer token from your MLS Grid dashboard" }],
    help: "MLS Grid issues one RESO Web API token that covers every MLS you're approved for.",
  },
  trestle: {
    name: "CoreLogic Trestle", tag: "Recommended", oauth: true, coverage: "250+ MLSs",
    baseUrl: "https://api-trestle.corelogic.com/trestle/odata",
    fields: [
      { k: "clientId", label: "Client ID", secret: false, ph: "trestle client id" },
      { k: "clientSecret", label: "Client secret", secret: true, ph: "••••••••" },
    ],
    help: "OAuth2 client-credentials. Your backend exchanges these for short-lived tokens.",
  },
  bridge: {
    name: "Bridge Interactive", tag: "", oauth: false, coverage: "Zillow Group · many MLSs",
    baseUrl: "https://api.bridgedataoutput.com/api/v2/OData",
    fields: [
      { k: "dataset", label: "Dataset name", secret: false, ph: "e.g. actris_ref" },
      { k: "serverToken", label: "Server token", secret: true, ph: "server access token" },
    ],
    help: "Bridge issues a server token per approved dataset.",
  },
  spark: {
    name: "Spark Platform (FBS)", tag: "", oauth: true, coverage: "FlexMLS boards",
    baseUrl: "https://replication.sparkapi.com/v1",
    fields: [{ k: "accessToken", label: "Access token", secret: true, ph: "OAuth access token" }],
    help: "Best fit if your board runs FlexMLS.",
  },
  direct: {
    name: "Direct RESO Web API", tag: "Advanced", oauth: true, coverage: "Single MLS endpoint",
    baseUrl: "",
    fields: [
      { k: "baseUrl", label: "OData base URL", secret: false, ph: "https://your-mls.example.com/RESO/OData" },
      { k: "tokenUrl", label: "Token URL", secret: false, ph: "https://your-mls.example.com/connect/token" },
      { k: "clientId", label: "Client ID", secret: false, ph: "client id" },
      { k: "clientSecret", label: "Client secret", secret: true, ph: "••••••••" },
    ],
    help: "For MLSs that expose their own RESO Web API directly.",
  },
};

const label = { fontSize: 10.5, letterSpacing: "0.09em", textTransform: "uppercase", color: T.faint, fontWeight: 600 };
const mono = { fontVariantNumeric: "tabular-nums", fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace" };
const card = { background: T.card, border: `1px solid ${T.line}`, borderRadius: 14 };
const btn = (p, disabled) => ({
  border: `1px solid ${p ? T.accent : T.line}`, background: p ? T.accent : T.card, color: p ? "#fff" : T.ink,
  borderRadius: 9, padding: "10px 18px", fontSize: 13.5, fontWeight: 600,
  cursor: disabled ? "not-allowed" : "pointer", opacity: disabled ? 0.55 : 1,
});

export default function MLSConnect() {
  const [provider, setProvider] = useState("mlsgrid");
  const [vals, setVals] = useState({});
  const [memberId, setMemberId] = useState("");
  const [mlsName, setMlsName] = useState("");
  const [reveal, setReveal] = useState({});
  const [status, setStatus] = useState("idle"); // idle | testing | connected | error
  const [result, setResult] = useState(null);

  const p = PROVIDERS[provider];
  const set = (k, v) => setVals((s) => ({ ...s, [k]: v }));

  const requiredFilled = useMemo(() => {
    const fieldsOk = p.fields.every((f) => (vals[f.k] || "").trim().length > 3);
    return fieldsOk && memberId.trim().length > 1 && mlsName.trim().length > 1;
  }, [p, vals, memberId, mlsName]);

  const changeProvider = (id) => { setProvider(id); setVals({}); setStatus("idle"); setResult(null); };

  // Simulated server-side test. Production: backend hits $metadata + Property?$top=1
  const test = () => {
    setStatus("testing"); setResult(null);
    setTimeout(() => {
      // simple heuristic to demo an error state: token that looks like a placeholder
      const bad = Object.values(vals).some((v) => /^(test|1234|xxxx|••)/i.test((v || "").trim()));
      if (bad) {
        setStatus("error");
        setResult({ msg: "Authenticated, but this account has no Closed/Sold data scope. BPOs need sold comps — ask your MLS to enable the data-feed (VOW/back-office) permission, not IDX-only." });
      } else {
        setStatus("connected");
        setResult({ mls: mlsName, member: memberId, scopes: ["Property (Active + Closed)", "Member", "Media"], count: "18,240", updated: "live" });
      }
    }, 1300);
  };

  return (
    <div style={{ background: T.paper, minHeight: "100%", padding: "20px 14px 40px", color: T.ink,
      fontFamily: "ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, sans-serif" }}>
      <div style={{ maxWidth: 720, margin: "0 auto" }}>

        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
          <div style={{ width: 28, height: 28, borderRadius: 7, background: T.accent, color: "#fff", display: "grid", placeItems: "center", fontWeight: 800, fontSize: 14 }}>B</div>
          <div style={{ ...label }}>Settings · Data connections</div>
        </div>
        <h1 style={{ fontSize: 24, fontWeight: 700, letterSpacing: "-0.02em", margin: "0 0 6px" }}>Connect your MLS</h1>
        <p style={{ color: T.sub, fontSize: 13.5, margin: "0 0 20px", lineHeight: 1.55 }}>
          We pull comparable sales from your MLS to auto-draft BPOs. Connect through an aggregator (fastest) or your MLS&rsquo;s direct RESO Web API.
        </p>

        {/* connected banner */}
        {status === "connected" && (
          <div style={{ ...card, borderColor: T.accentLine, background: T.accentSoft, padding: "16px 18px", marginBottom: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <Dot color={T.pos} />
                <div>
                  <div style={{ fontWeight: 700, fontSize: 14 }}>Connected · {result.mls}</div>
                  <div style={{ fontSize: 12.5, color: T.sub }}>{p.name} · member {result.member} · {result.count} properties accessible</div>
                </div>
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button onClick={test} style={btn(false)}>Re-test</button>
                <button onClick={() => { setStatus("idle"); setResult(null); }} style={{ ...btn(false), color: T.neg, borderColor: T.line }}>Disconnect</button>
              </div>
            </div>
            <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
              {result.scopes.map((s) => <Chip key={s}>{s}</Chip>)}
            </div>
          </div>
        )}

        {/* provider picker */}
        <div style={{ ...label, marginBottom: 8 }}>1 · Choose how you connect</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: 8, marginBottom: 20 }}>
          {Object.entries(PROVIDERS).map(([id, pr]) => {
            const on = provider === id;
            return (
              <button key={id} onClick={() => changeProvider(id)} style={{
                textAlign: "left", cursor: "pointer", background: on ? T.card : "transparent",
                border: `1px solid ${on ? T.accent : T.line}`, borderRadius: 11, padding: "11px 12px",
              }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 6 }}>
                  <span style={{ fontWeight: 600, fontSize: 13 }}>{pr.name}</span>
                  {pr.tag && <Tag warn={pr.tag === "Advanced"}>{pr.tag}</Tag>}
                </div>
                <div style={{ fontSize: 11, color: T.sub, marginTop: 4 }}>{pr.coverage}</div>
              </button>
            );
          })}
        </div>

        {/* credentials form */}
        <div style={{ ...card, padding: "18px 18px" }}>
          <div style={{ ...label, marginBottom: 4 }}>2 · Enter your credentials</div>
          <p style={{ fontSize: 12.5, color: T.sub, margin: "0 0 14px", lineHeight: 1.5 }}>{p.help}</p>

          {p.oauth && (
            <button onClick={() => { /* prod: redirect to provider OAuth */ }}
              style={{ ...btn(false), width: "100%", marginBottom: 14, borderStyle: "dashed" }}>
              🔐 Authorize with {p.name} (OAuth) — no secret to paste
            </button>
          )}

          <div style={{ display: "grid", gap: 12 }}>
            <Input lbl={`MLS / board name`} value={mlsName} onChange={setMlsName} ph="e.g. MetroList / MLSListings" />
            {p.baseUrl && <Input lbl="API base URL" value={p.baseUrl} onChange={() => {}} readOnly mono />}
            {p.fields.map((f) => (
              <Input key={f.k} lbl={f.label} value={vals[f.k] || ""} onChange={(v) => set(f.k, v)} ph={f.ph}
                secret={f.secret} revealed={!!reveal[f.k]} onToggle={() => setReveal((r) => ({ ...r, [f.k]: !r[f.k] }))} mono />
            ))}
            <Input lbl="Your MLS member / agent ID" value={memberId} onChange={setMemberId} ph="required for attribution & rules" mono />
          </div>

          {/* security note */}
          <div style={{ display: "flex", gap: 9, marginTop: 14, padding: "10px 12px", background: T.hi, borderRadius: 9 }}>
            <span style={{ fontSize: 14 }}>🔒</span>
            <div style={{ fontSize: 11.5, color: T.sub, lineHeight: 1.5 }}>
              Secrets are sent once over TLS to our servers and encrypted at rest. They&rsquo;re never stored in your browser or shown again after saving.
            </div>
          </div>

          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 16, gap: 10, flexWrap: "wrap" }}>
            <div style={{ fontSize: 12, color: T.sub }}>
              {status === "testing" && <span style={{ display: "flex", alignItems: "center", gap: 7 }}><Dot color={T.warn} pulse /> Testing connection…</span>}
              {status === "error" && <span style={{ color: T.neg, display: "flex", alignItems: "center", gap: 7 }}><Dot color={T.neg} /> Scope problem</span>}
            </div>
            <button onClick={test} disabled={!requiredFilled || status === "testing"} style={btn(true, !requiredFilled || status === "testing")}>
              {status === "testing" ? "Testing…" : "Test & connect"}
            </button>
          </div>

          {status === "error" && (
            <div style={{ marginTop: 12, padding: "11px 13px", background: T.warnSoft, border: `1px solid #e6cfa0`, borderRadius: 9, fontSize: 12.5, color: "#7a5210", lineHeight: 1.5 }}>
              {result.msg}
            </div>
          )}
        </div>

        <p style={{ fontSize: 11.5, color: T.faint, marginTop: 16, lineHeight: 1.55 }}>
          Don&rsquo;t have API credentials yet? Getting them is a request you file with your MLS or aggregator — see the activation guide. Access must include <b>Closed/Sold</b> data; IDX-only feeds won&rsquo;t work for BPOs.
        </p>
      </div>
    </div>
  );
}

function Input({ lbl, value, onChange, ph, secret, revealed, onToggle, readOnly, mono: m }) {
  return (
    <label style={{ display: "block" }}>
      <div style={{ ...label, marginBottom: 4 }}>{lbl}</div>
      <div style={{ display: "flex", alignItems: "center", border: `1px solid ${T.line}`, borderRadius: 9,
        background: readOnly ? T.hair : T.paper, overflow: "hidden" }}>
        <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={ph} readOnly={readOnly}
          type={secret && !revealed ? "password" : "text"}
          style={{ flex: 1, border: "none", background: "transparent", outline: "none", padding: "11px 13px",
            fontSize: 13, color: readOnly ? T.sub : T.ink, ...(m ? mono : {}) }} />
        {secret && (
          <button onClick={onToggle} style={{ border: "none", background: "transparent", color: T.faint, cursor: "pointer", padding: "0 12px", fontSize: 12 }}>
            {revealed ? "hide" : "show"}
          </button>
        )}
      </div>
    </label>
  );
}
function Tag({ children, warn }) {
  const c = warn ? T.warn : T.accent;
  return <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.05em", textTransform: "uppercase", color: c, border: `1px solid ${c}`, borderRadius: 20, padding: "2px 6px" }}>{children}</span>;
}
function Chip({ children }) {
  return <span style={{ fontSize: 11, fontWeight: 600, color: T.accent, background: "#fff", border: `1px solid ${T.accentLine}`, borderRadius: 7, padding: "4px 9px" }}>{children}</span>;
}
function Dot({ color, pulse }) {
  return <span style={{ width: 9, height: 9, borderRadius: "50%", background: color, display: "inline-block", boxShadow: pulse ? `0 0 0 3px ${color}22` : "none" }} />;
}
