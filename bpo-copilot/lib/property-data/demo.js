import createClient from "./index.js";

// provider:"mock" runs with no key. Switch to "attom" + a real key to go live:
//   createClient({ provider: "attom", apiKey: process.env.ATTOM_API_KEY })
const client = createClient({ provider: "mock" });

const usd = (n) => (n == null ? "—" : "$" + Number(n).toLocaleString());

const { subject, comps, meta } = await client.getBPOData(
  "227 N Sierra Nevada St, Stockton, CA 95205",
  { radiusMi: 1.0, monthsBack: 12, maxComps: 6 }
);

console.log("PROVIDER:", meta.provider, "| data as of", meta.dataAsOf, "| radius", meta.radiusMi, "mi\n");

console.log("SUBJECT");
console.log(`  ${subject.address}, ${subject.city}, ${subject.state} ${subject.zip}`);
console.log(`  APN ${subject.apn} | ${subject.stories}-story | ${subject.year} | ${subject.gla} sf | lot ${subject.lot} sf`);
console.log(`  ${subject.beds}bd ${subject.full}.${subject.half ? 5 : 0}ba | assessed ${usd(subject.assessed)}`);
console.log(`  AVM ${usd(subject.avm)} (${usd(subject.avmLow)}–${usd(subject.avmHigh)}, conf ${subject.avmScore})`);
console.log(`  last sale ${usd(subject.lastSale)} on ${subject.lastSaleDate}`);

console.log(`\n  agent must confirm (not in public records): ${meta.missingFields.join(", ")}`);

console.log(`\nCOMPS (${comps.length}) — sold, distance-sorted`);
for (const c of comps) {
  console.log(`  ${c.dist} mi  ${usd(c.price).padStart(9)}  ${String(c.gla).padStart(4)} sf  ${c.year}  ${c.beds}bd  ${c.date}  ${c.address}`);
}

console.log("\nNOTES");
meta.notes.forEach((n) => console.log("  • " + n));

console.log("\nRAW SUBJECT OBJECT (drops into the BPO app):");
console.log(JSON.stringify(subject, null, 2));
