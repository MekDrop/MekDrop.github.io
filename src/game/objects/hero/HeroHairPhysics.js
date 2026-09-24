const DRIVER_MASS = 0.04;
const DRIVER_RADIUS = 0.08;
const DRIVER_LOCAL_HEIGHT = 0.727;
const MAXIMUM_COMPRESSION = 0.055;
const MAXIMUM_LIFT = 0.008;
const MAXIMUM_ANCHOR_STEP = 0.4;

function copyVector(vector) {
  return { x: vector.x, y: vector.y, z: vector.z };
}

function profileFor(name) {
  if (/hair cap/i.test(name)) {
    return {
      verticalShift: 0.9,
      verticalSquash: 0.1,
      widthSpread: 0.025,
      pitch: 0,
      roll: 0,
    };
  }
  if (/hair mass/i.test(name)) {
    return {
      verticalShift: 0.45,
      verticalSquash: 0.045,
      widthSpread: 0.015,
      pitch: 0,
      roll: 0,
    };
  }
  if (/swept fringe/i.test(name)) {
    return {
      verticalShift: 0.58,
      verticalSquash: 0.015,
      widthSpread: 0,
      pitch: -5,
      roll: 7,
    };
  }
  if (/layered lock/i.test(name)) {
    return {
      verticalShift: 0.4,
      verticalSquash: 0,
      widthSpread: 0,
      pitch: -3,
      roll: 9,
    };
  }
  return {
    verticalShift: 0.28,
    verticalSquash: 0,
    widthSpread: 0,
    pitch: 2,
    roll: 6,
  };
}

export class HeroHairPhysics {
  #pc;
  #headEntity;
  #modelScale;
  #parts;
  #entity;
  #anchor;
  #driver;
  #joint;
  #anchorPosition;
  #previousAnchorPosition;
  #anchorHeight;
  #gravityVector = null;
  #compression = 0;

