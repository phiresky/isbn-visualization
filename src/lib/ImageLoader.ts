import {
  LinearFilter,
  LinearMipMapLinearFilter,
  MagnificationTextureFilter,
  MinificationTextureFilter,
  NearestFilter,
  Texture,
  TextureLoader,
} from "three";
import { Store } from "./Store";
import { IsbnPrefixRelative } from "./util";
export class ImageLoader {
  path: string;
  loader: TextureLoader = new TextureLoader();
  textures = new Map<IsbnPrefixRelative, Texture>();
  existing: Promise<Set<IsbnPrefixRelative>>;
  hasChildren: Promise<Set<IsbnPrefixRelative>>;
  static maxZoomPrefixLength = 4; // images with nearest zoom have prefix length 4
  minFilter: MinificationTextureFilter = LinearMipMapLinearFilter;
  magFilter: MagnificationTextureFilter = LinearFilter;
  constructor(
    root: string,
    private dataset: string,
    private store: Store,
  ) {
    this.path = `${root}/${dataset}`;
    this.minFilter = dataset === "publishers" ? NearestFilter : NearestFilter;

    this.magFilter = dataset === "publishers" ? NearestFilter : NearestFilter;
    this.existing = store.trackAsyncProgress(
      `${this.path}/written.json`,
      this.loadExisting(),
    );
    this.hasChildren = this.loadHasChildren();
  }
  private async loadExisting() {
    try {
      const res = await fetch(`${this.path}/written.json`);
      const json = (await res.json()) as IsbnPrefixRelative[];
      return new Set(json);
    } catch (cause) {
      throw Error(`Could not load written.json for ${this.dataset}`, { cause });
    }
  }
  private async loadHasChildren() {
    const existing = await this.existing;
    const out = new Set<IsbnPrefixRelative>();
    for (const prefix of existing) {
      for (let i = 1; i < prefix.length; i++) {
        out.add(prefix.slice(0, i) as IsbnPrefixRelative);
      }
    }
    return out;
  }
  async getHasChildren(prefix: IsbnPrefixRelative): Promise<boolean> {
    const hasChildren = await this.hasChildren;
    return hasChildren.has(prefix);
  }
  async getTexture(prefix: IsbnPrefixRelative): Promise<Texture | null> {
    const gotten = this.textures.get(prefix);
    if (gotten) {
      return gotten;
    }
    if (!(await this.existing).has(prefix)) {
      return null;
    }
    try {
      const path = `${this.path}/zoom-${prefix.length}/${prefix}.png`;
      const t = await this.store.trackAsyncProgress(
        `loadTexture(${path})`,
        this.loader.loadAsync(path),
      );
      if (prefix.length === ImageLoader.maxZoomPrefixLength)
        t.magFilter = NearestFilter;
      else t.magFilter = this.magFilter;
      // t.colorSpace = THREE.SRGBColorSpace;
      t.minFilter = this.minFilter;
      this.textures.set(prefix, t);
      return t;
    } catch (e) {
      console.error(e);
      return null;
    }
  }
}
