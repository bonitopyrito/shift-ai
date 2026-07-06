---
name: verify
description: Build, run, and drive Shift AI (Next.js + SQLite DM copilot) end-to-end
---

# Verifying Shift AI

## Build & launch

```bash
npm run build                       # must pass before start (next start serves .next)
rm -rf data                         # optional: fresh DB (auto-seeds demo data on first request)
IG_VERIFY_TOKEN=testtoken PORT=3100 nohup npm start > /tmp/shift.log 2>&1 &
```

Gotcha: background `npm start` survives across shells — kill by scanning
`/proc/*/cmdline` for `next-server` before restarting, or the old build keeps
serving the port and you verify stale code.

Without `ANTHROPIC_API_KEY` the app runs in **stub mode** (keyword-matched
replies, no extraction) — the full demo loop still works and is deterministic,
which is what you want for verification.

## Flows worth driving

```bash
S=http://localhost:3100
# inventory question → auto reply mentioning the car
curl -s -X POST $S/api/messages -H 'Content-Type: application/json' -d '{"handle":"t","text":"you got any corollas?"}'
# negotiation → disposition "draft" + lead flagged
curl -s -X POST $S/api/messages -H 'Content-Type: application/json' -d '{"handle":"t","text":"take 9000 cash today?"}'
# approve the draft (find id in data/shift.db messages WHERE status='draft')
curl -s -X POST $S/api/drafts/<id> -H 'Content-Type: application/json' -d '{"action":"approve"}'
# voice note ingestion
curl -s -X POST $S/api/voice-notes -H 'Content-Type: application/json' -d '{"transcript":"the corolla is gone"}'
# webhook handshake + signature rejection
curl -s "$S/api/webhooks/instagram?hub.mode=subscribe&hub.verify_token=testtoken&hub.challenge=123"   # → 123
curl -s -o /dev/null -w "%{http_code}" -X POST $S/api/webhooks/instagram -d '{}'                      # → 401
```

Check pages render: `/` (stat tiles, demand bars, lead cards), `/leads/<id>`,
`/queue`, `/inventory`, `/voice-notes`. Screenshots: `playwright-core` with
`executablePath: "/opt/pw-browsers/chromium"` (script must live inside the
project dir for ESM resolution).
