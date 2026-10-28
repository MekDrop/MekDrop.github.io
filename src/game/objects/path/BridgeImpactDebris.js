import { BridgeImpactResources } from "./BridgeImpactResources.js";

/**
 * @typedef {{entity:import("playcanvas").Entity, instances:import("playcanvas").MeshInstance[], lifetime:number, fadeStart:number, opacity:number, expired:boolean}} BridgeImpactPiece
 */

/**
 * Small deck planks and railing splinters released after a section lands.
 * Ammo owns their bounce; a short material fade retires the bounded scatter.
 */
export class BridgeImpactDebris {
  /**
   * @type {import("playcanvas").Entity}
   */
  entity;
  /**
   * @type {number}
   */
  age = 0;
  /**
   * @type {typeof import("playcanvas")}
   */
  #pc;
  /**
   * @type {number}
   */
  #station;
  /**
   * @type {BridgeImpactPiece[]}
   */
  #pieces = [];
  /**
   * @type {number}
   */
  #duration = 0;
  /**
   * @type {boolean}
   */
  #destroyed = false;
  /**
   * @type {import("./BridgeImpactResources.js").BridgeImpactResourceLease}
   */
  #resources;

  /**
   * Called by the owning bridge during normal map loading.
   * @param {import("./BridgeImpactResources.js").BridgeImpactResourceOptions} options
   * @returns {import("./BridgeImpactResources.js").BridgeImpactResourceLease}
   */
  static prepareResources(options) {
    return BridgeImpactResources.acquire(options);
  }

