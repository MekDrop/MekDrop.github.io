import bowlUrl from "../../../models/castle/residential/brazier.glb?url";
import towerUrl from "../../../models/castle/props/tower-brazier.glb?url";
import { AbstractCastleProp } from "../../shared/AbstractCastleProp.js";
import { FireEffect } from "../../fire/FireEffect.js";

/**
 * Reusable bowl or tower brazier with locally owned fire and authored contact.
 * Bowl proportions and effects retain the original castle fire calibration.
 */
export class Brazier extends AbstractCastleProp {
  /**
   * @type {FireEffect|null}
   */
  #fire = null;
  /**
   * @type {import("playcanvas").StandardMaterial|null}
   */
  #material = null;
  /**
   * @returns {string[]}
   */
  static get modelUrls() {
    return [bowlUrl, towerUrl];
  }
  /**
   * The shallow castle bowl previously had no contact; towers retain mesh contact.
   * @returns {boolean}
   */
  get hasAuthoredCollision() {
    return this.definition.variant === "tower";
  }
  /**
   * @returns {string}
   */
  get modelUrl() {
    return this.definition.variant === "tower" ? towerUrl : bowlUrl;
  }
  /**
   * @param {import("playcanvas").Entity} model
   * @param {boolean} collision
   */
  prepareModel(model, collision) {
    if (this.definition.variant === "tower") {
      return;
    }
    const scale = this.definition.scale ?? 0.25;
    model.setLocalScale(scale * 1.5, scale * 0.24, scale * 1.5);
  }

  /**
   * @param {ConstructorParameters<typeof AbstractCastleProp>[0]} options
   */
  constructor(options) {
    super(options);

    const { pc, definition } = options;
    const tower = definition.variant === "tower";
    if (!tower) {
      this.#material = new pc.StandardMaterial();
      this.#material.name = "Castle fire brazier";
      this.#material.diffuse = new pc.Color(0x20 / 255, 0x25 / 255, 0x28 / 255);
      this.#material.gloss = 0.14;
      this.#material.update();
      for (const render of this.visualRoots[0].findComponents("render")) {
        for (const mesh of render.meshInstances) {
          mesh.material = this.#material;
          mesh.castShadow = true;
          mesh.receiveShadow = true;
        }
      }
    }
    // Tower artwork was unlit; lighting it is an explicit placement choice.
    if (tower && !definition.flame) {
      return;
    }
    const app = options.app ?? pc.Application.getApplication();
    this.#fire = new FireEffect({
      pc,
      app,
      particleTexture: app.assets.find("castleFireParticle", "texture").resource,
    });
    this.#fire.add({
      x: 0,
      y: tower ? 0.7 * (definition.scale ?? 1) : 0,
      z: 0,
      scale: tower ? 0.25 * (definition.scale ?? 1) : definition.scale ?? 0.25,
      intensity: definition.intensity ?? 1,
      flame: definition.flame ?? true,
      phase: definition.phase ?? definition.position.x * 0.37 + definition.position.z * 0.53,
    });
    this.visualRoots[0].addChild(this.#fire.entity);
  }
  destroy() {
    this.#fire?.destroy();
    this.#fire = null;
    super.destroy();
    this.#material?.destroy();
    this.#material = null;
  }
}
