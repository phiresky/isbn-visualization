import { IsbnPrefixWithDashes } from "./util";

export type Digit = "0" | "1" | "2" | "3" | "4" | "5" | "6" | "7" | "8" | "9";
export const DIGITS: Digit[] = [
  "0",
  "1",
  "2",
  "3",
  "4",
  "5",
  "6",
  "7",
  "8",
  "9",
];
export type PrefixInfoData =
  | {
      // id: string;
      numericId?: number;
      registrant_name: string;
      agency_name: string;
      country_name: string;
      source: "isbngrp";
      prefix: IsbnPrefixWithDashes;
    }
  | {
      source: "publisher-ranges";
      numericId?: number;
      name: string;
      prefix: IsbnPrefixWithDashes;
      color?: string;
    };
export interface PrefixInfo {
  children?: InfoMap;
  info?: PrefixInfoData[];
  totalChildren: number;
}
export type InfoMap = Partial<Record<Digit, PrefixInfo>>;

export interface NeedLazyLoad {
  lazy: string | Promise<void>;
}
export interface LazyPrefixInfo {
  children?: LazyInfoMap;
  info?: PrefixInfoData[];
  totalChildren: number;
}
export type LazyInfoMap = NeedLazyLoad | Partial<Record<Digit, LazyPrefixInfo>>;

export function addRecord(
  map: InfoMap,
  prefix: IsbnPrefixWithDashes,
  record: PrefixInfoData
) {
  let layer = map;
  for (const [i, _digit] of [...prefix].entries()) {
    if (_digit === "-") continue;
    const digit = _digit as Digit;
    layer[digit] ??= { totalChildren: 0 };
    const target = layer[digit];
    const isLast = i === prefix.length - 1;
    if (isLast) {
      target.info ??= [];
      target.info.push(record);
    } else {
      target.totalChildren++;
      target.children ??= {};
      layer = target.children;
    }
  }
}
