#!/bin/bash

# Exit on error and undefined variables
set -euo pipefail

# Check for ImageMagick
if ! command -v magick >/dev/null 2>&1; then
    echo "Error: ImageMagick not available! Run \`brew install imagemagick\` and try again."
    exit 1
fi

# Setup
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TMP_DIR="$DIR/tmp"
OUTPUT_DIR="$DIR/.."
rm -rf "$TMP_DIR"
mkdir -p "$TMP_DIR"

# Mac ICNS
ICON_SET_DIR="$TMP_DIR/icon.iconset"
mkdir -p "$ICON_SET_DIR"
sizes=(16 32 64 128 256 512)
for size in "${sizes[@]}"; do
    # Normal size
    magick "$DIR/icon.png" -resize "${size}x${size}!" "$ICON_SET_DIR/icon_${size}x${size}.png" >/dev/null 2>&1
    # Retina size (@2x)
    retina_size=$((size * 2))
    magick "$DIR/icon.png" -resize "${retina_size}x${retina_size}!" "$ICON_SET_DIR/icon_${size}x${size}@2x.png" >/dev/null 2>&1
done
iconutil -c icns "$ICON_SET_DIR" -o "$OUTPUT_DIR/icon.icns"

# Windows ICO
win_sizes=(16 32 48 64 128 256)
for size in "${win_sizes[@]}"; do
    magick "$DIR/icon.png" -resize "${size}x${size}!" "$TMP_DIR/icon_${size}.png" >/dev/null 2>&1
done
magick $(printf "$TMP_DIR/icon_%s.png " "${win_sizes[@]}") "$OUTPUT_DIR/icon.ico"

# Linux PNG
magick "$DIR/icon.png" -resize 512x512\! "$OUTPUT_DIR/icon.png" >/dev/null 2>&1

# Cleanup
echo "Icons generated successfully!"
rm -rf "$TMP_DIR"
