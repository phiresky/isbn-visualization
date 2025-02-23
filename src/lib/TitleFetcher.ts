import { fetchJson } from "./json-fetch";
import { Store } from "./Store";
import {
  Isbn13Number,
  IsbnPrefixWithoutDashes,
  IsbnStrWithChecksum,
  splitNameJson,
} from "./util";

export type TitleFetchedInfo = {
  isbn13: Isbn13Number;
  title: string;
  creator: string;
};

export class TitleFetcher {
  cache: Map<
    IsbnPrefixWithoutDashes,
    Promise<Map<IsbnStrWithChecksum, TitleFetchedInfo>>
  > = new Map();
  constructor(private store: Store) {}
  async fetchTitle(
    title: IsbnStrWithChecksum
  ): Promise<TitleFetchedInfo | undefined> {
    const prefixStr = title.slice(0, 8) as IsbnPrefixWithoutDashes;
    const fname = splitNameJson(prefixStr, 3);

    let gotten = this.cache.get(prefixStr);
    if (!gotten) {
      gotten = fetchJson<TitleFetchedInfo[]>(
        this.store.runtimeConfig.titlesRoot + "/" + fname
      ).then(
        (data) =>
          new Map(
            data.map((info) => [
              String(info.isbn13) as IsbnStrWithChecksum,
              info,
            ])
          )
      );
      this.cache.set(prefixStr, gotten);
    }
    const data = await gotten;
    return data.get(title);
  }
}
