import { IsbnRelative, ProjectionConfig, totalIsbns } from "../lib/util";

export function linearConfig({
  scale = 50,
  aspectRatio = 5 / 4,
}: {
  scale?: number;
  aspectRatio?: number;
}): ProjectionConfig {
  const imgWidth = Math.sqrt(totalIsbns * aspectRatio);
  if (imgWidth !== (imgWidth | 0)) throw Error("not divisible");
  const imgHeight = imgWidth / aspectRatio;
  const pixelWidth = imgWidth / scale;
  const pixelHeight = imgHeight / scale;

  const config: ProjectionConfig = {
    scale,
    totalIsbns,
    pixelWidth,
    pixelHeight,
    coordsToRelativeIsbn(x: number, y: number) {
      const isbn =
        Math.floor((x / config.pixelWidth) * imgWidth) +
        Math.floor((y / config.pixelHeight) * imgHeight) * imgWidth;
      return isbn as IsbnRelative;
    },
    relativeIsbnToCoords(isbnLocal: number) {
      if (imgWidth !== (imgWidth | 0)) throw Error("not divisible");
      const x = Math.floor((isbnLocal / scale / scale) % pixelWidth);
      const y = Math.floor(isbnLocal / scale / scale / pixelWidth);
      return {
        x,
        y,
        width: pixelWidth / imgWidth,
        height: pixelWidth / imgWidth,
      };
      /*
      const x = isbnLocal % imgWidth;
      const y = Math.floor(isbnLocal / imgWidth);
      return {
        x: (x * pixelWidth) / imgWidth,
        y: (y * pixelHeight) / imgHeight,
        width: pixelWidth / imgWidth,
        height: pixelHeight / imgHeight,
      };*/
    },
  };
  return config;
}
