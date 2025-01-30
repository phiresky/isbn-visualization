#!/bin/bash
set -euo pipefail

find "$1" -name '*.png' | sort | while read f; do        
    if [[ ! -f "$f.timestamp" ]] || [[ "$f" -nt "$f.timestamp" ]] ; then
        echo -n "Processing $f "
        cp "$f" "$f.orig" --preserve=all
        # if in rarity or publishers dir, don't quantize (lossy)
        if [[ "$f" == *"/rarity/"* ]] || [[ "$f" == *"/publishers/"* ]] || [[ "$f" == *"/publication_date/zoom-4"* ]]; then
            echo losslessly...
            true
        else
            echo lossily...
            pngquant "$f" --ext .png --skip-if-larger --force || true
        fi
        oxipng "$f" -r -o max --strip all
        touch "$f.timestamp"
    fi
done