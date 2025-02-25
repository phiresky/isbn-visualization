import { writeFile } from "fs/promises";
import { ImageTiler, StatsAggregator } from "./ImageTiler";
import * as modules from "./modules";
import { loadSparseDataToMemory } from "./modules/single-sparse";

export type IsbnData = Partial<Record<string, Uint32Array>>;

/** sharp / vips uses a channel max of 1e16 for float32 images for some reason */
export const channelMax = 65535;

/** info of one tile of a tiled image */
export interface ImageTile {
  x: number;
  y: number;
  width: number;
  height: number;
  img: Float32Array;
}

export type ProcessSingleZoom = (tiler: ImageTiler) => Promise<void>;
async function processAllZoomLevels(
  dataset: string,
  minLevel = 1,
  maxLevel = 4,
): Promise<void> {
  const stats = new StatsAggregator();
  const processIsbnData = await loadData(dataset, stats);
  const written = [];
  const dir = `${process.env.OUTPUT_DIR_PUBLIC ?? "public"}/images/tiled/${dataset}`;
  for (let level = minLevel; level <= maxLevel; level++) {
    const tiledDir = `${dir}/zoom-${level}`;
    const tiler = new ImageTiler(level, tiledDir);
    if (level === minLevel) tiler.stats = stats;
    await tiler.init();
    await processIsbnData(tiler);
    await tiler.finish();
    const w = tiler.written;
    for (const prefix of w) {
      written.push(prefix.toString().padStart(level, "0"));
    }
    if (level === minLevel) {
      await writeFile(
        `${dir}/stats.json`,
        JSON.stringify(Object.fromEntries(stats.statistics)),
      );
    }
  }
  if (minLevel === 1 && maxLevel === 4) {
    await writeFile(`${dir}/written.json`, JSON.stringify(written));
  }
}

const specialDatasets = ["publishers", "all", "rarity", "publication_date"];
async function loadData(
  dataset: string,
  stats: StatsAggregator,
): Promise<ProcessSingleZoom> {
  if (dataset === "publishers") {
    return await modules.publishers();
  } else if (dataset === "rarity") {
    return modules.rarity(stats);
  } else if (dataset === "all") {
    return await modules.all(stats);
  } else if (dataset === "publication_date") {
    return modules.publication_date(stats);
  } else {
    return await modules.single(dataset);
  }
}
async function main() {
  // Main execution
  const dataset = process.argv[2];
  if (!dataset) throw Error("dataset arg required, use list to list");
  if (dataset === "list") {
    console.log(specialDatasets, Object.keys(await loadSparseDataToMemory()));
    return;
  }
  const level = process.argv[3];
  if (!level) throw Error("level arg required (1,2,3,4 or all)");
  if (level === "all") {
    await processAllZoomLevels(dataset);
  } else {
    await processAllZoomLevels(dataset, +level, +level);
  }
}

void main();
