import { IsbnRelative, ProjectionConfig } from "./util";

export type ViewParams = {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  width: number;
  height: number;
};

export type ViewParams2 = ViewParams | "visible" | "invisible";
export function getPlanePosition(
  config: ProjectionConfig,
  isbnStart: IsbnRelative,
  isbnEnd: IsbnRelative
) {
  const { x: xStart, y: yStart } = config.relativeIsbnToCoords(isbnStart);
  const end = config.relativeIsbnToCoords(isbnEnd);
  const xEnd = end.x + end.width;
  const yEnd = end.y + end.height;
  const width = xEnd - xStart;
  const height = yEnd - yStart;

  const position = [xStart + width / 2, -(yStart + height / 2), 0] as [
    number,
    number,
    number
  ];
  return { xStart, yStart, xEnd, yEnd, position, width, height };
}
export function simplifyView(
  view: ViewParams2,
  rect: {
    xStart: number;
    yStart: number;
    xEnd: number;
    yEnd: number;
  }
): ViewParams2 {
  if (view === "visible") return "visible";
  if (view === "invisible") return "invisible";
  if (
    view.minX <= rect.xStart &&
    view.minY <= rect.yStart &&
    view.maxX >= rect.xEnd &&
    view.maxY >= rect.yEnd
  )
    return "visible";
  if (
    rect.xStart >= view.maxX ||
    rect.yStart >= view.maxY ||
    rect.xEnd <= view.minX ||
    rect.yEnd <= view.minY
  )
    return "invisible";
  return view;
}
