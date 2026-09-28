const BODY_MASS = 0.008;
const BODY_HEIGHT = 0.035;
const BODY_PIVOT_HEIGHT = 0.09;
const BODY_RADIUS_SCALE = 0.72;
const MAXIMUM_BEND_ANGLE = 76;
const MAXIMUM_COMPRESSION = 0.08;
const FOOT_RADIUS = 0.17;
const FOOT_FORWARD_OFFSET = 0.1;
const FOOT_SIDE_OFFSET = 0.13;
const FOOT_CENTER_HEIGHT = 0.16;

export class FlowerPhysics {
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
    * @type {Array<{entity: import("playcanvas").Entity, body: import("playcanvas").RigidBodyComponent}>}
   */
  #feet = [];
  /**
   *
    * @type {Array<{entity: import("playcanvas").Entity, matrixIndex: number}>}
   */
  #flowers = [];
  /**
   *
    * @type {Map}
   */
  #batches = new Map();
  /**
   *
    * @type {typeof import("playcanvas")}
   */
  #up;
  /**
   *
    * @type {{x: number, y: number, z: number}}
   */
  #visualPosition;
  /**
   *
    * @type {{x: number, y: number, z: number}}
   */
  #visualRotation;
  /**
   *
    * @type {boolean}
   */
  #hiddenRotation;
  /**
   *
    * @type {typeof import("playcanvas")}
   */
  #hiddenScale;

  /**
   *
   * @param {{pc: typeof import("playcanvas")}} options
   * @param {typeof import("playcanvas")} options.pc
   */
  constructor({ pc }) {
    this.#pc = pc;
    this.#entity = new pc.Entity("Flower physics");
    this.#up = new pc.Vec3(0, 1, 0);
    this.#visualPosition = new pc.Vec3();
    this.#visualRotation = new pc.Quat();
    this.#hiddenRotation = new pc.Quat();
    this.#hiddenScale = new pc.Vec3(0, 0, 0);
    this.#feet = [this.#createFoot("left"), this.#createFoot("right")];
  }

  get entity() {
    return this.#entity;
  }

