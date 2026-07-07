#!/usr/bin/env node
/**
 * Comment watcher — the legitimate version of "keep scraping his account".
 * Polls the Meta Graph API for new comments on his recent Instagram media and
 * feeds them into the app's comment pipeline, which answers publicly, DMs the
 * commenter (private reply), and records the lead.
 *
 * Use this when webhooks aren't set up yet (no public URL / app review
 * pending). Once the `comments` webhook field is subscribed, this becomes a
 * belt-and-suspenders backstop — the pipeline dedupes by handle+text either way.
 *
 * Env:
 *   IG_PAGE_ACCESS_TOKEN  required — token with instagram_manage_comments
 *   IG_ACCOUNT_ID         required — the Instagram professional account id
 *   APP_URL               where the app runs (default http://localhost:3000)
 *   POLL_INTERVAL_SEC     watch-mode interval (default 60)
 *
 * Usage:
 *   node scripts/poll-meta.mjs           # one pass
 *   node scripts/poll-meta.mjs --watch   # keep watching
 */

import fs from "node:fs";
import path from "node:path";

const TOKEN = process.env.IG_PAGE_ACCESS_TOKEN;
const IG_ID = process.env.IG_ACCOUNT_ID;
const APP_URL = process.env.APP_URL ?? "http://localhost:3000";
const INTERVAL = Number(process.env.POLL_INTERVAL_SEC ?? 60) * 1000;
const GRAPH = "https://graph.facebook.com/v21.0";
const STATE_PATH = path.join(process.cwd(), "data", "poll-state.json");

if (!TOKEN || !IG_ID) {
  console.error("IG_PAGE_ACCESS_TOKEN and IG_ACCOUNT_ID are required. See README → Comments on posts & reels.");
  process.exit(1);
}

function loadState() {
  try {
    return JSON.parse(fs.readFileSync(STATE_PATH, "utf8"));
  } catch {
    return { seen: [] };
  }
}

function saveState(state) {
  fs.mkdirSync(path.dirname(STATE_PATH), { recursive: true });
  // keep the dedupe set bounded
  state.seen = state.seen.slice(-2000);
  fs.writeFileSync(STATE_PATH, JSON.stringify(state));
}

async function graph(pathname, params = {}) {
  const url = new URL(`${GRAPH}${pathname}`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  url.searchParams.set("access_token", TOKEN);
  const res = await fetch(url);
  const data = await res.json();
  if (!res.ok) throw new Error(`${pathname} → ${res.status}: ${JSON.stringify(data).slice(0, 300)}`);
  return data;
}

async function pollOnce(state) {
  const media = await graph(`/${IG_ID}/media`, {
    fields: "id,caption,media_product_type,timestamp",
    limit: "10",
  });

  let found = 0;
  for (const m of media.data ?? []) {
    const comments = await graph(`/${m.id}/comments`, {
      fields: "id,text,username,timestamp",
      limit: "50",
    });
    for (const c of comments.data ?? []) {
      if (state.seen.includes(c.id)) continue;
      state.seen.push(c.id);
      found++;
      const kind = m.media_product_type === "REELS" ? "reel" : "post";
      const label = `${kind} "${(m.caption ?? "").slice(0, 60) || m.id}"`;
      const res = await fetch(`${APP_URL}/api/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ handle: c.username, text: c.text, media: label, commentId: c.id }),
      });
      const out = await res.json().catch(() => ({}));
      console.log(
        `@${c.username} on ${label}: "${c.text}" → ${out.disposition ?? "?"}${out.delivered ? " (delivered)" : ""}`
      );
    }
  }
  saveState(state);
  return found;
}

const state = loadState();
const watch = process.argv.includes("--watch");

const run = async () => {
  try {
    const n = await pollOnce(state);
    console.log(`[${new Date().toISOString()}] poll done — ${n} new comment(s)`);
  } catch (err) {
    console.error(`[${new Date().toISOString()}] poll failed:`, err.message);
  }
};

await run();
if (watch) {
  console.log(`Watching every ${INTERVAL / 1000}s… (Ctrl-C to stop)`);
  setInterval(run, INTERVAL);
}
