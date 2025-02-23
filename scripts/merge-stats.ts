import { readFileSync, writeFileSync } from "fs";
import { mergeStats, StatsMap } from "../src/lib/stats";
import { IsbnPrefixWithoutDashes } from "../src/lib/util";

const out: StatsMap = {};
for (const dataset of ["all", "publication_date", "rarity", "publishers"]) {
  const f = JSON.parse(
    readFileSync(`public/images/tiled/${dataset}/stats.json`, "utf-8")
  ) as StatsMap;
  for (const k of Object.keys(f) as IsbnPrefixWithoutDashes[]) {
    if (out[k]) mergeStats(out[k], f[k]!);
    else out[k] = f[k];
  }
}

const outFile = `public/prefix-data/stats.json`;
console.log(`Writing to ${outFile}`);
writeFileSync(outFile, JSON.stringify(out));
