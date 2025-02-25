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

export function loadPublicationDateData(
  dbName: string,
  stats: StatsAggregator,
) {
  const db = sqlite3(dbName);
  let i = 0;
  const maxOclcNumber = db
    .prepare("select max(oclc_number) from isbn_data")
    .pluck()
    .get() as number;

  const isbns = new Uint8Array(totalIsbns);
  for (const row of db
    .prepare<
      [],
      {
        oclc_number: number;
        isbn13: Isbn13Number;
        publication_date: number | null;
      }
    >("select * from isbn_data where publication_date is not null")
    .iterate()) {
    if (++i % 1000000 === 0)
      console.log(
        "loading publication date data",
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
    if (row.publication_date !== null) {
      // range 1800 - 2055
      isbns[isbnRel] = Math.min(255, Math.max(1, row.publication_date - 1800));
      stats.addStatistic(isbnRel, {
        publication_date: row.publication_date,
        publication_date_count: 1,
      });
    }
  }
  return isbns;
}

export default function rarityModule(
  stats: StatsAggregator,
): ProcessSingleZoom {
  const dataset = loadPublicationDateData(
    process.env.INPUT_HOLDING_SQLITE ?? "data/library_holding_data.sqlite3",
    stats,
  );
  return (tiler) => processPublicationData(tiler, dataset);
}
async function processPublicationData(
  tiler: ImageTiler,
  dataset: Uint8Array,
): Promise<void> {
  tiler.postprocessPixels = postprocessPixels;
  for (let i = 0; i < totalIsbns; i++) {
    const relativeIsbn = i as IsbnRelative;
    if (relativeIsbn % 2e6 === 0) {
      tiler.logProgress(relativeIsbn / totalIsbns);
      await tiler.purgeToLength(1);
    }
    const publicationDate = dataset[i]; // - 1800
    if (publicationDate)
      tiler.colorIsbn(relativeIsbn, [publicationDate, 1, 1], {
        addToPixel: true,
        scaleColors: false,
        scaleColorByTileScale: false,
      });
  }
}

function postprocessPixels(image: ImageTile, totalBooksPerPixel: number) {
  for (let i = 0; i < image.img.length; i += 3) {
    let publicationDate = image.img[i];
    const bookCount = image.img[i + 1];
    // verify all are ints
    if (!Number.isInteger(publicationDate)) {
      throw new Error("non-integer value");
    }
    // compute average date
    if (bookCount > 0) {
      publicationDate /= bookCount;
    }
    if (bookCount === 0 && publicationDate !== 0) {
      console.log({ i, publicationDate, bookCount });
      throw new Error("invalid publication date");
    }
    if (bookCount > 0 && (publicationDate < 0 || publicationDate > 255)) {
      console.log({ i, publicationDate, bookCount });
      throw new Error("invalid publication date");
    }
    // scale to channelMax
    publicationDate *= channelMax / 255;
    image.img[i] = publicationDate;
    image.img[i + 1] = publicationDate;
    image.img[i + 2] = (bookCount / totalBooksPerPixel) * channelMax;
  }
}
