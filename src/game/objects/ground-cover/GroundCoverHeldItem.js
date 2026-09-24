import { isNumber } from "../../helpers/types.js";

const DEFAULT_BODY_COLLIDERS = Object.freeze([
  Object.freeze({
    name: "waist",
    position: { x: 0, y: 0.5, z: 0.06 },
    radius: 0.42,
  }),
  Object.freeze({
    name: "torso",
    position: { x: 0, y: 0.72, z: 0.03 },
    radius: 0.38,
  }),
  Object.freeze({
    name: "head",
    position: { x: 0, y: 1.08, z: 0.02 },
    radius: 0.2,
  }),
]);

const DEFAULT_HELD_PHYSICS = Object.freeze({
  bendAngle: 78,
  bodyColliders: DEFAULT_BODY_COLLIDERS,
  compression: 0.12,
  radius: 0.12,
  recovery: 7,
  response: 18,
});

export class GroundCoverHeldItem {
  static #GRIP_TRANSITION_DURATION = 0.18;

  #pc;
  #modelLibrary;
  #modelUrl;
  #name;
  #scale;
  #material;
  #castShadows;
  #receiveShadows;
  #sourceParent;
  #sourcePosition;
  #sourceRotation;
  #gripPoint;
  #physics;
  #entity = null;
  #visualPivot = null;
  #visualEntity = null;
  #ownsMaterial = false;
  #bodyColliders = [];
  #surfaceColliders = [];
  #surfaceCollisionHandlers = new Map();
  #activeContacts = new Map();
  #followTarget = null;
  #followOffset = null;
  #initialFollowOffset = null;
  #grippedFollowOffset = null;
  #gripElapsed = 0;
  #contactAmount = 0;
  #contactDirectionX = 0;
  #contactDirectionZ = 1;

  constructor({
    pc,
    modelLibrary,
    modelUrl,
    name,
    scale = 1,
    material = null,
    castShadows = true,
    receiveShadows = castShadows,
    sourceParent,
    sourcePosition,
    sourceRotation = 0,
    gripPoint = { x: 0, y: 0, z: 0 },
    physics = null,
  }) {
    this.#pc = pc;
    this.#modelLibrary = modelLibrary;
    this.#modelUrl = modelUrl;
    this.#name = name;
    this.#scale =
      isNumber(scale)
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
    this.#sourceParent = sourceParent;
    this.#sourcePosition = { ...sourcePosition };
    this.#sourceRotation = sourceRotation;
    this.#gripPoint = { ...gripPoint };
    this.#physics = physics
      ? { ...DEFAULT_HELD_PHYSICS, ...physics }
      : null;
  }

