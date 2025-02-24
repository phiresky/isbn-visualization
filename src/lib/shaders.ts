import { makeAutoObservable } from "mobx";
import * as THREE from "three";
import { ShaderMaterial } from "three";
import { gradientsPngUrl } from "../components/Legend";
import config from "../config";
import { ImageLoader } from "./ImageLoader";
import { Store } from "./Store";
import { IsbnPrefixRelative, removeDashes } from "./util";

const uniforms = {
  GLOW: "int",
  IS_IMAGE_MAX_ZOOM: "bool",
  DO_BOOKSHELF_EFFECT: "bool",
  CURRENT_ZOOM: "float",
  PUBLISHERS_BRIGHTNESS: "float",
  HIGHLIGHTED_PUBLISHER_ID: "int",
  HIGHLIGHTED_PUBLISHER_PREFIX_LENGTH: "int",
  PUBLISHERS_COLOR_SCHEME: "int",
  MIN_PUBLICATION_YEAR: "int",
  MAX_PUBLICATION_YEAR: "int",
  CHOSEN_COLOR_GRADIENT: "int",

  gradients: "sampler2D",
};
type UniformNames = keyof typeof uniforms;
const makeFragmentShader = (colorFn: string) => `
in vec2 vUv;
// allow up to 6 datasets
uniform sampler2D col1;
uniform sampler2D col2;
uniform sampler2D col3;
uniform sampler2D col4;
uniform sampler2D col5;
uniform sampler2D col6;
uniform sampler2D col7; // dummy data

${Object.entries(uniforms)
  .map(([name, type]) => `uniform ${type} ${name};`)
  .join("\n")}

out vec4 fragColor;

ivec4 getOrigRGB(vec4 c) {
  return ivec4(c * 255.0);
}
// less random but reproducible in JS
float rand(vec2 co){
     // return fract(sin(dot(co, vec2(12.9898, 78.233)))); // fract(length(co) / 1000.0));
    return fract(sin(dot(co, vec2(12.9898, 78.233))) * 2.);
}
// more random
highp float rand2(vec2 co) {
    highp float a = 12.9898;
    highp float b = 78.233;
    highp float c = 43758.5453;
    highp float dt= dot(co.xy, vec2(a,b));
    highp float sn= mod(dt,3.14);
    return fract(sin(sn) * c);
}

float getBookDecoration(vec2 positionWithinPixel, vec2 bookIndex) {
    float pattern = rand2(bookIndex * 2.3);
    float patternScale = 3.0 + rand2(bookIndex * 3.7) * 6.0; // Random scale between 4 and 12
    float pattern2 = rand2(bookIndex * 5.1); // Second pattern selector
    float decoration = 0.0;

    if (positionWithinPixel.y < 0.23) return 0.0;
    
    vec2 patternUV = positionWithinPixel;
    
    if (pattern < 0.25) {
        // Vertical stripes with varying frequency
        decoration = step(0.5, fract(patternUV.y * patternScale));
    } else if (pattern < 0.5) {
        // Diagonal stripes
        float diagonalPos = (patternUV.x + patternUV.y) * patternScale / 2.0;
        decoration = step(0.5, fract(diagonalPos));
    } else if (pattern < 0.75) {
        // Dots with varying size and spacing
        vec2 dotUV = fract(patternUV * patternScale) - 0.5;
        float dotSize = 0.15 + rand2(bookIndex * 7.3) * 0.2;
        decoration = 1.0 - smoothstep(dotSize, dotSize + 0.05, length(dotUV));
    } else {
        // Mixed pattern based on second random value
        if (pattern2 < 0.33) {
            // Checkerboard
            vec2 checkUV = floor(patternUV * patternScale);
            decoration = mod(checkUV.x + checkUV.y, 2.0);
        } else if (pattern2 < 0.66) {
            // Diamond pattern with varying size
            vec2 diamondUV = fract(patternUV * patternScale) - 0.5;
            float diamondSize = 0.2 + rand2(bookIndex * 9.1) * 0.3;
            decoration = 1.0 - smoothstep(diamondSize, diamondSize + 0.05, abs(diamondUV.x) + abs(diamondUV.y));
        } else {
            // Crosshatch
            float hatch1 = step(0.5, fract((patternUV.x - patternUV.y) * patternScale));
            float hatch2 = step(0.5, fract((patternUV.x + patternUV.y) * patternScale));
            decoration = min(hatch1 + hatch2, 1.0);
        }
    }
    
    return decoration;
}

vec4 bookshelfOverlay(vec4 bookColor) {
    if (!DO_BOOKSHELF_EFFECT) return bookColor;
    
    vec2 textureSize = vec2(textureSize($first_dataset, 0));
    vec2 bookIndex = floor(vUv.xy * textureSize);
    vec2 positionWithinPixel = mod(vUv.xy * textureSize, 1.0);
    float bookshelfHeight = 0.03;
    vec4 bookshelfColor = vec4(${config.bookshelfColor});
    
    positionWithinPixel.y -= bookshelfHeight;
    vec4 bgColor = (positionWithinPixel.y < 0.0 ? bookshelfColor : vec4(0.0));
    
    vec2 distanceToEdge = (0.5 - abs(positionWithinPixel - 0.5));
    float minBookWidth = 0.9;
    float maxBookWidth = 0.99;
    float bookWidth = minBookWidth + (maxBookWidth - minBookWidth) * rand(bookIndex);
    
    if (distanceToEdge.x < (1.0 - bookWidth)) return bgColor;
    
    float minBookHeight = 0.8;
    float maxBookHeight = 0.95;
    float bookHeight = minBookHeight + (maxBookHeight - minBookHeight) * rand(bookIndex * 1.2);
    vec2 bookCenter = vec2(0.5, bookHeight / 2.0);
    float stretchy = 1.5;
    
    if (length((positionWithinPixel - bookCenter) * vec2(1.0, stretchy * sqrt(10.0))) > stretchy * 1.6 * bookHeight) 
        return bgColor;
    
    float decoration = getBookDecoration(positionWithinPixel, bookIndex);
    
    // Mix original color with generated color and decoration
    // vec4 cla = min(bookColor, vec4(1.0));
    vec4 decoratedColor = mix(bookColor, bookColor * 0.7, decoration * 0.5);
    
    // Apply edge shading
    return decoratedColor - decoratedColor * (vec4(1.0) * 3.0 * pow(0.5-distanceToEdge.x, 2.0));
}

vec4 bookshelfOverlayDependingOnZoom(vec4 bookColor) {
  if (!IS_IMAGE_MAX_ZOOM) return bookColor;
  float minZoom = 90.0;
  if (CURRENT_ZOOM < 90.0) return bookColor;
  vec4 c1 = bookshelfOverlay(bookColor);
  float maxZoom = minZoom * sqrt(10.0);
  float fadeIn = clamp((CURRENT_ZOOM - minZoom) / (maxZoom - minZoom), 0.0, 1.0);
  return mix(bookColor, c1, fadeIn);
}

float brightnessWithGlow(float brightness) {
  return clamp(brightness * float(2 * GLOW + 1), 0., 1.);
}

vec4 texture2DWithGlow(sampler2D col1, vec2 vUv) {
  vec2 textureSize = vec2(textureSize(col1, 0));
  vec4 books = texture2D(col1, vUv);
  if (IS_IMAGE_MAX_ZOOM && CURRENT_ZOOM > 50.0) return books;
  if (GLOW >= 1) {
    books *= float(GLOW);
    books += texture2D(col1, vUv + vec2(1, 0) / textureSize);
    books += texture2D(col1, vUv + vec2(0, 1) / textureSize);
    books += texture2D(col1, vUv + vec2(-1, 0) / textureSize);
    books += texture2D(col1, vUv + vec2(0, -1) / textureSize);
  }
  if (GLOW >= 2) {
    books *= float(GLOW);
    books += texture2D(col1, vUv + vec2(1, 1) / textureSize);
    books += texture2D(col1, vUv + vec2(-1, 1) / textureSize);
    books += texture2D(col1, vUv + vec2(1, -1) / textureSize);
    books += texture2D(col1, vUv + vec2(-1, -1) / textureSize);
  }
  if (GLOW >= 3) {
    books *= float(GLOW);
    books += texture2D(col1, vUv + vec2(2, 0) / textureSize);
    books += texture2D(col1, vUv + vec2(0, 2) / textureSize);
    books += texture2D(col1, vUv + vec2(-2, 0) / textureSize);
    books += texture2D(col1, vUv + vec2(0, -2) / textureSize);
  }
  return books;
}

vec4 publisherColorDark(int publisherId) {
  if (publisherId == 0) return vec4(0.0);
  float random = rand2(vec2(float((publisherId%256)) * 54.1, float(publisherId) / 15260.1));
  vec4 color1 = vec4(0.396, 0.263, 0.229, 1.);
  vec4 color2 = vec4(0.129, 0.263, 0.396, 1.);
  vec4 pubColor = mix(color1, color2, random);
  return pubColor;
}
vec3 hsv2rgb(vec3 c) {
  vec4 K = vec4(1.0, 2.0 / 3.0, 1.0 / 3.0, 3.0);
  vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);
  return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y);
}

#define PI 3.1415926538
vec4 heatmapColor(float x) {
  // each color is 20 pixels high, so take the middle of that
  float ySize = float(textureSize(gradients, 0).y);
  return texture2D(gradients, vec2(x, (ySize - 10. - float(CHOSEN_COLOR_GRADIENT) * 20.) / ySize));
  // https://stackoverflow.com/questions/28495390/thermal-imaging-palette-table
  // return vec4(sqrt(x), pow(x,3.), (sin(2. * PI * x) >= 0. ? sin(2. * PI * x) : 0.), 1.0);
}

vec4 publisherColorHSL(int publisherId) {
  if (publisherId == 0) return vec4(0.0);
  float random = rand2(vec2(float((publisherId%258)) * 54.1, float(publisherId) / 15260.1));
  return vec4(hsv2rgb(vec3(random, 0.5, 0.5)), 1.0);
}
vec4 withPublisherColor(vec4 bookColor, float publishersBrightness) {
  vec4 pubColorRaw = texture2D($dataset_publishers, vUv);
  ivec4 data = getOrigRGB(pubColorRaw);
  int publisherId = data.r * 65536 + data.g * 256 + data.b;
  vec4 publisherColor = PUBLISHERS_COLOR_SCHEME == 1 ? publisherColorHSL(publisherId) : publisherColorDark(publisherId);
  vec4 color = bookColor + publishersBrightness * publisherColor;
  if (HIGHLIGHTED_PUBLISHER_ID != 0) {
      if (HIGHLIGHTED_PUBLISHER_ID == publisherId) {
      float minZoom = 0.05 * pow(10., float(HIGHLIGHTED_PUBLISHER_PREFIX_LENGTH) / 2.0);
      float maxZoom = minZoom * sqrt(10.0);
      float fadeOut = clamp((CURRENT_ZOOM - minZoom) / (maxZoom - minZoom), 0.4, 1.0);
        return mix(vec4(137.0, 196.0, 244.0, 255.0) / 255., color, fadeOut);
      }
  }
  return color;
}

vec4 filterPublicationRange(vec4 bookColor) {
  if (MIN_PUBLICATION_YEAR == -1 && MAX_PUBLICATION_YEAR == -1) return bookColor;
  ivec4 data = getOrigRGB(texture2D($dataset_publication_date, vUv));
  // zero means no data, 1 means 1801 or before, 255 means 2055 or later
  if (data.r == 0) return vec4(0.);
  int publicationYear = (data.r + 1800);
  if (MIN_PUBLICATION_YEAR != -1 && publicationYear < MIN_PUBLICATION_YEAR) return vec4(0.);
  if (MAX_PUBLICATION_YEAR != -1 && publicationYear > MAX_PUBLICATION_YEAR) return vec4(0.);
  return bookColor;
}

vec4 postprocessColor(vec4 bookColor, float publishersBrightness) {
  return bookshelfOverlayDependingOnZoom(withPublisherColor(filterPublicationRange(bookColor), publishersBrightness));
}

vec4 postprocessColor(vec4 bookColor) {
  return postprocessColor(bookColor, PUBLISHERS_BRIGHTNESS);
}


${colorFn}

void main() {
  fragColor = colorOfPixel(vUv);
}`;

