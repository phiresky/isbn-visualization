import bencode from "bencode";
import { createReadStream } from "node:fs";
import { ZSTDDecompress } from "simple-zstd";
import { IsbnData, ProcessSingleZoom } from "..";
import { IsbnRelative } from "../../../src/lib/util";
import { ImageTiler } from "../ImageTiler";
export const INPUT_FILENAME =
  process.env.INPUT_BENC || `data/aa_isbn13_codes_20241204T185335Z.benc.zst`;

export async function colorImageWithSparseIsbns(
  tiler: ImageTiler,
  packedIsbnsBinary: Uint32Array
): Promise<void> {
  const addcolor = [1, 1, 1] as [number, number, number];

  let position = 0;
  let isbnStreak = true;

  for (const value of packedIsbnsBinary) {
    if (isbnStreak) {
      for (let j = 0; j < value; j++) {
        const isbn = position as IsbnRelative;
        tiler.colorIsbn(isbn, addcolor);
        // tiler.stats?.addStatistic(isbn, { count: 1 });

        position++;
      }
    } else {
      position += value;
      await tiler.purgeToLength(1);
    }

    isbnStreak = !isbnStreak;
  }
}

export async function loadSparseDataToMemory(): Promise<IsbnData> {
  // Read and decompress the input file
  const fileStream = createReadStream(INPUT_FILENAME);
  return new Promise((resolve) => {
    const chunks: Buffer[] = [];
    fileStream
      .pipe(ZSTDDecompress())
      .on("data", (chunk: Buffer) => chunks.push(chunk))
      .on("end", async () => {
        const data = Buffer.concat(chunks);
        const isbnData = bencode.decode(data) as Record<string, Uint8Array>;
        // Convert Uint8Array to Uint32Array
        const isbnData2: IsbnData = {};
        for (const [k, v] of Object.entries(isbnData)) {
          if (v.byteOffset !== 0) {
            throw new Error(
              `packedIsbnsBinaryUint8 must be aligned to 0, is ${v.byteOffset}`
            );
          }
          const packedIsbnsBinary = new Uint32Array(v.buffer);
          isbnData2[k] = packedIsbnsBinary;
        }
        resolve(isbnData2);
      });
  });
}

export default async function singleSparse(
  dataset: string
): Promise<ProcessSingleZoom> {
  const data = await loadSparseDataToMemory();
  const dataa = data[dataset];
  if (!dataa) {
    throw new Error(`dataset ${dataset} not found`);
  }
  return (tiler) => colorImageWithSparseIsbns(tiler, dataa);
}
