declare module "isbn3/lib/calculate_check_digit" {
  export default function calculateCheckDigit(isbn: string): string;
}
declare module "simple-zstd" {
  export function ZSTDDecompress(): NodeJS.ReadableStream &
    NodeJS.WritableStream;
}
