import { readFile } from "fs/promises";
import { ProcessSingleZoom } from "..";
import { InfoMap, LazyPrefixInfo } from "../../../src/lib/info-map";
import { getGroupHierarchy } from "../../../src/lib/prefix-data";
import {
  IsbnRelative,
  lastIsbnInPrefix,
  relativeToIsbnPrefix,
  removeDashes,
  totalIsbns,
} from "../../../src/lib/util";
import { ImageTiler } from "../ImageTiler";

export async function processPublishersData(
  tiler: ImageTiler,
  publishersData: LazyPrefixInfo,
): Promise<void> {
  let color: [number, number, number] | null = null;
  let curPrefixEnd = -1;
  for (
    let relativeIsbn = 0 as IsbnRelative;
    relativeIsbn < totalIsbns;
    relativeIsbn++
  ) {
    if (relativeIsbn % 2e6 === 0) {
      console.log(
        `Processing ${((relativeIsbn / totalIsbns) * 100).toFixed(2)}%...`,
      );
      await tiler.purgeToLength(1);
    }
    if (relativeIsbn > curPrefixEnd) {
      const isbn = relativeToIsbnPrefix(relativeIsbn);
      const data = getGroupHierarchy(publishersData, isbn);
      if (typeof data === "function") {
        throw Error(
          "found lazy data in full data dump from /data, this is impossible",
        );
      }
      if (data.outers.length >= 2) {
        const pr = data.outers[1]?.info?.[0].prefix;
        if (!pr) throw Error("not handled");
        curPrefixEnd = lastIsbnInPrefix(removeDashes(pr));
      } else {
        curPrefixEnd = relativeIsbn + 9;
      }
      if (data.outers.length === 0) {
        // throw Error(`no data for ${isbn}, previous ended at ${curPrefixEnd}`);
        color = null;
        continue;
      }
      color = null;
      const groupId = data.outers[0].info?.[0].numericId;
      const publisherId = data.outers[1]?.info?.[0].numericId;
      // publisherId to RGB
      if (publisherId) {
        color = [0, 0, 0];
        color[0] = ((publisherId & 0xff0000) >> 16) / 255;
        color[1] = ((publisherId & 0x00ff00) >> 8) / 255;
        color[2] = (publisherId & 0x0000ff) / 255;
        tiler.stats?.addStatistic(relativeIsbn, {
          publisher_blocks: 1,
        });
      }

      /* console.log(
        `color from ${isbn} to ${curPrefixEnd + isbnEANStart}: ${color}`
      );*/
    }
    if (color) {
      tiler.colorIsbn(relativeIsbn, color, {
        addToPixel: false,
        scaleColors: true,
        scaleColorByTileScale: false,
      });
    }
  }
}

export async function loadPublishersData() {
  const publishersData = {
    children: JSON.parse(
      await readFile(
        process.env.INPUT_PREFIX_DATA || `data/prefix-data.json`,
        "utf8",
      ),
    ) as InfoMap,
    totalChildren: 0,
  };
  return publishersData;
}

export default async function publishersModule(): Promise<ProcessSingleZoom> {
  const publishersData = await loadPublishersData();
  return (tiler) => processPublishersData(tiler, publishersData);
}
