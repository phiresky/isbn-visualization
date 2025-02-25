#!/bin/bash
set -euo pipefail

# for each env var, check if file exists and make path absolute

# default INPUT_ISBNGRP_DUMP to DATA_DIR/aa_meta__aacid__isbngrp_records__20240920T194930Z--20240920T194930Z.jsonl.seekable.zst
INPUT_ISBNGRP_DUMP="${INPUT_ISBNGRP_DUMP:-"$DATA_DIR/annas_archive_meta__aacid__isbngrp_records__20240920T194930Z--20240920T194930Z.jsonl.seekable.zst"}"
INPUT_WORLDCAT_DUMP="${INPUT_WORLDCAT_DUMP:-"$DATA_DIR/annas_archive_meta__aacid__worldcat__20241230T203056Z--20241230T203056Z.jsonl.seekable.zst"}"
INPUT_BENC="${INPUT_BENC:-"$DATA_DIR/aa_isbn13_codes_20241204T185335Z.benc.zst"}"
# annas_archive_meta__aacid__worldcat__20241230T203056Z--20241230T203056Z.jsonl.seekable.zst
for var in INPUT_ISBNGRP_DUMP INPUT_WORLDCAT_DUMP INPUT_BENC OUTPUT_DIR_PUBLIC DATA_DIR; do
  if [ -z "${!var-}" ]; then
    echo "Required env variable not set: $var"
    exit 1
  fi
  if [ ! -f "${!var}" ] && [ ! -d "${!var}" ]; then
    echo "File not found: ${!var} (from $var)"
    exit 1
  fi
  export $var="$(realpath "${!var}")"
done

# go to repo root
cd "$(dirname "$0")/.."


# build web components to out dir
if [ ! -f "$OUTPUT_DIR_PUBLIC/index.html" ]; then
  echo "Running pnpm build"
  rm -rf "$OUTPUT_DIR_PUBLIC/assets" # ensure we don't have old assets
  pnpm build
  cp -r dist/* "$OUTPUT_DIR_PUBLIC/"
else
  echo "Skipping pnpm build as $OUTPUT_DIR_PUBLIC/index.html already exists"
fi

# run only if DATA_DIR/prefix-data.json does not exist
if [ ! -f "$DATA_DIR/prefix-data.json" ]; then
  echo "Running gen-prefixes.ts"
  pnpm tsx scripts/gen-prefixes.ts "$INPUT_ISBNGRP_DUMP"
else
  echo "Skipping gen-prefixes.ts as $DATA_DIR/prefix-data.json already exists"
fi

if [ ! -f "$OUTPUT_DIR_PUBLIC/prefix-data/root.json.gz" ]; then
  echo "Running scripts/minify-prefix-data.sh"
  scripts/minify-prefix-data.sh
else
  echo "Skipping scripts/minify-prefix-data.sh as $OUTPUT_DIR_PUBLIC/prefix-data/root.json.gz already exists"
fi


# run only if DATA_DIR/library_holding_data.sqlite3 does not exist
if [ ! -f "$DATA_DIR/library_holding_data.sqlite3" ]; then
  echo "Running scripts/rarity"
  scripts/rarity/target/release/rarity "$INPUT_WORLDCAT_DUMP"
else
  echo "Skipping scripts/rarity as $DATA_DIR/library_holding_data.sqlite3 already exists"
fi

JOBS="${JOBS:-$(nproc)}"

for dataset in all publishers rarity publication_date cadal_ssno cerlalc duxiu_ssid edsebk gbooks goodreads ia isbndb isbngrp libby md5 nexusstc nexusstc_download oclc ol rgb trantor; do
  if [ ! -f "$OUTPUT_DIR_PUBLIC/images/tiled/$dataset/written.json" ]; then
    echo "Running scripts/write-images $dataset all"
    pnpm tsx scripts/write-images $dataset all &
  else
    echo "Skipping scripts/write-images $dataset all as $OUTPUT_DIR_PUBLIC/images/tiled/$dataset/written.json already exists"
  fi

  # allow to execute up to $N jobs in parallel
  while [[ $(jobs -r -p | wc -l) -ge $JOBS ]]; do
      # now there are $N jobs already running, so wait here for any job
      # to be finished so there is a place to start next one.
      wait -n
  done
done
wait

# merge-stats
if [ ! -f "$OUTPUT_DIR_PUBLIC/prefix-data/stats.json" ] && [ ! -f "$OUTPUT_DIR_PUBLIC/prefix-data/stats.json.gz" ] ; then
  echo "Running scripts/merge-stats.ts"
  pnpm tsx scripts/merge-stats.ts
else
  echo "Skipping scripts/merge-stats.ts as $OUTPUT_DIR_PUBLIC/prefix-data/stats.json already exists"
fi

# minify-images

for dataset in "$OUTPUT_DIR_PUBLIC/images/tiled/"*; do
  echo "Running scripts/minify-images.sh $dataset &"
  scripts/minify-images.sh "$dataset" &
  # allow to execute up to $N jobs in parallel
  while [[ $(jobs -r -p | wc -l) -ge $JOBS ]]; do
      # now there are $N jobs already running, so wait here for any job
      # to be finished so there is a place to start next one.
      wait -n
  done
done
wait

if [ ! -d "$OUTPUT_DIR_PUBLIC/title-data" ]; then
  echo "Running scripts/write-titles.ts"
  pnpm tsx scripts/write-titles.ts
else
  echo "Skipping scripts/write-titles.ts as $OUTPUT_DIR_PUBLIC/title-data already exists"
fi