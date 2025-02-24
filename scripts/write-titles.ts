import sqlite3 from "better-sqlite3";
import { mkdirSync, writeFileSync } from "fs";
import path from "path";
import {
  Isbn13Number,
  IsbnRelative,
  relativeToFullIsbn,
  splitNameJson,
  totalIsbns,
} from "../src/lib/util";

export function loadPublicationDateData(dbName: string) {
  const db = sqlite3(dbName);
  // perf options
  db.pragma("cache_size = 100000");
  //mmap
  db.pragma("journal_mode = WAL");
  db.pragma("synchronous = OFF");
  db.pragma("temp_store = MEMORY");
  db.pragma("mmap_size = 300000000000");

  const blockSize = 10000;
  const prefixLength = 12 - Math.log10(blockSize);
  const dirSegmentLength = 3;
  const i = 0;
  const maxOclcNumber = db
    .prepare("select max(oclc_number) from isbn_data")
    .pluck()
    .get() as number;
  for (let isbn = 0; isbn < totalIsbns; isbn += blockSize) {
    const first = relativeToFullIsbn(isbn as IsbnRelative);
    const next = relativeToFullIsbn((isbn + blockSize) as IsbnRelative);
    const rows = db
      .prepare<
        [Isbn13Number, Isbn13Number],
        {
          isbn13: Isbn13Number;
          title: string | null;
          creator: string | null;
        }
      >(
        "select isbn13,title as title, creator as creator from isbn_data where isbn13 >= ? and isbn13 < ? group by isbn13 order by isbn13",
      )
      .all(+first as Isbn13Number, +next as Isbn13Number);
    for (const row of rows) {
      const maxL = 70;
      if (row.title && row.title.length > maxL)
        row.title = row.title.slice(0, maxL) + "...";
      if (row.creator && row.creator.length > maxL)
        row.creator = row.creator.slice(0, maxL) + "...";
    }
    if (isbn % 1000000 === 0)
      console.log(
        `loading range ${first}, done: ${((isbn / totalIsbns) * 100).toFixed(
          1,
        )}%`,
      );
    if (rows.length === 0) continue;
    const prefixStr = first.slice(0, prefixLength);
    const fname =
      `public/title-data/` + splitNameJson(prefixStr, dirSegmentLength);
    mkdirSync(path.dirname(fname), { recursive: true });
    writeFileSync(fname, JSON.stringify(rows));
  }
}

loadPublicationDateData("data/library_holding_data.sqlite3");
