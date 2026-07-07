#!/bin/bash
# Double-click me to run Shift AI.
# (If macOS blocks this the first time: right-click the file → Open → Open.)
cd "$(dirname "$0")"

if ! command -v node >/dev/null 2>&1; then
  echo ""
  echo "  Node.js is not installed yet."
  echo "  1. Go to https://nodejs.org and install the LTS version"
  echo "  2. Then double-click this file again"
  echo ""
  read -n 1 -s -r -p "  Press any key to close..."
  exit 1
fi

if [ ! -d node_modules ]; then
  echo "First-time setup — takes a minute or two..."
  npm install
fi

echo ""
echo "  Starting Shift AI... your browser will open in a few seconds."
echo "  Keep this window open while you use the app."
echo ""
(sleep 8 && open http://localhost:3000) &
npm run dev
