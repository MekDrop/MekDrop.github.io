import castleDoorsModelUrl from "../../models/castle/doors/castle-doors.glb?url";

const DOOR_THICKNESS = 0.16;
const DOOR_INSET = 0.28;
const OPEN_SPEED = 3.4;
const OPEN_DISTANCE = 1.8;
const CLOSE_INSIDE_DISTANCE = 0.9;
const PASSABLE_OPEN_AMOUNT = 0.72;
const CLICK_OPEN_SECONDS = 1;
const DOOR_HEIGHT = 2.3;
const OPEN_ANIMATION = "Open";

export class CastleDoor {
  static get modelUrl() {
    return castleDoorsModelUrl;
  }

  #pc;
  #entity;
  #animationLayer;
  #animationDuration;
  #center;
  #inward;
  #tangent;
  #width;
  #targetOpen = false;
  #openAmount = 0;
  #manualOpenRemaining = 0;

  constructor({ pc, castlePosition, door, modelLibrary }) {
    this.#pc = pc;
    this.#width = door.width;
    const geometry = this.#doorGeometry(castlePosition, door);
    this.#center = geometry.center;
    this.#inward = geometry.inward;
    this.#tangent = geometry.tangent;

    this.#entity = modelLibrary.instantiate(CastleDoor.modelUrl);
    this.#entity.name = `Castle ${door.side.toLowerCase()} doors`;
    this.#entity.setLocalPosition(
      this.#center.x,
      this.#center.y,
      this.#center.z,
    );
    this.#entity.setLocalEulerAngles(0, geometry.baseYaw, 0);
    const animationTrack = modelLibrary
      .getAnimationTracks(CastleDoor.modelUrl, [OPEN_ANIMATION])
      .get(OPEN_ANIMATION);
    this.#entity.addComponent("anim", { activate: true });
    this.#entity.anim.addAnimationState(
      OPEN_ANIMATION,
      animationTrack,
      1,
      false,
    );
    this.#animationLayer = this.#entity.anim.baseLayer;
    this.#animationDuration = animationTrack.duration;
    this.#animationLayer.play(OPEN_ANIMATION);
    this.#entity.anim.speed = 0;
    this.#syncAnimation();
  }

  get entity() {
    return this.#entity;
  }

  get revealsInterior() {
    return this.#shouldOpen() || this.#openAmount > 0.001;
  }

  openTemporarily(duration = CLICK_OPEN_SECONDS) {
    this.#manualOpenRemaining = Math.max(
      this.#manualOpenRemaining,
      duration,
    );
  }

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

  destroy() {
    this.#entity?.destroy();
    this.#entity = null;
    this.#animationLayer = null;
  }

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

  #syncAnimation() {
    this.#animationLayer.activeStateCurrentTime =
      this.#animationDuration * this.#openAmount;
  }

  #shouldOpen() {
    return this.#targetOpen || this.#manualOpenRemaining > 0;
  }
}