  /**
   * @param {{pc:typeof import("playcanvas"), app:import("playcanvas").Application, materials:Map<string,import("playcanvas").Material>, modelLibrary?:import("../../models/GameModelLibrary.js").GameModelLibrary, definition:import("../ObjectTypes.js").MapObjectDefinition, impact:import("./BridgeDeckFragment.js").BridgeGroundImpact, station:number}} options
   */
  constructor({ pc, app, materials, modelLibrary, definition, impact, station }) {
    this.#pc = pc;
    this.#station = station;
    this.entity = new pc.Entity(`Bridge impact scatter ${station}`);
    this.entity.tags.add("hero-surface-ignore", "bridge-impact-debris");
    app.root.addChild(this.entity);
    this.#resources = BridgeImpactDebris.prepareResources({
      pc,
      app,
      materials,
      modelLibrary,
      material: definition.material,
    });
    for (let index = 0; index < 10; index++) {
      this.#createPiece({
        definition,
        impact,
      }, index);
    }
  }

  /**
   * @param {{definition:import("../ObjectTypes.js").MapObjectDefinition, impact:import("./BridgeDeckFragment.js").BridgeGroundImpact}} options
   * @param {number} index
   */
  #createPiece({ definition, impact }, index) {
    const pc = this.#pc;
    const wood = index >= 6;
    const horizontal = definition.span.horizontal;
    const along = wood ? (index % 2 ? -0.28 : 0.28) : (Math.floor(index / 2) - 1) * 0.32;
    const across = wood ? (index < 8 ? -0.91 : 0.91) : (index % 2 ? -0.48 : 0.48);
    const local = new pc.Vec3(horizontal ? along : across, wood ? 0.35 : 0.02, horizontal ? across : along);
    const offset = impact.rotation.transformVector(local);
    const position = impact.position.clone().add(offset);
    const alongSize = wood ? 0.28 + this.#random(index, 1) * 0.24 : 0.24 + this.#random(index, 1) * 0.12;
    const acrossSize = wood ? 0.055 + this.#random(index, 2) * 0.035 : 0.48 + this.#random(index, 2) * 0.16;
    const height = wood ? 0.07 + this.#random(index, 3) * 0.035 : 0.09 + this.#random(index, 3) * 0.08;
    const size = new pc.Vec3(horizontal ? alongSize : acrossSize, height, horizontal ? acrossSize : alongSize);
    const localRotation = new pc.Quat().setFromEulerAngles((this.#random(index, 4) - 0.5) * 22,
      (this.#random(index, 5) - 0.5) * 65, (this.#random(index, 6) - 0.5) * 20);
    const rotation = new pc.Quat().mul2(impact.rotation, localRotation);
    const half = size.clone().mulScalar(0.5);
    const extent = Math.abs(rotation.transformVector(new pc.Vec3(half.x, 0, 0)).y) +
      Math.abs(rotation.transformVector(new pc.Vec3(0, half.y, 0)).y) +
      Math.abs(rotation.transformVector(new pc.Vec3(0, 0, half.z)).y);
    const floor = impact.contactPoint?.y ?? impact.position.y - 0.12;
    // A tilted landed section may have local pieces below its root. Keep their
    // initial convex bodies above the real contact plane before adding bounce.
    position.y = Math.max(position.y, floor + extent + 0.025);
    const root = new pc.Entity(wood ? "Broken bridge railing" : "Broken bridge plank");
    root.tags.add("hero-surface-ignore", "bridge-impact-piece");
    this.entity.addChild(root);
    root.setPosition(position);
    root.setRotation(rotation);
    const instances = this.#resources.createTimber(root, size);
    root.addComponent("collision", {
      type: "box",
      halfExtents: half,
    });
    root.addComponent("rigidbody", {
      type: "dynamic",
      mass: wood ? 0.06 : 0.18 + this.#random(index, 7) * 0.1,
      friction: 0.75,
      restitution: 0.12,
      linearDamping: 0.18,
      angularDamping: 0.28,
      group: pc.BODYGROUP_USER_2,
      mask: pc.BODYMASK_STATIC,
    });
    const length = Math.hypot(offset.x, offset.z) || 1;
    const spread = 0.4 + this.#random(index, 8) * 0.65;
    const inherited = impact.velocity ?? pc.Vec3.ZERO;
    root.rigidbody.linearVelocity = new pc.Vec3(
      Math.max(-1, Math.min(1, inherited.x * 0.2)) + offset.x / length * spread,
      0.9 + this.#random(index, 9) * 0.9,
      Math.max(-1, Math.min(1, inherited.z * 0.2)) + offset.z / length * spread,
    );
    root.rigidbody.angularVelocity = new pc.Vec3((this.#random(index, 10) - 0.5) * 5,
      (this.#random(index, 11) - 0.5) * 4, (this.#random(index, 12) - 0.5) * 5);
    const lifetime = 1.7 + this.#random(index, 13) * 0.7;
    this.#duration = Math.max(this.#duration, lifetime);
    this.#pieces.push({
      entity: root,
      instances,
      lifetime,
      fadeStart: lifetime - 0.85,
      opacity: 1,
      expired: false,
    });
  }

  /**
   * @param {number} index
   * @param {number} salt
   * @returns {number}
   */
  #random(index, salt) {
    const value = Math.sin(this.#station * 12.9898 + index * 78.233 + salt * 31.4159) * 43758.5453;

    return value - Math.floor(value);
  }

  /**
   * @param {number} deltaTime
   */
  update(deltaTime) {
    if (this.#destroyed || !Number.isFinite(deltaTime) || deltaTime <= 0) {
      return;
    }
    this.age += deltaTime;
    for (const piece of this.#pieces) {
      if (piece.expired || this.age < piece.fadeStart) {
        continue;
      }
      const opacity = Math.max(0, (piece.lifetime - this.age) / (piece.lifetime - piece.fadeStart));
      this.#fadePiece(piece, opacity);
      if (opacity === 0) {
        piece.expired = true;
        piece.entity.enabled = false;
      }
    }
  }

  /**
   * @param {BridgeImpactPiece} piece
   * @param {number} opacity
   */
  #fadePiece(piece, opacity) {
    piece.opacity = opacity;
    for (const instance of piece.instances) {
      instance.setParameter("material_opacity", opacity);
    }
  }

  /**
   * @returns {boolean}
   */
  get expired() {
    return this.#destroyed || this.age >= this.#duration;
  }

  destroy() {
    if (this.#destroyed) {
      return;
    }
    this.#destroyed = true;
    for (const piece of this.#pieces) {
      piece.entity.destroy();
    }
    this.#pieces = [];
    this.entity.destroy();
    this.#resources.release();
  }
}
