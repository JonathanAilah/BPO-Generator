export const runtime = "nodejs";

// Model IDs drift — confirm current at https://docs.claude.com/en/docs/about-claude/models
const MODEL = process.env.ANTHROPIC_MODEL || "claude-sonnet-5";

const MARKET = { supply: "Over supply", trend: "Declining", avgDom: 133 };

/*
  POST /api/narrative   { subject, comps, reconciled }
  -> { subject, marketing, comps: string[], _source: "ai" }
  Returns 501 when ANTHROPIC_API_KEY is unset; the client then uses its
  local template. The key never leaves the server.
*/
export async function POST(req) {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return Response.json({ error: "no_key" }, { status: 501 });

  const { subject, comps, reconciled } = await req.json().catch(() => ({}));
  if (!subject || !Array.isArray(comps)) return Response.json({ error: "bad payload" }, { status: 400 });

  const payload = {
    subject: { year: subject.year, stories: subject.stories, gla: subject.gla, lot: subject.lot, condition: subject.condition },
    market: MARKET, reconciled,
    comps: comps.map((c) => ({ address: c.address, dist: c.dist, price: c.price, adjusted: c.adjusted, grossPct: Math.round((c.grossPct || 0) * 100), gla: c.gla, year: c.year })),
  };
  const prompt = `You are a licensed real estate broker drafting the narrative comment sections of a Broker Price Opinion. Concise, professional, factual. Do not invent facts beyond the data.

DATA:
${JSON.stringify(payload, null, 2)}

Return ONLY JSON: {"subject":"2-3 sentences","marketing":"2-3 sentences incl. financing & list-price rationale","comps":["comp 1 comment","comp 2 comment","comp 3 comment"]} Each comp comment 2-3 sentences noting proximity, comparison, adjusted value.`;

  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "content-type": "application/json", "x-api-key": key, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({ model: MODEL, max_tokens: 1000, messages: [{ role: "user", content: prompt }] }),
    });
    if (!res.ok) return Response.json({ error: await res.text() }, { status: 502 });
    const data = await res.json();
    const text = (data.content || []).map((i) => (i.type === "text" ? i.text : "")).join("");
    const parsed = JSON.parse(text.replace(/```json|```/g, "").trim());
    if (!parsed.subject || !Array.isArray(parsed.comps)) throw new Error("unexpected shape");
    return Response.json({ ...parsed, _source: "ai" });
  } catch (e) {
    return Response.json({ error: String(e?.message || e) }, { status: 502 });
  }
}
