import calculateCheckDigit from "isbn3/lib/calculate_check_digit";

export { calculateCheckDigit };

declare const __nominal__type: unique symbol;

export type Nominal<Type, Identifier> = Type & {
  readonly [__nominal__type]: Identifier;
};

export type IsbnPrefixWithDashes = Nominal<string, "IsbnPrefixWithDashes">;

export type IsbnPrefixWithoutDashes = Nominal<
  string,
  "IsbnPrefixWithoutDashes"
>;

/** isbn13 but with the 978/979 prefix removed and a number */
export type IsbnRelative = Nominal<number, "IsbnRelative">;
export type Isbn13Number = Nominal<number, "Isbn13Number">;
export type IsbnStrWithChecksum = Nominal<string, "IsbnStrWithChecksum">;
/** prefix minus start isbn (e.g. prefix 9781 is prefix 01, 9792 is prefix 12) */
export type IsbnPrefixRelative = Nominal<string, "IsbnPrefixRelative">;
export function removeDashes(
  prefix: IsbnPrefixWithDashes
): IsbnPrefixWithoutDashes {
  return prefix.replace(/-/g, "") as IsbnPrefixWithoutDashes;
}

export function isbnPrefixAppend(
  prefix: IsbnPrefixWithDashes,
  suffix: string
): IsbnPrefixWithDashes {
  return (prefix + suffix) as IsbnPrefixWithDashes;
}
export function isbnPrefixToRelative(
  prefix: IsbnPrefixWithoutDashes
): IsbnPrefixRelative {
  return prefix.replace(/^978/, "0").replace(/^979/, "1") as IsbnPrefixRelative;
}
export function isbnPrefixFromRelative(
  prefix: IsbnPrefixRelative
): IsbnPrefixWithoutDashes {
  return prefix
    .replace(/^0/, "978")
    .replace(/^1/, "979") as IsbnPrefixWithoutDashes;
}
export function isbnToRelative(isbn: Isbn13Number): IsbnRelative {
  return (isbn - isbnEANStart) as IsbnRelative;
}
export function relativeToIsbnPrefix(
  relative: IsbnRelative
): IsbnPrefixWithoutDashes {
  return String(relative + isbnEANStart) as IsbnPrefixWithoutDashes;
}
export function relativeToFullIsbn(
  relative: IsbnRelative
): IsbnStrWithChecksum {
  const noCs = String(relative + isbnEANStart);
  return (noCs + calculateCheckDigit(noCs)) as IsbnStrWithChecksum;
}
export function fullIsbnToRelative(isbn: IsbnStrWithChecksum): IsbnRelative {
  return isbnToRelative(+isbn.slice(0, -1) as Isbn13Number);
}
export const isbnEANStart = 978 * 1e9;
export const totalIsbns = 2e9;
export type ProjectionConfig = {
  scale: number;
  totalIsbns: number;
  // imgWidth: number;
  // imgHeight: number;
  pixelWidth: number;
  pixelHeight: number;
  coordsToRelativeIsbn: (
    this: ProjectionConfig,
    x: number,
    y: number
  ) => IsbnRelative;
  relativeIsbnToCoords: (
    this: ProjectionConfig,
    isbnRelative: IsbnRelative
  ) => { x: number; y: number; width: number; height: number };
};

export function firstIsbnInPrefix(
  prefix: IsbnPrefixWithoutDashes
): IsbnRelative {
  return isbnToRelative(+prefix.padEnd(12, "0") as Isbn13Number);
}

export function lastIsbnInPrefix(
  prefix: IsbnPrefixWithoutDashes
): IsbnRelative {
  return isbnToRelative(+prefix.padEnd(12, "9") as Isbn13Number);
}

export function libIsbnToNumber(isbn: ISBN): Isbn13Number {
  if (!isbn.isbn13) throw Error("no isbn");
  return +isbn.isbn13.slice(0, -1).replace(/-/g, "") as Isbn13Number;
}
export const digits = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]; // Constants

export const IMG_WIDTH = 2000;

// https://stackoverflow.com/a/64090995
export function hsl2rgb(
  h: number,
  s: number,
  l: number
): [number, number, number] {
  let a = s * Math.min(l, 1 - l);
  let f = (n: number, k = (n + h / 30) % 12) =>
    l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
  return [f(0), f(8), f(4)];
}
export function siNumber(n: number) {
  const si = ["", "k", "M", "G", "T", "P", "E"];
  const exp = Math.floor(Math.log10(n) / 3);
  const mantissa = n / 10 ** (3 * exp);
  return mantissa.toFixed(0) + si[exp];
}

export const statsConfig = {
  minPrefixLength: 3,
  maxPrefixLength: 7,
};