  mount(parent, followTarget = parent) {
    if (!this.#entity) {
      if (this.#physics) {
        this.#createDeformableVisual();
      } else {
        this.#createStaticVisual();
      }
    }
    if (this.#entity.parent !== parent) {
      parent.addChild(this.#entity);
    }
    this.#ensureBodyColliders(parent);
    this.#followTarget = followTarget;
    const inverseParentTransform = parent
      .getWorldTransform()
      .clone()
      .invert();
    const sourceWorldPosition = this.#sourceParent
      .getWorldTransform()
      .transformPoint(
        new this.#pc.Vec3(
          this.#sourcePosition.x,
          this.#sourcePosition.y,
          this.#sourcePosition.z,
        ),
      );
    const sourceLocalPosition = inverseParentTransform.transformPoint(
      sourceWorldPosition,
    );
    const targetLocalPosition = inverseParentTransform.transformPoint(
      this.#followTarget.getPosition(),
    );
    this.#followOffset = sourceLocalPosition
      .clone()
      .sub(targetLocalPosition);
    this.#initialFollowOffset = this.#followOffset.clone();
    const rotatedGripPoint = new this.#pc.Quat()
      .setFromEulerAngles(0, this.#sourceRotation, 0)
      .transformVector(this.#scaledGripPoint());
    this.#grippedFollowOffset = rotatedGripPoint.mulScalar(-1);
    this.#gripElapsed = 0;
    this.#contactAmount = 0;
    this.#activeContacts.clear();
    this.#entity.setLocalPosition(sourceLocalPosition);
    this.#entity.setLocalEulerAngles(0, this.#sourceRotation, 0);
    this.#resetDeformation();
    this.#syncCollisionBodies();
  }

  follow(deltaTime) {
    if (!this.#entity?.parent || !this.#followTarget) {
      return;
    }
    this.#gripElapsed += deltaTime;
    const progress = Math.min(
      1,
      this.#gripElapsed / GroundCoverHeldItem.#GRIP_TRANSITION_DURATION,
    );
    const easedProgress = progress * progress * (3 - 2 * progress);
    this.#followOffset.lerp(
      this.#initialFollowOffset,
      this.#grippedFollowOffset,
      easedProgress,
    );
    const localPosition = this.#entity.parent
      .getWorldTransform()
      .clone()
      .invert()
      .transformPoint(this.#followTarget.getPosition());
    localPosition.add(this.#followOffset);
    this.#entity.setLocalPosition(localPosition);
    this.#syncCollisionBodies();
    this.#advanceBodyContact(deltaTime);
  }

  destroy() {
    for (const [surface, handlers] of this.#surfaceCollisionHandlers) {
      surface.rigidbody?.off("collisionstart", handlers.start);
      surface.rigidbody?.off("collisionend", handlers.end);
    }
    this.#surfaceCollisionHandlers.clear();
    this.#activeContacts.clear();
    for (const collider of this.#bodyColliders) {
      collider.destroy();
    }
    this.#bodyColliders = [];
    this.#surfaceColliders = [];
    this.#entity?.destroy();
    this.#entity = null;
    this.#visualPivot = null;
    this.#visualEntity = null;
    this.#followTarget = null;
    this.#followOffset = null;
    this.#initialFollowOffset = null;
    this.#grippedFollowOffset = null;
    this.#contactAmount = 0;
    if (this.#ownsMaterial) {
      this.#material?.destroy();
    }
    this.#material = null;
    this.#ownsMaterial = false;
  }

  #createStaticVisual() {
    this.#entity = this.#modelLibrary.instantiateMerged(
      this.#modelUrl,
      {
        material: this.#material,
        castShadows: this.#castShadows,
        receiveShadows: this.#receiveShadows,
      },
    );
    this.#entity.name = `Held ${this.#name}`;
    this.#entity.setLocalPosition(0, 0, 0);
    this.#entity.setLocalScale(
      this.#scale.x,
      this.#scale.y,
      this.#scale.z,
    );
  }

