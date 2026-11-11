import pergolaUrl from "../../../models/castle/garden/pergola.glb?url";
import canopyUrl from "../../../models/castle/garden/striped-canopy.glb?url";
import { AbstractCastleProp } from "../../shared/AbstractCastleProp.js";
import leafUrl from "../../../models/castle/garden/ivy-leaf.glb?url";
import stemUrl from "../../../models/vegetation/cliff-vine-stem.glb?url";
import { GardenVine } from "./GardenVine.js";
import { GardenShelterPreview } from "./GardenShelterPreview.js";
import { GardenVineAttachments } from "./GardenVineAttachments.js";

/**
 * Open-sided timber shelter. Both authored meshes have bottom-centre pivots,
 * a 4.2 × 3.62 m timber footprint and 2.85 m height. Living foliage grows
 * outside the pergola's rear rafters. Posts leave seating open.
 */
export class GardenShelter extends AbstractCastleProp {
  /**
   * @type {ConstructorParameters<typeof AbstractCastleProp>[0]}
   */
  #options;
  /**
   * @type {GardenVine|null}
   */
  #vine = null;

  /**
   * @param {ConstructorParameters<typeof AbstractCastleProp>[0]} options
   */
  constructor(options) {
    super(options);

    this.#options = options;
  }
  /**
   * @returns {string[]}
   */
  static get modelUrls() {
    return [pergolaUrl, canopyUrl, leafUrl, stemUrl];
  }

  /**
   * @returns {string}
   */
  get modelUrl() {
    return this.definition.variant === "canopy" ? canopyUrl : pergolaUrl;
  }

  /**
   * Foliage must never become a rigid timber collision surface.
   * @param {import("playcanvas").Entity} model
   * @param {boolean} collision
   */
  prepareModel(model, collision) {
    if (collision) {
      for (const node of [...model.findComponents("render")]) {
        if (node.entity.name.startsWith("Vine leaf ") || node.entity.name.startsWith("Living vine ")) {
          node.entity.destroy();
        }
      }
    }
  }

  onSceneReady() {
    const model = this.visualRoots[0].children[0];
    const attachments = !this.#vine && this.definition.variant !== "canopy"
      ? GardenVineAttachments.read(model) : null;
    super.onSceneReady();
    if (attachments) {
      const { pc, modelLibrary } = this.#options;
      this.#vine = new GardenVine(pc.Application.getApplication(), model, modelLibrary, stemUrl, leafUrl, attachments);
    }
  }

  /**
   * @returns {import("playcanvas").Entity[]}
   */
  get vineRoots() {
    return this.#vine ? [this.#vine.entity] : [];
  }

  get previewOptions() {
    return this.#options;
  }

  /**
   * @param {number} [yaw]
   * @param {number} [elevation]
   * @param {boolean} [detail]
   * @param {import("playcanvas").Vec3} [focus]
   * @param {number} [detailRadius]
   * @returns {Promise<{visiblePixels: number, transparentPixels: number, margin: number}>}
   */
  capturePreview(yaw, elevation, detail, focus, detailRadius) {
    return new GardenShelterPreview(this).capture(yaw, elevation, detail, focus, detailRadius);
  }

  destroy() {
    this.#vine?.destroy();
    super.destroy();
  }
}