type TypedUniforms = Record<
  UniformNames,
  { value: number | boolean | THREE.Texture }
>;
export class ShaderUtil {
  constructor(private store: Store) {
    makeAutoObservable(this);
  }
  gradientsTexture = new THREE.TextureLoader()
    .loadAsync(gradientsPngUrl)
    .then((t) => {
      t.colorSpace = THREE.NoColorSpace;
      t.magFilter = THREE.LinearFilter;
      t.minFilter = THREE.LinearFilter;
      return t;
    });

  get shaderColorFn() {
    if (this.store.runtimeConfig.customShader) {
      return this.store.runtimeConfig.customShader;
    }
    if (this.store.runtimeConfig.dataset === "all-md5") {
      return `vec4 colorOfPixel(vec2 uv) {
  vec4 present_all = texture2D($dataset_all, uv);
  vec4 present_md5 = texture2D($dataset_md5, uv);

  // vec4 present_gradient = vec4(present_all.x - present_md5.x, present_md5.x + present_all.x * 0.1, present_all.x * 0.1, 1);
  vec4 present_gradient = heatmapColor(present_md5.x / present_all.x) * brightnessWithGlow(present_all.x);
  // add publishers only in background (when brightness of gradient > 0.1);
  float publisherStrength = length(present_gradient) > 1.1 ? 0.0 : PUBLISHERS_BRIGHTNESS;
  return postprocessColor(present_gradient, publisherStrength);
}
`;
    } else if (this.store.runtimeConfig.dataset === "rarity") {
      return `vec4 colorOfPixel(vec2 uv) {
  vec4 data = texture2D($dataset_rarity, uv);
  // create linear gradient between red and green
  vec4 colorRare = vec4(1.0,0.0,0.0,1);
  vec4 colorCommon = vec4(0.0,1.0,0,1);
  // png range 0-255, shader range 0-1
  ivec4 dataOrig = getOrigRGB(data);
  int holdingCount = dataOrig.r;
  int editionCount = dataOrig.g;
  int bookCount = dataOrig.b;
  if (bookCount != 0) {
    float averageHoldingPerBook = float(holdingCount) / float(bookCount);
    // make gradient between 0 (rare) and 1 (common)
    float rarity = clamp(pow(averageHoldingPerBook / 20.0, 2.0), 0., 1.);
    // float presence = max(data.r, max(data.g, data.b)); // since we scale down one of the values when max > 255
    return postprocessColor(heatmapColor(rarity)); // * brightnessWithGlow(presence);
  }
  return postprocessColor(vec4(0.));
}`;
    } else if (this.store.runtimeConfig.dataset === "publication_date") {
      return `vec4 colorOfPixel(vec2 uv) {
  vec4 bookColor = texture2D($dataset_publication_date, uv);
  if (bookColor.r != 0.) {
    float publicationYear = (bookColor.r * 255.) + 1800.; // average publication year in this pixel
    float fillRate = bookColor.b; // 0-100% number of books present
    float minYear = 1985.;
    float maxYear = 2025.;
    float brightness = brightnessWithGlow(fillRate);
    bookColor = heatmapColor(clamp((publicationYear - minYear) / (maxYear - minYear), 0., 1.)) * brightness;
  }
  return postprocessColor(bookColor);
}`;
    } else if (this.store.runtimeConfig.dataset === "publishers") {
      return `
vec4 colorOfPixel(vec2 uv) {
  // 1.0 stands for brightness of publishers = 100%
  return postprocessColor(vec4(0.), 1.0);
}`;
    } else {
      return `vec4 colorOfPixel(vec2 uv) {
  vec4 bookColor = texture2D($dataset_${this.store.runtimeConfig.dataset}, uv);
  return postprocessColor(heatmapColor(bookColor.r));
}`;
    }
  }

