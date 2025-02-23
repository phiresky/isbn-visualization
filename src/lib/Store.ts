import {
  OrbitControlsChangeEvent,
  OrbitControlsProps,
} from "@react-three/drei";
import * as isbnlib from "isbn3";
import { autorun, makeAutoObservable, observable, runInAction } from "mobx";
import { createTransformer } from "mobx-utils";
import { Camera, OrthographicCamera, Vector3, Vector3Like } from "three";
import config from "../config";
import { DetailLevelObservable } from "./DetailLevelObservable";
import { plotSmartTrajectory, Point3D } from "./flight";
import { GoogleBooksItem, googleBooksQueryIsbn } from "./google-books";
import { ImageLoader } from "./ImageLoader";
import { LazyPrefixInfo } from "./info-map";
import { getGroupHierarchy, LazyPrefixInfoWithParents } from "./prefix-data";
import {
  defaultRuntimeConfig,
  loadRuntimeConfigFromURL,
  RuntimeConfiguration,
  saveRuntimeConfigToURL,
} from "./RuntimeConfiguration";
import { ShaderUtil } from "./shaders";
import { StatsCalculator } from "./stats";
import { TitleFetcher } from "./TitleFetcher";
import {
  firstIsbnInPrefix,
  fullIsbnToRelative,
  isbnPrefixToRelative,
  IsbnPrefixWithoutDashes,
  IsbnRelative,
  IsbnStrWithChecksum,
  lastIsbnInPrefix,
  ProjectionConfig,
  relativeToFullIsbn,
  relativeToIsbnPrefix,
  statsConfig,
} from "./util";
import { ViewParams } from "./view-utils";

type RarityInfo = {
  holdingCount: number;
  editionCount: number;
  bookCount: number;
};
export class Store {
  view: ViewParams;
  camera?: OrthographicCamera;
  orbitControls?: OrbitControlsProps["ref"] | null = null;
  statsCalculator = new StatsCalculator();
  minimapHoveredCell: string | null = null;

  highlightedIsbn:
    | { type: "todo" }
    | {
        type: "done";
        isbn: IsbnStrWithChecksum;
        obj: ISBN | null;
        relative: IsbnRelative;
        groupInfo: LazyPrefixInfo[];
        googleBookDetails: GoogleBooksItem | null | "todo";
        rarity: RarityInfo | null;
      } = {
    type: "todo",
  };
  #imageLoader: Map<string, ImageLoader> = new Map();
  rootPrefixInfo: LazyPrefixInfo = {
    children: { lazy: "root.json" },
    totalChildren: 0,
  };

  bookDetails = new Map<IsbnStrWithChecksum, GoogleBooksItem | null>();
  projection: ProjectionConfig;
  externalSearchEngines: { name: string; url: string }[] = [];
  shaderUtil = new ShaderUtil(this);
  animationRequestId: number = 0;
  runtimeConfig: RuntimeConfiguration;

  /** numeric id of publisher to highlight */
  highlightedPublisher: {
    relative: IsbnRelative;
    obj: ISBN | null;
    data: LazyPrefixInfo[] | null;
  } | null = null;
  highlightedStats: {
    prefixStart: IsbnPrefixWithoutDashes;
    prefixEnd: IsbnPrefixWithoutDashes;
  } | null = null;
  resetZoomButton: boolean = false;
  shaderError = "";
  titleFetcher = new TitleFetcher(this);
  constructor(projectionConfig: ProjectionConfig) {
    this.projection = projectionConfig;
    this.runtimeConfig = loadRuntimeConfigFromURL();
    makeAutoObservable(this, {
      view: observable.deep,
      rootPrefixInfo: observable.shallow,
      highlightedIsbn: observable.shallow,
      orbitControls: false,
      animationRequestId: false,
      highlightedPublisher: observable.shallow,
    });
    this.view = {
      minX: 0,
      minY: 0,
      maxX: this.projection.pixelWidth,
      maxY: this.projection.pixelHeight,
      width: this.projection.pixelWidth,
      height: this.projection.pixelHeight,
    };
    const params = new URLSearchParams(window.location.search);
    this.addExternalSearchEngines(params);
    autorun(() => saveRuntimeConfigToURL(this.runtimeConfig));
  }
  get floatZoomFactor() {
    return this.projection.pixelWidth / this.view.width;
  }
  addExternalSearchEngines(params: URLSearchParams) {
    this.externalSearchEngines.push(...config.externalSearchEngines);
    const searchEngines = params.getAll("external");
    for (const engine of searchEngines) {
      const [name, url] = [
        engine.slice(0, engine.indexOf(":")),
        engine.slice(engine.indexOf(":") + 1),
      ];

      this.externalSearchEngines.push({ name, url });
    }
  }
  getDetailLevel = createTransformer(
    (prefix: IsbnPrefixWithoutDashes) => new DetailLevelObservable(this, prefix)
  );
  imageLoader(dataset: string) {
    let l = this.#imageLoader.get(dataset);
    if (!l) {
      l = new ImageLoader(config.imagesRoot, dataset, this);
      this.#imageLoader.set(dataset, l);
    }
    return l;
  }
  async getBookDetail(isbn: IsbnStrWithChecksum) {
    const b = this.bookDetails.get(isbn);
    if (b) return b;
    const r = await this.googleBooksQueryIsbn(isbn);
    this.bookDetails.set(isbn, r);
    return r;
  }

