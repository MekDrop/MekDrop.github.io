import { FLOWER_WORKER_MESSAGE as MESSAGE } from "../../enum/FlowerWorkerMessage.js";

const BODY_MASS = 0.008;
const DISABLE_WORLD_GRAVITY = 1;
const BODY_PIVOT_HEIGHT = 0.16;
const BODY_RADIUS_SCALE = 0.72;
const FOOT_FORWARD_OFFSET = 0.076;
const FOOT_SIDE_OFFSET = 0.107;
const FOOT_CENTER_HEIGHT = 0.32;
const FOOT_HALF_HEIGHT = 0.3;
const FOOT_HALF_WIDTH = 0.17;

export class FlowerPhysics {
  /**
   * @type {boolean}
   */
  #useWorker;
  /**
   * @type {number}
   */
  #gravity;
  /**
   * @type {Worker|null}
   */
  #worker = null;
  /**
   * @type {boolean}
   */
  #workerStarted = false;
  /**
   * @type {boolean}
   */
  #workerReady = false;
  /**
   * @type {boolean}
   */
  #workerBusy = false;
  /**
   * @type {number}
   */
  #pendingDelta = 0;
  /**
   * @type {Float32Array|null}
   */
  #submittedOffsets = null;
  /**
   * @type {import("../../physics/FlowerPhysicsSimulation.js").FlowerDefinition[]}
   */
  #definitions = [];
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
   * @type {import("playcanvas").ShaderMaterial|null}
   */
  #contactMaterial = null;
  /**
   * @type {Float32Array[]}
   */
  #contactPositions = [new Float32Array(4), new Float32Array(4)];
  /**
   * @type {Float32Array}
   */
  #contactDirection = new Float32Array([0, 1]);
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
   * @type {import("playcanvas").Vec3}
   */
  #deformedScale;
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
   * @param {{pc: typeof import("playcanvas"), useWorker?: boolean, gravity?: number}} options
   * @param {typeof import("playcanvas")} options.pc
   * @param {boolean} options.useWorker
   * @param {number} options.gravity
   */
  constructor({ pc, useWorker = false, gravity = -9.81 }) {
    this.#pc = pc;
    this.#useWorker = useWorker;
    this.#gravity = gravity;
    this.#entity = new pc.Entity("Flower physics");
    this.#visualPosition = new pc.Vec3();
    this.#visualRotation = new pc.Quat();
    this.#deformedScale = new pc.Vec3();
    this.#hiddenRotation = new pc.Quat();
    this.#hiddenScale = new pc.Vec3(0, 0, 0);
    this.#feet = [this.#createFoot("left"), this.#createFoot("right")];
  }

  get entity() {
    return this.#entity;
  }

