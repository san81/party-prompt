#!/bin/sh
# Renders tools/og-cards.html into the link-preview images public/img/og-{landing,vibe,rapid}.jpg.
# Needs Google Chrome (macOS path below, or set CHROME) and macOS `sips` for the JPEG step.
set -e
cd "$(dirname "$0")/.."
CHROME=${CHROME:-"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"}
for c in landing vibe rapid; do
  "$CHROME" --headless=new --disable-gpu --hide-scrollbars --force-device-scale-factor=1 \
    --virtual-time-budget=4000 --window-size=1200,630 \
    --screenshot="public/img/og-$c.png" "file://$PWD/tools/og-cards.html?c=$c" >/dev/null 2>&1
  sips -s format jpeg -s formatOptions 85 "public/img/og-$c.png" --out "public/img/og-$c.jpg" >/dev/null
  rm "public/img/og-$c.png"
  echo "public/img/og-$c.jpg"
done
