import { attomProvider, mockProvider, parseAddress } from "./providers.js";
import { normalizeSubject, normalizeComp } from "./normalize.js";
import { milesBetween } from "./distance.js";

/*
  createClient({ provider, apiKey }) -> { getBPOData }

  provider: "mock" (default, no key) or "attom" (needs apiKey / ATTOM_API_KEY)

  getBPOData(address, opts) resolves to:
    {
      subject,                // normalized subject in the app's schema
      comps,                  // sold comps, distance-sorted, in the app's schema
      meta: { provider, dataAsOf, radiusMi, missingFields, notes }
    }

  The returned `subject` and `comps` match the shapes used by the BPO app
  (see SUBJECT / COMP_POOL in bpo-generator.jsx) and drop straight into the
  existing comp selector + adjustment grid.
*/

function pickProvider(name, apiKey) {
  if (name === "attom") return attomProvider(apiKey);
  return mockProvider();
}

const isoDaysAgo = (days) => new Date(Date.now() - days * 864e5).toISOString().slice(0, 10);

export function createClient({ provider = "mock", apiKey } = {}) {
  const p = pickProvider(provider, apiKey);

  async function getBPOData(address, opts = {}) {
    const {
      radiusMi = 1.0,
      monthsBack = 12,
      maxComps = 8,
      minPrice = 50000,          // floor out obvious non-arm's-length records
      glaTolerance = 0.6,        // keep comps within +/-60% GLA of subject
    } = opts;

    const addr = parseAddress(address);

    // 1) subject
    const rawSub = await p.subject(addr);
    if (!rawSub.property) {
      return { subject: null, comps: [], meta: { provider: p.name, notes: ["No public record found for that address."] } };
    }
    const { subject, missing } = normalizeSubject(rawSub.property, rawSub.avm);
    const origin = { lat: subject.lat, lng: subject.lng };

    // 2) comps (geo radius + date/price window)
    const startDate = isoDaysAgo(Math.round(monthsBack * 30.4));
    const endDate = isoDaysAgo(0);
    const rawComps = await p.comps({
      lat: origin.lat, lng: origin.lng, radius: radiusMi,
      startDate, endDate, minAmt: minPrice, maxAmt: undefined, pageSize: 50,
    });

    // 3) normalize -> distance -> filter -> sort -> cap
    const glaLo = subject.gla ? subject.gla * (1 - glaTolerance) : 0;
    const glaHi = subject.gla ? subject.gla * (1 + glaTolerance) : Infinity;

    const comps = rawComps
      .map((raw, i) => normalizeComp(raw, i))
      .map((c) => ({ ...c, dist: milesBetween(origin, { lat: c.lat, lng: c.lng }) }))
      .filter((c) => c.address && c.address.toUpperCase() !== subject.address.toUpperCase()) // drop the subject itself
      .filter((c) => c.price && c.price >= minPrice)
      .filter((c) => c.gla == null || (c.gla >= glaLo && c.gla <= glaHi))
      .sort((a, b) => (a.dist ?? 99) - (b.dist ?? 99))
      .slice(0, maxComps);

    return {
      subject,
      comps,
      meta: {
        provider: p.name,
        dataAsOf: endDate,
        radiusMi,
        window: `${monthsBack} months`,
        missingFields: missing,          // app should prompt the agent for these
        notes: [
          "Public records return SOLD comps only — active listings require MLS.",
          "Condition/heating/cooling are defaulted; agent confirms on inspection.",
          "Recorder data lags; recent sales may not yet appear.",
        ],
      },
    };
  }

  return { getBPOData, providerName: p.name };
}

export default createClient;
