import { RiverLava } from './RiverLava.js';
import { RiverWater } from './RiverWater.js';
import { IslandObjectRoots } from '../shared/IslandObjectRoots.js';

export class Rivers {
  /**
   *
    * @returns {string[]}
   */
  static get modelUrls() {
    return RiverWater.modelUrls;
  }

  /**
   *
   * @type {RiverWater[]}
   */
  #surfaces;

  /**
   * @type {IslandObjectRoots}
   */
  #islandRoots;

  /**
   *
   * @param {{pc: typeof import("playcanvas"), app: import("playcanvas").Application, mapData?: import("src/game/objects/ObjectTypes.js").GameMapData, modelLibrary: import("../../models/GameModelLibrary.js").GameModelLibrary, definition?: import("../ObjectTypes.js").MapObjectDefinition, runtime?: import("../ObjectTypes.js").MapObjectRuntime}} context
   */
  constructor(context) {
    if (context.definition) {
      this.definition = context.definition;
      context = { ...context, mapData: { ...context.runtime.mapData,
        islandConnectorData: context.runtime.mapData.islandConnectorData,
        riverData: context.definition.rivers } };
    }
    this.entity = new context.pc.Entity('Rivers');
    this.#islandRoots = new IslandObjectRoots(context.pc, this.entity, context.mapData);
    this.#surfaces = [];
    const groups = new Map();
    for (const river of context.mapData.riverData ?? []) {
      const bank = river.cells[0];
      const group = this.#islandRoots.groupForTile(bank);
      if (!groups.has(group)) {
        groups.set(group, { bank, rivers: [] });
      }
      groups.get(group).rivers.push(river);
    }
    for (const { bank, rivers } of groups.values()) {
      const options = { ...context, mapData: { ...context.mapData, riverData: rivers } };
      for (const Surface of [RiverWater, RiverLava]) {
        const surface = new Surface(options);
        surface.build(context.modelLibrary);
        this.#islandRoots.addChild(surface.entity, bank);
        this.#surfaces.push(surface);
      }
    }
  }

  /**
   * @param {number} near
   * @param {number} far
   * @param {number[]} [offsets]
   */
  setIslandOffsets(near, far, offsets = [near, far]) {
    this.#islandRoots.setOffsets(near, far, offsets);
  }

  /**
   *
   * @param {number} deltaTime
   * @param {import("src/game/objects/ObjectTypes.js").HeroLike} hero
   * @param {import("playcanvas").Entity} camera
   */
  update(deltaTime, hero = null, camera = null) {
    for (const surface of this.#surfaces) {
      surface.update(deltaTime, hero, camera);
    }
  }

  /**
   * @param {number} deltaTime
   * @param {import("../ObjectTypes.js").HeroLike} hero
   * @param {import("playcanvas").Entity} camera
   */
  onFrame(deltaTime, hero, camera) {
    this.update(deltaTime, hero, camera);
  }

  destroy() {
    for (const surface of this.#surfaces) {
      surface.destroy();
    }
    this.#surfaces = [];
    this.entity.destroy();
  }
}
