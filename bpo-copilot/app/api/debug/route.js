import { attomProvider, parseAddress } from "@/lib/property-data/providers.js";

export const runtime = "nodejs";

/*
  TEMPORARY diagnostic. Visit in a browser:
    https://YOUR-APP.vercel.app/api/debug?address=3042 Tenaya, Stockton, CA 95205
  Returns the RAW ATTOM objects (subject + one comp) so field paths can be
  mapped correctly. The API key stays on the server. Delete this file when done.
*/
export async function GET(req) {
  const address = new URL(req.url).searchParams.get("address");
  if (!address) return Response.json({ error: "add ?address=... to the URL" }, { status: 400 });
  if (!process.env.ATTOM_API_KEY) return Response.json({ error: "ATTOM_API_KEY not set" }, { status: 501 });

  const p = attomProvider(process.env.ATTOM_API_KEY);
  const addr = parseAddress(address);
  try {
    const sub = await p.subject(addr);
    let firstComp = null;
    if (sub.property) {
      const comps = await p.comps({
        lat: sub.property.location?.latitude,
        lng: sub.property.location?.longitude,
        radius: 1, pageSize: 2,
      });
      firstComp = comps[0] || null;
    }
    return Response.json({
      rawSubjectProperty: sub.property,
      rawSubjectAvm: sub.avm,
      rawFirstComp: firstComp,
    });
  } catch (e) {
    return Response.json({ error: String(e?.message || e) }, { status: 502 });
  }
}
