import { BannerCloth } from "./BannerCloth.js";
import { IslandObjectRoots } from "../../shared/IslandObjectRoots.js";

/**
 * Wall-mounted banner variants sharing cloth physics and pointer interaction.
 */
export class Banner {
  /**
   * @type {import("../../ObjectTypes.js").MapObjectDefinition}
   */
  #definition;
  /**
   * @type {BannerCloth}
   */
  #visual;
  /**
   * @type {IslandObjectRoots|null}
   */
  #islandRoots = null;

  /**
   * @returns {string[]}
   */
  static get modelUrls() {
    return BannerCloth.modelUrls;
  }

  /**
   * Publish castle cloth through map objects.
   * @param {import("../../ObjectTypes.js").GameMapData} mapData
   */
  static prepareMap(mapData) {
    const objects = mapData.objects ??= [];
    for (let index = objects.length - 1; index >= 0; index--) {
      const item = objects[index];
      if (!item.castleBanner) {
        continue;
      }
      const castle = objects.find(
        /**
         * @param {import("../../ObjectTypes.js").MapObjectDefinition} candidate
         */
        (candidate) => candidate.object === "Castle" && candidate.id === item.sourceCastleId,
      );
      if (!castle || castle.seed !== item.sourceCastleSeed) {
        objects.splice(index, 1);
      }
    }
    for (const castle of [...objects]) {
      if (castle.object !== "Castle") {
        continue;
      }
      for (const [index, banner] of (castle.buildPlan?.geometry?.decorations?.banners ?? []).entries()) {
        const id = `${castle.id}-banner-${index}`;
        /**
         * @param {import("../../ObjectTypes.js").MapObjectDefinition} item
         */
        const hasBannerId = (item) => item.id === id;
        if (objects.some(hasBannerId)) {
          continue;
        }
        objects.push({
          id,
          object: Banner.name,
          variant: "cloth",
          castleBanner: true,
          sourceCastleId: castle.id,
          sourceCastleSeed: castle.seed,
          tile: castle.tile,
          position: {
            x: banner.x,
            y: banner.y,
            z: banner.z,
          },
          rotation: banner.yaw,
          width: banner.width,
          height: banner.height,
        });
      }
    }
  }

  /**
   * @param {{pc: typeof import("playcanvas"), app: import("playcanvas").Application, modelLibrary: import("../../../models/GameModelLibrary.js").GameModelLibrary, definition: import("../../ObjectTypes.js").MapObjectDefinition, runtime?: import("../../ObjectTypes.js").MapObjectRuntime}} options
   */
  constructor(options) {
    const { pc, definition, runtime = {} } = options;
    this.#definition = definition;
    this.#visual = new BannerCloth(options);
    this.#visual.add({
      ...definition.position,
      yaw: definition.rotation ?? 0,
      width: definition.width,
      height: definition.height,
      variant: definition.variant,
    });
    this.#visual.entity.tags.add("map-object", definition.id, Banner.name);
    const root = this.#visual.entity.children[0];
    this.#islandRoots = new IslandObjectRoots(pc, this.#visual.entity, runtime.mapData);
    this.#islandRoots.addChild(root, definition.tile);
    root.setLocalPosition(definition.position.x, definition.position.y, definition.position.z);
    root.setLocalEulerAngles(definition.tilt?.x ?? 0, definition.rotation ?? 0, definition.tilt?.z ?? 0);
    const scale = definition.scale ?? 1;
    const stretch = definition.stretch ?? {
      x: 1,
      y: 1,
      z: 1,
    };
    root.setLocalScale(scale * stretch.x, scale * stretch.y, scale * stretch.z);
  }

  get definition() {
    return this.#definition;
  }
  /**
   * @returns {import("playcanvas").Entity}
   */
  get entity() {
    return this.#visual.entity;
  }
  /**
   * @returns {import("playcanvas").Entity[]}
   */
  get visualRoots() {
    return [this.#visual.entity];
  }
  /**
   * @param {number} near
   * @param {number} far
   * @param {number[]} [offsets]
   */
  setIslandOffsets(near, far, offsets = [near, far]) {
    if (this.#islandRoots) {
      this.#islandRoots.setOffsets(near, far, offsets);
    }
  }
  /**
   * @param {import("playcanvas").Vec3} start
   * @param {import("playcanvas").Vec3} end
   */
  getPointerHit(start, end) {
    const hit = this.#visual.getBannerHit(start, end);

    return hit ? {
      ...hit,
      pointerTarget: this,
    } : null;
  }
  /**
   * @param {{hit: Parameters<BannerCloth["beginWindGesture"]>[0]}} options
   */
  handlePointerDown({ hit }) {
    this.#visual.beginWindGesture(hit);

    return { capturePointer: true };
  }
  /**
   * @param {{ray: {start: import("playcanvas").Vec3, end: import("playcanvas").Vec3}, deltaTime: number}} options
   */
  handlePointerMove({ ray, deltaTime }) {
    this.#visual.applyMouseWind(ray.start, ray.end, deltaTime);

    return true;
  }
  handlePointerUp() {
    this.#visual.endWindGesture();

    return true;
  }
  handlePointerCancel() {
    this.#visual.endWindGesture();
  }
  destroy() {
    this.#visual.destroy();
  }
}
