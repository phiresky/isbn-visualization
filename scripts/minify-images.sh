#!/bin/bash
set -euo pipefail

lines="$(find "$1" -name '*.png' | wc -l)"

find "$1" -name '*.png' | sort | pv -l --size=$lines | while read f; do        
    if [[ ! -f "$f.timestamp" ]] || [[ "$f" -nt "$f.timestamp" ]] ; then
        echo -n "Re-compressing $f "
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