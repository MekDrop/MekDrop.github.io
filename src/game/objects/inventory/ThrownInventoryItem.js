import { GRASS_SURFACE_LIFT } from "../../config/terrain.js";

const THROW_SPEED = 1.45;
const THROW_LIFT = 3.15;
const FLOOR_OFFSET = 0.04;
const DROP_FALL_HEIGHT = 0.85;
const FLOOR_HALF_SIZE = 3;
const FLOOR_HALF_HEIGHT = 0.025;
const BODY_HALF_EXTENTS = Object.freeze({ x: 0.12, y: 0.1, z: 0.12 });
const BODY_MASS = 0.08;
const LINEAR_DAMPING = 0.08;
const ANGULAR_DAMPING = 0.48;
const ANGULAR_VELOCITY = Object.freeze({
  x: (310 * Math.PI) / 180,
  y: (220 * Math.PI) / 180,
  z: (-270 * Math.PI) / 180,
});
const FADE_SECONDS = 0.24;
const GRASS_CONTACT_RADIUS = 0.16;

export class ThrownInventoryItem {
  #pc;
  #entity;
  #body;
  #floor;
  #grassSurfaceY;
  #touchingGrass = false;
  #forward;
  #worldForward;
  #materials = [];
  #fading = false;
  #fadeElapsed = 0;
  #expired = false;

