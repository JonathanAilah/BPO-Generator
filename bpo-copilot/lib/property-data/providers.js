/*
  Two providers, ONE response contract (ATTOM's `property[]` shape).
  - attomProvider: hits the live ATTOM gateway. Needs process.env.ATTOM_API_KEY.
  - mockProvider:  returns the identical shape from fixtures, so the whole
                   pipeline (normalize + distance + filter) runs with no key.

  Because both emit the same raw shape, normalize.js is written once and the
  switch from mock -> live is a one-line change in index.js.
*/

// ---------- address parsing ----------
export function parseAddress(input) {
  if (input && typeof input === "object") return input; // already {line1, city, state, zip}
  const parts = String(input).split(",").map((s) => s.trim());
  const line1 = parts[0] || "";
  const city = parts[1] || "";
  const m = (parts[2] || "").match(/([A-Za-z]{2})\s*(\d{5})?/);
  return { line1, city, state: m?.[1] || "", zip: m?.[2] || "" };
}

// =================== LIVE ATTOM ===================
const ATTOM_BASE = "https://api.gateway.attomdata.com/propertyapi/v1.0.0";

async function attomGet(path, params, key) {
  const url = `${ATTOM_BASE}/${path}?` + new URLSearchParams(params).toString();
  const res = await fetch(url, { headers: { apikey: key, Accept: "application/json" } });
  if (!res.ok) throw new Error(`ATTOM ${path} -> ${res.status} ${res.statusText}`);
  const json = await res.json();
  const code = json?.status?.code;
  if (code !== 0 && code !== "0") {
    // code 0 = SuccessWithResult; anything else (e.g. 400/SuccessWithoutResult) -> empty
    if (json?.status?.msg?.includes("Without")) return { ...json, property: [] };
    throw new Error(`ATTOM ${path} -> ${json?.status?.msg || "error"}`);
  }
  return json;
}

export function attomProvider(key = process.env.ATTOM_API_KEY) {
  if (!key) throw new Error("ATTOM_API_KEY not set");
  return {
    name: "ATTOM",
    async subject(addr) {
      const address2 = `${addr.city}, ${addr.state} ${addr.zip}`.trim();
      const detail = await attomGet("property/expandedprofile", { address1: addr.line1, address2 }, key);
      const property = detail.property?.[0];
      if (!property) return { property: null, avm: null };
      let avm = null;
      try {
        const a = await attomGet("avm/detail", { address1: addr.line1, address2 }, key);
        avm = a.property?.[0]?.avm || null;
      } catch { /* AVM optional; some plans bundle it into detail */ }
      return { property, avm };
    },
    async comps({ lat, lng, radius, startDate, endDate, minAmt, maxAmt, pageSize }) {
      const json = await attomGet("sale/snapshot", {
        latitude: lat, longitude: lng, radius,
        propertytype: "SFR",
        startsalesearchdate: startDate, endsalesearchdate: endDate,
        minsaleamt: minAmt, maxsaleamt: maxAmt,
        pagesize: pageSize, orderby: "saleAmt desc",
      }, key);
      return json.property || [];
    },
  };
}

// =================== MOCK (ATTOM-shaped) ===================
// Seeded from the real Stockton subject + ICE AVM comps, in ATTOM's JSON shape.
const SUB_LAT = 37.9667, SUB_LNG = -121.2833;
const offset = (mi, brng) => {
  const dLat = (mi / 69) * Math.cos((brng * Math.PI) / 180);
  const dLng = (mi / 54.6) * Math.sin((brng * Math.PI) / 180);
  return { latitude: (SUB_LAT + dLat).toFixed(6), longitude: (SUB_LNG + dLng).toFixed(6) };
};

