# BPO Copilot

Auto-drafts Broker Price Opinions for real estate agents. Type an address → the app pulls property data, scores comparable sales, runs the adjustment grid, reconciles to a price opinion, drafts the narrative, and produces a review-ready BPO. **A licensed agent reviews and signs — the software drafts, it does not issue.**

Next.js (App Router), ready to deploy on Vercel. **Runs on built-in mock data with zero configuration** — add API keys to go live.

## Deploy to Vercel (no terminal needed)

1. Push this folder to a GitHub repo (or upload it via github.com).
2. On **vercel.com** → **Add New… → Project** → import that repo. Vercel auto-detects Next.js; just click **Deploy**.
3. It deploys immediately and works on mock data. To go live, add environment variables (next section) and redeploy.

## Environment variables

Set these in Vercel: **Project → Settings → Environment Variables** (or a local `.env` file — see `.env.example`). Keys stay server-side; they are never sent to the browser.

| Variable | Required? | Purpose |
|---|---|---|
| `ATTOM_API_KEY` | Optional | Live public-records data. **Unset = mock data.** |
| `ANTHROPIC_API_KEY` | Optional | AI-drafted narrative. Unset = template fallback. |
| `ANTHROPIC_MODEL` | Optional | Defaults to `claude-sonnet-5`. Confirm current IDs at https://docs.claude.com/en/docs/about-claude/models |

After adding or changing a variable, trigger a redeploy (Deployments → ⋯ → Redeploy).

## Run locally (optional, needs Node 18+)

```bash
npm install
cp .env.example .env      # add your keys, or leave blank for mock
npm run dev               # http://localhost:3000
node lib/property-data/demo.js   # exercise the data adapter alone
```

## How it's wired

```
Browser (components/)                Server (app/api/, lib/)
  BPOGenerator ── POST /api/bpo ───▶  createClient(attom|mock).getBPOData()   [ATTOM_API_KEY]
              ── POST /api/narrative ▶ Anthropic messages API                  [ANTHROPIC_API_KEY]
```

- **`app/api/bpo/route.js`** — subject + comps. Uses ATTOM when the key is set, mock otherwise. Never exposes the key.
- **`app/api/narrative/route.js`** — drafts the comment sections. Returns 501 without a key; the client then uses its local template.
- **`lib/property-data/`** — the adapter (see its own README). Same shape from mock and ATTOM, so live/mock is one flag.
- Scoring, adjustments and reconciliation run client-side in `BPOGenerator.jsx` for interactivity.

## Pages

- `/` — the BPO generator (address → BPO)
- `/engine` — standalone adjustment grid
- `/mls` — MLS connection settings (for the future MLS data layer)

## Roadmap

1. **Add ATTOM key** on Vercel → live data. Validate `lib/property-data/normalize.js` field mappings against real responses.
2. **Multi-form PDF export** — map the internal schema onto each AMC's BPO form.
3. **Order intake + e-sign** — license-verified signing.
4. **MLS layer** — approved aggregator vendor unlocks fresher data + active listings (`/mls`, `docs/`).

## Caveats

- ATTOM field paths in `normalize.js` are directional (verify against your plan's responses).
- Non-disclosure states (TX, UT, ID, …) don't publish sale prices; those markets need MLS.
- A BPO must be completed and signed by a licensed agent/broker; check per-state BPO rules.