  constructor({
    pc,
    modelLibrary,
    item,
    position,
    direction,
    dropped = false,
    dropStartY = null,
  }) {
    this.#pc = pc;
    const floorSurfaceY = position.y;
    this.#grassSurfaceY = floorSurfaceY + GRASS_SURFACE_LIFT;
    this.#forward = new pc.Vec3(0, 0, 1);
    this.#worldForward = new pc.Vec3();
    const horizontalLength = Math.hypot(direction.x, direction.z) || 1;
    const bodyY = dropped
      ? Math.max(
          floorSurfaceY + FLOOR_OFFSET,
          Number.isFinite(dropStartY)
            ? dropStartY
            : floorSurfaceY + DROP_FALL_HEIGHT,
        )
      : position.y + 0.86;

    this.#entity = new pc.Entity(`Thrown inventory item ${item.variant}`);
    const body = new pc.Entity(`Thrown inventory item body ${item.variant}`);
    body.setLocalPosition(position.x, bodyY, position.z);
    body.setLocalEulerAngles(-18, 24, 12);
    const model = modelLibrary.instantiate(item.modelUrl);
    this.#cloneMaterials(model);
    body.addChild(model);
    body.addComponent("collision", {
      type: "box",
      halfExtents: new pc.Vec3(
        BODY_HALF_EXTENTS.x,
        BODY_HALF_EXTENTS.y,
        BODY_HALF_EXTENTS.z,
      ),
      linearOffset: new pc.Vec3(0, BODY_HALF_EXTENTS.y, 0),
    });
    body.addComponent("rigidbody", {
      type: pc.BODYTYPE_DYNAMIC,
      mass: BODY_MASS,
      friction: 0.74,
      rollingFriction: 0.3,
      restitution: 0.28,
      linearDamping: LINEAR_DAMPING,
      angularDamping: ANGULAR_DAMPING,
      group: pc.BODYGROUP_USER_3,
      mask: pc.BODYGROUP_USER_4,
    });
    body.rigidbody.linearVelocity = dropped
      ? new pc.Vec3(0, 0, 0)
      : new pc.Vec3(
          (direction.x / horizontalLength) * THROW_SPEED,
          THROW_LIFT,
          (direction.z / horizontalLength) * THROW_SPEED,
        );
    body.rigidbody.angularVelocity = dropped
      ? new pc.Vec3(0, 0, 0)
      : new pc.Vec3(
          ANGULAR_VELOCITY.x,
          ANGULAR_VELOCITY.y,
          ANGULAR_VELOCITY.z,
        );
    this.#body = body;
    this.#entity.addChild(body);

    const floor = new pc.Entity(`Thrown inventory item floor ${item.variant}`);
    floor.setLocalPosition(
      position.x,
      floorSurfaceY + FLOOR_OFFSET - FLOOR_HALF_HEIGHT,
      position.z,
    );
    floor.addComponent("collision", {
      type: "box",
      halfExtents: new pc.Vec3(
        FLOOR_HALF_SIZE,
        FLOOR_HALF_HEIGHT,
        FLOOR_HALF_SIZE,
      ),
    });
    floor.addComponent("rigidbody", {
      type: pc.BODYTYPE_STATIC,
      friction: 0.86,
      restitution: 0.28,
      group: pc.BODYGROUP_USER_4,
      mask: pc.BODYGROUP_USER_3,
    });
    this.#floor = floor;
    body.rigidbody.on("collisionstart", this.#handleCollisionStart);
    body.rigidbody.on("collisionend", this.#handleCollisionEnd);
    this.#entity.addChild(floor);
  }

  get entity() {
    return this.#entity;
  }

  get expired() {
    return this.#expired;
  }

  get state() {
    const position = this.#body?.getPosition();
    return {
      position: position
        ? { x: position.x, y: position.y, z: position.z }
        : null,
    };
  }

  get grassImpressionContacts() {
    if (!this.#touchingGrass) {
      return [];
    }
    const position = this.#body.getPosition();
    this.#body
      .getRotation()
      .transformVector(this.#forward, this.#worldForward);
    const directionLength =
      Math.hypot(this.#worldForward.x, this.#worldForward.z) || 1;
    return [{
      id: this,
      x: position.x,
      y: this.#grassSurfaceY,
      z: position.z,
      directionX: this.#worldForward.x / directionLength,
      directionZ: this.#worldForward.z / directionLength,
      halfWidth: GRASS_CONTACT_RADIUS,
      halfLength: GRASS_CONTACT_RADIUS,
      strength: 1,
    }];
  }

  beginFade() {
    if (this.#fading || this.#expired) {
      return;
    }
    this.#fading = true;
    this.#fadeElapsed = 0;
    for (const material of this.#materials) {
      material.blendType = this.#pc.BLEND_NORMAL;
      material.opacity = 1;
      material.update();
    }
  }

  advance(deltaTime) {
    if (this.#expired || !this.#fading) {
      return;
    }
    this.#advanceFade(Math.min(deltaTime, 0.1));
  }

  destroy() {
    this.#body?.rigidbody.off("collisionstart", this.#handleCollisionStart);
    this.#body?.rigidbody.off("collisionend", this.#handleCollisionEnd);
    this.#entity?.destroy();
    this.#entity = null;
    this.#body = null;
    this.#floor = null;
    for (const material of this.#materials) {
      material.destroy();
    }
    this.#materials = [];
    this.#pc = null;
  }

  #cloneMaterials(model) {
    const clones = new Map();
    for (const render of model.findComponents("render")) {
      for (const meshInstance of render.meshInstances) {
        const source = meshInstance.material;
        let material = clones.get(source);
        if (!material) {
          material = source.clone();
          material.name = `Thrown ${source.name}`;
          material.update();
          clones.set(source, material);
          this.#materials.push(material);
        }
        meshInstance.material = material;
      }
    }
  }

  #handleCollisionStart = (result) => {
    if (result.other === this.#floor) {
      this.#touchingGrass = true;
    }
  };

  #handleCollisionEnd = (other) => {
    if (other === this.#floor) {
      this.#touchingGrass = false;
    }
  };

  #advanceFade(deltaTime) {
    this.#fadeElapsed = Math.min(
      FADE_SECONDS,
      this.#fadeElapsed + deltaTime,
    );
    const progress = this.#fadeElapsed / FADE_SECONDS;
    const opacity = 1 - progress * progress * (3 - 2 * progress);
    for (const material of this.#materials) {
      material.opacity = opacity;
      material.update();
    }
    this.#expired = progress >= 1;
  }
}
