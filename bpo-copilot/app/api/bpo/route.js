import createClient from "@/lib/property-data/index.js";

// ATTOM calls need the Node runtime (not Edge).
export const runtime = "nodejs";

/*
  POST /api/bpo   { address: string, options?: {...} }
  -> { subject, comps, meta }

  Uses live ATTOM when ATTOM_API_KEY is set; otherwise falls back to the
  built-in mock so the app runs immediately after deploy. The key never
  leaves the server.
*/
export async function POST(req) {
  const { address, options } = await req.json().catch(() => ({}));
  if (!address) return Response.json({ error: "address required" }, { status: 400 });

  const hasKey = !!process.env.ATTOM_API_KEY;
  const client = createClient({ provider: hasKey ? "attom" : "mock", apiKey: process.env.ATTOM_API_KEY });

  try {
    const data = await client.getBPOData(address, options || {});
    return Response.json({ ...data, meta: { ...data.meta, live: hasKey } });
  } catch (e) {
    return Response.json({ error: String(e?.message || e) }, { status: 502 });
  }
}
