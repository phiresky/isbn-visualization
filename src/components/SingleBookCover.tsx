import * as isbnlib from "isbn3";
import { observer } from "mobx-react-lite";
import { fromPromise } from "mobx-utils";
import { useMemo } from "react";
import { fetchJson } from "../lib/json-fetch";
import { Store } from "../lib/Store";
import {
  Isbn13Number,
  IsbnPrefixWithoutDashes,
  IsbnStrWithChecksum,
  splitNameJson,
} from "../lib/util";
import { EanBarcode } from "./EanBarcode";

function dot(v1: [number, number], v2: [number, number]) {
  return v1[0] * v2[0] + v1[1] * v2[1];
}

// Helper function to emulate GLSL's fract function
// Returns the fractional part of a number
function fract(x: number) {
  return x - Math.floor(x);
}

// Random function translated from GLSL
// Takes an array of 2 numbers (representing vec2)
function rande(co: [number, number]) {
  return fract(Math.sin(dot(co, [12.9898, 78.233])) * 2);
}

export function bookHeight(bookIndex: [number, number]) {
  const minBookHeight = 0.8;
  const maxBookHeight = 0.95;
  const r = 1.2;
  const re = rande([bookIndex[0] * r, bookIndex[1] * r]);
  return minBookHeight + (maxBookHeight - minBookHeight) * re;
}

type Infoo = { isbn13: Isbn13Number; title: string; creator: string };
const DOMAIN = `https://isbn-titles.phiresky.xyz/`;
class TitleFetcher {
  cache: Map<
    IsbnPrefixWithoutDashes,
    Promise<Map<IsbnStrWithChecksum, Infoo>>
  > = new Map();
  async fetchTitle(title: IsbnStrWithChecksum): Promise<Infoo | undefined> {
    const prefixStr = title.slice(0, 8) as IsbnPrefixWithoutDashes;
    const fname = splitNameJson(prefixStr, 3);

    let gotten = this.cache.get(prefixStr);
    if (!gotten) {
      gotten = fetchJson<Infoo[]>(DOMAIN + fname).then(
        (data) =>
          new Map(
            data.map((info) => [
              String(info.isbn13) as IsbnStrWithChecksum,
              info,
            ])
          )
      );
      console.log(prefixStr, gotten);
      this.cache.set(prefixStr, gotten);
    }
    const data = await gotten;
    return data.get(title);
  }
}
const titleFetcher = new TitleFetcher();

export const SingleBookCover = observer(function SingleBookCover({
  isbn,
  store,
}: {
  store: Store;
  isbn: IsbnStrWithChecksum;
}) {
  const fetchTitleJson = useMemo(
    () => fromPromise(titleFetcher.fetchTitle(isbn)),
    [isbn]
  );
  const titleInfo = store.cachedGoogleBooks.get(isbn);
  const [y1, x1, y2, x2, y3, x3, _checksum] = isbn.slice(-7);
  const [x, y] = [+(x1 + x2 + x3), +(y1 + y2 + y3)];
  const bookHeightE = bookHeight([x, 999 - y]);
  // console.log(isbn, x, y);
  const title =
    titleInfo?.volumeInfo.title ??
    fetchTitleJson.case({ fulfilled: (t) => t?.title });
  const author =
    titleInfo?.volumeInfo.authors?.join(", ") ??
    fetchTitleJson.case({ fulfilled: (t) => t?.creator });
  return (
    <div
      className="single-book"
      style={{ width: (bookHeightE * 100).toFixed(0) + "%" }}
    >
      <div className="isbn-and-barcode">
        <div>
          <div className="isbn">ISBN {isbnlib.hyphenate(isbn)}</div>
          <EanBarcode ean={isbn} />
        </div>
      </div>
      <div className="titleinfo">
        <div className={`title ${!title ? "unknown" : ""}`}>{title}</div>
        <div className={`author ${!author ? "unknown" : ""}`}>
          {author ? `by ${author}` : ""}
        </div>
      </div>
    </div>
  );
});