  cachedGoogleBooks: Map<IsbnStrWithChecksum, GoogleBooksItem | null> =
    new Map();
  async googleBooksQueryIsbn(isbn: IsbnStrWithChecksum) {
    const cached = this.cachedGoogleBooks.get(isbn);
    if (cached) return Promise.resolve(cached);
    const result = await this.trackAsyncProgress(
      `googleBooksQuery(${isbn})`,
      googleBooksQueryIsbn(isbn)
    );
    this.cachedGoogleBooks.set(isbn, result);
    return result;
  }

  updateHighlight(x: number, y: number, isHover: boolean) {
    const relativeIsbn = this.projection.coordsToRelativeIsbn(x, y);
    if (isHover) {
      this.updateHighlightedPublisher(relativeIsbn);
    } else {
      this.updateHighlightedIsbn(
        relativeToFullIsbn(relativeIsbn),
        relativeIsbn
      );
    }
  }
  updateHighlightedPublisher(relativeIsbn: IsbnRelative) {
    const isbnStr = relativeToIsbnPrefix(relativeIsbn);
    const groupInfo = getGroupHierarchy(this.rootPrefixInfo, isbnStr);
    const isbnInst = isbnlib.parse(relativeToFullIsbn(relativeIsbn));
    const oldOne = this.highlightedPublisher?.relative;
    this.highlightedPublisher = {
      relative: relativeIsbn,
      obj: isbnInst,
      data: null,
    };
    if (typeof groupInfo === "function") {
      this.highlightedPublisher.data = (
        getGroupHierarchy(
          this.rootPrefixInfo,
          isbnStr,
          false
        ) as LazyPrefixInfoWithParents
      ).outers;

      //groupInfo().then((info) => (this.highlightedGroupInfo = info.outers));
      if (oldOne !== relativeIsbn)
        this.debounceFetchGroupData(() =>
          groupInfo().then((info) => {
            if (this.highlightedPublisher)
              this.highlightedPublisher.data = info.outers;
          })
        );
    } else {
      this.highlightedPublisher.data = groupInfo.outers;
    }
  }

