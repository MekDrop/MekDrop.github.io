import bookcaseUrl from "../../models/castle/residential/bookcase.glb?url";
import bookUrl from "../../models/castle/props/closed-shelf-book.glb?url";
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
  static get modelUrls() { return [bookcaseUrl, bookUrl]; }
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
    let state = 2166136261;
    for (const character of String(definition.seed ?? definition.id)) {
      state = Math.imul(state ^ character.charCodeAt(0), 16777619) >>> 0;
    }
    /**
     * @returns {number}
     */
    const random = definition.seed === undefined ? Math.random : () => {
      state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
      return state / 4294967296;
    };
    for (let index = 0; index < count; index += 1) {
      const offset = -bounds.length / 2 + (index + 0.5) * length;
      const model = models.instantiate(bookcaseUrl);
      const angle = bounds.rotation * Math.PI / 180;
      const reversed = (alongX ? Math.cos(angle) : -Math.sin(angle)) < 0;
      const joinStart = (reversed ? index < count - 1 : index > 0) || definition.joinStart;
      const joinEnd = (reversed ? index > 0 : index < count - 1) || definition.joinEnd;
      const levels = Bookshelf.resize(model, bounds.height, joinStart, joinEnd);
      BookshelfBooks.populate(models, model, bookUrl, random, levels);
      model.name = "Castle oak bookcase";
      // The model spans Z=-0.17..0.19, so recenter its 0.36-deep footprint.
      const frontOffset = definition.facing === -1 ? 0.01 : -0.01;
      model.setLocalPosition(bounds.x + (alongX ? offset : frontOffset), definition.from.y, bounds.z + (alongX ? frontOffset : offset));
      model.setLocalScale(length / 0.85, 1, 1);
      model.setLocalEulerAngles(0, bounds.rotation, 0);
      parent.addChild(model);
    }
    return bounds;
  }

  /**
   * Repeat the authored planks at normal spacing; only the cabinet uprights
   * and backing change length. Books retain their original proportions.
   * @param {import("playcanvas").Entity} model
   * @param {number} height
   * @param {boolean} [joinStart]
   * @param {boolean} [joinEnd]
   * @returns {{bottom:number,height:number}[]}
   */
  static resize(model, height, joinStart = false, joinEnd = false) {
    const planks = model.find(/**
     * @param {import("playcanvas").GraphNode} node
     */
    node => /^Shelf plank/.test(node.name));
    const template = planks[0];
    const levels = [];
    const count = Math.max(1, Math.round((height - 0.0775) / 0.35));
    const spacing = (height - 0.0775) / count;
    for (let index = 0; index <= count; index++) {
      const plank = template.clone();
      const bottom = 0.05 + index * spacing;
      plank.setLocalPosition(0, bottom, 0);
      model.addChild(plank);
      if (index < count) { levels.push({ bottom: bottom + 0.0275, height: spacing - 0.055 }); }
    }
    for (const plank of planks) { plank.destroy(); }
    for (const node of model.find(/**
     * @param {import("playcanvas").GraphNode} node
     */
    node => /^Shelf side/.test(node.name))) {
      const x = node.getLocalPosition().x;
      if (x < 0 && joinStart) { node.destroy(); continue; }
      node.setLocalScale(x > 0 && joinEnd ? 0.75 : 1, height / 1.35, 1);
      node.setLocalPosition(x > 0 && joinEnd ? 0.425 : x, height / 2, 0);
    }
    const backing = model.findByName("Shelf backing");
    backing.setLocalScale(1, (height - 0.05) / 1.3, 1);
    backing.setLocalPosition(0, height / 2 + 0.005, -0.14);
    const trim = model.findByName("Top carved trim");
    trim.setLocalPosition(0, height - 0.0275, 0.17);
    return levels;
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
   * @param {number[]} [offsets]
   */
  setIslandOffsets(near, far, offsets = [near, far]) { this.#islandRoots.setOffsets(near, far, offsets); }
  destroy() { this.#entity.destroy(); }
}
