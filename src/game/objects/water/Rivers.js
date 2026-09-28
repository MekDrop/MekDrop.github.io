import { RiverLava } from './RiverLava.js';
import { RiverWater } from './RiverWater.js';

export class Rivers {
  /**
   *
    * @returns {string}
   */
  static get modelUrls() {
    return RiverWater.modelUrls;
  }

  /**
   *
    * @type {context}
   */
  #surfaces;

  /**
   *
   * @param {number} context
   */
  constructor(context) {
    this.entity = new context.pc.Entity('Rivers');
    this.#surfaces = [new RiverWater(context), new RiverLava(context)];
    for (const surface of this.#surfaces) {
      surface.build(context.modelLibrary);
      this.entity.addChild(surface.entity);
    }
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

  destroy() {
    for (const surface of this.#surfaces) {
      surface.destroy();
    }
    this.#surfaces = [];
    this.entity.destroy();
  }
}
