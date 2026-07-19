import { attomProvider, parseAddress } from "@/lib/property-data/providers.js";

export const runtime = "nodejs";

/*
  TEMPORARY diagnostic. Visit:
    https://YOUR-APP.vercel.app/api/debug?address=8655 Tenaya Ct, Stockton, CA 95212
  Shows what sale/snapshot returns around the subject (count + each comp's sale
  date), so we can see recency/scarcity. Key stays server-side. Delete when done.
*/
export async function GET(req) {
  const address = new URL(req.url).searchParams.get("address");
  if (!address) return Response.json({ error: "add ?address=... to the URL" }, { status: 400 });
  if (!process.env.ATTOM_API_KEY) return Response.json({ error: "ATTOM_API_KEY not set" }, { status: 501 });

  const p = attomProvider(process.env.ATTOM_API_KEY);
  const addr = parseAddress(address);
  try {
    const sub = await p.subject(addr);
    const prop = sub.property;
    if (!prop) return Response.json({ error: "subject not found", parsed: addr });

    const raw = await p.comps({
      lat: prop.location?.latitude, lng: prop.location?.longitude, radius: 5, pageSize: 30,
    });
    const rows = raw.map((c) => ({
      line1: c.address?.line1,
      attomId: c.identifier?.attomId,
      saleDate: c.sale?.amount?.salerecdate || c.sale?.amount?.saleRecDate || null,
      saleAmt: c.sale?.amount?.saleamt || c.sale?.amount?.saleAmt || null,
      gla: c.building?.size?.universalsize || c.building?.size?.universalSize || null,
    }));
    const dated = rows.filter((r) => r.saleDate).map((r) => r.saleDate).sort();
    return Response.json({
      subjectAttomId: prop.identifier?.attomId,
      subjectAddress: prop.address?.line1,
      totalReturnedByATTOM: raw.length,
      newestSaleDate: dated[dated.length - 1] || null,
      oldestSaleDate: dated[0] || null,
      comps: rows,
    });
  } catch (e) {
    return Response.json({ error: String(e?.message || e) }, { status: 502 });
  }
}
