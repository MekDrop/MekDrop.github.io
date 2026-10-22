import { BELL_BUG_ANIMATION } from "./BellBugAnimation.js";

/**
 * Embedded clip binding on the complete imported skinned hierarchy.
 */
export class BellBugModel {
  /**
   * @type {import("playcanvas").Entity}
   */
  #model;
  /**
   * @type {string|null}
   */
  #current = null;

  /**
   * @param {import("./BellBug.js").BellBug} owner
   * @param {string} url
   */
  constructor(owner, url) {
    this.#model = owner.modelLibrary.instantiate(url);
    this.#model.setLocalPosition(0, 0.0116, 0.0071);
    // Blender -Y maps to glTF +Z; the semantic gameplay forward is -Z.
    this.#model.setLocalEulerAngles(0, 180, 0);
    owner.entity.addChild(this.#model);
    const names = Object.values(BELL_BUG_ANIMATION);
    const tracks = owner.modelLibrary.getAnimationTracks(url, names);
    this.#model.addComponent("anim", { activate: true });
    const loops = new Set(["idle_nervous", "scuttle_walk", "scuttle_run", "cower",
      "panic_ring_loop", "door_scratch_loop", "stun", "carried_panic", "airborne_tumble"]);
    for (const name of names) {
      this.#model.anim.addAnimationState(name, tracks.get(name), 1, loops.has(name));
    }
    this.play(owner.clip);
  }

  /**
   * @param {string} name
   */
  play(name) {
    if (this.#current === name) {
      return;
    }
    this.#model.anim.baseLayer.transition(name, this.#current ? 0.1 : 0);
    this.#current = name;
  }

  /**
   * @param {number} value
   */
  set speed(value) {
    this.#model.anim.speed = Math.max(0, Math.min(3, value));
  }

  /**
   * @returns {import("playcanvas").Entity}
   */
  get model() {
    return this.#model;
  }

  /**
   * @param {string} name
   */
  restart(name) {
    this.#current = name;
    this.#model.anim.baseLayer.play(name);
    this.#model.anim.baseLayer.activeStateCurrentTime = 0;
    this.#model.anim.update(0);
  }

  destroy() {
    this.#model.destroy();
  }
}
