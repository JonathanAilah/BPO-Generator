/*
  Maps ATTOM's property objects into the app schema.

  IMPORTANT: ATTOM uses DIFFERENT capitalization across endpoints —
  property/expandedprofile (subject) is camelCase (livingSize, yearBuilt,
  lotSize2, bathsFull, assdTtlValue); sale/snapshot (comps) is lowercase
  (universalsize, yearbuilt, saleamt). Every getter therefore tries BOTH.

  Fields ATTOM does not return (condition always; garage/fireplaces/rooms on
  comps) stay null so the engine can SKIP them rather than assume zero.
*/

const num = (v) => {
  if (v == null || v === "") return null;
  const n = Number(String(v).replace(/[^0-9.\-]/g, ""));
  return Number.isFinite(n) ? n : null;
};
// first non-empty value across several possible key spellings/casings
const pick = (obj, ...keys) => {
  if (!obj) return null;
  for (const k of keys) if (obj[k] != null && obj[k] !== "") return obj[k];
  return null;
};

function mapHeating(s) {
  if (!s) return null;
  const t = String(s).toUpperCase();
  if (t.includes("HOT WATER") || t.includes("RADIANT") || t.includes("STEAM")) return "Forced Hot Water";
  if (t.includes("FORCED") || t.includes("CENTRAL")) return "Central";
  if (t.includes("ELECTRIC")) return "Electric";
  return "Other";
}
function mapCooling(s) {
  if (!s) return null;
  const t = String(s).toUpperCase();
  if (t.includes("CENTRAL")) return "Central";
  if (t.includes("WALL") || t.includes("WINDOW") || t.includes("EVAP")) return "Wall";
  if (t.includes("NONE")) return "None";
  return "Wall";
}

function coreFields(p) {
  const b = p.building || {};
  const size = b.size || {}, rooms = b.rooms || {}, lot = p.lot || {}, summ = p.summary || {};
  const util = p.utilities || b.utilities || {}, loc = p.location || {}, park = b.parking || {}, interior = b.interior || {};

  const gla = num(pick(size, "livingSize", "livingsize", "universalSize", "universalsize", "bldgSize", "bldgsize"));
  let lotSf = num(pick(lot, "lotSize2", "lotsize2"));
  if (!lotSf) { const ac = num(pick(lot, "lotSize1", "lotsize1")); lotSf = ac ? Math.round(ac * 43560) : null; }
  const year = num(pick(summ, "yearBuilt", "yearbuilt"));
  const beds = num(pick(rooms, "beds"));
  const full = num(pick(rooms, "bathsFull", "bathsfull")) ?? num(pick(rooms, "bathsTotal", "bathstotal"));
  const half = num(pick(rooms, "bathsHalf", "bathshalf")) ?? 0;
  const roomsTotal = num(pick(rooms, "roomsTotal", "roomstotal"));      // ATTOM rarely provides -> null
  const fireplaces = num(pick(interior, "fplcCount", "fplccount"));     // null if absent
  const garage = num(pick(park, "prkgSpaces", "prkgspaces", "garageSpaces")); // null if absent
  const stories = num(pick(b.summary || {}, "levels")) ?? num(pick(summ, "levels"));
  const heat = mapHeating(pick(util, "heatingType", "heatingtype"));
  const cool = mapCooling(pick(util, "coolingType", "coolingtype"));

  return {
    apn: pick(p.identifier || {}, "apn"),
    attomId: pick(p.identifier || {}, "attomId", "Id"),
    gla, lot: lotSf, year, beds, rooms: roomsTotal, full, half, garage, fireplaces,
    stories: stories ?? 1,
    heat, cool,                                   // null => defaulted + flagged downstream
    condition: "Average",                         // never in public records; agent confirms
    lat: num(pick(loc, "latitude")), lng: num(pick(loc, "longitude")),
  };
}

export function normalizeSubject(p, avm) {
  const c = coreFields(p);
  const a = p.address || {}, summ = p.summary || {}, lot = p.lot || {}, sale = p.sale?.amount || {};
  const missing = [
    ...(c.gla == null ? ["gla"] : []), ...(c.lot == null ? ["lot"] : []),
    ...(c.year == null ? ["year"] : []), ...(c.beds == null ? ["beds"] : []),
    "condition",
    ...(c.heat == null ? ["heating"] : []), ...(c.cool == null ? ["cooling"] : []),
  ];
  const absentee = String(summ.absenteeInd || "").toUpperCase();
  return {
    subject: {
      address: pick(a, "line1") || "", city: pick(a, "locality") || "", state: pick(a, "countrySubd") || "", zip: pick(a, "postal1") || "",
      legal: pick(summ, "legal1") || pick(lot, "legal1") || "",
      apn: c.apn, attomId: c.attomId,
      gla: c.gla, lot: c.lot, year: c.year, stories: c.stories, beds: c.beds, rooms: c.rooms,
      full: c.full, half: c.half, garage: c.garage, fireplaces: c.fireplaces,
      condition: c.condition, heating: c.heat ?? "Forced Hot Water", cooling: c.cool ?? "Central",
      occupancy: absentee.includes("OWNER") ? "Occupied by owner" : absentee ? "Tenant / absentee" : null,
      zoning: pick(lot, "zoningType") || null,
      assessed: num(pick(p.assessment?.assessed || {}, "assdTtlValue", "assdttlvalue")),
      avm: num(avm?.amount?.value), avmLow: num(avm?.amount?.low), avmHigh: num(avm?.amount?.high), avmScore: num(avm?.amount?.scr),
      lastSale: num(pick(sale, "saleAmt", "saleamt")), lastSaleDate: pick(sale, "saleRecDate", "salerecdate") || null,
    },
    missing: [...new Set(missing)],
  };
}

export function normalizeComp(p, i) {
  const c = coreFields(p);
  const a = p.address || {}, sale = p.sale?.amount || {};
  return {
    id: `pr_${c.attomId || i}`, attomId: c.attomId,
    address: pick(a, "line1") || "", status: "sold",
    price: num(pick(sale, "saleAmt", "saleamt")),
    date: pick(sale, "saleRecDate", "salerecdate") || pick(p.sale || {}, "salesearchdate", "saleSearchDate") || null,
    dist: null,
    gla: c.gla, lot: c.lot, year: c.year, stories: c.stories, beds: c.beds, rooms: c.rooms,
    full: c.full, half: c.half, garage: c.garage, fireplaces: c.fireplaces, // null when unknown -> engine skips
    condition: c.condition, heating: c.heat ?? "Forced Hot Water", cooling: c.cool ?? "Central",
    lat: c.lat, lng: c.lng, source: "Public records",
  };
}
