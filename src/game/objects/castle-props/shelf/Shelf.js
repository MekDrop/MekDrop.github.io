import { ShelfItems } from "./ShelfItems.js";
import storageUrl from "../../../models/castle/residential/storage-shelf.glb?url";
import bookcaseUrl from "../../../models/castle/residential/bookcase.glb?url";
import bookUrl from "../../../models/castle/props/closed-shelf-book.glb?url";
import { ShelfBooks } from "./ShelfBooks.js";
import { ShelfLayout } from "./ShelfLayout.js";
import { IslandObjectRoots } from "../../shared/IslandObjectRoots.js";
import { addGeneratedVoxelPhysics } from "../../shared/GeneratedVoxelPhysics.js";

/**
 * Storage racks and book cabinets shared by authored maps and castle rooms.
 */
export class Shelf {
  /**
   * @param {import("../../ObjectTypes.js").GameMapData} mapData
   */
  static prepareMap(mapData) {
    ShelfItems.prepareMap(mapData);
  }

  /**
   * @returns {string[]}
   */
  static get modelUrls() {
    return [storageUrl, bookcaseUrl, bookUrl];
  }
  /**
   * @type {import("playcanvas").Entity}
   */
  #entity;
  /**
   * @type {import("playcanvas").Entity}
   */
  #collider;
  /**
   * @type {import("playcanvas").Entity}
   */
  #visual;
  /**
   * @type {import("../../ObjectTypes.js").MapObjectDefinition}
   */
  #definition;
  /**
   * @type {IslandObjectRoots}
   */
  #islandRoots;

  /**
   * @param {{pc: typeof import("playcanvas"), modelLibrary: import("../../../models/GameModelLibrary.js").GameModelLibrary, definition: import("../../ObjectTypes.js").MapObjectDefinition, runtime?: import("../../ObjectTypes.js").MapObjectRuntime}} options
   */
  constructor({ pc, modelLibrary, definition, runtime = {} }) {
    this.#definition = definition;
    this.#entity = new pc.Entity(`${definition.id} island ownership`);
    this.#visual = new pc.Entity(`${definition.id} shelf`);
    this.#visual.tags.add("map-object", definition.id, this.constructor.name);
    this.#islandRoots = new IslandObjectRoots(pc, this.#entity, runtime.mapData);
    this.#islandRoots.addChild(this.#visual, definition.tile);
    const bounds = Shelf.addVisual(modelLibrary, this.#visual, definition);
    this.#collider = addGeneratedVoxelPhysics({
      pc,
      parent: this.#visual,
      name: definition.id,
      voxels: [bounds],
      friction: 0.6,
    });
  }

  /**
   * Adds the existing authored shelf and books, with collision dimensions for its owner.
   * @param {import("../../../models/GameModelLibrary.js").GameModelLibrary} models
   * @param {import("playcanvas").Entity} parent
   * @param {import("../../ObjectTypes.js").MapObjectDefinition} definition
   * @returns {ReturnType<typeof ShelfLayout.bounds>}
   */
  static addVisual(models, parent, definition) {
    if (definition.variant === "storage") {
      const scale = definition.scale ?? 1;
      const stretch = definition.stretch ?? {
        x: 1,
        y: 1,
        z: 1,
      };
      const model = models.instantiate(storageUrl);
      if (definition.items) {
        for (const node of model.find(Shelf.#isStorageContent)) {
          node.destroy();
        }
      }
      const position = definition.position;
      parent.setLocalPosition(position.x, position.y, position.z);
      const rotation = definition.collisionRotation ?? definition.rotation ?? 0;
      parent.setLocalEulerAngles(0, rotation, 0);
      model.setLocalEulerAngles(0, (definition.rotation ?? 0) - rotation, 0);
      model.setLocalScale(scale * stretch.x, scale * stretch.y, scale * stretch.z);
      parent.addChild(model);

      return {
        x: 0,
        y: scale * stretch.y / 2,
        z: 0,
        width: definition.footprint?.width ?? 0.8 * scale * stretch.x,
        height: scale * stretch.y,
        depth: definition.footprint?.depth ?? 0.3 * scale * stretch.z,
      };
    }
    const bounds = ShelfLayout.bounds(definition);
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
      const levels = Shelf.resize(model, bounds.height, joinStart, joinEnd);
      if (definition.books !== false && !definition.items) {
        ShelfBooks.populate(models, model, bookUrl, random, levels);
      } else {
        for (const node of model.find(Shelf.#findNode)) {
          node.destroy();
        }
      }
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
    const planks = model.find(Shelf.#findNode2);
    const template = planks[0];
    const levels = [];
    const count = Math.max(1, Math.round((height - 0.0775) / 0.35));
    const spacing = (height - 0.0775) / count;
    for (let index = 0; index <= count; index++) {
      const plank = template.clone();
      const bottom = 0.05 + index * spacing;
      plank.setLocalPosition(0, bottom, 0);
      model.addChild(plank);
      if (index < count) {
        levels.push({
          bottom: bottom + 0.0275,
          height: spacing - 0.055,
        });
      }
    }
    for (const plank of planks) {
      plank.destroy();
    }
    for (const node of model.find(Shelf.#findNode3)) {
      const x = node.getLocalPosition().x;
      if (x < 0 && joinStart) {
        node.destroy(); continue;
      }
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

  get entity() {
    return this.#entity;
  }
  get definition() {
    return this.#definition;
  }
  /**
   * @returns {import("playcanvas").Entity[]}
   */
  get visualRoots() {
    return [this.#visual];
  }
  /**
   * @param {number} near
   * @param {number} far
   * @param {number[]} [offsets]
   */
  setIslandOffsets(near, far, offsets = [near, far]) {
    this.#islandRoots.setOffsets(near, far, offsets);
    this.#collider.rigidbody?.syncEntityToBody();
  }
  onSceneReady() {
    this.#collider.rigidbody?.syncEntityToBody();
  }
  destroy() {
    this.#entity.destroy();
  }

  /**
   *
   * @param {import("playcanvas").GraphNode} node
   */
  static #isStorageContent(node) {
    return /^(Supply crate|Crate iron band)/.test(node.name);
  }

  /**
   * @param {import("playcanvas").GraphNode} node
   */
  static #findNode(node) {
    return /^(Leather bound book|Book spine brass)/.test(node.name);
  }

  /**
   * @param {import("playcanvas").GraphNode} node
   */
  static #findNode2(node) {
    return /^Shelf plank/.test(node.name);
  }

  /**
   * @param {import("playcanvas").GraphNode} node
   */
  static #findNode3(node) {
    return /^Shelf side/.test(node.name);
  }
}
