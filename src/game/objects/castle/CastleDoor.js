import castleDoorsModelUrl from "../../models/castle/doors/castle-doors.glb?url";
import { CASTLE_DOOR_ANIMATION } from "../../enum/CastleDoorAnimation.js";

const DOOR_THICKNESS = 0.16;
const DOOR_INSET = -0.18;
const OPEN_SPEED = 3.4;
const OPEN_DISTANCE = 1.8;
const CLOSE_INSIDE_DISTANCE = 0.9;
const PASSABLE_OPEN_AMOUNT = 0.72;
const CLICK_OPEN_SECONDS = 1;
const DOOR_HEIGHT = 2.3;
const WOOD_PLANK_NAME = "castle door plank";

export class CastleDoor {
  /**
   *
    * @returns {string}
   */
  static get modelUrl() {
    return castleDoorsModelUrl;
  }

  /**
   *
    * @type {typeof import("playcanvas")}
   */
  #pc;
  /**
   *
    * @type {import("playcanvas").Entity}
   */
  #entity;
  /**
   *
    * @type {import("playcanvas").AnimController}
   */
  #animationLayer;
  /**
   *
    * @type {number}
   */
  #animationDuration;
  /**
   *
    * @type {{x: number, y: number, z: number}}
   */
  #center;
  /**
   *
    * @type {{x: number, z: number}}
   */
  #inward;
  /**
   *
    * @type {{x: number, z: number}}
   */
  #tangent;
  /**
   *
    * @type {number}
   */
  #width;
  /**
   *
    * @type {boolean}
   */
  #targetOpen = false;
  /**
   *
    * @type {number}
   */
  #openAmount = 0;
  /**
   *
    * @type {number}
   */
  #manualOpenRemaining = 0;

