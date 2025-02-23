import { computed, makeObservable } from "mobx";
import { Store } from "./Store";
import {
  IMG_WIDTH,
  IsbnPrefixWithoutDashes,
  IsbnRelative,
  firstIsbnInPrefix,
  lastIsbnInPrefix,
} from "./util";
import { getPlanePosition, simplifyView } from "./view-utils";

const minPrefixLength = 3; // 978-, 979
const maxPrefixLength = 11;

export class DetailLevelObservable {
  planePosition: ReturnType<typeof getPlanePosition>;
  rect: { xStart: number; xEnd: number; yStart: number; yEnd: number };
  isbnStart: IsbnRelative;
  isbnEnd: IsbnRelative;
  parent: DetailLevelObservable | null = null;
  constructor(private store: Store, private prefix: IsbnPrefixWithoutDashes) {
    makeObservable(this, {
      viewVisible: computed,
      container: computed,
      textOpacity: computed,
      textChildren: computed,
      imageChildren: computed,
      image: computed,
    });
    this.parent =
      prefix.length > 2
        ? store.getDetailLevel(prefix.slice(0, -1) as IsbnPrefixWithoutDashes)
        : null;
    this.isbnStart = firstIsbnInPrefix(prefix);
    this.isbnEnd = lastIsbnInPrefix(prefix);

    this.planePosition = getPlanePosition(
      store.projection,
      this.isbnStart,
      this.isbnEnd
    );
    this.rect = this.planePosition;
  }
  get viewVisible() {
    if (this.parent?.viewVisible === "invisible") return "invisible";
    if (this.parent?.viewVisible === "visible") return "visible";
    const v = simplifyView(this.store.view, this.rect);
    return v;
  }
  get container() {
    // return this.prefix.length < 8;
    // console.log("update container", this.prefix);
    if (this.viewVisible === "invisible") return false;
    return true;
  }
  get textOpacity() {
    const innermost = this.prefix.length === maxPrefixLength;
    const outermost = this.prefix.length === minPrefixLength;
    const textSwitchLevel = this.store.runtimeConfig.textMinZoomLevel;
    const textSwitchLevelFull = textSwitchLevel * 1.5 - textSwitchLevel;
    const opa1 = outermost
      ? 1
      : Math.max(
          0,
          Math.min(
            1,
            (getScale(this.rect, this.store, 0) - textSwitchLevel) /
              textSwitchLevelFull
          )
        );
    // show 2 levels at the same time
    const showLevels = this.store.runtimeConfig.textLevelCount;
    const opa2 = innermost
      ? 1
      : Math.max(
          0,
          Math.min(
            1,
            1 -
              (getScale(this.rect, this.store, -showLevels) - textSwitchLevel) /
                textSwitchLevelFull
          )
        );
    return Math.min(opa1, opa2);
  }
  get textChildren() {
    const outermost = this.prefix.length === minPrefixLength;
    return (
      this.prefix.length <= maxPrefixLength &&
      (outermost ||
        getScale(this.rect, this.store, -1) >=
          this.store.runtimeConfig.textMinZoomLevel)
    );
  }

  #imageRelativeLevel(relativeLevel: number) {
    if (this.viewVisible === "invisible") return false;
    if (this.prefix.length === minPrefixLength) return true;
    const nextLargerImgScale = getScale(
      this.rect,
      this.store,
      relativeLevel + 1
    );
    return (
      this.prefix.length <= 6 &&
      nextLargerImgScale >= this.store.runtimeConfig.imgMinZoomLevel
    );
  }

  get image() {
    return this.#imageRelativeLevel(0);
  }
  get imageChildren() {
    return this.#imageRelativeLevel(-1);
  }
}
export interface DetailLevel {
  container: boolean;
  text: boolean;
  children: boolean;
}
export function getScale(
  rect: { xEnd: number; xStart: number; yEnd: number; yStart: number },
  store: Store,
  relativeLevel: number
) {
  const imgWidthInPixels = (rect.xEnd - rect.xStart) * store.floatZoomFactor;
  const isVertical = rect.xEnd - rect.xStart < rect.yEnd - rect.yStart;
  const imgScale =
    imgWidthInPixels / (isVertical ? IMG_WIDTH / Math.sqrt(10) : IMG_WIDTH);
  const nextImgScale = imgScale * 10 ** (relativeLevel / 2);
  return nextImgScale;
}
