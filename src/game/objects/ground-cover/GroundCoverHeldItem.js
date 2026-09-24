import { isNumber } from "../../helpers/types.js";

export class GroundCoverHeldItem {
  #pc;
  #modelLibrary;
  #modelUrl;
  #name;
  #scale;
  #material;
  #castShadows;
  #receiveShadows;
  #gripPoint;
  #pickupTilt;
  #entity = null;
  #visualPivot = null;
  #followTarget = null;
  #ownsMaterial = false;

  constructor({
    pc,
    modelLibrary,
    modelUrl,
    name,
    scale = 1,
    material = null,
    castShadows = true,
    receiveShadows = castShadows,
    gripPoint = { x: 0, y: 0, z: 0 },
    pickupTilt = -68,
  }) {
    this.#pc = pc;
    this.#modelLibrary = modelLibrary;
    this.#modelUrl = modelUrl;
    this.#name = name;
    this.#scale = isNumber(scale)
      ? { x: scale, y: scale, z: scale }
      : { ...scale };
    if (material?.clone) {
      this.#material = material.clone();
      this.#ownsMaterial = true;
    } else {
      this.#material = material;
    }
    this.#castShadows = castShadows;
    this.#receiveShadows = receiveShadows;
    this.#gripPoint = { ...gripPoint };
    this.#pickupTilt = pickupTilt;
  }

  mount(parent, followTarget = parent) {
    if (!this.#entity) {
      this.#createVisual();
    }
    if (this.#entity.parent !== parent) {
      parent.addChild(this.#entity);
    }
    this.#followTarget = followTarget;
    this.#visualPivot.setLocalEulerAngles(0, 0, this.#pickupTilt);
    this.follow();
  }

  follow() {
    if (!this.#entity?.parent || !this.#followTarget) {
      return;
    }
    const gripPosition = this.#entity.parent
      .getWorldTransform()
      .clone()
      .invert()
      .transformPoint(this.#followTarget.getPosition());
    this.#entity.setLocalPosition(gripPosition.sub(this.#scaledGripPoint()));
  }

  destroy() {
    this.#entity?.destroy();
    this.#entity = null;
    this.#visualPivot = null;
    this.#followTarget = null;
    if (this.#ownsMaterial) {
      this.#material?.destroy();
    }
    this.#material = null;
    this.#ownsMaterial = false;
  }

  #createVisual() {
    const gripPoint = this.#scaledGripPoint();
    this.#entity = new this.#pc.Entity(`Held ${this.#name}`);
    this.#visualPivot = new this.#pc.Entity(`Held ${this.#name} grip pivot`);
    this.#visualPivot.setLocalPosition(gripPoint);
    const visual = this.#modelLibrary.instantiateMerged(this.#modelUrl, {
      material: this.#material,
      castShadows: this.#castShadows,
      receiveShadows: this.#receiveShadows,
    });
    visual.name = `Held ${this.#name} visual`;
    visual.setLocalPosition(-gripPoint.x, -gripPoint.y, -gripPoint.z);
    visual.setLocalScale(this.#scale.x, this.#scale.y, this.#scale.z);
    this.#visualPivot.addChild(visual);
    this.#entity.addChild(this.#visualPivot);
  }

  #scaledGripPoint() {
    return new this.#pc.Vec3(
      this.#gripPoint.x * this.#scale.x,
      this.#gripPoint.y * this.#scale.y,
      this.#gripPoint.z * this.#scale.z,
    );
  }
}
