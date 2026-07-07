# Shift AI — Instagram DM copilot for a car seller

A car seller posts inventory on Instagram and his DMs flood: "how much for the
corolla", "you got any civics?", "would you take 7800 cash". Shift AI answers
those DMs **in his voice**, keeps his knowledge current from **voice notes**,
and distills every conversation onto a **dashboard** — the only layer he
actually touches.

## The three pieces

1. **DM agent** — Claude (`claude-opus-4-8`) replies like the seller texts:
   casual, short, always moving toward a visit. It only states facts from the
   live inventory, records intel on every message, and **escalates instead of
   winging it** — negotiations, trade-ins, payment talk, and anything it can't
   answer are held as drafts for the seller's approval (hybrid autonomy).
2. **Voice notes** — the seller talks like he would to an assistant: *"the gray
   corolla's gone… got a 2016 altima coming thursday, asking 8500."* Claude's
   structured outputs turn that into inventory updates (`add_car`, `mark_sold`,
   `update_price`) and business facts the agent answers from.
3. **Dashboard** — leads as bullet-point cards (models they asked about, their
   questions, how close they are to buying), an approval queue, and a demand
   chart: *unique customers per model* — the signal for what to source next.

## Running it

```bash
npm install
cp .env.example .env.local   # add ANTHROPIC_API_KEY for live AI
npm run dev                  # http://localhost:3000
```

Without `ANTHROPIC_API_KEY` the app runs in **stub mode**: keyword-matched
replies and heuristic escalation so the whole loop (inbox → dashboard → queue)
is demoable with zero setup. The dashboard shows a banner when stubbed.

The SQLite database auto-creates at `data/shift.db` with demo inventory and
leads on first run. Delete the folder to reset.

### Pages

| Route | What it is |
|---|---|
| `/` | Dashboard — stat tiles, demand chart, lead cards with jotted-down bullets |
| `/inbox` | Inbox simulator — play a customer while Meta app access is pending |
| `/queue` | Approval queue — edit/approve/reject the AI's held-back drafts |
| `/inventory` | What the AI is allowed to talk about |
| `/voice-notes` | Send transcripts, see what was extracted and applied |
| `/leads/[id]` | One lead: full bullet profile + conversation |

## Wiring real Instagram

The webhook at `POST /api/webhooks/instagram` is ready — the simulator and the
webhook share one pipeline. To go live:

1. Convert the seller's Instagram to a **professional account** and link it to
   a Facebook Page.
2. Create a **Meta app** (developers.facebook.com) → add *Messenger* /
   *Instagram* products → request `instagram_manage_messages` (app review
   required for production).
3. Set the webhook URL to `https://<your-domain>/api/webhooks/instagram`,
   subscribe to `messages`, and use the same `IG_VERIFY_TOKEN` you set in env.
   The GET handshake and `X-Hub-Signature-256` verification are implemented.
4. Set `IG_APP_SECRET` and `IG_PAGE_ACCESS_TOKEN` — approved auto-replies then
   deliver via the Graph API (`src/lib/instagram.ts`).

Note Meta's rule: bots may only reply within 24h of the customer's last
message — fine for this use case (replies are near-instant).

## Comments on posts & reels

Comments run the same pipeline as DMs, with a twist: the AI posts a short
public reply under the comment ("answered you in the DMs 🤝" — configurable
via the `comment_public_reply` setting) and sends the real answer as a
**Meta private reply** — a DM addressed to the comment. That's the loop that
turns reel commenters into leads.

Two ways to get comments in, both through the official Graph API:

1. **Webhook (real-time)** — subscribe the Meta app to the `comments` field
   alongside `messages`. The handler at `/api/webhooks/instagram` already
   parses comment events, skips the seller's own comments, and delivers both
   replies. Facebook Page posts work the same way via the `feed` field (wire
   it identically when needed).
2. **Poller (no public URL needed)** — `npm run poll` watches his recent
   media for new comments every 60s and feeds them to `/api/comments`.
   Needs `IG_PAGE_ACCESS_TOKEN` (with `instagram_manage_comments`) and
   `IG_ACCOUNT_ID`. State lives in `data/poll-state.json`.

**Why no scraping:** pulling his account with headless browsers or
third-party scrapers violates Meta's ToS and risks the account — which *is*
the business. The Graph API provides everything (his media, comments, DMs)
legitimately, in real time, because it's his own account.

## Voice-note audio

The `/api/voice-notes` endpoint takes a transcript. Audio transcription
(Whisper, Deepgram, or the seller's phone keyboard dictation) plugs in
upstream: transcribe, then POST the text. Extraction and application are
already handled.

## Architecture

```
Instagram DM ─▶ webhook ─┐
                         ├─▶ agent (Claude + tools) ─▶ auto-reply ──▶ customer
Inbox simulator ─────────┘         │                └▶ draft ──▶ approval queue
                                   └▶ capture_lead_intel ─▶ lead bullets + demand chart
Voice note ─▶ transcript ─▶ structured extraction ─▶ inventory + business facts
                                                          (what the agent answers from)
```

- **Stack**: Next.js (App Router) · TypeScript · Tailwind · better-sqlite3 ·
  `@anthropic-ai/sdk`
- **Agent**: manual tool loop — `check_inventory`, `capture_lead_intel`
  (called on every message), `flag_for_review` (turns the reply into a draft).
  Adaptive thinking; persona block is prompt-cached, volatile inventory/lead
  context sits after the cache breakpoint.
- **Extraction**: `output_config.format` JSON schema — never invents prices or
  cars the seller didn't mention; unmatched cars surface as "review manually".
