import config from "../config";

/** Any value not set is set according to the dataset-specific defaults. */
export interface RuntimeConfiguration {
  /**
   * The identifier of the dataset to display. Also affects the defaults of all the other options.
   * Datasets are defined in config.ts (datasetOptions).
   */
  dataset: string;
  /** If true, when zoomed in, each pixel will have a book-like style applied to it in the shader */
  doBookshelfEffect: boolean;
  /** If true the group/publisher names will be vertical (for zoom levels where the bounding box is vertical) */
  groupTextVertical: boolean;
  /** Each publisher range gets a random unique color. This number, between 0.0-1.0, determines how bright that color is.
   * If 0, the publishers images will not be loaded.
   */
  publishersBrightness: number;
  /**
   * Number from 0.0-10, determines how much the brightness is increased when zoomed out (so sparse data is easier to see).
   * The exact effect depends on the shader (passed as uniform float GLOW)
   */
  shaderGlow: number;
  /** If true, the publisher names are overlaid over their bounding box. */
  showPublisherNames: boolean;
  /** Show a grid to visualize the boundaries of each ISBN digit */
  showGrid: boolean;
  /** How many grid levels to display (1 to 3) */
  gridLevels: number;
  /** Determines how the color is assigned to publishers */
  publishersColorSchema: "dark" | "hsl";
  /** Determines the minimum size at which text of each zoom level is displayed (performance-critical, good values are around 0.04-0.2) */
  textMinZoomLevel: number;
  /** Determines how many text levels are shown simultaneously. Their size depends on textMinZoomLevel. Can be floating number (e.g. 1.5) */
  textLevelCount: number;
  /** Determines the zoom level at which to load the next image level. 1.0 means that when an image tile is magnified 1.0x,
   * the next level is loaded (so in that case images would always be displayed down-scaled or at 1:1 size)
   */
  imgMinZoomLevel: number;
  /** the GLSL fragment shader template snippet to replace the default one with. See shaders.ts for defaults  */
  customShader: string;
  /** The color of the grid as a hex string ("#555544") */
  gridColor: string;
  /** If set, filter out books that were published before this year */
  filterMinimumPublicationYear: number;
  /** If set, filter out books that were published after this year */
  filterMaximumPublicationYear: number;
  /** The index of the color gradient to choose from gradients.png. The meaning of the color scale depends on the dataset. */
  colorGradient: number;

  /** The URL prefix for image tiles (used like `${imagesRoot}/${dataset}/zoom-1/1.png`) */
  imagesRoot: string;
  /** The URL prefix of json files (publishers and stats) */
  jsonRoot: string;
  /** The URL prefix of the json files containing book titles (if any) */
  titlesRoot: string;
}

const defaultDataset = "publication_date";
function isMobile() {
  const minWidth = 768; // Minimum width for desktop devices
  return window.innerWidth < minWidth || screen.width < minWidth;
}
export function defaultRuntimeConfig(dataset: string): RuntimeConfiguration {
  const ds = config.datasetOptions.find((d) => d.id === dataset);
  // on mobile, defaults for performance
  const mobile = {
    textMinZoomLevel: 0.12,
    textLevelCount: 1.66,
    imgMinZoomLevel: 1.8,
  };
  return {
    dataset,
    doBookshelfEffect: true,
    groupTextVertical: true,
    publishersBrightness: 0.5,
    shaderGlow: 5,
    showPublisherNames: true,
    showGrid: true,
    gridLevels: 2,
    publishersColorSchema: "hsl",
    textMinZoomLevel: 0.09,
    textLevelCount: 2,
    imgMinZoomLevel: 1.2,
    customShader: "",
    gridColor: "#555544",
    filterMinimumPublicationYear: -1,
    filterMaximumPublicationYear: -1,
    colorGradient: 6,
    imagesRoot:
      window.origin === "https://phiresky.github.io"
        ? "/isbn-visualization-images/tiled"
        : import.meta.env.BASE_URL + "/images/tiled",
    jsonRoot:
      window.origin === "https://phiresky.github.io"
        ? "/isbn-visualization-json/prefix-data"
        : import.meta.env.BASE_URL + "/prefix-data",
    titlesRoot:
      window.origin === "https://phiresky.github.io" ||
      window.location.hostname === "localhost"
        ? "https://isbn-titles.phiresky.xyz"
        : import.meta.env.BASE_URL + "/title-data",

    ...(isMobile() ? mobile : {}),
    ...ds?.runtimeConfig,
  };
}

export function loadRuntimeConfigFromURL(): RuntimeConfiguration {
  const url = new URLSearchParams(window.location.search);
  const base = defaultRuntimeConfig(
    url.get("dataset") ?? defaultDataset,
  ) as unknown as Record<string, unknown>;
  for (const key in base) {
    const value = url.get(key);
    if (value !== null) {
      if (typeof base[key] === "number") {
        base[key] = parseFloat(value);
      } else if (typeof base[key] === "boolean") {
        base[key] = value === "true";
      } else if (typeof base[key] === "string") {
        base[key] = value;
      } else {
        throw new Error(`Unknown type for ${key}`);
      }
    }
  }
  return base as unknown as RuntimeConfiguration;
}

// set, to url, only values not same as base, taking care of nulls as well
export function saveRuntimeConfigToURL(_config: RuntimeConfiguration) {
  const config = _config as unknown as Record<string, unknown>;
  const base = defaultRuntimeConfig(_config.dataset) as unknown as Record<
    string,
    unknown
  >;
  const url = new URLSearchParams();
  if (_config.dataset !== defaultDataset) {
    url.set("dataset", _config.dataset);
  }
  for (const key in config) {
    if (config[key] !== base[key]) {
      url.set(key, String(config[key]));
    }
  }

  debounceSetUrl(url);
}

function debounce<A>(
  func: (...args: A[]) => void,
  wait: number,
): (...args: A[]) => void {
  let timeout: number;
  return function (this: unknown, ...args: A[]) {
    clearTimeout(timeout);
    timeout = window.setTimeout(() => {
      func.apply(this, args);
    }, wait);
  };
}

const debounceSetUrl = debounce((url: URLSearchParams) => {
  window.history.replaceState({}, "", `?${url.toString()}`);
}, 500);
