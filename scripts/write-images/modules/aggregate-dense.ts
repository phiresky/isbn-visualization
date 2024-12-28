import { IsbnData, ProcessSingleZoom } from "..";
import { IsbnRelative, totalIsbns } from "../../../src/lib/util";
import { ImageTiler, StatsAggregator } from "../ImageTiler";
import { loadSparseDataToMemory } from "./single-sparse";

export async function colorImageWithDenseIsbns(
  tiler: ImageTiler,
  isbnsBinaryUint8: Uint8Array
): Promise<void> {
  if (isbnsBinaryUint8.length !== totalIsbns) throw Error("wrong length");
  const addcolor = [1, 1, 1] as [number, number, number];
  for (let i = 0; i < isbnsBinaryUint8.length; i++) {
    const relativeIsbn = i as IsbnRelative;
    if (relativeIsbn % 2e6 === 0) {
      console.log(
        `Processing ${((relativeIsbn / totalIsbns) * 100).toFixed(2)}%...`
      );
      await tiler.purgeToLength(1);
    }
    if (isbnsBinaryUint8[i]) {
      tiler.colorIsbn(relativeIsbn, addcolor);
      tiler.stats?.addStatistic(relativeIsbn, { dataset_all: 1 });
    }
  }
}
export function aggregateDatasets(
  datasets: IsbnData,
  stats: StatsAggregator
): Uint8Array {
  const out = new Uint8Array(totalIsbns);
  for (const dataset in datasets) {
    console.log("adding data for dataset", dataset);
    const data = datasets[dataset];

    let position = 0;
    let isbnStreak = true;

    for (const value of data) {
      if (isbnStreak) {
        for (let j = 0; j < value; j++) {
          out[position as IsbnRelative] = 1;
          stats.addStatistic(position as IsbnRelative, {
            [`dataset_${dataset}`]: 1,
          });
          position++;
        }
      } else {
        position += value;
      }

      isbnStreak = !isbnStreak;
    }
  }
  return out;
}

export default async function aggregateDense(
  stats: StatsAggregator
): Promise<ProcessSingleZoom> {
  const dataSet = await loadSparseDataToMemory();
  const data = aggregateDatasets(dataSet, stats);
  return (tiler) => colorImageWithDenseIsbns(tiler, data);
}
