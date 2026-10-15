import closedUrl from "../../models/castle/props/closed-reading-book.glb?url";
import openUrl from "../../models/castle/props/open-reading-book.glb?url";
import classicOpenUrl from "../../models/castle/leisure/open-book.glb?url";
import uprightClosedUrl from "../../models/castle/props/closed-shelf-book.glb?url";
import { AbstractCastleProp } from "../castle-props/AbstractCastleProp.js";
import { BookCover } from "./BookCover.js";
import { BookMapObjects } from "./BookMapObjects.js";

/**
 * One independently owned volume, on a shelf or laid out for reading.
 */
export class Book extends AbstractCastleProp {
  /**
   * Also accept legacy definitions created directly by containers or scripts.
   * @param {ConstructorParameters<typeof AbstractCastleProp>[0]} options
   */
  constructor(options) {
    BookMapObjects.normalize(options.definition);
    super(options);
  }

  /**
   * @returns {string[]}
   */
  static get modelUrls() { return [closedUrl, openUrl, classicOpenUrl, uprightClosedUrl]; }
  /**
   * @returns {string}
   */
  get modelUrl() {
    if (this.definition.isOpen) {
      return this.definition.style === "classic" ? classicOpenUrl : openUrl;
    }
    return this.definition.pose === "upright" ? uprightClosedUrl : closedUrl;
  }
  /**
   * Shelf contents share the cabinet's collision rather than hundreds of bodies.
   * @returns {boolean}
   */
  get hasAuthoredCollision() { return !this.definition.sourceShelfId; }
  /**
   * @param {import("playcanvas").Entity} model
   * @param {boolean} collision
   */
  prepareModel(model, collision) {
    if (!collision) {
      BookCover.apply(model, this.definition.coverColor);
    }
  }
  /**
   * @param {import("../ObjectTypes.js").GameMapData} mapData
   */
  static prepareMap(mapData) { BookMapObjects.prepareMap(mapData); }
}
