import { IsbnRelative, ProjectionConfig, totalIsbns } from "../lib/util";

export function bookshelfConfig({
  width = 1000,
  height,
  swapEvery = true,
  startSwapXy = true,
  gridW = 10,
  gridH = 1,
}: {
  width?: number;
  height?: number;
  swapEvery?: boolean;
  startSwapXy?: boolean;
  gridW?: number;
  gridH?: number;
}): ProjectionConfig {
  const digits = 10;
  /*
  A*B
  C*D

  A/B = C/D
  B = C

  10D = A

  A/C = C/D

  A/C = C/(10A)

  A^2 = (C^2)/10

  A = sqrt(C^2 / 10)

  A = C * sqrt(1/10)

  A = C / sqrt(10)
  */
  height ??= ((totalIsbns / 1e9) * width) / Math.sqrt(gridW);
  const scale = Math.sqrt(totalIsbns / (width * height));
  const startRectWidth = width * (startSwapXy ? gridH : gridW / 2);
  const startRectHeight = height * (startSwapXy ? gridW / 2 : gridH);
  return {
    scale,
    totalIsbns,
    pixelWidth: width,
    pixelHeight: height,
    relativeIsbnToCoords(relativeIsbn: number) {
      const isbnLocal = relativeIsbn.toString().padStart(10, "0");
      const digits = String(isbnLocal);
      let x = 0;
      let y = 0;
      let currentRectWidth = startRectWidth;
      let currentRectHeight = startRectHeight;
      let swapXy = startSwapXy;
      for (const digit of digits) {
        let innerXofs = (+digit % gridW) / gridW;
        let innerYofs = Math.floor(+digit / gridW) / gridH;
        if (swapXy) {
          y += innerXofs * currentRectHeight;
          x += innerYofs * currentRectWidth;
          currentRectWidth /= gridH;
          currentRectHeight /= gridW;
        } else {
          x += innerXofs * currentRectWidth;
          y += innerYofs * currentRectHeight;
          currentRectWidth /= gridW;
          currentRectHeight /= gridH;
        }
        if (swapEvery) swapXy = !swapXy;
      }
      return { x, y, width: currentRectWidth, height: currentRectHeight };
    },
    coordsToRelativeIsbn(x: number, y: number) {
      let currentRectWidth = startRectWidth;
      let currentRectHeight = startRectHeight;
      let swapXy = startSwapXy;
      let isbn = "";
      for (let i = 0; i < digits; i++) {
        if (swapXy) {
          const innerAofs = Math.floor((gridW * y) / currentRectHeight);
          const innerBofs = Math.floor((gridH * x) / currentRectWidth);
          y -= (innerAofs / gridW) * currentRectHeight;
          x -= (innerBofs / gridH) * currentRectWidth;
          currentRectHeight /= gridW;
          currentRectWidth /= gridH;
          isbn += String(innerBofs * gridW + innerAofs);
        } else {
          const innerXofs = Math.floor((gridW * x) / currentRectWidth);
          const innerYofs = Math.floor((gridH * y) / currentRectHeight);
          x -= (innerXofs / gridW) * currentRectWidth;
          y -= (innerYofs / gridH) * currentRectHeight;
          currentRectWidth /= gridW;
          currentRectHeight /= gridH;
          isbn += String(innerYofs * 5 + innerXofs);
        }
        if (swapEvery) swapXy = !swapXy;
      }
      return +isbn as IsbnRelative;
    },
  };
}
