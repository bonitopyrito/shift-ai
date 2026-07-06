#!/usr/bin/env node
/**
 * Demo workout: simulates a realistic burst of Instagram DM traffic plus a
 * voice note, so the dashboard/queue have life in them.
 *
 * Usage: start the app (npm run dev), then:
 *   node scripts/demo.mjs            # targets http://localhost:3000
 *   DEMO_URL=http://localhost:3100 node scripts/demo.mjs
 */

const BASE = process.env.DEMO_URL ?? "http://localhost:3000";

async function post(path, body) {
  const res = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`${path} → ${res.status}: ${JSON.stringify(data)}`);
  return data;
}

async function dm(handle, text) {
  const r = await post("/api/messages", { handle, text });
  const tag = r.disposition === "draft" ? "✋ held for approval" : "→ auto-replied";
  console.log(`@${handle}: "${text}"`);
  console.log(`   ${tag}: "${r.reply}"\n`);
}

console.log(`Working ${BASE} ...\n`);

// A morning of DMs
await dm("maria.g", "how much for the altima?");
await dm("maria.g", "does it come with the trip ticket?");
await dm("tania_v", "cuanto por el corolla?");
await dm("jay_wheels", "you got any civics or corollas rn?");
await dm("jay_wheels", "i can do 9500 cash for the civic today");
await dm("luis.autos", "when does the elantra get in? im interested");
await dm("mike.f", "you got any pickup trucks?");
await dm("carlos_m", "so we got a deal at 7800 or what");

// The seller sends a voice note
const vn = await post("/api/voice-notes", {
  transcript:
    "the camry buyer backed out so its available again at 8900... also got a 2015 f-150 coming next week, gonna ask 13500. and tell people we take zelle now",
});
console.log(`🎙 voice note → ${vn.summary}`);
if (vn.applied?.length) for (const a of vn.applied) console.log(`   ✓ ${a}`);

console.log(`\nDone. Open ${BASE} — dashboard, queue, and voice notes are populated.`);
