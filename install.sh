#!/usr/bin/env bash
# install.sh — Install SQL Playground system-wide (Linux)
# Run: chmod +x install.sh && ./install.sh

set -e
APP_DIR="/opt/sql-playground"
DESKTOP_DIR="$HOME/.local/share/applications"

echo "→ Installing SQL Playground to $APP_DIR …"

# Create app directory
sudo mkdir -p "$APP_DIR"

# Copy all files from dist/linux-unpacked
sudo cp -r dist/linux-unpacked/* "$APP_DIR/"
sudo chmod +x "$APP_DIR/sql-playground"

# Generate a simple icon (purple diamond with DB symbol)
if [ ! -f "$APP_DIR/icon.png" ]; then
    echo "→ Generating icon…"
    # Create a simple 128x128 PNG using ImageMagick if available,
    # otherwise use a blank placeholder
    if command -v convert >/dev/null 2>&1; then
        convert -size 128x128 xc:#bd93f9 -fill white -font Helvetica-Bold -pointsize 64 -gravity center -annotate 0 "DB" "$APP_DIR/icon.png" 2>/dev/null || true
    fi
fi

# Install desktop entry for current user
echo "→ Installing desktop entry…"
mkdir -p "$DESKTOP_DIR"
sed "s|/opt/sql-playground|$APP_DIR|g" sql-playground.desktop > "$DESKTOP_DIR/sql-playground.desktop"

# Update desktop database
update-desktop-database "$DESKTOP_DIR" 2>/dev/null || true

echo ""
echo "✅ Done! SQL Playground is now in your app launcher."
echo "   Search for 'SQL Playground' in your start menu."
echo ""
echo "   To uninstall: sudo rm -rf $APP_DIR && rm $DESKTOP_DIR/sql-playground.desktop"
