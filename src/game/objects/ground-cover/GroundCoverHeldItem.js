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
  #entity = null;
  #followTarget = null;
  #followOffset = null;
  #initialFollowOffset = null;
  #grippedFollowOffset = null;
  #gripElapsed = 0;

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
  }) {
    this.#pc = pc;
    this.#modelLibrary = modelLibrary;
    this.#modelUrl = modelUrl;
    this.#name = name;
    this.#scale =
      typeof scale === "number"
        ? { x: scale, y: scale, z: scale }
        : { ...scale };
    this.#material = material;
    this.#castShadows = castShadows;
    this.#receiveShadows = receiveShadows;
    this.#sourceParent = sourceParent;
    this.#sourcePosition = { ...sourcePosition };
    this.#sourceRotation = sourceRotation;
    this.#gripPoint = { ...gripPoint };
  }

  mount(parent, followTarget = parent) {
    if (!this.#entity) {
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
    if (this.#entity.parent !== parent) {
      parent.addChild(this.#entity);
    }
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
    const scaledGripPoint = new this.#pc.Vec3(
      this.#gripPoint.x * this.#scale.x,
      this.#gripPoint.y * this.#scale.y,
      this.#gripPoint.z * this.#scale.z,
    );
    const rotatedGripPoint = new this.#pc.Quat()
      .setFromEulerAngles(0, this.#sourceRotation, 0)
      .transformVector(scaledGripPoint);
    this.#grippedFollowOffset = rotatedGripPoint.mulScalar(-1);
    this.#gripElapsed = 0;
    this.#entity.setLocalPosition(sourceLocalPosition);
    this.#entity.setLocalEulerAngles(0, this.#sourceRotation, 0);
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
  }

  destroy() {
    this.#entity?.destroy();
    this.#entity = null;
    this.#followTarget = null;
    this.#followOffset = null;
    this.#initialFollowOffset = null;
    this.#grippedFollowOffset = null;
  }
}