  updateHighlightedStats(x: number, y: number, mode: "start" | "end") {
    const relativeIsbn = this.projection.coordsToRelativeIsbn(x, y);
    const prefix = relativeToIsbnPrefix(relativeIsbn).slice(
      0,
      statsConfig.maxPrefixLength
    ) as IsbnPrefixWithoutDashes;
    if (!this.highlightedStats || mode === "start")
      this.highlightedStats = { prefixStart: prefix, prefixEnd: prefix };
    else this.highlightedStats.prefixEnd = prefix;
  }
  inProgress = new Map<string, string | null>();
  trackAsyncProgress<T>(_id: string, p: Promise<T>) {
    let id = _id;
    let copy = 1;
    while (this.inProgress.has(id)) id = _id + " " + ++copy;
    runInAction(() => this.inProgress.set(id, null));
    //console.time(id);
    p.then(() => {
      this.inProgress.delete(id);
      //console.timeEnd(id);
    });
    p.catch((e) => {
      this.inProgress.set(id, e);
      console.timeEnd(id);
      console.warn(id, "ERROR", e);
    });
    return p;
  }
  updateHighlightedIsbn(
    fullIsbn: IsbnStrWithChecksum,
    relativeIsbn?: IsbnRelative
  ) {
    if (!relativeIsbn) relativeIsbn = fullIsbnToRelative(fullIsbn);
    const isbnStr = relativeToIsbnPrefix(relativeIsbn);
    // getGroup(store, prefix)
    const isbnInst = isbnlib.parse(fullIsbn);
    if (
      this.highlightedIsbn.type !== "todo" &&
      this.highlightedIsbn.relative &&
      this.highlightedIsbn.relative === relativeIsbn
    )
      return;
    this.highlightedIsbn = {
      type: "done",
      relative: relativeIsbn,
      isbn: fullIsbn,
      obj: isbnInst,
      groupInfo: [],
      googleBookDetails: "todo",
      rarity: null,
    };
    const groupInfo = getGroupHierarchy(this.rootPrefixInfo, isbnStr);
    if (typeof groupInfo === "function") {
      this.highlightedIsbn.groupInfo = (
        getGroupHierarchy(
          this.rootPrefixInfo,
          isbnStr,
          false
        ) as LazyPrefixInfoWithParents
      ).outers;
      //groupInfo().then((info) => (this.highlightedGroupInfo = info.outers));
      this.debounceFetchGroupData(() =>
        groupInfo().then((info) => {
          if (this.highlightedIsbn.type === "done")
            this.highlightedIsbn.groupInfo = info.outers;
        })
      );
    } else {
      this.highlightedIsbn.groupInfo = groupInfo.outers;
    }
    if (this.highlightedIsbn.groupInfo.length > 0) {
      (async () => {
        const detail = await this.getBookDetail(fullIsbn);
        if (
          this.highlightedIsbn.type === "done" &&
          this.highlightedIsbn.relative === relativeIsbn
        )
          this.highlightedIsbn.googleBookDetails = detail;
      })();
      (async () => {
        const rarity = await this.getRarityOfIsbn(relativeIsbn);
        if (
          this.highlightedIsbn.type === "done" &&
          this.highlightedIsbn.relative === relativeIsbn
        )
          this.highlightedIsbn.rarity = rarity;
      })();
    } else {
      this.highlightedIsbn.googleBookDetails = null;
    }
  }
  debounceFetchGroupDataTimeout: ReturnType<typeof setTimeout> | null = null;
  // call newFunction only after 1s of inactivity
  debounceFetchGroupData(newFunction: () => Promise<void>) {
    if (this.debounceFetchGroupDataTimeout) {
      clearTimeout(this.debounceFetchGroupDataTimeout);
    }
    this.debounceFetchGroupDataTimeout = setTimeout(() => {
      this.trackAsyncProgress("highlightGroupInfo", newFunction());
    }, 500);
  }
  updateView(e?: OrbitControlsChangeEvent) {
    if (!e) return;
    const camera = (e as any).target.object as Camera;
    const topLeft = new Vector3(-1, -1, 0).unproject(camera);
    const bottomRight = new Vector3(1, 1, 0).unproject(camera);
    const minX = topLeft.x + this.projection.pixelWidth / 2;
    const maxX = bottomRight.x + this.projection.pixelWidth / 2;
    const minY = -(bottomRight.y - this.projection.pixelHeight / 2);
    const maxY = -(topLeft.y - this.projection.pixelHeight / 2);
    const view = {
      minX,
      maxX,
      minY,
      maxY,
      width: +(maxX - minX).toFixed(8),
      height: +(maxY - minY).toFixed(8),
    };
    this.resetZoomButton = true;
    Object.assign(this.view, view);
  }
  zoomAnimateToHighlight() {
    if (this.highlightedIsbn.type !== "done") return;
    const { x, y, width, height } = this.projection.relativeIsbnToCoords(
      this.highlightedIsbn.relative
    );
    const targetX = x + width / 2;
    const targetY = y + (height * 3) / 4;
    this.zoomAnimateTo(targetX, targetY, 14000, 7);
  }
  setView(targetX: number, targetY: number) {
    targetX -= this.projection.pixelWidth / 2;
    targetY = this.projection.pixelHeight / 2 - targetY;
    const camera = this.camera!;
    camera.position.x = targetX;
    camera.position.y = targetY;
    // if (position.zoom) camera.zoom = position.zoom;
    this.orbitControls.target.x = camera.position.x;
    this.orbitControls.target.y = camera.position.y;
    camera.updateProjectionMatrix();
  }
  zoomAnimateTo(
    targetX: number,
    targetY: number,
    targetZoom: number,
    timeScale: number
  ) {
    targetX -= this.projection.pixelWidth / 2;
    targetY = this.projection.pixelHeight / 2 - targetY;
    const camera = this.camera;
    if (!camera) return;
    const orbitControls = this.orbitControls;
    if (!orbitControls) return;
    const orig = { ...camera.position };
    const origZoom = camera.zoom;
    const maxZoom = 1; // maxZoom = distance 1. 1/2 * maxZoom = distance 2 => maxZoom/n = distance n;
    const from = new Point3D(orig.x, orig.y, maxZoom / camera.zoom);
    const to = new Point3D(targetX, targetY, maxZoom / targetZoom);
    console.log("xyz space", {
      from,
      to,
    });
    const setPosition = (position: Vector3Like) => {
      camera.position.x = position.x;
      camera.position.y = position.y;
      camera.zoom = maxZoom / position.z;
      this.orbitControls.target.x = camera.position.x;
      this.orbitControls.target.y = camera.position.y;
      camera.updateProjectionMatrix();
    };
    //const trajectory = getTrajectoryReal2(from, to);
    const trajectory = plotSmartTrajectory(from, to);
    console.log("trajectory xyz", trajectory);
    // lerp each segment in trajectory using it's given length
    const start = performance.now() / timeScale;
    const animate = () => {
      const now = performance.now() / timeScale;
      const time = now - start;
      setPosition(trajectory.position(time));
      if (time < trajectory.duration) {
        this.animationRequestId = requestAnimationFrame(animate);
      }
    };
    animate();
  }