  /**
   * @returns {import("playcanvas").Vec3[]}
   */
  get footPositions() { return this.#feet.map(
    /**
     * @param {import("playcanvas").Entity} foot
     */
    (foot) => foot.getPosition().clone(),
  ); }

  get footDirection() { return this.#contactDirection; }

  /**
   * @param {ReturnType<FlowerPhysics["addFlower"]>} flower
   * @returns {import("playcanvas").Mat4}
   */
  paperStemMatrix(flower) {
    const root = flower.anchor.getPosition(), tip = flower.body.getPosition();
    const compression = Math.max(0.65, Math.min(1, (tip.y - root.y) / flower.pivotHeight));
    const matrix = new this.#pc.Mat4().setTRS(root, flower.rotation,
      new this.#pc.Vec3(flower.scale.x, flower.scale.y * compression, flower.scale.z));
    matrix.data[4] += (tip.x - root.x) * flower.scale.y / flower.pivotHeight;
    matrix.data[6] += (tip.z - root.z) * flower.scale.y / flower.pivotHeight;
    return matrix;
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
   * @param {number} options.tipHeight Measured model height before vertical scaling.
   */
  addFlower({
    variant,
    matrixIndex,
    position,
    rotation,
    horizontalScale,
    verticalScale,
    interactionRadius,
    tipHeight = BODY_PIVOT_HEIGHT,
  }) {
    const pivotHeight = tipHeight * verticalScale;
    const anchor = new this.#pc.Entity(`${variant} physics anchor`);
    anchor.setLocalPosition(position.x, position.y, position.z);

    const body = new this.#pc.Entity(`${variant} physics body`);
    body.setLocalPosition(0, pivotHeight, 0);
    body.addComponent("collision", {
      type: "cylinder",
      radius: interactionRadius * BODY_RADIUS_SCALE,
      height: 0.035,
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
    body.rigidbody.on("simulationenabled", () => this.#configureTipBody(body));
    // A world-fixed joint cannot follow a floating island. Give it a moving
    // kinematic support, isolated from all collision groups.
    anchor.addComponent("collision", { type: "sphere", radius: 0.01 });
    anchor.addComponent("rigidbody", {
      type: this.#pc.BODYTYPE_KINEMATIC,
      group: this.#pc.BODYGROUP_USER_1,
      mask: 0,
    });
    anchor.addComponent("joint", {
      type: this.#pc.JOINTTYPE_6DOF,
      entityA: anchor,
      entityB: body,
      linearMotionX: this.#pc.MOTION_LIMITED,
      linearMotionY: this.#pc.MOTION_LIMITED,
      linearMotionZ: this.#pc.MOTION_LIMITED,
      linearLimitsX: [-0.18, 0.18],
      linearLimitsY: [-pivotHeight + 0.001, 0.01],
      linearLimitsZ: [-0.18, 0.18],
      linearStiffness: [0.6, 0.6, 0.6],
      linearDamping: [0.86, 0.86, 0.86],
      angularMotionX: this.#pc.MOTION_LOCKED,
      angularMotionY: this.#pc.MOTION_LOCKED,
      angularMotionZ: this.#pc.MOTION_LOCKED,
    });
    this.#entity.addChild(anchor);
    this.#configureTipBody(body);

    const flower = {
      anchor,
      body,
      baseY: position.y,
      offset: 0,
      hidden: false,
      matrix: new this.#pc.Mat4(),
      matrixIndex,
      pivotHeight,
      radius: interactionRadius * BODY_RADIUS_SCALE,
      rotation: new this.#pc.Quat().setFromEulerAngles(0, rotation, 0),
      scale: new this.#pc.Vec3(
        horizontalScale,
        verticalScale,
        horizontalScale,
      ),
      variant,
    };
    this.#flowers.push(flower);
    this.#definitions.push({ position: { ...position }, pivotHeight, radius: interactionRadius });
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
   * @param {import("playcanvas").ShaderMaterial} material
   */
  setContactMaterial(material) {
    this.#contactMaterial = material;
    this.#updateContactMaterial();
  }

  #updateContactMaterial() {
    this.#contactMaterial?.setParameter("uFlowerFootDirection", this.#contactDirection);
    for (let index = 0; index < this.#feet.length; index++) {
      const position = this.#feet[index].getPosition();
      this.#contactPositions[index].set([position.x, position.y - FOOT_HALF_HEIGHT, position.z, 1]);
      this.#contactMaterial?.setParameter(`uFlowerFoot${index}`, this.#contactPositions[index]);
    }
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
    const directionLength = Math.hypot(direction.x, direction.z);
    const forwardX = directionLength ? direction.x / directionLength : this.#contactDirection[0];
    const forwardZ = directionLength ? direction.z / directionLength : this.#contactDirection[1];
    this.#contactDirection.set([forwardX, forwardZ]);
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
    this.#updateContactMaterial();
    this.updateMatrices();
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

  /**
   * @param {ReturnType<FlowerPhysics["addFlower"]>} flower
   * @param {number} offset
   */
  setOffset(flower, offset) {
    const delta = offset - flower.offset;
    if (delta === 0 || flower.hidden) {
      return;
    }
    const bodyPosition = flower.body.getPosition();
    const x = bodyPosition.x;
    const y = bodyPosition.y + delta;
    const z = bodyPosition.z;
    const anchorPosition = flower.anchor.getLocalPosition();
    flower.anchor.setLocalPosition(
      anchorPosition.x,
      flower.baseY + offset,
      anchorPosition.z,
    );
    if (this.#workerReady) {
      flower.body.setPosition(x, y, z);
    } else {
      flower.anchor.rigidbody.syncEntityToBody();
      flower.body.rigidbody.teleport(x, y, z);
    }
    flower.offset = offset;
  }

  updateMatrices() {
    for (const variant of this.#batches.keys()) {
      this.#writeBatch(variant);
    }
  }

  /**
   * @param {import("playcanvas").Entity} entity
   */
  #configureTipBody(entity) {
    const body = entity.rigidbody.body;
    if (!body) { return; }
    body.setSleepingThresholds(0.001, 0.001);
    // PlayCanvas reapplies world gravity each frame. Bullet's per-body flag
    // preserves the supported tip's override so it can recover after contact.
    body.setFlags(body.getFlags() | DISABLE_WORLD_GRAVITY);
    // The rooted stem supports the tip's weight; the joint models its flex.
    const gravity = new Ammo.btVector3(0, 0, 0);
    body.setGravity(gravity);
    Ammo.destroy(gravity);
  }

  /**
   * @param {number} deltaTime
   */
  advance(deltaTime) {
    if (this.#useWorker && !this.#workerStarted && this.#flowers.length) {
      this.#workerStarted = true;
      try {
        this.#worker = new Worker(new URL("../../physics/FlowerPhysics.worker.js", import.meta.url), { type: "module" });
        this.#worker.onmessage = this.#receiveWorkerMessage;
        this.#worker.onerror = this.#handleWorkerError;
        this.#worker.postMessage({ type: MESSAGE.INITIALIZE, definitions: this.#definitions, gravity: this.#gravity });
      } catch {
        this.#restoreMainThreadPhysics();
      }
    }
    this.#pendingDelta = Math.min(this.#pendingDelta + deltaTime, 0.1);
    if (this.#workerReady && !this.#workerBusy) {
      const offsets = new Float32Array(this.#flowers.length);
      const hidden = new Uint8Array(this.#flowers.length);
      for (let index = 0; index < this.#flowers.length; index++) {
        offsets[index] = this.#flowers[index].offset;
        hidden[index] = Number(this.#flowers[index].hidden);
      }
      const feet = new Float32Array(6);
      for (let index = 0; index < this.#feet.length; index++) {
        const position = this.#feet[index].getPosition();
        feet.set([position.x, position.y, position.z], index * 3);
      }
      this.#submittedOffsets = offsets;
      this.#workerBusy = true;
      this.#worker.postMessage({ type: MESSAGE.STEP, deltaTime: this.#pendingDelta, offsets, hidden, feet });
      this.#pendingDelta = 0;
    }
    this.updateMatrices();
  }

  /**
   * @param {MessageEvent} event
   * @type {(event: MessageEvent) => void}
   */
  #receiveWorkerMessage = (event) => {
    const { type, transforms } = event.data;
    if (type === MESSAGE.READY) {
      this.#workerReady = true;
      this.#entity.enabled = false;
    } else if (type === MESSAGE.RESULT) {
      this.#workerBusy = false;
      for (let index = 0; index < this.#flowers.length; index++) {
        const flower = this.#flowers[index];
        if (flower.hidden) { continue; }
        const offset = index * 7;
        this.#visualPosition.set(transforms[offset],
          transforms[offset + 1] + flower.offset - this.#submittedOffsets[index], transforms[offset + 2]);
        this.#visualRotation.set(transforms[offset + 3], transforms[offset + 4], transforms[offset + 5], transforms[offset + 6]);
        flower.body.setPositionAndRotation(this.#visualPosition, this.#visualRotation);
      }
    } else if (type === MESSAGE.FAILED) {
      console.warn(event.data.detail);
      this.#restoreMainThreadPhysics();
    }
  };

  /**
   * @param {ErrorEvent} event
   * @type {(event: ErrorEvent) => void}
   */
  #handleWorkerError = (event) => {
    event.preventDefault();
    console.warn(event.message);
    this.#restoreMainThreadPhysics();
  };

  /**
   * @type {() => void}
   */
  #restoreMainThreadPhysics = () => {
    this.#worker?.terminate();
    this.#worker = null;
    this.#workerReady = false;
    this.#workerBusy = false;
    for (const flower of this.#flowers) {
      if (flower.hidden) { continue; }
      flower.anchor.rigidbody.syncEntityToBody();
      flower.body.rigidbody.teleport(flower.body.getPosition(), this.#hiddenRotation);
    }
    this.#entity.enabled = true;
    console.warn("Flower physics worker unavailable; using main-thread Ammo.");
  };

  destroy() {
    this.#worker?.terminate();
    this.#worker = null;
    this.#entity.destroy();
    this.#feet = [];
    this.#flowers = [];
    this.#batches.clear();
    this.#definitions = [];
  }

  /**
   *
   * @param {{normal: import("src/game/objects/ObjectTypes.js").Point3}} side
   */
  #createFoot(side) {
    const foot = new this.#pc.Entity(`Hero ${side} flower collider`);
    foot.setLocalPosition(0, -1000, 0);
    foot.addComponent("collision", {
      type: "box",
      halfExtents: new this.#pc.Vec3(FOOT_HALF_WIDTH, FOOT_HALF_HEIGHT, FOOT_HALF_WIDTH),
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
      if (flower.hidden || flower.paperActive) {
        flower.matrix.setTRS(
          flower.body.getPosition(),
          this.#hiddenRotation,
          this.#hiddenScale,
        );
      } else {
        const tip = flower.body.getPosition();
        const root = flower.anchor.getPosition();
        const tipHeight = tip.y - root.y;
        let contacting = false;
        for (const foot of this.#feet) {
          const position = foot.getPosition();
          const dx = Math.max(0, Math.abs(tip.x - position.x) - FOOT_HALF_WIDTH);
          const dz = Math.max(0, Math.abs(tip.z - position.z) - FOOT_HALF_WIDTH);
          const soleHeight = position.y - FOOT_HALF_HEIGHT - root.y;
          if (dx * dx + dz * dz < flower.radius ** 2 &&
            soleHeight < flower.pivotHeight && position.y + FOOT_HALF_HEIGHT > root.y) {
            contacting = true;
          }
        }
        // A patch contains several heads: contact with one boot should not
        // flatten every flower into the grass. The shader compresses only the
        // contacted vertices, keeping surrounding petals legible.
        const compression = Math.max(contacting ? 0.65 : 0.001 / flower.pivotHeight, Math.min(1, tipHeight / flower.pivotHeight));
        const spread = contacting ? 1.35 : 1;
        this.#deformedScale.set(flower.scale.x * spread, flower.scale.y * compression, flower.scale.z * spread);
        flower.matrix.setTRS(
          root,
          flower.rotation,
          this.#deformedScale,
        );
        // Shear the stem toward Ammo's tip without rotating the whole petal
        // plane into the hero. Vertical scale retains the simulated compression.
        flower.matrix.data[4] += (tip.x - root.x) * flower.scale.y / flower.pivotHeight;
        flower.matrix.data[6] += (tip.z - root.z) * flower.scale.y / flower.pivotHeight;
      }
      matrices.set(flower.matrix.data, flower.matrixIndex * 16);
    }
    vertexBuffer.unlock();
  }
}
