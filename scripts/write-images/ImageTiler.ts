import { mkdir } from "fs/promises";
import sharp from "sharp";
import { ImageTile, channelMax } from ".";
import {
  IMG_WIDTH,
  IsbnPrefixWithoutDashes,
  IsbnRelative,
  ProjectionConfig,
  relativeToIsbnPrefix,
  statsConfig,
  totalIsbns,
} from "../../src/lib/util";
import { bookshelfConfig } from "../../src/projections/bookshelf";

export class StatsAggregator {
  statistics = new Map<IsbnPrefixWithoutDashes, Record<string, number>>();

  addStatistic(isbn: IsbnRelative, obj: Record<string, number>) {
    const isbnFull = relativeToIsbnPrefix(isbn);
    for (
      let i = statsConfig.minPrefixLength;
      i <= statsConfig.maxPrefixLength;
      i++
    ) {
      const prefix = isbnFull.slice(0, i) as IsbnPrefixWithoutDashes;
      let stats = this.statistics.get(prefix);
      if (!stats) {
        stats = {};
        this.statistics.set(prefix, stats);
      }
      for (const [key, value] of Object.entries(obj)) {
        stats[key] = (stats[key] || 0) + value;
      }
    }
  }
}
export class ImageTiler {
  images = new Map<number, ImageTile>();
  written = new Set<number>();
  config: ProjectionConfig;
  totalBooksPerPixel: number;
  // only set for first zoom level
  stats?: StatsAggregator;
  postprocessPixels?: (
    img: ImageTile,
    totalBooksPerPixel: number,
  ) => void | Promise<void>;
  constructor(
    private prefixLength: number,
    private tiledDir: string,
  ) {
    const { width, height } =
      prefixLength === 4
        ? { width: 100000, height: 20000 }
        : { width: IMG_WIDTH * Math.sqrt(10 ** (prefixLength - 1)) };
    this.config =
      /* linearConfig({
        scale: Math.sqrt(scale),
        aspectRatio: 5 / 4,
      });*/
      bookshelfConfig({ width, height });

    this.totalBooksPerPixel =
      totalIsbns / this.config.pixelWidth / this.config.pixelHeight;
    console.log(`total books per pixel: ${this.totalBooksPerPixel}`);
  }
  async init() {
    console.log(`Generating ${this.tiledDir}...`);
    await mkdir(this.tiledDir, { recursive: true });
  }
  #getImage(relativeIsbn: number): ImageTile {
    const prefix = Math.floor(relativeIsbn / 10 ** (10 - this.prefixLength));
    const startIsbn = prefix * 10 ** (10 - this.prefixLength);
    const endIsbn = startIsbn + 10 ** (10 - this.prefixLength) - 1;
    const start = this.config.relativeIsbnToCoords(startIsbn as IsbnRelative);
    const end = this.config.relativeIsbnToCoords(endIsbn as IsbnRelative);
    let image = this.images.get(prefix);
    if (this.written.has(prefix))
      throw Error(`tile ${prefix} already finalized`);
    if (!image) {
      const width = Math.ceil(end.x + end.width - start.x);
      const height = Math.ceil(end.y + end.height - start.y);
      image = {
        x: start.x,
        y: start.y,
        width,
        height,
        img: new Float32Array(width * height * 3),
      };
      this.images.set(prefix, image);
    }
    return image;
  }
  colorIsbn(
    relativeIsbn: IsbnRelative,
    color: [number, number, number],
    options: {
      addToPixel: boolean;
      scaleColors: boolean;
      scaleColorByTileScale: boolean;
    } = { addToPixel: true, scaleColorByTileScale: true, scaleColors: true },
  ) {
    const channels = 3;
    const image = this.#getImage(relativeIsbn);
    // const x = Math.floor((position / scale) % dimensions.width);
    // const y = Math.floor(position / scale / dimensions.width);
    // eslint-disable-next-line prefer-const
    let { x, y, width, height } =
      this.config.relativeIsbnToCoords(relativeIsbn);
    x -= image.x;
    y -= image.y;
    // if we are scaling by tile scale, we want to consider pixels that are < 50% filled. If not,
    // we want to only include those >= 50% filled. Since the center of a pixel is at (0.5, 0.5), this means rounding gives us the bound (lower bound inclusive, upper bound exclusive)
    const minX = options.scaleColorByTileScale ? Math.floor(x) : Math.round(x);
    let maxX = options.scaleColorByTileScale
      ? Math.ceil(x + width)
      : Math.round(x + width);
    const minY = options.scaleColorByTileScale ? Math.floor(y) : Math.round(y);
    let maxY = options.scaleColorByTileScale
      ? Math.ceil(y + height)
      : Math.round(y + height);
    // but, if no pixel would be put, put a pixel
    if (minX === maxX) maxX++;
    if (minY === maxY) maxY++;
    for (let xo = minX; xo < maxX; xo++) {
      for (let yo = minY; yo < maxY; yo++) {
        const pixelIndex = (yo * image.width + xo) * channels;
        // we may have some pixels that we only want to fractionally fill
        let scaleColor = options.scaleColors ? channelMax : 1;
        if (options.scaleColorByTileScale) {
          const filWidth = Math.min(x + width, xo + 1) - Math.max(x, xo);
          const filHeight = Math.min(y + height, yo + 1) - Math.max(y, yo);
          scaleColor *= filWidth * filHeight;
        }
        if (options.addToPixel) {
          image.img[pixelIndex] += color[0] * scaleColor;
          image.img[pixelIndex + 1] += color[1] * scaleColor;
          image.img[pixelIndex + 2] += color[2] * scaleColor;
        } else {
          image.img[pixelIndex] = color[0] * scaleColor;
          image.img[pixelIndex + 1] = color[1] * scaleColor;
          image.img[pixelIndex + 2] = color[2] * scaleColor;
        }
      }
    }
  }
  async #writeAndPurgeImage(prefix: number) {
    await this.writeImage(prefix);
    this.images.delete(prefix);
    this.written.add(prefix);
  }
  async writeImage(prefix: number) {
    if (this.written.has(prefix)) throw Error("image already written");
    const image = this.images.get(prefix);
    if (!image) throw Error("no image");
    if (this.postprocessPixels)
      await this.postprocessPixels(image, this.totalBooksPerPixel);
    const img = sharp(image.img, {
      raw: {
        width: image.width,
        height: image.height,
        channels: 3,
        premultiplied: false,
      },
    });
    const paddedPrefix = String(prefix).padStart(this.prefixLength, "0");
    /*const withSubdirs = paddedPrefix
          .replace(/(.{4})/g, "$1/")
          .replace(/\/$/, "");
        if (withSubdirs.includes("/")) {
          await mkdir(dirname(withSubdirs), { recursive: true });
        }*/
    const fname = `${this.tiledDir}/${paddedPrefix}.png`;
    console.log(`writing tile ${fname}`);
    await img.toFile(fname);
    // await new Promise((resolve) => setTimeout(resolve, 1000));
    img.destroy();
  }
  async writeAll() {
    await this.purgeToLength(0);
  }
  async purgeToLength(len: number) {
    while (this.images.size > len) {
      const image = this.images.keys().next();
      if (image.value === undefined) throw Error("impossibor");
      await this.#writeAndPurgeImage(image.value);
    }
  }

  async finish() {
    console.log(`writing ${this.images.size} remaining tiles`);
    await this.writeAll();
    console.log(`wrote ${this.written.size} tiles`);

    console.log("Done.");
  }
}
