import sqlite3 from "better-sqlite3";
import { channelMax, ImageTile, ProcessSingleZoom } from "..";
import {
  fullIsbnToRelative,
  Isbn13Number,
  IsbnRelative,
  IsbnStrWithChecksum,
  totalIsbns,
} from "../../../src/lib/util";
import { ImageTiler, StatsAggregator } from "../ImageTiler";

export function loadRarityData(dbName: string, stats: StatsAggregator) {
  const db = sqlite3(dbName);
  let i = 0;
  const maxOclcNumber = db
    .prepare("select max(oclc_number) from isbn_data")
    .pluck()
    .get() as number;

  const isbns = new Uint8Array(totalIsbns * 2);
  for (const row of db
    .prepare<
      [],
      {
        oclc_number: number;
        isbn13: Isbn13Number;
        publication_date: number;
        holding_count: number;
        edition_count: number;
      }
    >(
      "select * from isbn_data join holdings_data on isbn_data.oclc_number = holdings_data.oclc_number",
    )
    .iterate()) {
    if (++i % 1000000 === 0)
      console.log(
        "loading rarity data",
        ((row.oclc_number / maxOclcNumber) * 100).toFixed(1) + "%",
        i,
        row,
      );
    // isbns.set(+row.isbn as Isbn13Number, row.oclc_number);
    const isbnRel = fullIsbnToRelative(
      String(row.isbn13) as IsbnStrWithChecksum,
    );
    if (isbnRel < 0 || isbnRel >= totalIsbns) {
      throw new Error(`invalid isbn: ${row.isbn13} ${isbnRel}`);
    }
    const existingHolding = isbns[2 * isbnRel];
    const existingEdition = isbns[2 * isbnRel + 1];
    isbns[2 * isbnRel] = Math.min(row.holding_count + existingHolding, 255);
    // add 1 to edition count as a "exists" marker
    isbns[2 * isbnRel + 1] = Math.min(
      (existingEdition || 1) + row.edition_count,
      255,
    );

    stats.addStatistic(isbnRel, {
      rarity_holdingCount: row.holding_count,
      rarity_editionCount: row.edition_count,
      rarity_exists: 1,
    });
    /*if (existingHolding || existingEdition) {
      console.log("multiple entries for ", row, {
        existingHolding,
        existingEdition,
      });
    }*/
  }
  return isbns;
}

/*if (require.main === module) {
  const dbName = process.argv[2];
  if (!dbName) throw new Error("no db name provided");
  loadRarityData(dbName);
}*/

export default async function rarityModule(
  stats: StatsAggregator,
): Promise<ProcessSingleZoom> {
  const dataset = loadRarityData(
    process.env.INPUT_HOLDING_SQLITE || "data/library_holding_data.sqlite3",
    stats,
  );
  return (tiler) => processRarityData(tiler, dataset);
}
async function processRarityData(
  tiler: ImageTiler,
  dataset: Uint8Array,
): Promise<void> {
  tiler.postprocessPixels = postprocessPixels;
  for (let i = 0; i < totalIsbns; i++) {
    const relativeIsbn = i as IsbnRelative;
    if (relativeIsbn % 2e6 === 0) {
      console.log(
        `Processing ${((relativeIsbn / totalIsbns) * 100).toFixed(2)}%...`,
      );
      await tiler.purgeToLength(1);
    }
    const holdingCount = dataset[2 * i];
    let editionCount = dataset[2 * i + 1];
    const exists = editionCount > 0; // we added 1 to editionCount as an "exists" marker
    if (exists) editionCount -= 1;
    if (holdingCount || editionCount || exists) {
      tiler.colorIsbn(relativeIsbn, [holdingCount, editionCount, 1], {
        addToPixel: true,
        scaleColors: false,
        scaleColorByTileScale: false,
      });
    }
  }
}

async function postprocessPixels(image: ImageTile) {
  for (let i = 0; i < image.img.length; i += 3) {
    let holdingsCount = image.img[i];
    let editionCount = image.img[i + 1];
    let bookCount = image.img[i + 2];
    // verify all are ints
    if (
      !Number.isInteger(holdingsCount) ||
      !Number.isInteger(editionCount) ||
      !Number.isInteger(bookCount)
    ) {
      throw new Error("non-integer value");
    }
    // verify all are positive
    if (holdingsCount < 0 || editionCount < 0 || bookCount < 0) {
      throw new Error("negative value");
    }
    // verify all are 0 if bookCount is 0
    if (bookCount === 0 && (holdingsCount || editionCount)) {
      throw new Error("non-zero value with zero book count");
    }

    // scale the colors
    const maxValue = Math.max(holdingsCount, editionCount, bookCount);
    const needScaleDown = maxValue >= 255;
    if (needScaleDown) {
      const scale = 255 / maxValue;
      holdingsCount *= scale;
      editionCount *= scale;
      bookCount *= scale;
    }
    // scale to channelMax
    holdingsCount *= channelMax / 255;
    editionCount *= channelMax / 255;
    bookCount *= channelMax / 255;
    /*console.log({
      holdingsCount,
      editionCount,
      bookCount,
      maxValue,
      foo: image.img.slice(i, i + 3),
    });*/
    image.img[i] = holdingsCount;
    image.img[i + 1] = editionCount;
    image.img[i + 2] = bookCount;
  }
}