  /**
   *
   * @param {{variant: string, matrixIndex: number, position: {x: number, y: number, z: number}, rotation: number, horizontalScale: {x: number, y: number, z: number}, verticalScale: {x: number, y: number, z: number}, interactionRadius: number}} options
   * @param {string} options.variant
   * @param {number} options.matrixIndex
   * @param {{x: number, y: number, z: number}} options.position
   * @param {number} options.rotation
   * @param {{x: number, y: number, z: number}} options.horizontalScale
   * @param {{x: number, y: number, z: number}} options.verticalScale
   * @param {number} options.interactionRadius
   */
  addFlower({
    variant,
    matrixIndex,
    position,
    rotation,
    horizontalScale,
    verticalScale,
    interactionRadius,
  }) {
    const pivotHeight = BODY_PIVOT_HEIGHT * verticalScale;
    const anchor = new this.#pc.Entity(`${variant} physics anchor`);
    anchor.setLocalPosition(position.x, position.y, position.z);

    const body = new this.#pc.Entity(`${variant} physics body`);
    body.setLocalPosition(0, pivotHeight, 0);
    body.addComponent("collision", {
      type: "cylinder",
      radius: interactionRadius * BODY_RADIUS_SCALE,
      height: BODY_HEIGHT,
      axis: 1,
    });
    body.addComponent("rigidbody", {
      type: this.#pc.BODYTYPE_DYNAMIC,
      mass: BODY_MASS,
      friction: 0.75,
      restitution: 0,
      linearDamping: 0.58,
      angularDamping: 0.7,
      group: this.#pc.BODYGROUP_USER_1,
      mask: this.#pc.BODYGROUP_USER_2,
    });
    anchor.addChild(body);
    anchor.addComponent("joint", {
      type: this.#pc.JOINTTYPE_6DOF,
      entityA: body,
      linearMotionX: this.#pc.MOTION_LOCKED,
      linearMotionY: this.#pc.MOTION_LIMITED,
      linearMotionZ: this.#pc.MOTION_LOCKED,
      linearLimitsY: [-MAXIMUM_COMPRESSION, 0.01],
      linearStiffness: [0, 12, 0],
      linearDamping: [1, 0.86, 1],
      angularMotionX: this.#pc.MOTION_LIMITED,
      angularMotionY: this.#pc.MOTION_LOCKED,
      angularMotionZ: this.#pc.MOTION_LIMITED,
      angularLimitsX: [-MAXIMUM_BEND_ANGLE, MAXIMUM_BEND_ANGLE],
      angularLimitsZ: [-MAXIMUM_BEND_ANGLE, MAXIMUM_BEND_ANGLE],
      angularStiffness: [0.06, 0, 0.06],
      angularDamping: [0.74, 1, 0.74],
    });
    this.#entity.addChild(anchor);

    const flower = {
      anchor,
      body,
      hidden: false,
      matrix: new this.#pc.Mat4(),
      matrixIndex,
      pivotHeight,
      rotation: new this.#pc.Quat().setFromEulerAngles(0, rotation, 0),
      scale: new this.#pc.Vec3(
        horizontalScale,
        verticalScale,
        horizontalScale,
      ),
      variant,
    };
    this.#flowers.push(flower);
    return flower;
  }

  /**
   *
   * @param {string} variant
   * @param {import("playcanvas").VertexBuffer} vertexBuffer
   */
  setBatch(variant, vertexBuffer) {
    this.#batches.set(variant, vertexBuffer);
  }

  /**
   *
   * @param {{x: number, y: number, z: number}} options
   * @param {number} options.x
   * @param {number} options.y
   * @param {number} options.z
   * @param {{x: number, y: number, z: number}} direction
   */
  updateHeroPosition({ x, y, z }, direction = { x: 0, z: 1 }) {
    const directionLength = Math.hypot(direction.x, direction.z) || 1;
    const forwardX = direction.x / directionLength;
    const forwardZ = direction.z / directionLength;
    const rightX = forwardZ;
    const rightZ = -forwardX;
    const centerX = x + forwardX * FOOT_FORWARD_OFFSET;
    const centerZ = z + forwardZ * FOOT_FORWARD_OFFSET;
    const centerY = y + FOOT_CENTER_HEIGHT;

    this.#feet[0].setPosition(
      centerX - rightX * FOOT_SIDE_OFFSET,
      centerY,
      centerZ - rightZ * FOOT_SIDE_OFFSET,
    );
    this.#feet[1].setPosition(
      centerX + rightX * FOOT_SIDE_OFFSET,
      centerY,
      centerZ + rightZ * FOOT_SIDE_OFFSET,
    );
  }

  /**
   *
   * @param {{entity: import("playcanvas").Entity, body: import("playcanvas").RigidBodyComponent}} flower
   */
  hide(flower) {
    flower.hidden = true;
    flower.anchor.enabled = false;
    this.#writeBatch(flower.variant);
  }

  updateMatrices() {
    for (const variant of this.#batches.keys()) {
      this.#writeBatch(variant);
    }
  }

  destroy() {
    this.#entity.destroy();
    this.#feet = [];
    this.#flowers = [];
    this.#batches.clear();
  }

  /**
   *
   * @param {{normal: import("src/game/objects/ObjectTypes.js").Point3}} side
   */
  #createFoot(side) {
    const foot = new this.#pc.Entity(`Hero ${side} flower collider`);
    foot.setLocalPosition(0, -1000, 0);
    foot.addComponent("collision", {
      type: "sphere",
      radius: FOOT_RADIUS,
    });
    foot.addComponent("rigidbody", {
      type: this.#pc.BODYTYPE_KINEMATIC,
      friction: 0.8,
      restitution: 0,
      group: this.#pc.BODYGROUP_USER_2,
      mask: this.#pc.BODYGROUP_USER_1,
    });
    this.#entity.addChild(foot);
    return foot;
  }

  /**
   *
   * @param {string} variant
   */
  #writeBatch(variant) {
    const vertexBuffer = this.#batches.get(variant);
    if (!vertexBuffer) {
      return;
    }
    const storage = vertexBuffer.lock();
    const matrices =
      storage instanceof Float32Array ? storage : new Float32Array(storage);

    for (const flower of this.#flowers) {
      if (flower.variant !== variant) {
        continue;
      }
      if (flower.hidden) {
        flower.matrix.setTRS(
          flower.body.getPosition(),
          this.#hiddenRotation,
          this.#hiddenScale,
        );
      } else {
        const bodyRotation = flower.body.getRotation();
        bodyRotation.transformVector(this.#up, this.#visualPosition);
        this.#visualPosition
          .mulScalar(-flower.pivotHeight)
          .add(flower.body.getPosition());
        this.#visualRotation.mul2(bodyRotation, flower.rotation);
        flower.matrix.setTRS(
          this.#visualPosition,
          this.#visualRotation,
          flower.scale,
        );
      }
      matrices.set(flower.matrix.data, flower.matrixIndex * 16);
    }
    vertexBuffer.unlock();
  }
}
