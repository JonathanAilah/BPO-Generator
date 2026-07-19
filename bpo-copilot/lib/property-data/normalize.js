/*
  Maps ATTOM's `property[]` object shape into the schema the BPO app consumes.

  Field names below are ATTOM's documented paths (property/expandedprofile,
  sale/snapshot, avm/detail). Exact availability varies by plan and by county,
  so every getter is defensive and records what's missing.

  Public records CANNOT supply: condition, heating, cooling (interior/quality).
  Those are defaulted and flagged in `_missing` so the app prompts the agent —
  which is fine, because condition is the agent's on-site call anyway.
*/

const num = (v) => {
  if (v == null || v === "") return null;
  const n = Number(String(v).replace(/[^0-9.\-]/g, ""));
  return Number.isFinite(n) ? n : null;
};

// ATTOM heating/cooling strings are inconsistent; map loosely to app enums.
function mapHeating(s) {
  if (!s) return null;
  const t = s.toUpperCase();
  if (t.includes("HOT WATER") || t.includes("RADIANT") || t.includes("STEAM")) return "Forced Hot Water";
  if (t.includes("FORCED") || t.includes("CENTRAL")) return "Central";
  if (t.includes("ELECTRIC")) return "Electric";
  return "Other";
}
function mapCooling(s) {
  if (!s) return null;
  const t = s.toUpperCase();
  if (t.includes("CENTRAL")) return "Central";
  if (t.includes("WALL") || t.includes("WINDOW") || t.includes("EVAP")) return "Wall";
  if (t.includes("NONE") || t.includes("NO")) return "None";
  return "Wall";
}

function lotSqft(lot) {
  const sf = num(lot?.lotsize2); // ATTOM: lotsize2 = sqft
  if (sf) return Math.round(sf);
  const acres = num(lot?.lotsize1); // lotsize1 = acres
  return acres ? Math.round(acres * 43560) : null;
}

function garageBays(building) {
  // ATTOM parking is unreliable for bay COUNT; take an explicit spaces field if present.
  const spaces = num(building?.parking?.prkgSpaces) ?? num(building?.parking?.garageSpaces);
  if (spaces != null) return spaces;
  const type = (building?.parking?.garagetype || "").toUpperCase();
  return type && !type.includes("NO") ? null : 0; // null => unknown -> flagged
}

// Shared mapper for one ATTOM property object -> app "core" fields.
function coreFields(p) {
  const b = p.building || {};
  const missing = [];
  const withFlag = (val, key) => { if (val == null) missing.push(key); return val; };

  const full = num(b.rooms?.bathsfull);
  const half = num(b.rooms?.bathshalf);
  const heating = mapHeating(b.utilities?.heatingtype);
  const cooling = mapCooling(b.utilities?.coolingtype);
  const garage = garageBays(b);

  return {
    core: {
      apn: p.identifier?.apn || null,
      gla: withFlag(num(b.size?.livingsize) ?? num(b.size?.universalsize), "gla"),
      lot: withFlag(lotSqft(p.lot), "lot"),
      year: withFlag(num(p.summary?.yearbuilt), "year"),
      stories: num(b.summary?.levels) ?? num(p.summary?.levels) ?? 1,
      beds: withFlag(num(b.rooms?.beds), "beds"),
      rooms: num(b.rooms?.roomsTotal) ?? null,
      full: full ?? null,
      half: half ?? 0,
      garage: garage,                 // may be null -> flagged below
      fireplaces: num(b.interior?.fplccount) ?? 0,
      // ---- public records cannot supply these ----
      condition: "Average",           // agent confirms on site
      heating: heating ?? "Forced Hot Water",
      cooling: cooling ?? "Central",
      lat: num(p.location?.latitude) ?? num(p.address?.latitude),
      lng: num(p.location?.longitude) ?? num(p.address?.longitude),
    },
    missing: [
      ...missing,
      ...(garage == null ? ["garage"] : []),
      "condition",                    // always agent-supplied
      ...(heating ? [] : ["heating"]),
      ...(cooling ? [] : ["cooling"]),
    ],
  };
}

export function normalizeSubject(p, avm) {
  const { core, missing } = coreFields(p);
  const a = p.address || {};
  const sale = p.sale?.amount || {};
  return {
    subject: {
      address: a.line1 || "",
      city: a.locality || "",
      state: a.countrySubd || "",
      zip: a.postal1 || "",
      legal: p.summary?.legal1 || p.lot?.legal1 || "",
      ...core,
      occupancy: null,                 // not in public records
      zoning: p.lot?.zoningType || p.summary?.zoning || null,
      assessed: num(p.assessment?.assessed?.assdttlvalue),
      avm: num(avm?.amount?.value),
      avmLow: num(avm?.amount?.low),
      avmHigh: num(avm?.amount?.high),
      avmScore: num(avm?.amount?.scr),
      lastSale: num(sale.saleamt),
      lastSaleDate: sale.salerecdate || null,
    },
    missing: [...new Set(missing)],
  };
}

export function normalizeComp(p, i) {
  const { core } = coreFields(p);
  const a = p.address || {};
  const sale = p.sale?.amount || {};
  return {
    id: `pr_${p.identifier?.attomId || i}`,
    address: a.line1 || "",
    status: "sold",                    // public records = closed sales only
    price: num(sale.saleamt),
    date: sale.salerecdate || p.sale?.salesearchdate || null,
    dist: null,                        // filled by orchestrator via haversine
    gla: core.gla, lot: core.lot, year: core.year, stories: core.stories,
    beds: core.beds, rooms: core.rooms, full: core.full, half: core.half,
    garage: core.garage ?? 0, fireplaces: core.fireplaces,
    condition: core.condition, heating: core.heating, cooling: core.cooling,
    lat: core.lat, lng: core.lng,
    source: "Public records",
  };
}
