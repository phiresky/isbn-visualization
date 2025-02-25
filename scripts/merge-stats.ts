import { readFileSync, writeFileSync } from "fs";
import { mergeStats, StatsMap } from "../src/lib/stats";
import { IsbnPrefixWithoutDashes } from "../src/lib/util";

const dir = process.env.OUTPUT_DIR_PUBLIC ?? "public";
const out: StatsMap = {};
for (const dataset of ["all", "publication_date", "rarity", "publishers"]) {
  const f = JSON.parse(
    readFileSync(`${dir}/images/tiled/${dataset}/stats.json`, "utf-8"),
  ) as StatsMap;
  for (const k of Object.keys(f) as IsbnPrefixWithoutDashes[]) {
    if (out[k]) {
      const v = f[k];
      if (v === undefined) continue;
      mergeStats(out[k], v);
    } else out[k] = f[k];
  }
}

const outFile = `${dir}/prefix-data/stats.json`;
console.log(`Writing to ${outFile}`);
writeFileSync(outFile, JSON.stringify(out));