  constructor({ pc, app, headEntity, hairEntities, modelScale }) {
    this.#pc = pc;
    this.#headEntity = headEntity;
    this.#modelScale = modelScale;
    this.#anchorHeight = DRIVER_LOCAL_HEIGHT * modelScale;
    this.#parts = hairEntities.filter(Boolean).map((entity) => ({
      entity,
      position: copyVector(entity.getLocalPosition()),
      rotation: copyVector(entity.getLocalEulerAngles()),
      scale: copyVector(entity.getLocalScale()),
      side: Math.sign(entity.getLocalPosition().x),
      profile: profileFor(entity.name),
    }));
    this.#anchorPosition = new pc.Vec3();
    this.#previousAnchorPosition = new pc.Vec3();

    this.#entity = new pc.Entity("Hero hair physics");
    this.#anchor = new pc.Entity("Hero hair physics anchor");
    this.#driver = new pc.Entity("Hero hair physics driver");
    this.#joint = new pc.Entity("Hero hair spring joint");
    this.#syncAnchor(true);
    this.#driver.setPosition(this.#anchorPosition);
    this.#driver.setRotation(this.#headEntity.getRotation());

    this.#anchor.addComponent("collision", {
      type: "sphere",
      radius: 0.005,
    });
    this.#anchor.addComponent("rigidbody", {
      type: pc.BODYTYPE_KINEMATIC,
      group: pc.BODYGROUP_USER_3,
      mask: pc.BODYMASK_NONE,
    });
    this.#driver.addComponent("collision", {
      type: "sphere",
      radius: DRIVER_RADIUS,
    });
    this.#driver.addComponent("rigidbody", {
      type: pc.BODYTYPE_DYNAMIC,
      mass: DRIVER_MASS,
      friction: 0,
      restitution: 0,
      linearDamping: 0.18,
      angularDamping: 1,
      group: pc.BODYGROUP_USER_3,
      mask: pc.BODYGROUP_USER_4,
    });
    this.#joint.addComponent("joint", {
      type: pc.JOINTTYPE_6DOF,
      entityA: this.#driver,
      entityB: this.#anchor,
      linearMotionX: pc.MOTION_LOCKED,
      linearMotionY: pc.MOTION_LIMITED,
      linearMotionZ: pc.MOTION_LOCKED,
      linearLimitsY: [-MAXIMUM_COMPRESSION, MAXIMUM_LIFT],
      linearStiffness: [0, 18, 0],
      linearDamping: [1, 0.84, 1],
      angularMotionX: pc.MOTION_LOCKED,
      angularMotionY: pc.MOTION_LOCKED,
      angularMotionZ: pc.MOTION_LOCKED,
    });
    this.#entity.addChild(this.#anchor);
    this.#entity.addChild(this.#driver);
    this.#entity.addChild(this.#joint);
    app.root.addChild(this.#entity);
    this.#disableDriverGravity();
  }

  get state() {
    return {
      compression: this.#compression,
      engine: "ammo",
    };
  }

  update() {
    if (!this.#entity) {
      return;
    }
    const anchorMoved = this.#syncAnchor();
    if (anchorMoved > MAXIMUM_ANCHOR_STEP) {
      this.#driver.rigidbody.teleport(
        this.#anchorPosition,
        this.#headEntity.getRotation(),
      );
      this.#driver.rigidbody.linearVelocity = new this.#pc.Vec3();
      this.#driver.rigidbody.activate();
    }

    const driverPosition = this.#driver.getPosition();
    const offsetY = this.#anchorPosition.y - driverPosition.y;
    const worldCompression = Math.max(
      -MAXIMUM_LIFT,
      Math.min(MAXIMUM_COMPRESSION, offsetY),
    );
    this.#compression = worldCompression / this.#modelScale;
    this.#applyPose();
  }

  destroy() {
    this.#compression = 0;
    this.#applyPose();
    const ammo = globalThis.Ammo;
    if (this.#gravityVector && ammo?.destroy) {
      ammo.destroy(this.#gravityVector);
    }
    this.#gravityVector = null;
    this.#entity?.destroy();
    this.#entity = null;
    this.#anchor = null;
    this.#driver = null;
    this.#joint = null;
    this.#headEntity = null;
    this.#parts = [];
  }

  #syncAnchor(initial = false) {
    const headPosition = this.#headEntity.getPosition();
    this.#anchorPosition.set(
      headPosition.x,
      headPosition.y + this.#anchorHeight,
      headPosition.z,
    );
    const distance = initial
      ? 0
      : Math.hypot(
          this.#anchorPosition.x - this.#previousAnchorPosition.x,
          this.#anchorPosition.y - this.#previousAnchorPosition.y,
          this.#anchorPosition.z - this.#previousAnchorPosition.z,
        );
    this.#anchor.setPosition(this.#anchorPosition);
    this.#previousAnchorPosition.set(
      this.#anchorPosition.x,
      this.#anchorPosition.y,
      this.#anchorPosition.z,
    );
    return distance;
  }

  #disableDriverGravity() {
    const body = this.#driver.rigidbody?.body;
    const ammo = globalThis.Ammo;
    if (!body?.setGravity || !ammo?.btVector3) {
      return;
    }
    this.#gravityVector = new ammo.btVector3(0, 0, 0);
    body.setGravity(this.#gravityVector);
    this.#driver.rigidbody.activate();
  }

  #applyPose() {
    const maximumLocalCompression = MAXIMUM_COMPRESSION / this.#modelScale;
    const response = this.#compression / maximumLocalCompression;
    for (const part of this.#parts) {
      const { entity, position, rotation, scale, side, profile } = part;
      entity.setLocalPosition(
        position.x,
        position.y - this.#compression * profile.verticalShift,
        position.z,
      );
      entity.setLocalEulerAngles(
        rotation.x + response * profile.pitch,
        rotation.y,
        rotation.z + response * profile.roll * side,
      );
      entity.setLocalScale(
        scale.x * (1 + response * profile.widthSpread),
        scale.y * (1 - response * profile.verticalSquash),
        scale.z * (1 + response * profile.widthSpread),
      );
    }
  }
}
