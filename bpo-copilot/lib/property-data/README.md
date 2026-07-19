# property-data — public-records comp adapter

Address in → normalized **subject + sold comps** out, in the exact schema the BPO app consumes. Written against **ATTOM**'s real endpoints/response shapes, with a **mock provider** (identical shape) so the whole pipeline runs today with no key.

## Run the demo (no key)

```bash
node demo.js
```

## Go live (one-line switch)

```js
import createClient from "./index.js";

const client = createClient({ provider: "attom", apiKey: process.env.ATTOM_API_KEY });
const { subject, comps, meta } = await client.getBPOData(
  "227 N Sierra Nevada St, Stockton, CA 95205",
  { radiusMi: 1.0, monthsBack: 12, maxComps: 8 }
);
```

Because the mock and ATTOM providers emit the **same raw shape**, `normalize.js` is unchanged when you flip the switch. Get an ATTOM trial key from their developer portal, set `ATTOM_API_KEY`, done.

## Output

- `subject` — matches `SUBJECT` in `bpo-generator.jsx` (drops into the app directly).
- `comps` — array matching `COMP_POOL` items; feed straight into the comp selector + adjustment grid.
- `meta.missingFields` — what public records can't supply (`condition`, usually `heating`/`cooling`, sometimes `garage`). The app should prompt the agent for these; condition is their on-site call anyway.
- `meta.notes` — data caveats to show the agent (sold-only, recorder lag).

## Division of labor

This module **fetches and normalizes** — it does not select. It returns candidates (including the occasional distressed sale like 1405 E Channel at $80/sqft). The app's existing `score()` function — with the price-per-sqft outlier guard — does the ranking and demotes those. Keep fetch and selection separate.

## Real-world caveats

- **ATTOM is self-serve; CoreLogic is enterprise.** Start with ATTOM; alternates: Estated / Rentcast (cheaper), HouseCanary (stronger AVM).
- **Field names/availability vary by plan and county.** Every getter is defensive, but validate against your actual API responses — my field paths are directional (knowledge cutoff early 2026), not gospel.
- **Non-disclosure states** (TX, UT, ID, etc.) don't publish sale prices — you'll get subject data but thin/no sold comps there. CA (your launch market) is fine.
- **No active listings** — those are MLS-only. The BPO's listing-comparable section stays agent-entered until you add MLS.
- Read the ATTOM license on **caching/redistribution** before you build caching around it.

## Files

- `index.js` — `createClient()` + `getBPOData()` orchestration (radius, date/price window, GLA filter, distance sort)
- `providers.js` — `attomProvider` (live) + `mockProvider` (fixtures) + address parsing
- `normalize.js` — ATTOM `property[]` → app schema, with `_missing` flagging
- `distance.js` — haversine
- `demo.js` — end-to-end run on the mock
