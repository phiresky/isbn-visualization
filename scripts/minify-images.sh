#!/bin/bash
set -euo pipefail

find "$1" -name '*.png' | sort | while read f; do        
    if [[ ! -f "$f.orig" ]] || [[ "$f" -nt "$f.orig" ]] ; then
        echo "Processing $f"
        cp "$f" "$f.orig" --preserve=all
        # if in rarity or publishers dir, don't quantize (lossy)
        if [[ "$f" == *"/rarity/"* ]] || [[ "$f" == *"/publishers/"* ]] || [[ "$f" == *"/publication_date/zoom-4"* ]]; then
            true
        else
            pngquant "$f" --ext .png --skip-if-larger --force || true
        fi
        oxipng "$f" -r -o max --strip all
    fi
done