  #createDeformableVisual() {
    this.#entity = new this.#pc.Entity(`Held ${this.#name}`);
    this.#entity.setLocalPosition(0, 0, 0);
    const gripPoint = this.#scaledGripPoint();
    this.#visualPivot = new this.#pc.Entity(`Held ${this.#name} grip pivot`);
    this.#visualPivot.setLocalPosition(gripPoint.x, gripPoint.y, gripPoint.z);
    this.#visualEntity = this.#modelLibrary.instantiateMerged(
      this.#modelUrl,
      {
        material: this.#material,
        castShadows: this.#castShadows,
        receiveShadows: this.#receiveShadows,
      },
    );
    this.#visualEntity.name = `Held ${this.#name} visual`;
    this.#visualEntity.setLocalPosition(
      -gripPoint.x,
      -gripPoint.y,
      -gripPoint.z,
    );
    this.#visualEntity.setLocalScale(
      this.#scale.x,
      this.#scale.y,
      this.#scale.z,
    );
    this.#visualPivot.addChild(this.#visualEntity);
    this.#entity.addChild(this.#visualPivot);
    this.#createSurfaceColliders(gripPoint);
  }

  #createSurfaceColliders(gripPoint) {
    for (const [index, point] of this.#surfaceSamplePoints(gripPoint).entries()) {
      const collider = new this.#pc.Entity(
        `Held ${this.#name} surface contact ${index}`,
      );
      collider.setLocalPosition(point.x, point.y, point.z);
      collider.addComponent("collision", {
        type: "sphere",
        radius: this.#physics.radius * 0.45,
      });
      collider.addComponent("rigidbody", {
        type: this.#pc.BODYTYPE_DYNAMIC,
        mass: 0.001,
        friction: 0.8,
        restitution: 0,
        linearDamping: 1,
        angularDamping: 1,
        linearFactor: new this.#pc.Vec3(0, 0, 0),
        angularFactor: new this.#pc.Vec3(0, 0, 0),
        group: this.#pc.BODYGROUP_USER_1,
        mask: this.#pc.BODYGROUP_USER_2,
      });
      const start = (result) => this.#handleCollisionStart(collider, result);
      const end = (result) => this.#handleCollisionEnd(collider, result);
      collider.rigidbody.on("collisionstart", start);
      collider.rigidbody.on("collisionend", end);
      this.#surfaceCollisionHandlers.set(collider, { start, end });
      this.#entity.addChild(collider);
      this.#surfaceColliders.push(collider);
    }
  }

  #ensureBodyColliders(parent) {
    if (!this.#physics || this.#bodyColliders.length > 0) {
      return;
    }
    for (const contact of this.#physics.bodyColliders) {
      const collider = new this.#pc.Entity(
        `Held ${this.#name} ${contact.name} body contact`,
      );
      collider.setLocalPosition(
        contact.position.x,
        contact.position.y,
        contact.position.z,
      );
      collider.addComponent("collision", {
        type: "sphere",
        radius: contact.radius,
      });
      collider.addComponent("rigidbody", {
        type: this.#pc.BODYTYPE_KINEMATIC,
        friction: 0.8,
        restitution: 0,
        group: this.#pc.BODYGROUP_USER_2,
        mask: this.#pc.BODYGROUP_USER_1,
      });
      parent.addChild(collider);
      this.#bodyColliders.push(collider);
    }
  }

  #handleCollisionStart(surface, result) {
    const body = result.other;
    if (!this.#bodyColliders.includes(body)) {
      return;
    }
    this.#activeContacts.set(this.#contactKey(surface, body), { surface, body });
  }

  #handleCollisionEnd(surface, result) {
    const body = result.other;
    if (!this.#bodyColliders.includes(body)) {
      return;
    }
    this.#activeContacts.delete(this.#contactKey(surface, body));
  }

  #advanceBodyContact(deltaTime) {
    if (!this.#physics || !this.#visualPivot || !this.#entity.parent) {
      return;
    }
    let targetContact = 0;
    let contactDirectionX = this.#contactDirectionX;
    let contactDirectionZ = this.#contactDirectionZ;
    for (const { surface, body } of this.#activeContacts.values()) {
      const surfacePosition = this.#parentLocalPosition(surface);
      const bodyPosition = this.#parentLocalPosition(body);
      const dx = surfacePosition.x - bodyPosition.x;
      const dz = surfacePosition.z - bodyPosition.z;
      const distance = Math.hypot(dx, dz);
      const amount = Math.max(
        0.35,
        1 - distance / (surface.collision.radius + body.collision.radius),
      );
      if (amount <= targetContact) {
        continue;
      }
      const horizontalDistance = distance || 1;
      targetContact = amount;
      contactDirectionX = dx / horizontalDistance;
      contactDirectionZ = dz / horizontalDistance;
    }
    this.#contactDirectionX = contactDirectionX;
    this.#contactDirectionZ = contactDirectionZ;
    const responseRate = targetContact > this.#contactAmount
      ? this.#physics.response
      : this.#physics.recovery;
    const response = 1 - Math.exp(-deltaTime * responseRate);
    this.#contactAmount += (targetContact - this.#contactAmount) * response;
    const ease = this.#contactAmount * this.#contactAmount *
      (3 - 2 * this.#contactAmount);
    this.#applyContactDeformation(ease);
  }

  #applyContactDeformation(amount) {
    if (!this.#visualEntity || !this.#entity.parent) {
      return;
    }
    let bestContact = null;
    for (const { surface, body } of this.#activeContacts.values()) {
      const surfacePosition = this.#parentLocalPosition(surface);
      const bodyPosition = this.#parentLocalPosition(body);
      const dx = surfacePosition.x - bodyPosition.x;
      const dz = surfacePosition.z - bodyPosition.z;
      const distance = Math.hypot(dx, dz);
      const strength = Math.max(
        0.35,
        1 - distance / (surface.collision.radius + body.collision.radius),
      );
      if (bestContact && strength <= bestContact.strength) {
        continue;
      }
      bestContact = { bodyPosition, dx, dz, strength };
    }
    if (!bestContact) {
      this.#setContactMaterialParameters({
        amount,
        contactLocal: [0, -1000, 0],
        directionLocal: [this.#contactDirectionX, 0, this.#contactDirectionZ],
      });
      return;
    }
    const contactWorld = this.#entity.parent
      .getWorldTransform()
      .transformPoint(bestContact.bodyPosition);
    const contactLocal = this.#visualEntity
      .getWorldTransform()
      .clone()
      .invert()
      .transformPoint(contactWorld);
    const directionLength = Math.hypot(bestContact.dx, bestContact.dz) || 1;
    const parentDirection = new this.#pc.Vec3(
      bestContact.dx / directionLength,
      0,
      bestContact.dz / directionLength,
    );
    const directionLocal = this.#visualEntity
      .getWorldTransform()
      .clone()
      .invert()
      .transformVector(parentDirection)
      .normalize();
    this.#setContactMaterialParameters({
      amount: amount * bestContact.strength,
      contactLocal: [contactLocal.x, contactLocal.y, contactLocal.z],
      directionLocal: [directionLocal.x, directionLocal.y, directionLocal.z],
    });
  }

  #setContactMaterialParameters({ amount, contactLocal, directionLocal }) {
    this.#material?.setParameter("uContactLocal", contactLocal);
    this.#material?.setParameter("uContactDirectionLocal", directionLocal);
    this.#material?.setParameter("uContactRadius", this.#physics?.radius ?? 0.001);
    this.#material?.setParameter("uContactAmount", amount);
  }
  #resetDeformation() {
    this.#visualPivot?.setLocalEulerAngles(0, 0, 0);
    this.#visualPivot?.setLocalScale(1, 1, 1);
    this.#setContactMaterialParameters({
      amount: 0,
      contactLocal: [0, -1000, 0],
      directionLocal: [0, 0, 1],
    });
  }

  #scaledGripPoint() {
    return new this.#pc.Vec3(
      this.#gripPoint.x * this.#scale.x,
      this.#gripPoint.y * this.#scale.y,
      this.#gripPoint.z * this.#scale.z,
    );
  }

  #surfaceSamplePoints(gripPoint) {
    const radius = this.#physics.radius;
    const halfGrip = new this.#pc.Vec3(
      gripPoint.x * 0.5,
      gripPoint.y * 0.5,
      gripPoint.z * 0.5,
    );
    return [
      new this.#pc.Vec3(0, 0, 0),
      halfGrip,
      gripPoint,
      new this.#pc.Vec3(radius, 0, 0),
      new this.#pc.Vec3(-radius, 0, 0),
      new this.#pc.Vec3(0, 0, radius),
      new this.#pc.Vec3(0, 0, -radius),
      new this.#pc.Vec3(halfGrip.x + radius, halfGrip.y, halfGrip.z),
      new this.#pc.Vec3(halfGrip.x - radius, halfGrip.y, halfGrip.z),
      new this.#pc.Vec3(halfGrip.x, halfGrip.y, halfGrip.z + radius),
      new this.#pc.Vec3(halfGrip.x, halfGrip.y, halfGrip.z - radius),
      new this.#pc.Vec3(gripPoint.x + radius, gripPoint.y, gripPoint.z),
      new this.#pc.Vec3(gripPoint.x - radius, gripPoint.y, gripPoint.z),
      new this.#pc.Vec3(gripPoint.x, gripPoint.y, gripPoint.z + radius),
      new this.#pc.Vec3(gripPoint.x, gripPoint.y, gripPoint.z - radius),
    ];
  }

  #syncCollisionBodies() {
    for (const collider of [...this.#bodyColliders, ...this.#surfaceColliders]) {
      collider.rigidbody?.teleport(collider.getPosition(), collider.getRotation());
      collider.rigidbody?.activate();
    }
  }

  #parentLocalPosition(entity) {
    return this.#entity.parent
      .getWorldTransform()
      .clone()
      .invert()
      .transformPoint(entity.getPosition());
  }

  #contactKey(surface, body) {
    return `${surface.getGuid()}:${body.getGuid()}`;
  }
}