  /**
   *
   * @param {{pc: typeof import("playcanvas"), castlePosition: {x: number, z: number, width: number, depth: number, elevation: number}, door: import("src/game/objects/ObjectTypes.js").CastleDoorDefinition, modelLibrary: string, woodMaterial: import("playcanvas").Material}} options
   * @param {typeof import("playcanvas")} options.pc
   * @param {{x: number, z: number, width: number, depth: number, elevation: number}} options.castlePosition
   * @param {import("src/game/objects/ObjectTypes.js").CastleDoorDefinition} options.door
   * @param {string} options.modelLibrary
   * @param {import("playcanvas").Material} options.woodMaterial
   */
  constructor({ pc, castlePosition, door, modelLibrary, woodMaterial }) {

    this.#pc = pc;

    this.#width = door.width;
    const geometry = this.#doorGeometry(castlePosition, door);

    this.#center = geometry.center;

    this.#inward = geometry.inward;

    this.#tangent = geometry.tangent;


    this.#entity = modelLibrary.instantiate(CastleDoor.modelUrl);
    this.#entity.name = `Castle ${door.side.toLowerCase()} doors`;
    this.#applyWoodMaterial(woodMaterial);
    this.#entity.setLocalPosition(
      this.#center.x,
      this.#center.y,
      this.#center.z,
    );
    this.#entity.setLocalEulerAngles(0, geometry.baseYaw, 0);
    const animationTrack = modelLibrary
      .getAnimationTracks(CastleDoor.modelUrl, [
        CASTLE_DOOR_ANIMATION.OPEN,
      ])
      .get(CASTLE_DOOR_ANIMATION.OPEN);
    this.#entity.addComponent("anim", { activate: true });
    this.#entity.anim.addAnimationState(
      CASTLE_DOOR_ANIMATION.OPEN,
      animationTrack,
      1,
      false,
    );

    this.#animationLayer = this.#entity.anim.baseLayer;

    this.#animationDuration = animationTrack.duration;
    this.#animationLayer.play(CASTLE_DOOR_ANIMATION.OPEN);
    this.#entity.anim.speed = 0;
    this.#syncAnimation();
  }

  get entity() {
    return this.#entity;
  }

  /**
   *
    * @returns {boolean}
   */
  get revealsInterior() {
    return this.#shouldOpen() || this.#openAmount > 0.001;
  }

  /**
   *
   * @param {number} duration
   */
  openTemporarily(duration = CLICK_OPEN_SECONDS) {
    this.#manualOpenRemaining = Math.max(
      this.#manualOpenRemaining,
      duration,
    );
  }

  /**
   *
   * @param {number} rayStart
   * @param {number} rayEnd
   */
  getHit(rayStart, rayEnd) {
    if (!this.#entity) {
      return null;
    }
    const inverse = this.#entity.getWorldTransform().clone().invert();
    const localStart = inverse.transformPoint(rayStart, new this.#pc.Vec3());
    const localEnd = inverse.transformPoint(rayEnd, new this.#pc.Vec3());
    const directionZ = localEnd.z - localStart.z;
    if (Math.abs(directionZ) < 0.000001) {
      return null;
    }

    const distance = -localStart.z / directionZ;
    if (distance < 0 || distance > 1) {
      return null;
    }
    const localX = localStart.x + (localEnd.x - localStart.x) * distance;
    const localY = localStart.y + (localEnd.y - localStart.y) * distance;
    if (
      Math.abs(localX) > this.#width / 2 + 0.08 ||
      localY < -0.08 ||
      localY > DOOR_HEIGHT + 0.08
    ) {
      return null;
    }

    return { distance, door: this };
  }

  /**
   *
   * @param {number} rayStart
   * @param {number} rayEnd
   */
  getPointerHit(rayStart, rayEnd) {
    const hit = this.getHit(rayStart, rayEnd);
    return hit ? { ...hit, pointerTarget: this } : null;
  }

  handlePointerDown() {
    this.openTemporarily();
    return true;
  }

  /**
   *
   * @param {{x: number, z: number}} options
   * @param {number} options.x
   * @param {number} options.z
   */
  updateHeroPosition({ x, z }) {
    const deltaX = x - this.#center.x;
    const deltaZ = z - this.#center.z;
    const insideDistance = deltaX * this.#inward.x + deltaZ * this.#inward.z;
    const lateralDistance = Math.abs(
      deltaX * this.#tangent.x + deltaZ * this.#tangent.z,
    );
    const alignedWithDoor = lateralDistance <= this.#width / 2 + 0.8;

    if (insideDistance > CLOSE_INSIDE_DISTANCE) {
      this.#targetOpen = false;
    } else {
      this.#targetOpen =
        alignedWithDoor && Math.abs(insideDistance) <= OPEN_DISTANCE;
    }
  }

  /**
   *
   * @param {number} deltaTime
   */
  update(deltaTime) {
    this.#manualOpenRemaining = Math.max(
      0,
      this.#manualOpenRemaining - deltaTime,
    );
    const target = Number(this.#shouldOpen());
    const amount = OPEN_SPEED * deltaTime;
    if (this.#openAmount < target) {
      this.#openAmount = Math.min(target, this.#openAmount + amount);
    } else if (this.#openAmount > target) {
      this.#openAmount = Math.max(target, this.#openAmount - amount);
    }
    this.#syncAnimation();
  }

  /**
   *
   * @param {number} x
   * @param {number} z
   * @param {number} radius
   */
  intersectsFootprint(x, z, radius) {
    if (this.#openAmount >= PASSABLE_OPEN_AMOUNT) {
      return false;
    }
    const deltaX = x - this.#center.x;
    const deltaZ = z - this.#center.z;
    const normalDistance = Math.abs(
      deltaX * this.#inward.x + deltaZ * this.#inward.z,
    );
    const lateralDistance = Math.abs(
      deltaX * this.#tangent.x + deltaZ * this.#tangent.z,
    );
    return (
      normalDistance <= DOOR_THICKNESS / 2 + radius &&
      lateralDistance <= this.#width / 2 + radius
    );
  }

  /**
   *
   * @param {number} x
   * @param {number} y
   * @param {number} z
   * @param {number} radius
   */
  blocksCameraAt(x, y, z, radius = 0) {
    if (this.#openAmount >= PASSABLE_OPEN_AMOUNT) {
      return false;
    }
    const deltaX = x - this.#center.x;
    const deltaZ = z - this.#center.z;
    const normalDistance = Math.abs(
      deltaX * this.#inward.x + deltaZ * this.#inward.z,
    );
    const lateralDistance = Math.abs(
      deltaX * this.#tangent.x + deltaZ * this.#tangent.z,
    );
    return (
      y >= this.#center.y - radius &&
      y <= this.#center.y + DOOR_HEIGHT + radius &&
      normalDistance <= DOOR_THICKNESS / 2 + radius &&
      lateralDistance <= this.#width / 2 + radius
    );
  }

  destroy() {
    this.#entity?.destroy();
    this.#entity = null;
    this.#animationLayer = null;
  }

  /**
   *
   * @param {{x: number, z: number, width: number, depth: number, elevation: number}} castlePosition
   * @param {import("src/game/objects/ObjectTypes.js").CastleDoorDefinition} door
   */
  #doorGeometry(castlePosition, door) {
    const geometryBySide = {
      WEST: {
        center: {
          x: castlePosition.x + DOOR_INSET,
          y: castlePosition.elevation,
          z: castlePosition.z + door.offset + door.width / 2,
        },
        inward: { x: 1, z: 0 },
        tangent: { x: 0, z: 1 },
        baseYaw: -90,
      },
      EAST: {
        center: {
          x: castlePosition.x + castlePosition.width - DOOR_INSET,
          y: castlePosition.elevation,
          z: castlePosition.z + door.offset + door.width / 2,
        },
        inward: { x: -1, z: 0 },
        tangent: { x: 0, z: 1 },
        baseYaw: -90,
      },
      NORTH: {
        center: {
          x: castlePosition.x + door.offset + door.width / 2,
          y: castlePosition.elevation,
          z: castlePosition.z + DOOR_INSET,
        },
        inward: { x: 0, z: 1 },
        tangent: { x: 1, z: 0 },
        baseYaw: 0,
      },
      SOUTH: {
        center: {
          x: castlePosition.x + door.offset + door.width / 2,
          y: castlePosition.elevation,
          z: castlePosition.z + castlePosition.depth - DOOR_INSET,
        },
        inward: { x: 0, z: -1 },
        tangent: { x: 1, z: 0 },
        baseYaw: 0,
      },
    };
    return geometryBySide[door.side];
  }

  /**
   *
   * @param {import("playcanvas").Material} material
   */
  #applyWoodMaterial(material) {
    const pending = [this.#entity];
    while (pending.length) {
      const entity = pending.pop();
      for (const meshInstance of entity.render?.meshInstances ?? []) {
        const nodeName = meshInstance.node?.name?.toLowerCase() ?? "";
        const materialName = meshInstance.material?.name?.toLowerCase() ?? "";
        const isWood =
          entity.name.toLowerCase().includes(WOOD_PLANK_NAME) ||
          nodeName.includes(WOOD_PLANK_NAME) ||
          materialName === "castle door wood" ||
          materialName === "castle door shadowed wood";
        if (isWood) {
          meshInstance.material = material;
        }
      }
      pending.push(...entity.children);
    }
  }

  #syncAnimation() {
    this.#animationLayer.activeStateCurrentTime =
      this.#animationDuration * this.#openAmount;
  }

  #shouldOpen() {
    return this.#targetOpen || this.#manualOpenRemaining > 0;
  }
}
