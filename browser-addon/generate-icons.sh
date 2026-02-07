#!/bin/bash
# Generate extension icons from SVG
# Requires: inkscape or ImageMagick with librsvg

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

for dir in chrome firefox; do
  ICONS_DIR="$SCRIPT_DIR/$dir/icons"
  SVG_FILE="$ICONS_DIR/icon.svg"
  
  if [ -f "$SVG_FILE" ]; then
    echo "Generating icons for $dir..."
    
    # Try inkscape first
    if command -v inkscape &> /dev/null; then
      for size in 16 32 48 128; do
        inkscape -w $size -h $size "$SVG_FILE" -o "$ICONS_DIR/icon$size.png" 2>/dev/null
      done
    # Fallback to ImageMagick
    elif command -v convert &> /dev/null; then
      for size in 16 32 48 128; do
        convert -background none -resize ${size}x${size} "$SVG_FILE" "$ICONS_DIR/icon$size.png" 2>/dev/null
      done
    else
      echo "Error: Neither inkscape nor ImageMagick found. Please install one of them."
      exit 1
    fi
    
    echo "Icons generated for $dir!"
  fi
done

echo "Done!"