const attomProp = (o) => ({
  identifier: { attomId: o.id, apn: o.apn || null },
  address: { line1: o.line1, locality: "STOCKTON", countrySubd: "CA", postal1: "95205" },
  location: { latitude: o.lat, longitude: o.lng },
  summary: { propclass: "Single Family Residence / Townhouse", propsubtype: "SFR", yearbuilt: o.year, levels: o.stories || 1 },
  lot: { lotsize2: o.lot, zoningType: o.zoning || null, legal1: o.legal || null },
  building: {
    size: { livingsize: o.gla, universalsize: o.gla },
    rooms: { beds: o.beds, bathsfull: o.full ?? o.baths ?? null, bathshalf: o.half ?? 0, roomsTotal: o.rooms ?? null },
    interior: { fplccount: o.fireplaces ?? 0 },
    parking: o.garage != null ? { prkgSpaces: o.garage } : {},
    summary: { levels: o.stories || 1 },
    utilities: {}, // public records rarely include heating/cooling -> tests the "missing" path
  },
  sale: { amount: { saleamt: o.saleamt, salerecdate: o.saledate }, salesearchdate: o.saledate },
  assessment: { assessed: { assdttlvalue: o.assessed || null } },
});

const SUBJECT_FIXTURE = attomProp({
  id: 5551001, apn: "151-170-060-000", line1: "227 N SIERRA NEVADA ST",
  lat: SUB_LAT, lng: SUB_LNG, year: 1900, stories: 2, lot: 7500, gla: 1576,
  beds: 3, full: 1, half: 1, rooms: 6, fireplaces: 1, garage: 0, assessed: 217230,
  saleamt: 150000, saledate: "2003-01-28",
  legal: "STOCKTON SUBD: EAST OF CENTER STREET MAP REF: MB 151 PG 17",
});
const SUBJECT_AVM = { amount: { value: 339000, high: 420400, low: 257600, scr: 76 } };

// sold comps (real addresses/attrs from the ICE AVM comparables table)
const COMP_FIXTURES = [
  ["1123 E PARK ST", 0.37, 40, 1588, 5001, 1900, 4, 3, 400000, "2026-05-13"],
  ["1404 E PARK ST", 0.30, 25, 1233, 6000, 1902, 5, 2, 315000, "2026-03-05"],
  ["1262 N UNION ST", 0.85, 300, 1452, 7500, 1934, 4, 2, 366000, "2026-03-16"],
  ["1205 N AIRPORT WAY", 0.76, 315, 1684, 5000, 1945, 3, 1, 378000, "2026-04-22"],
  ["1418 E LINDSAY ST", 0.10, 90, 1183, 3716, 1918, 4, 2, 360000, "2025-04-29"],
  ["1611 N STANFORD AVE", 0.96, 20, 1486, 5001, 1922, 2, 2, 252500, "2026-04-28"],
  ["1405 E CHANNEL ST", 0.04, 200, 2029, 5001, 1895, 4, 2, 162000, "2026-02-26"], // distressed outlier
  ["1236 E POPLAR ST", 0.45, 100, 1486, 5001, 1938, 3, 2, 418000, "2024-10-10"],
].map((c, i) => {
  const [line1, mi, brng, gla, lot, year, beds, baths, saleamt, saledate] = c;
  const { latitude, longitude } = offset(mi, brng);
  return attomProp({ id: 5552000 + i, line1, lat: latitude, lng: longitude, gla, lot, year, beds, baths, rooms: beds + 2, saleamt, saledate });
});

export function mockProvider() {
  return {
    name: "Mock (ATTOM shape)",
    async subject() { return { property: SUBJECT_FIXTURE, avm: SUBJECT_AVM }; },
    async comps({ minAmt, startDate }) {
      // emulate ATTOM filtering so the demo shows filters working
      return COMP_FIXTURES.filter((p) => {
        const amt = p.sale.amount.saleamt;
        const okAmt = !minAmt || amt >= minAmt;
        const okDate = !startDate || p.sale.amount.salerecdate >= startDate;
        return okAmt && okDate;
      });
    },
  };
}
