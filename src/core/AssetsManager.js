import { Assets, Rectangle, Texture } from "pixi.js";

/**
 * @typedef {object} SpritesheetAnimationOptions
 * @property {number} [columns] Number of columns in spritesheet grid.
 * @property {number} [rows] Number of rows in spritesheet grid.
 * @property {number} [frameWidth] Width of one frame in pixels.
 * @property {number} [frameHeight] Height of one frame in pixels.
 * @property {number} [startFrame=0] Starting frame index in row-major order.
 * @property {number} [frames] Number of frames to extract.
 * @property {string} [frameKeyPrefix] Prefix for generated frame texture keys.
 */

export class AssetsManager {
  #textures = new Map();
  #animations = new Map();
  #inFlightLoads = new Map();
  #inFlightAnimations = new Map();

  #isCanvasImageSource(value) {
    if (!value) return false;
    if (typeof ImageBitmap !== "undefined" && value instanceof ImageBitmap) return true;
    if (typeof OffscreenCanvas !== "undefined" && value instanceof OffscreenCanvas) return true;
    if (typeof HTMLCanvasElement !== "undefined" && value instanceof HTMLCanvasElement) return true;
    if (typeof HTMLImageElement !== "undefined" && value instanceof HTMLImageElement) return true;
    if (typeof SVGImageElement !== "undefined" && value instanceof SVGImageElement) return true;
    if (typeof HTMLVideoElement !== "undefined" && value instanceof HTMLVideoElement) return true;
    if (typeof VideoFrame !== "undefined" && value instanceof VideoFrame) return true;
    if (typeof CSSImageValue !== "undefined" && value instanceof CSSImageValue) return true;
    return false;
  }

  /**
   * Loaded textures keyed by texture key.
   *
   * @returns {Map<string, import("pixi.js").Texture>}
   */
  get textures() {
    return this.#textures;
  }

  /**
   * Registered animations keyed by animation key.
   *
   * @returns {Map<string, import("pixi.js").Texture[]>}
   */
  get animations() {
    return this.#animations;
  }

  #getTextureSourceElement(texture) {
    const candidates = [
      texture?.source?.resource?.source,
      texture?.source?.source,
      texture?.source?.resource,
      texture?.source?.resource?.source?.source,
      texture?.source?.resource?.resource?.source,
    ];
    return candidates.find((candidate) => this.#isCanvasImageSource(candidate)) ?? null;
  }

  #createCanvas(width, height) {
    if (typeof OffscreenCanvas !== "undefined") {
      return new OffscreenCanvas(width, height);
    }
    if (typeof document !== "undefined") {
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      return canvas;
    }
    return null;
  }

  #findTextureKeyByTexture(texture) {
    for (const [textureKey, registeredTexture] of this.#textures.entries()) {
      if (registeredTexture === texture) {
        return textureKey;
      }
    }
    return null;
  }

  /**
   * Loads texture from URL and registers it in `textures` map.
   *
   * @param {string} key Texture key.
   * @param {string} url Texture URL/path loadable by Pixi Assets.
   * @returns {Promise<import("pixi.js").Texture | null>}
   */
  async addTextureFromUrl(key, url) {
    if (!key || !url) return null;
    if (this.#textures.has(key)) return this.#textures.get(key);
    if (this.#inFlightLoads.has(key)) return this.#inFlightLoads.get(key);

    const loadPromise = Assets.load(url)
      .then((texture) => {
        texture.source.scaleMode = "nearest";
        this.#textures.set(key, texture);
        return texture;
      })
      .finally(() => {
        this.#inFlightLoads.delete(key);
      });

    this.#inFlightLoads.set(key, loadPromise);
    return loadPromise;
  }

  /**
   * Unregisters and destroys a texture by key.
   * Also removes animations that reference this texture.
   *
   * @param {string} key Texture key to unload.
   * @returns {Promise<void>}
   */
  async unloadTexture(key) {
    if (!key) return;
    const texture = this.#textures.get(key) ?? null;
    this.#textures.delete(key);
    this.#inFlightLoads.delete(key);

    if (texture) {
      for (const [animationKey, animationTextures] of this.#animations.entries()) {
        if (Array.isArray(animationTextures) && animationTextures.includes(texture)) {
          this.#animations.delete(animationKey);
        }
      }
    }

    if (texture && !texture.destroyed) {
      texture.destroy(true);
    }
  }

  /**
   * Registers animation from already loaded texture keys.
   * Throws if any key is missing.
   *
   * @param {string} key Animation key in the `animations` map.
   * @param {string[]} [textureKeys=[]] Ordered texture keys to compose animation.
   * @returns {void}
   */
  addAnimationFromTextures(key, textureKeys = []) {
    if (!key || !Array.isArray(textureKeys)) return;

    const textures = [];

    for (const textureKey of textureKeys) {
      if (!this.#textures.has(textureKey)) {
        throw new Error(`Missing texture for animation "${key}": ${textureKey}`);
      }
      textures.push(this.#textures.get(textureKey));
    }

    this.#animations.set(key, textures);
  }

  /**
   * Loads a spritesheet, slices it into frame textures and registers them as an animation.
   *
   * @param {string} key Animation key in the `animations` map.
   * @param {string} url Spritesheet URL/path loadable by Pixi Assets.
   * @param {SpritesheetAnimationOptions} [options={}] Slicing and key-generation options.
   * @returns {Promise<void>}
   */
  async addAnimationFromSpritesheet(key, url, options = {}) {
    if (!key || !url) return;
    if (this.#animations.has(key)) return;
    if (this.#inFlightAnimations.has(key)) return this.#inFlightAnimations.get(key);

    const loadPromise = (async () => {
      const spritesheetTexture = await Assets.load(url);
      spritesheetTexture.source.scaleMode = "nearest";

      const columns = Number.isFinite(options.columns) ? Math.max(1, Math.floor(options.columns)) : null;
      const rows = Number.isFinite(options.rows) ? Math.max(1, Math.floor(options.rows)) : null;
      const frameWidth = Number.isFinite(options.frameWidth)
        ? Math.max(1, Math.floor(options.frameWidth))
        : (columns ? Math.max(1, Math.floor(spritesheetTexture.width / columns)) : null);
      const frameHeight = Number.isFinite(options.frameHeight)
        ? Math.max(1, Math.floor(options.frameHeight))
        : (rows ? Math.max(1, Math.floor(spritesheetTexture.height / rows)) : null);

      if (!frameWidth || !frameHeight) {
        throw new Error("addAnimationFromSpritesheet requires frameWidth/frameHeight or columns/rows");
      }

      const maxColumns = Math.max(1, Math.floor(spritesheetTexture.width / frameWidth));
      const maxRows = Math.max(1, Math.floor(spritesheetTexture.height / frameHeight));
      const maxFrames = maxColumns * maxRows;
      const startFrame = Number.isFinite(options.startFrame) ? Math.max(0, Math.floor(options.startFrame)) : 0;
      const requestedFrames = Number.isFinite(options.frames)
        ? Math.max(0, Math.floor(options.frames))
        : (maxFrames - startFrame);
      const frameCount = Math.max(0, Math.min(requestedFrames, maxFrames - startFrame));
      const animationTextures = [];
      const frameKeyPrefix = options.frameKeyPrefix ?? `${key}:`;

      for (let frameOffset = 0; frameOffset < frameCount; frameOffset += 1) {
        const frameIndex = startFrame + frameOffset;
        const frameColumn = frameIndex % maxColumns;
        const frameRow = Math.floor(frameIndex / maxColumns);
        const frame = new Rectangle(
          frameColumn * frameWidth,
          frameRow * frameHeight,
          frameWidth,
          frameHeight,
        );
        const frameTexture = new Texture({
          source: spritesheetTexture.source,
          frame,
        });
        frameTexture.source.scaleMode = "nearest";
        const frameKey = `${frameKeyPrefix}${frameOffset}`;
        this.#textures.set(frameKey, frameTexture);
        animationTextures.push(frameTexture);
      }

      this.#animations.set(key, animationTextures);
    })().finally(() => {
      this.#inFlightAnimations.delete(key);
    });

    this.#inFlightAnimations.set(key, loadPromise);
    return loadPromise;
  }

  /**
   * Creates a horizontally flipped copy of an already loaded texture.
   *
   * @param {string} originalKey Existing source texture key.
   * @param {string} newKey New key for flipped texture.
   * @returns {import("pixi.js").Texture | null}
   */
  addFlippedTexture(originalKey, newKey) {
    if (!originalKey || !newKey) return null;
    if (this.#textures.has(newKey)) return this.#textures.get(newKey);

    const originalTexture = this.#textures.get(originalKey);
    if (!originalTexture) return null;

    const sourceElement = this.#getTextureSourceElement(originalTexture);
    if (!sourceElement) return null;
    let drawableSource = sourceElement;

    if (typeof ImageData !== "undefined" && sourceElement instanceof ImageData) {
      const imageDataCanvas = this.#createCanvas(sourceElement.width, sourceElement.height);
      const imageDataContext = imageDataCanvas?.getContext?.("2d") ?? null;
      if (!imageDataCanvas || !imageDataContext) return null;
      imageDataContext.putImageData(sourceElement, 0, 0);
      drawableSource = imageDataCanvas;
    }

    if (!this.#isCanvasImageSource(drawableSource)) return null;

    const sourceFrame = originalTexture.frame;
    const frameX = Math.round(sourceFrame?.x ?? 0);
    const frameY = Math.round(sourceFrame?.y ?? 0);
    const frameWidth = Math.max(1, Math.round(sourceFrame?.width ?? originalTexture.width));
    const frameHeight = Math.max(1, Math.round(sourceFrame?.height ?? originalTexture.height));
    const canvas = this.#createCanvas(frameWidth, frameHeight);
    if (!canvas) return null;

    const context = canvas.getContext("2d");
    if (!context) return null;

    context.save();
    context.translate(frameWidth, 0);
    context.scale(-1, 1);
    context.drawImage(
      drawableSource,
      frameX,
      frameY,
      frameWidth,
      frameHeight,
      0,
      0,
      frameWidth,
      frameHeight,
    );
    context.restore();

    const texture = Texture.from(canvas);
    texture.source.scaleMode = "nearest";
    this.#textures.set(newKey, texture);
    return texture;
  }

  /**
   * Creates a cropped texture from an already loaded texture and stores it under a new key.
   * Crop values are ratios in the 0..1 range relative to the source texture.
   *
   * @param {string} originalKey Existing source texture key.
   * @param {string} newKey New key for cropped texture.
   * @param {{x:number, y:number, w:number, h:number}} crop Crop rectangle ratios.
   * @returns {Promise<import("pixi.js").Texture | null>}
   */
  async addCroppedTexture(originalKey, newKey, crop) {
    if (!originalKey || !newKey || !crop) return null;
    if (this.#textures.has(newKey)) return this.#textures.get(newKey);
    const inFlightOriginal = this.#inFlightLoads.get(originalKey);
    if (inFlightOriginal) {
      await inFlightOriginal;
    }

    const originalTexture = this.#textures.get(originalKey);
    if (!originalTexture) return null;

    const frame = new Rectangle(
      Math.round(originalTexture.width * crop.x),
      Math.round(originalTexture.height * crop.y),
      Math.round(originalTexture.width * crop.w),
      Math.round(originalTexture.height * crop.h),
    );

    const croppedTexture = new Texture({
      source: originalTexture.source,
      frame,
    });
    croppedTexture.source.scaleMode = "nearest";
    this.#textures.set(newKey, croppedTexture);
    return croppedTexture;
  }

  /**
   * Creates a horizontally flipped copy of an existing animation and registers it under a new key.
   * Each frame is created via `addFlippedTexture`.
   *
   * @param {string} originalKey Existing animation key.
   * @param {string} newKey New animation key.
   * @returns {Promise<import("pixi.js").Texture[] | void>}
   */
  async addFlippedAnimation(originalKey, newKey) {
    if (!originalKey || !newKey) return;
    if (this.#animations.has(newKey)) return this.#animations.get(newKey);
    const inFlightOriginal = this.#inFlightAnimations.get(originalKey);
    if (inFlightOriginal) {
      await inFlightOriginal;
    }

    const originalAnimation = this.#animations.get(originalKey);
    if (!Array.isArray(originalAnimation)) return;

    const flippedTextures = [];
    for (let index = 0; index < originalAnimation.length; index += 1) {
      const originalTexture = originalAnimation[index];
      const originalTextureKey = this.#findTextureKeyByTexture(originalTexture);
      if (!originalTextureKey) {
        throw new Error(`Missing texture key for animation "${originalKey}" frame ${index}`);
      }

      const flippedTextureKey = `${newKey}:${index}`;
      const flippedTexture = this.addFlippedTexture(originalTextureKey, flippedTextureKey);
      if (!flippedTexture) {
        throw new Error(`Failed to flip texture "${originalTextureKey}" for animation "${newKey}"`);
      }
      flippedTextures.push(flippedTexture);
    }

    this.#animations.set(newKey, flippedTextures);
    return flippedTextures;
  }
}
