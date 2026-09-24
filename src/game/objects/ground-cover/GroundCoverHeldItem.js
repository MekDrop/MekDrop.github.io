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
  #pickupPitch;
  #pickupYaw;
  #keepCapUpright;
  #entity = null;
  #visualPivot = null;
  #followTarget = null;
  #ownsMaterial = false;
  #ownedPartMaterials = [];

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
    pickupPitch = 0,
    pickupYaw = 0,
    keepCapUpright = false,
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
    this.#pickupPitch = pickupPitch;
    this.#pickupYaw = pickupYaw;
    this.#keepCapUpright = keepCapUpright;
  }

  mount(parent, followTarget = parent) {
    if (!this.#entity) {
      this.#createVisual();
    }
    if (this.#entity.parent !== parent) {
      parent.addChild(this.#entity);
    }
    this.#followTarget = followTarget;
    const outwardRotation = new this.#pc.Quat().setFromEulerAngles(
      0,
      this.#pickupYaw,
      0,
    );
    const pitchRotation = new this.#pc.Quat().setFromEulerAngles(
      this.#pickupPitch,
      0,
      0,
    );
    const tiltRotation = new this.#pc.Quat().setFromEulerAngles(
      0,
      0,
      this.#pickupTilt,
    );
    this.#visualPivot.setLocalRotation(
      outwardRotation.mul(pitchRotation).mul(tiltRotation),
    );
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
    for (const material of this.#ownedPartMaterials) {
      material.destroy();
    }
    this.#ownedPartMaterials = [];
  }

  #createVisual() {
    const gripPoint = this.#scaledGripPoint();
    this.#entity = new this.#pc.Entity(`Held ${this.#name}`);
    this.#visualPivot = new this.#pc.Entity(`Held ${this.#name} grip pivot`);
    this.#visualPivot.setLocalPosition(gripPoint);
    const visual = this.#keepCapUpright
      ? this.#modelLibrary.instantiate(this.#modelUrl)
      : this.#modelLibrary.instantiateMerged(this.#modelUrl, {
          material: this.#material,
          castShadows: this.#castShadows,
          receiveShadows: this.#receiveShadows,
        });
    if (this.#keepCapUpright) {
      this.#matchMergedAppearance(visual);
      this.#orientMushroomCaps(visual);
    }
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

  #matchMergedAppearance(visual) {
    const replacements = new Map();
    const pending = [visual];
    while (pending.length) {
      const node = pending.pop();
      for (const meshInstance of node.render?.meshInstances ?? []) {
        const source = meshInstance.material;
        let material = replacements.get(source);
        if (!material) {
          material = new this.#pc.StandardMaterial();
          material.name = `${this.#name} held source color`;
          // Ground items bake diffuse colors into vertex colors.
          const color = source?.diffuse ?? this.#pc.Color.WHITE;
          const brightness = node.name.endsWith(" stalk") ? 0.85 : 1;
          material.diffuse = new this.#pc.Color(
            color.r ** (1 / 2.2) * brightness,
            color.g ** (1 / 2.2) * brightness,
            color.b ** (1 / 2.2) * brightness,
          );
          material.opacity = source?.opacity ?? 1;
          material.gloss = 0.08;
          material.metalness = 0;
          material.useMetalness = true;
          material.update();
          replacements.set(source, material);
          this.#ownedPartMaterials.push(material);
        }
        meshInstance.material = material;
      }
      pending.push(...node.children);
    }
  }

  #orientMushroomCaps(visual) {
    const nodes = [];
    const pending = [visual];
    while (pending.length) {
      const node = pending.pop();
      nodes.push(node);
      pending.push(...node.children);
    }

    const stalks = nodes.filter((node) => node.name.endsWith(" stalk"));
    const stalkJoints = new Map();
    let heldStalk = null;
    let nearestGripDistance = Infinity;
    for (const stalk of stalks) {
      const center = stalk.getLocalPosition().clone();
      const joint = center.clone();
      joint.y *= 2;
      stalkJoints.set(stalk.name, joint);
      const distance =
        (center.x - this.#gripPoint.x) ** 2 +
        (center.z - this.#gripPoint.z) ** 2;
      if (distance < nearestGripDistance) {
        nearestGripDistance = distance;
        heldStalk = stalk;
      }
    }

    if (heldStalk && this.#gripPoint.y < 0) {
      const top = stalkJoints.get(heldStalk.name);
      const bottom = new this.#pc.Vec3(
        this.#gripPoint.x,
        this.#gripPoint.y,
        this.#gripPoint.z,
      );
      const direction = top.clone().sub(bottom);
      const originalHeight = top.y;
      const length = direction.length();
      const scale = heldStalk.getLocalScale();
      heldStalk.setLocalScale(
        scale.x,
        scale.y * (length / originalHeight),
        scale.z,
      );
      heldStalk.setLocalPosition(top.clone().add(bottom).mulScalar(0.5));
      heldStalk.setLocalRotation(
        new this.#pc.Quat().setFromDirections(
          new this.#pc.Vec3(0, 1, 0),
          direction.normalize(),
        ),
      );
    }

    for (const cap of nodes.filter((node) => node.name.endsWith(" cap"))) {
      const prefix = cap.name.slice(0, -4);
      const parent = cap.parent;
      const joint =
        stalkJoints.get(`${prefix} stalk`) ??
        cap.getLocalPosition().clone();
      const pivot = new this.#pc.Entity(`${prefix} held cap pivot`);
      pivot.setLocalPosition(joint);
      parent.addChild(pivot);

      for (const part of nodes.filter(
        (node) =>
          node.parent === parent &&
          (node === cap ||
            (node.name.startsWith(`${prefix} `) && node.name.includes("spot"))),
      )) {
        const position = part.getLocalPosition().clone().sub(joint);
        parent.removeChild(part);
        pivot.addChild(part);
        part.setLocalPosition(position);
      }
      // Keep the cap angled with the stalk while its top still points upward.
      const capUprightCorrection = 0.5;
      const undoTilt = new this.#pc.Quat().setFromEulerAngles(
        0,
        0,
        -this.#pickupTilt * capUprightCorrection,
      );
      const undoPitch = new this.#pc.Quat().setFromEulerAngles(
        -this.#pickupPitch * capUprightCorrection,
        0,
        0,
      );
      pivot.setLocalRotation(undoTilt.mul(undoPitch));
    }
  }
}