  async getRarityOfIsbn(isbn: IsbnRelative): Promise<RarityInfo | null> {
    const imgPrefix = relativeToIsbnPrefix(isbn).slice(
      0,
      2 + 4
    ) as IsbnPrefixWithoutDashes;

    const img = await this.imageLoader("rarity").getTexture(
      isbnPrefixToRelative(imgPrefix)
    );
    if (!img) return null;
    const imgElement = img.image as HTMLImageElement;
    if (!imgElement) throw Error("no image element");
    const imgPos = this.projection.relativeIsbnToCoords(
      firstIsbnInPrefix(imgPrefix)
    );
    const imgPosEnd = this.projection.relativeIsbnToCoords(
      lastIsbnInPrefix(imgPrefix)
    );
    const pos = this.projection.relativeIsbnToCoords(isbn);
    const canvas = new OffscreenCanvas(1, 1);
    const ctx = canvas.getContext("2d")!;
    const xInImg = Math.round(
      ((pos.x - imgPos.x) / (imgPosEnd.x + imgPosEnd.width - imgPos.x)) *
        imgElement.width
    );
    const yInImg = Math.round(
      ((pos.y - imgPos.y) / (imgPosEnd.y + imgPosEnd.height - imgPos.y)) *
        imgElement.height
    );
    ctx.drawImage(imgElement, xInImg, yInImg, 1, 1, 0, 0, 1, 1);
    const imgData = ctx.getImageData(0, 0, 1, 1);
    console.log({ ctx, imgElement, imgData, pos, imgPos, xInImg, yInImg });
    return {
      holdingCount: imgData.data[0],
      editionCount: imgData.data[1],
      bookCount: imgData.data[2],
    };
  }
  get currentDataset() {
    const d = config.datasetOptions.find(
      (g) => g.id === this.runtimeConfig.dataset
    );
    if (!d) throw Error("dataset not found");
    return d;
  }

  switchDataset(dataset: string, resetSettings: boolean) {
    const d = config.datasetOptions.find((d) => d.id === dataset);
    if (!d) throw Error("dataset not found");
    this.inProgress.clear();
    if (resetSettings) {
      this.runtimeConfig = defaultRuntimeConfig(d.id);
    } else {
      this.runtimeConfig.dataset = d.id;
    }
  }
}
