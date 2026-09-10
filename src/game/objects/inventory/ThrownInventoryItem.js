const GRAVITY = 6.8;
const THROW_SPEED = 1.45;
const THROW_LIFT = 2.35;
const FLOOR_OFFSET = 0.04;
const FADE_SECONDS = 0.24;

export class ThrownInventoryItem {
  #pc;
  #entity;
  #materials = [];
  #groundY;
  #position;
  #velocity;
  #rotation = { x: -18, y: 24, z: 12 };
  #angularVelocity = { x: 310, y: 220, z: -270 };
  #settled = false;
  #fading = false;
  #fadeElapsed = 0;
  #expired = false;

  constructor({ pc, modelLibrary, item, position, direction }) {
    this.#pc = pc;
    this.#groundY = position.y + FLOOR_OFFSET;
    this.#position = new pc.Vec3(
      position.x,
      position.y + 0.86,
      position.z,
    );
    const horizontalLength = Math.hypot(direction.x, direction.z) || 1;
    this.#velocity = new pc.Vec3(
      (direction.x / horizontalLength) * THROW_SPEED,
      THROW_LIFT,
      (direction.z / horizontalLength) * THROW_SPEED,
    );

    this.#entity = new pc.Entity(`Thrown inventory item ${item.variant}`);
    this.#entity.setLocalPosition(this.#position);
    const model = modelLibrary.instantiate(item.modelUrl);
    this.#cloneMaterials(model);
    this.#entity.addChild(model);
    this.#applyRotation();
  }

  get entity() {
    return this.#entity;
  }

  get expired() {
    return this.#expired;
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
    if (this.#expired) {
      return;
    }
    const frameTime = Math.min(deltaTime, 0.1);
    this.#advanceThrow(frameTime);
    if (this.#fading) {
      this.#advanceFade(frameTime);
    }
  }

  destroy() {
    this.#entity?.destroy();
    this.#entity = null;
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

  #advanceThrow(deltaTime) {
    if (!this.#settled) {
      this.#velocity.y -= GRAVITY * deltaTime;
      this.#position.x += this.#velocity.x * deltaTime;
      this.#position.y += this.#velocity.y * deltaTime;
      this.#position.z += this.#velocity.z * deltaTime;
      if (this.#position.y <= this.#groundY) {
        this.#position.y = this.#groundY;
        if (Math.abs(this.#velocity.y) > 0.55) {
          this.#velocity.y = Math.abs(this.#velocity.y) * 0.28;
          this.#velocity.x *= 0.62;
          this.#velocity.z *= 0.62;
          this.#angularVelocity.x *= 0.7;
          this.#angularVelocity.y *= 0.7;
          this.#angularVelocity.z *= 0.7;
        } else {
          this.#settled = true;
          this.#velocity.set(0, 0, 0);
        }
      }
      this.#entity.setLocalPosition(this.#position);
    }

    const angularDecay = Math.exp(-deltaTime * (this.#settled ? 8 : 0.65));
    this.#rotation.x += this.#angularVelocity.x * deltaTime;
    this.#rotation.y += this.#angularVelocity.y * deltaTime;
    this.#rotation.z += this.#angularVelocity.z * deltaTime;
    this.#angularVelocity.x *= angularDecay;
    this.#angularVelocity.y *= angularDecay;
    this.#angularVelocity.z *= angularDecay;
    this.#applyRotation();
  }

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

  #applyRotation() {
    this.#entity.setLocalEulerAngles(
      this.#rotation.x,
      this.#rotation.y,
      this.#rotation.z,
    );
  }
}
