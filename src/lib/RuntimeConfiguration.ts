import config from "../config";

export type RuntimeConfiguration = {
  dataset: string;
  doBookshelfEffect: boolean;
  groupTextVertical: boolean;
  publishersBrightness: number;
  shaderGlow: number;
  showPublisherNames: boolean;
  showGrid: boolean;
  publishersColorSchema: "dark" | "hsl";
  textMinZoomLevel: number;
  textLevelCount: number;
  imgMinZoomLevel: number;
  customShader: string;
  gridColor: string;
  filterMinimumPublicationYear: number;
  filterMaximumPublicationYear: number;
  colorGradient: number;
};

const defaultDataset = "publication_date";
export function defaultRuntimeConfig(dataset: string): RuntimeConfiguration {
  const ds = config.datasetOptions.find((d) => d.id === dataset);
  return {
    dataset,
    doBookshelfEffect: true,
    groupTextVertical: true,
    publishersBrightness: 0.6,
    shaderGlow: 5,
    showPublisherNames: true,
    showGrid: true,
    publishersColorSchema: "hsl",
    textMinZoomLevel: 0.08,
    textLevelCount: 2,
    imgMinZoomLevel: 1.2,
    customShader: "",
    gridColor: "#333333",
    filterMinimumPublicationYear: -1,
    filterMaximumPublicationYear: -1,
    colorGradient: 6,
    ...ds?.runtimeConfig,
  };
}

export function loadRuntimeConfigFromURL(): RuntimeConfiguration {
  const url = new URLSearchParams(window.location.search);
  const base = defaultRuntimeConfig(
    url.get("dataset") || defaultDataset
  ) as Record<string, unknown>;
  for (const key in base) {
    const value = url.get(key);
    if (value !== null) {
      if (typeof base[key] === "number") {
        base[key] = parseFloat(value);
      } else if (typeof base[key] === "boolean") {
        base[key] = value === "true";
      } else if (typeof base[key] === "string") {
        base[key] = value as any;
      } else {
        throw new Error(`Unknown type for ${key}`);
      }
    }
  }
  return base as RuntimeConfiguration;
}

// set, to url, only values not same as base, taking care of nulls as well
export function saveRuntimeConfigToURL(_config: RuntimeConfiguration) {
  const config = _config as Record<string, unknown>;
  const base = defaultRuntimeConfig(_config.dataset) as Record<string, unknown>;
  const url = new URLSearchParams();
  if (_config.dataset !== defaultDataset) {
    url.set("dataset", _config.dataset);
  }
  for (const key in config) {
    if (config[key] !== base[key]) {
      url.set(key, config[key] + "");
    }
  }

  debounceSetUrl(url);
}

function debounce<T extends (...args: any[]) => any>(func: T, wait: number): T {
  let timeout: number;
  return function (this: any, ...args: any[]) {
    const context = this;
    clearTimeout(timeout);
    timeout = window.setTimeout(() => func.apply(context, args), wait);
  } as any;
}

const debounceSetUrl = debounce((url: URLSearchParams) => {
  window.history.replaceState({}, "", `?${url.toString()}`);
}, 500);