  get shaderProgram() {
    const requiredTextures: string[] = [];
    const cfg = this.store.runtimeConfig;
    const fragmentShader = makeFragmentShader(this.shaderColorFn).replace(
      /\$([a-z0-9_]+)/g,
      (_, dataset: string) => {
        if (
          dataset === "dataset_publishers" &&
          cfg.publishersBrightness === 0 &&
          cfg.dataset !== "publishers"
        ) {
          return `col7`; // fake / empty texture
        } else if (
          dataset === "dataset_publication_date" &&
          cfg.dataset !== "publication_date" &&
          cfg.filterMinimumPublicationYear === -1 &&
          cfg.filterMaximumPublicationYear === -1
        ) {
          return `col7`; // fake / empty texture
        } else if (dataset === "first_dataset") {
          return cfg.dataset === "dataset_publishers" ? `col1` : `col2`;
        } else {
          requiredTextures.push(dataset.replace("dataset_", ""));
          return `col${requiredTextures.length}`;
        }
      },
    );
    return { fragmentShader, requiredTextures };
  }

  async getIsbnShaderMaterial(
    prefix: IsbnPrefixRelative,
  ): Promise<{ material: ShaderMaterial; refreshUniforms: () => void } | null> {
    const { requiredTextures, fragmentShader } = this.shaderProgram;
    const textures = await Promise.all(
      requiredTextures.map((d) => this.store.imageLoader(d).getTexture(prefix)),
    );
    const gradientsTexture = await this.gradientsTexture;
    const isMaxZoom = prefix.length >= ImageLoader.maxZoomPrefixLength;

    const material = new ShaderMaterial({
      lights: false,
      uniforms: {
        DO_BOOKSHELF_EFFECT: { value: true },
        CURRENT_ZOOM: { value: 1 },
        IS_IMAGE_MAX_ZOOM: { value: isMaxZoom },
        GLOW: { value: 0 },
        PUBLISHERS_BRIGHTNESS: { value: 0 },
        HIGHLIGHTED_PUBLISHER_ID: { value: 0 },
        HIGHLIGHTED_PUBLISHER_PREFIX_LENGTH: { value: 0 },
        PUBLISHERS_COLOR_SCHEME: { value: 0 },
        gradients: { value: gradientsTexture },
        ...Object.fromEntries(
          textures.map((_, i) => [`col${i + 1}`, { value: textures[i] }]),
        ),
        MIN_PUBLICATION_YEAR: { value: -1 },
        MAX_PUBLICATION_YEAR: { value: -1 },
        CHOSEN_COLOR_GRADIENT: { value: 0 },
      } satisfies TypedUniforms,
      glslVersion: THREE.GLSL3,
      // blending,
      vertexShader: `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`,
      fragmentShader,
    });
    return {
      material,
      refreshUniforms: () => {
        const config = this.store.runtimeConfig;
        const unis = material.uniforms as TypedUniforms;
        // material.uniforms.col1.value = texture1;
        // material.uniforms.col2.value = texture2;
        unis.DO_BOOKSHELF_EFFECT.value = config.doBookshelfEffect;
        unis.CURRENT_ZOOM.value = this.store.floatZoomFactor;
        unis.GLOW.value = config.shaderGlow;
        unis.PUBLISHERS_BRIGHTNESS.value = config.publishersBrightness;
        const publisherInfo =
          this.store.highlightedPublisher?.data?.[1]?.info?.[0];
        unis.HIGHLIGHTED_PUBLISHER_ID.value = publisherInfo?.numericId ?? 0;
        unis.HIGHLIGHTED_PUBLISHER_PREFIX_LENGTH.value = publisherInfo
          ? removeDashes(publisherInfo.prefix).length - 2
          : 0;
        unis.PUBLISHERS_COLOR_SCHEME.value = [undefined, "hsl", "dark"].indexOf(
          config.publishersColorSchema,
        );
        unis.MIN_PUBLICATION_YEAR.value = config.filterMinimumPublicationYear;
        unis.MAX_PUBLICATION_YEAR.value = config.filterMaximumPublicationYear;
        unis.CHOSEN_COLOR_GRADIENT.value = config.colorGradient;
      },
    };
  }
}
