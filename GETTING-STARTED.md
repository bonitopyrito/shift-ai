# Shift AI — how to run it (no tech skills needed)

This is the AI that answers your Instagram DMs and comments for you, in your
voice, and puts everything on one dashboard. Here's how to try it.

## Step 1 — Install Node.js (one time, 2 minutes)

Go to **https://nodejs.org** and install the **LTS** version.
Just click Next through the installer. That's it.

## Step 2 — Start the app

Open the Shift AI folder you were sent and double-click:

- **Windows:** `start-windows.bat`
- **Mac:** `start-mac.command`
  *(if Mac blocks it the first time: right-click the file → Open → Open)*

The first run takes a minute or two to set itself up. Then your browser opens
to the app. **Keep the black window open while you use it** — that's the app
running. Close it when you're done.

## Step 3 — Play with it

1. **Dashboard** — this is your layer. Every person who messages you shows up
   as a card with what they want, jotted down in bullets. The chart shows
   which models people keep asking for — that's what to source next.
2. **Inbox simulator** — pretend you're a customer. Type "how much for the
   corolla" and watch it answer like you would. Flip it to *Comment* mode and
   type "how much?" like someone commenting on your reel — it answers publicly
   AND slides into their DMs.
3. Try typing **"i'll give you 9000 cash today"** — watch it NOT take the
   deal. It says "let me check with the boss" and the offer shows up in your
   **Approval queue**, waiting for you. Deals are always your call.
4. **Voice notes** — type what you'd say in a voice note: *"the corolla's
   gone, got a 2015 f-150 coming next week, asking 13500"*. Watch the
   inventory update itself.

Want the demo data refreshed with a busy morning of customers? Double-click
the start file, and while it's running, a friend can run `npm run demo` — or
just play customer yourself in the simulator.

## What you're looking at (honest version)

Right now it runs in **demo mode** — the replies are canned-smart so you can
feel the flow. The real version plugs in the actual AI (replies in YOUR
texting style, learned from your real messages) and connects to your actual
Instagram, so real DMs and comments flow in and get answered. That's the next
step if you want it.
