import sqlite from "better-sqlite3";
import { createReadStream } from "fs";
import fs from "fs/promises";
import readline from "readline";
import zlib from "zlib";
interface Record {
  _index: "aarecords__9";
  _id: string;
  _source: {
    id: "string";
    file_unified_data: {
      title_best: string;
      author_best: string;
      publisher_best: string;
      identifiers_unified: {
        aarecord_id: string[];

        md5?: string[];
        sha1?: string[];
        isbn10?: string[];
        isbn13?: string[];
      };
    };
  };
}

async function connect(dbName: string) {
  const db = sqlite(dbName);
  // enable wal mode
  db.prepare("PRAGMA journal_mode = WAL").run();
  // disable synchronous
  db.prepare("PRAGMA synchronous = OFF").run();
  // create table isbns (isbn13, book_id), books (book_id, publisher, author, title)
  db.prepare(
    "CREATE TABLE IF NOT EXISTS books (book_id INTEGER PRIMARY KEY, publisher TEXT, author TEXT, title TEXT)",
  ).run();
  db.prepare(
    "CREATE UNIQUE INDEX IF NOT EXISTS idx_books_publisher_author_title ON books (publisher, author, title)",
  ).run();
  db.prepare(
    "CREATE TABLE IF NOT EXISTS isbns (isbn13 INTEGER, book_id INTEGER REFERENCES books(book_id), primary key (isbn13, book_id))",
  ).run();
  return db;
}

async function load(dbName: string, dataDir: string) {
  const db = await connect(dbName);
  // readdir, find all dataDir/aarecords__*.json.gz
  const files = (await fs.readdir(dataDir)).filter((f) =>
    /^aarecords__[^.]+\.json\.gz$/.exec(f),
  );
  for (const file of files) {
    console.log(`Loading ${file}`);
    // stream read gzipped jsonl file
    const stream = createReadStream(`${dataDir}/${file}`);
    const gunzip = zlib.createGunzip();
    const rl = readline.createInterface({
      input: stream.pipe(gunzip),
      crlfDelay: Infinity,
    });
    // insert or return id
    const book = db.prepare<[string, string, string], { book_id: number }>(
      "INSERT INTO books (publisher, author, title) VALUES (?, ?, ?) ON CONFLICT (publisher, author, title) DO UPDATE SET publisher = excluded.publisher RETURNING book_id",
    );
    const isbns = db.prepare(
      "INSERT OR IGNORE INTO isbns (isbn13, book_id) VALUES (?, ?)",
    );
    db.exec("BEGIN TRANSACTION");
    for await (const line of rl) {
      // parse json
      const record = JSON.parse(line) as Record;
      // insert into books
      const { title_best, author_best, publisher_best } =
        record._source.file_unified_data;
      const {
        aarecord_id,
        isbn13 = [],
        isbn10,
      } = record._source.file_unified_data.identifiers_unified;
      if (!title_best) {
        // console.log(`No title for ${aarecord_id[0]}`);
        continue;
      }
      const { book_id } = book.get(publisher_best, author_best, title_best)!;

      if (isbn13.length === 0) {
        // console.log(`No ISBN for ${aarecord_id[0]} ${title_best}`);
        if (isbn10?.length) console.log(`no isbn13, but has isbn10: ${isbn10}`);
      }

      // insert into isbns
      for (const isbn of isbn13) {
        isbns.run(isbn, book_id);
      }
    }
    db.exec("END TRANSACTION");
  }
}

// cmdline args
const dbName = process.argv[2];
const dataDir = process.argv[3];
if (!dbName || !dataDir) {
  console.error("Usage: gen-sqlite <db-name> <data-dir>");
  process.exit(1);
}
load(dbName, dataDir);
