import isbnlib from "isbn3";
import {
  addRecord,
  Digit,
  InfoMap,
  LazyInfoMap,
  LazyPrefixInfo,
  PrefixInfo,
  PrefixInfoData,
} from "./info-map";
import { fetchJson } from "./json-fetch";
import {
  digits,
  isbnEANStart,
  IsbnPrefixWithDashes,
  IsbnPrefixWithoutDashes,
  totalIsbns,
} from "./util";

const testGroups: PrefixInfoData[] = [];
for (let x = 1; x <= 10; x++) {
  testGroups.push(
    ...digits.map((i) => ({
      prefix: `978-${String(i).padStart(x, "0")}` as IsbnPrefixWithDashes,
      source: "publisher-ranges" as const,
      name: "test",
    })),
  );
}

export async function resolveOnePrefixLevel(
  prefix: LazyPrefixInfo,
  fetchRoot: string,
): Promise<{ children?: InfoMap; info?: PrefixInfoData[] }> {
  if (prefix.children && "lazy" in prefix.children) {
    if (typeof prefix.children.lazy === "string") {
      const fname = prefix.children.lazy;
      prefix.children.lazy = (async () => {
        const map = await fetchJson<LazyInfoMap>(`${fetchRoot}/${fname}`);
        prefix.children = map;
      })();
    }
    await prefix.children.lazy;
    return prefix as PrefixInfo;
  }
  return prefix as PrefixInfo;
}
export function addIsbnGroups(
  prefixData: InfoMap,
  {
    testMode = false,
    addUnassigned,
  }: { testMode: boolean; addUnassigned: boolean },
) {
  if (testMode) {
    // empty
    prefixData[9] = { totalChildren: 0 };
    for (const group of testGroups) addRecord(prefixData, group.prefix, group);
    return;
  }
  for (const [prefix, group] of Object.entries(isbnlib.groups) as [
    IsbnPrefixWithDashes,
    (typeof isbnlib.groups)[string],
  ][]) {
    addRecord(prefixData, prefix, {
      ...group,
      prefix,
      source: "publisher-ranges",
    });
  }
  const musicPrefix = "979-0" as IsbnPrefixWithDashes;
  addRecord(prefixData, musicPrefix, {
    prefix: musicPrefix,
    name: "Sheet Music (ISMNs)",
    source: "publisher-ranges",
  });
  if (addUnassigned) {
    const rootPrefixInfo = {
      children: prefixData,
      totalChildren: 0,
    };
    for (let i = 0; i < totalIsbns / 1e8; i++) {
      const range = String(isbnEANStart + i * 1e8);
      const prefix = (range[0] +
        range[1] +
        range[2] +
        "-" +
        range[3]) as IsbnPrefixWithDashes;
      if (
        !getGroup(rootPrefixInfo, prefix) &&
        !digits.some((e) =>
          getGroup(rootPrefixInfo, (prefix + e) as IsbnPrefixWithDashes),
        )
      ) {
        addRecord(prefixData, prefix, {
          prefix,
          name: "Unassigned",
          color: "black",
          source: "publisher-ranges",
        });
      }
    }
  }
}
export interface LazyPrefixInfoWithParents {
  outers: LazyPrefixInfo[];
  inner: LazyPrefixInfo | null;
}
export function getGroupHierarchy(
  rootPrefixInfo: LazyPrefixInfo,
  prefix: IsbnPrefixWithDashes | IsbnPrefixWithoutDashes,
  allowFetch = true,
):
  | LazyPrefixInfoWithParents
  | ((prefixRoot: string) => Promise<LazyPrefixInfoWithParents>) {
  const infos: LazyPrefixInfo[] = [];
  let cur: LazyPrefixInfo = rootPrefixInfo;
  for (const c of prefix as Iterable<Digit | "-">) {
    if (c === "-") continue;
    if (cur.info) infos.push(cur);
    if (cur.children) {
      if ("lazy" in cur.children) {
        if (allowFetch) {
          return async (fetchRoot: string) => {
            await resolveOnePrefixLevel(cur, fetchRoot);
            const res = getGroupHierarchy(rootPrefixInfo, prefix);
            // flatten
            if (typeof res === "function") return await res(fetchRoot);
            return res;
          };
        } else {
          return { outers: infos, inner: null };
        }
      }
    }
    if (!cur.children?.[c]) return { outers: infos, inner: null };
    cur = cur.children[c];
  }
  return { outers: infos, inner: cur };
}
export function getGroup(
  rootPrefixInfo: LazyPrefixInfo,
  prefix: IsbnPrefixWithDashes,
):
  | LazyPrefixInfo
  | null
  | ((fetchRoot: string) => Promise<LazyPrefixInfo | null>) {
  const h = getGroupHierarchy(rootPrefixInfo, prefix);
  if (typeof h === "function")
    return (fetchRoot: string) => h(fetchRoot).then((h) => h.inner);
  return h.inner;
}
