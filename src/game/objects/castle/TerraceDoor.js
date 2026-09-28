import terraceDoorUrl from "../../models/castle/leisure/terrace-door.glb?url";
import terraceStairheadUrl from "../../models/castle/leisure/terrace-stairhead.glb?url";
import { CASTLE_DOOR_ANIMATION } from "../../enum/CastleDoorAnimation.js";

/**
 * A roof stairhead with a single rectangular door opening onto the terrace.
 */
export class TerraceDoor {
  /**
   *
    * @returns {Array<string>}
   */
  static get modelUrls() {
    return [terraceDoorUrl, terraceStairheadUrl];
  }

  /**
   *
    * @type {import("playcanvas").Entity}
   */
  #entity;
  /**
   *
    * @type {import("playcanvas").Entity}
   */
  #door;
  /**
   *
    * @type {import("playcanvas").AnimController}
   */
  #layer;
  /**
   *
    * @type {number}
   */
  #duration;
  /**
   *
    * @type {number}
   */
  #amount = 0;
  /**
   *
    * @type {typeof import("playcanvas")}
   */
  #pc;
  /**
   *
    * @type {() => boolean}
   */
  #onOpen;

  /**
   *
   * @param {{pc: typeof import("playcanvas"), modelLibrary: string, wallMaterial: import("playcanvas").Material, woodMaterial: import("playcanvas").Material, onOpen: () => boolean}} options
   * @param {typeof import("playcanvas")} options.pc
   * @param {string} options.modelLibrary
   * @param {import("playcanvas").Material} options.wallMaterial
   * @param {import("playcanvas").Material} options.woodMaterial
   * @param {() => boolean} options.onOpen
   */
  constructor({
    pc,
    modelLibrary,
    wallMaterial,
    woodMaterial,
    onOpen,
  }) {

    this.#pc = pc;

    this.#onOpen = onOpen;

    this.#entity = modelLibrary.instantiate(terraceStairheadUrl);
    this.#entity.name = "Terrace stairhead";
    this.#applyWallMaterial(wallMaterial);

    this.#door = modelLibrary.instantiate(terraceDoorUrl);
    this.#door.name = "Terrace outward-opening door";
    this.#applyWoodMaterial(woodMaterial);
    this.#entity.addChild(this.#door);
    const track = modelLibrary.getAnimationTracks(terraceDoorUrl, [
      CASTLE_DOOR_ANIMATION.OPEN,
    ]).get(CASTLE_DOOR_ANIMATION.OPEN);
    this.#door.addComponent("anim", { activate: true });
    this.#door.anim.addAnimationState(CASTLE_DOOR_ANIMATION.OPEN, track, 1, false);

    this.#layer = this.#door.anim.baseLayer;
    this.#layer.play(CASTLE_DOOR_ANIMATION.OPEN);
    this.#door.anim.speed = 0;

    this.#duration = track.duration;
    this.#layer.activeStateCurrentTime = 0;
  }

  get entity() {
    return this.#entity;
  }

  get openAmount() {
    return this.#amount;
  }

  set openAmount(value) {
    this.#amount = Math.max(0, Math.min(1, value));
    this.#layer.activeStateCurrentTime = this.#amount * this.#duration;
    this.#door.anim.update(0);
  }

  /**
   *
    * @returns {boolean}
   */
  get insideHandle() {
    return this.#door.findByName("Terrace door inside ring handle");
  }

  /**
   *
    * @returns {{x: number, y: number, z: number}}
   */
  get hingeRotation() {
    return this.#door.findByName("Terrace door hinge").getRotation();
  }

  /**
   *
   * @param {number} rayStart
   * @param {number} rayEnd
   */
  getPointerHit(rayStart, rayEnd) {
    const hinge = this.#door?.findByName("Terrace door hinge");
    if (!hinge) {
      return null;
    }
    const inverse = hinge.getWorldTransform().clone().invert();
    const start = inverse.transformPoint(rayStart, new this.#pc.Vec3());
    const end = inverse.transformPoint(rayEnd, new this.#pc.Vec3());
    const dz = end.z - start.z;
    if (Math.abs(dz) < 0.000001) {
      return null;
    }
    const distance = -start.z / dz;
    const x = start.x + (end.x - start.x) * distance;
    const y = start.y + (end.y - start.y) * distance;
    if (distance < 0 || distance > 1 || x < 0 || x > 1 || y < 0 || y > 1.25) {
      return null;
    }
    return { distance, pointerTarget: this };
  }

  handlePointerDown() {
    return this.#onOpen?.() ?? false;
  }

  /**
   *
   * @param {number} x
   * @param {number} y
   * @param {number} z
   * @param {number} radius
   */
  blocksCameraAt(x, y, z, radius = 0) {
    const hinge = this.#door?.findByName("Terrace door hinge");
    if (!hinge) {
      return false;
    }
    const inverse = hinge.getWorldTransform().clone().invert();
    const point = inverse.transformPoint(
      new this.#pc.Vec3(x, y, z),
      new this.#pc.Vec3(),
    );
    return (
      point.x >= -radius &&
      point.x <= 1 + radius &&
      point.y >= -radius &&
      point.y <= 1.25 + radius &&
      Math.abs(point.z) <= 0.08 + radius
    );
  }

  /**
   *
   * @param {number} deltaTime
   * @param {boolean} open
   * @param {number} speed
   */
  update(deltaTime, open, speed = 3) {
    const step = Math.max(0, deltaTime) * speed;
    this.#amount = open
      ? Math.min(1, this.#amount + step)
      : Math.max(0, this.#amount - step);
    this.#layer.activeStateCurrentTime = this.#amount * this.#duration;
  }

  destroy() {
    this.#entity.destroy();
    this.#door = null;
  }

  /**
   *
   * @param {import("playcanvas").Material} wallMaterial
   */
  #applyWallMaterial(wallMaterial) {
    if (!wallMaterial) {
      return;
    }

    const pending = [this.#entity];
    while (pending.length) {
      const entity = pending.pop();
      const isFramePiece =
        entity.name === "Terrace stairhead frame" ||
        entity.name.startsWith("Terrace jamb block");
      if (isFramePiece) {
        for (const meshInstance of entity.render?.meshInstances ?? []) {
          meshInstance.material = wallMaterial;
        }
      }
      pending.push(...entity.children);
    }
  }

  /**
   *
   * @param {import("playcanvas").Material} woodMaterial
   */
  #applyWoodMaterial(woodMaterial) {
    const pending = [this.#door];
    while (pending.length) {
      const entity = pending.pop();
      for (const meshInstance of entity.render?.meshInstances ?? []) {
        const nodeName = meshInstance.node?.name ?? "";
        const isWood =
          entity.name.startsWith("Terrace door plank") ||
          nodeName.startsWith("Terrace door plank");
        if (isWood) {
          meshInstance.material = woodMaterial;
        }
      }
      pending.push(...entity.children);
    }
  }
}
