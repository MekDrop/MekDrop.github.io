import bookcaseUrl from "../../models/castle/residential/bookcase.glb?url";
import { BookshelfBooks } from "./BookshelfBooks.js";
import { BookshelfLayout } from "./BookshelfLayout.js";
import { IslandObjectRoots } from "../shared/IslandObjectRoots.js";
import { addGeneratedVoxelPhysics } from "../shared/GeneratedVoxelPhysics.js";

/**
 * Book-filled oak shelves shared by authored maps and castle rooms.
 */
export class Bookshelf {
  /**
   * @returns {string[]}
   */
  static get modelUrls() { return [bookcaseUrl]; }
  /**
   * @type {import("playcanvas").Entity}
   */
  #entity;
  /**
   * @type {import("playcanvas").Entity}
   */
  #visual;
  /**
   * @type {import("../ObjectTypes.js").MapObjectDefinition}
   */
  #definition;
  /**
   * @type {IslandObjectRoots}
   */
  #islandRoots;

  /**
   * @param {{pc: typeof import("playcanvas"), modelLibrary: import("../../models/GameModelLibrary.js").GameModelLibrary, definition: import("../ObjectTypes.js").MapObjectDefinition, runtime?: import("../ObjectTypes.js").MapObjectRuntime}} options
   */
  constructor({ pc, modelLibrary, definition, runtime = {} }) {
    this.#definition = definition;
    this.#entity = new pc.Entity(`${definition.id} island ownership`);
    this.#visual = new pc.Entity(`${definition.id} bookshelf`);
    this.#visual.tags.add("map-object", definition.id, this.constructor.name);
    this.#islandRoots = new IslandObjectRoots(pc, this.#entity, runtime.mapData);
    this.#islandRoots.addChild(this.#visual, definition.tile);
    const bounds = Bookshelf.addVisual(modelLibrary, this.#visual, definition);
    addGeneratedVoxelPhysics({ pc, parent: this.#visual, name: definition.id, voxels: [bounds], friction: 0.6 });
  }

  /**
   * Adds the existing authored shelf and books, with collision dimensions for its owner.
   * @param {import("../../models/GameModelLibrary.js").GameModelLibrary} models
   * @param {import("playcanvas").Entity} parent
   * @param {import("../ObjectTypes.js").MapObjectDefinition} definition
   * @returns {ReturnType<typeof BookshelfLayout.bounds>}
   */
  static addVisual(models, parent, definition) {
    const bounds = BookshelfLayout.bounds(definition);
    // Repeat modules for long shelves so individual books retain their proportions.
    const count = Math.max(1, Math.ceil(bounds.length / 0.935 - 1e-9));
    const length = bounds.length / count;
    const alongX = definition.from.x !== definition.to.x;
    for (let index = 0; index < count; index += 1) {
      const offset = -bounds.length / 2 + (index + 0.5) * length;
      const model = models.instantiate(bookcaseUrl);
      BookshelfBooks.randomize(model);
      model.name = "Castle oak bookcase";
      // The model spans Z=-0.17..0.19, so recenter its 0.36-deep footprint.
      const frontOffset = definition.facing === -1 ? 0.01 : -0.01;
      model.setLocalPosition(bounds.x + (alongX ? offset : frontOffset), definition.from.y, bounds.z + (alongX ? frontOffset : offset));
      model.setLocalScale(length / 0.85, bounds.height / 1.35, 1);
      model.setLocalEulerAngles(0, bounds.rotation, 0);
      parent.addChild(model);
    }
    return bounds;
  }

  get entity() { return this.#entity; }
  get definition() { return this.#definition; }
  /**
   * @returns {import("playcanvas").Entity[]}
   */
  get visualRoots() { return [this.#visual]; }
  /**
   * @param {number} near
   * @param {number} far
   */
  setIslandOffsets(near, far) { this.#islandRoots.setOffsets(near, far); }
  destroy() { this.#entity.destroy(); }
}
