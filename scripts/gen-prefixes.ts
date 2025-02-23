import { createReadStream } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { createInterface } from "node:readline";
import { ZSTDDecompress } from "simple-zstd";
import {
  addRecord,
  Digit,
  InfoMap,
  LazyInfoMap,
  PrefixInfo,
} from "../src/lib/info-map";
import { addIsbnGroups } from "../src/lib/prefix-data";
import { IsbnPrefixWithDashes } from "../src/lib/util";

interface JsonRecord {
  aacid: string;
  metadata: {
    id: string;
    record: {
      registrant_name: "foo";
      agency_name: "New Zealand";
      country_name: "New Zealand";
      isbns: [
        { isbn: IsbnPrefixWithDashes; isbn_type: "prefix" },
        { isbn: "..."; isbn_type: "isbn13" }
      ];
    };
  };
}

async function go() {
  const fname = process.argv[2];
  if (!fname) throw new Error("no input filename provided");
  const map: InfoMap = {};
  let recordCount = 0;
  for await (const line of createInterface(
    createReadStream(fname).pipe(ZSTDDecompress())
  )) {
    const obj = JSON.parse(line) as JsonRecord;
    if (recordCount % 100000 === 0) console.log(`${recordCount} records...`);
    recordCount++;
    for (const isbn of obj.metadata.record.isbns) {
      if (isbn.isbn_type === "prefix") {
        // console.log(isbn.isbn);
        // if (isbn.isbn.length > 9) continue;
        const r = obj.metadata.record;
        addRecord(map, isbn.isbn, {
          // id: obj.metadata.id,
          registrant_name: r.registrant_name,
          agency_name: r.agency_name,
          country_name: r.country_name,
          source: "isbngrp",
          prefix: isbn.isbn,
        });
      }
    }
  }
  addIsbnGroups(map, {
    testMode: false,
    addUnassigned: true,
  });
  const maxDepth = 7;
  const maxInlineDeepChildren = 10;
  const outDir = "public/prefix-data";
  const outFileFull = `data/prefix-data.json`;

  let nextPublisherId = 1;
  let nextGroupId = 1;
  const publishersIdCache = new Map<string, number>();
  function countUniquePublishers(map: InfoMap): Set<string> {
    const out = new Set<string>();
    for (const [digit, info] of Object.entries(map) as [Digit, PrefixInfo][]) {
      if (info.children) {
        const children = countUniquePublishers(info.children);
        info.totalChildren = children.size;
        for (const child of children) {
          out.add(child);
        }
      }
      if (info.info) {
        for (const record of info.info) {
          if (record && record.source === "isbngrp") {
            out.add(record.registrant_name);
          }
        }
      }
    }
    return out;
  }
  countUniquePublishers(map);
  function recurseAssignNumericIds(map: InfoMap) {
    for (const [digit, info] of Object.entries(map) as [Digit, PrefixInfo][]) {
      if (info.info) {
        const record = info.info[0];
        // for (const record of info.info) {
        if (record) {
          if (record.source === "isbngrp") {
            const cached = publishersIdCache.get(record.registrant_name);
            if (cached) {
              record.numericId = cached;
            } else {
              record.numericId = nextPublisherId++;
              publishersIdCache.set(record.registrant_name, record.numericId);
            }
          } else {
            if (record.name !== "Unassigned") {
              record.numericId = nextGroupId++;
            }
          }
        }
      }
      if (info.children) {
        recurseAssignNumericIds(info.children);
      }
    }
  }
  recurseAssignNumericIds(map);
  console.log(
    `assigned ${nextPublisherId} publisher ids, ${nextGroupId} group ids`
  );

  async function recurseOrRemoveAndWrite(
    layer: InfoMap,
    depth: number,
    prefix: string
  ): Promise<LazyInfoMap> {
    await mkdir(outDir, { recursive: true });
    if (depth >= maxDepth && Object.keys(layer).length) {
      const fname = `${prefix}.json`;
      await writeFile(`${outDir}/${fname}`, JSON.stringify(layer));
      return { lazy: fname };
    } else {
      const out: LazyInfoMap = {};
      for (const [digit, info] of Object.entries(layer) as [
        Digit,
        PrefixInfo
      ][]) {
        out[digit] = {
          ...info,
          children:
            info.totalChildren <= maxInlineDeepChildren
              ? info.children
              : await recurseOrRemoveAndWrite(
                  info.children || {},
                  depth + 1,
                  `${prefix}${digit}`
                ),
        };
      }
      return out;
    }
  }
  await writeFile(outFileFull, JSON.stringify(map));
  const lazyMap = await recurseOrRemoveAndWrite(map, 0, "");
  await writeFile(`${outDir}/root.json`, JSON.stringify(lazyMap));
}

void go();
