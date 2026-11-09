import { reinforceKingHem } from "./KingCapeHem.js";
import { KingCapeGeometry } from "./KingCapeGeometry.js";

/**
 * @typedef {{index: number, local: import("playcanvas").Vec3, previous: import("playcanvas").Vec3, target: import("playcanvas").Vec3}} KingCapePin
 * @typedef {{entity: import("playcanvas").Entity, localCenter: import("playcanvas").Vec3, floor: boolean, previousPosition: import("playcanvas").Vec3, targetPosition: import("playcanvas").Vec3, previousRotation: import("playcanvas").Quat, targetRotation: import("playcanvas").Quat, body: import("sync-ammo/dist/ammo").btRigidBody, motion: import("sync-ammo/dist/ammo").btDefaultMotionState, transform: import("sync-ammo/dist/ammo").btTransform, position: import("sync-ammo/dist/ammo").btVector3, rotation: import("sync-ammo/dist/ammo").btQuaternion}} KingCapeCollider
 */

const PHYSICS_SCALE = 20;
const FIXED_STEP = 1 / 120;
const MAX_SUBSTEPS = 6;
const MAX_DELTA = FIXED_STEP * MAX_SUBSTEPS;

/**
 * A stiff, chest-sewn cape simulated by Bullet in world space.
 * The authored skin supplies initialization/reset poses only; subsequent motion
 * comes from the soft body, so root movement and turns generate real inertia.
 */
export class KingCapePhysics {
  /**
   * @type {typeof import("playcanvas")}
   */
  #pc;
  /**
   * @type {typeof globalThis.Ammo|null}
   */
  #ammo = null;
  /**
   * @type {import("playcanvas").Entity}
   */
  #root;
  /**
   * @type {import("playcanvas").Entity|null}
   */
  #chest = null;
  /**
   * @type {import("sync-ammo/dist/ammo").btSoftRigidDynamicsWorld|null}
   */
  #world = null;
  /**
   * @type {import("sync-ammo/dist/ammo").btSoftBody|null}
   */
  #body = null;
  /**
   * @type {Array<{ptr: number}>}
   */
  #owned = [];
  /**
   * @type {KingCapeGeometry}
   */
  #geometry;
  /**
   * @type {KingCapePin[]}
   */
  #pins = [];
  /**
   * @type {KingCapeCollider[]}
   */
  #colliders = [];
  /**
   * @type {import("playcanvas").EventHandle|null}
   */
  #updateHandle = null;
  /**
   * @type {import("playcanvas").EventHandle|null}
   */
  #renderHandle = null;
  /**
   * @type {import("playcanvas").Vec3}
   */
  #previousPosition;
  /**
   * @type {number}
   */
  #pendingDelta = 0;
  /**
   * @type {number}
   */
  #accumulator = 0;
  /**
   * @type {number}
   */
  #substeps = 0;
  /**
   * @type {number}
   */
  #resets = 0;
  /**
   * @type {number}
   */
  #scale = 1;
  /**
   * Bind-pose sole height in model-root space, independent of animated feet.
   * @type {number}
   */
  #groundOffset = 0;
  /**
   * Settled floor supports use Bullet's zero-mass nodes, not a frozen cape.
   * @type {Map<number,{mass:number,point:import("playcanvas").Vec3}>}
   */
  #floorContacts = new Map();
  /**
   * @type {import("playcanvas").Mat4|null}
   */
  #seatedRoot = null;
  /**
   * @type {number}
   */
  #restQuietTime = 0;
  /**
   * @type {import("playcanvas").Vec3[]|null}
   */
  #sleepPins = null;

  /**
   * @returns {number}
   */
  get #groundY() {
    return this.#root.getPosition().y + this.#groundOffset * this.#scale;
  }
  /**
   * @type {boolean}
   */
  #bodyRegistered = false;
  /**
   * @type {boolean}
   */
  #initializationFailed = false;
  /**
   * @type {boolean}
   */
  #resume = false;
  /**
   * @type {boolean}
   */
  #destroyed = false;

  /**
   * @param {{pc: typeof import("playcanvas"), app: import("playcanvas").Application, modelRoot: import("playcanvas").Entity}} options
   */
  constructor({ pc, app, modelRoot }) {
    this.#pc = pc;
    this.#geometry = new KingCapeGeometry(pc, modelRoot);
    this.#root = modelRoot;
    this.#previousPosition = modelRoot.getPosition().clone();
    this.#updateHandle = app?.on?.("update", this.#queueUpdate.bind(this)) ?? null;
    this.#renderHandle = app?.on?.("prerender", this.#beforeRender.bind(this)) ?? null;
  }

  /**
   * @template {{ptr: number}} T
   * @param {T} value
   * @returns {T}
   */
  #own(value) {
    this.#owned.push(value);

    return value;
  }

  /**
   * @param {number} deltaTime
   */
  #queueUpdate(deltaTime) {
    if (Number.isFinite(deltaTime)) {
      this.#pendingDelta = Math.min(MAX_DELTA, this.#pendingDelta + Math.max(0, deltaTime));
    }
  }

  /**
   * No Bullet pools or private meshes are allocated until a visible cape exists.
   * @returns {boolean}
   */
  #initialize() {
    const ammo = globalThis.Ammo;
    const cape = this.#root.findByName("Folded royal mantle back");
    this.#chest = this.#root.findByName("Royal chest");
    const instances = cape?.render?.meshInstances ?? [];
    if (!ammo?.btSoftRigidDynamicsWorld || !ammo.btSoftBody || !this.#chest || !instances.length) {
      return false;
    }
    this.#ammo = ammo;
    this.#scale = Math.max(0.001, this.#root.getWorldTransform().getScale().y);
    const rootInverse = this.#root.getWorldTransform().clone().invert();
    let sole = Infinity;
    for (const side of ["left", "right"]) {
      const boot = this.#root.findByName(`${side} fitted leather boot`);
      for (const instance of boot?.render?.meshInstances ?? []) {
        const positions = [];
        instance.mesh.getPositions(positions);
        const matrix = rootInverse.clone().mul(instance.node.getWorldTransform());
        for (let index = 0; index < positions.length; index += 3) {
          const point = matrix.transformPoint(new this.#pc.Vec3(...positions.slice(index, index + 3)));
          sole = Math.min(sole, point.y);
        }
      }
    }
    this.#groundOffset = Number.isFinite(sole) ? sole : 0;
    const chestInverse = this.#chest.getWorldTransform().clone().invert();
    const { bindPoints, triangles, frontSeams, threshold } =
      this.#geometry.initializeSurface(instances, this.#chest, this.#scale, rootInverse);
    for (let index = 0; index < this.#geometry.nodes.length; index++) {
      const point = this.#geometry.nodes[index];
      if (rootInverse.transformPoint(point).y >= threshold - 0.0001 || frontSeams.has(index)) {
        this.#pins.push({
          index,
          local: chestInverse.transformPoint(point),
          previous: point.clone(),
          target: point.clone(),
        });
      }
    }
    const configuration = this.#own(new ammo.btSoftBodyRigidBodyCollisionConfiguration());
    const dispatcher = this.#own(new ammo.btCollisionDispatcher(configuration));
    const broadphase = this.#own(new ammo.btDbvtBroadphase());
    const solver = this.#own(new ammo.btSequentialImpulseConstraintSolver());
    const softSolver = this.#own(new ammo.btDefaultSoftBodySolver());
    this.#world = this.#own(new ammo.btSoftRigidDynamicsWorld(dispatcher, broadphase, solver, configuration, softSolver));
    const gravity = this.#own(new ammo.btVector3(0, -9.81 * PHYSICS_SCALE, 0));
    this.#world.setGravity(gravity);
    this.#world.getWorldInfo().set_m_gravity(gravity);
    this.#body = new ammo.btSoftBody(this.#world.getWorldInfo());
    const vector = new ammo.btVector3(0, 0, 0);
    for (const point of bindPoints) {
      vector.setValue(point.x * PHYSICS_SCALE, point.y * PHYSICS_SCALE, point.z * PHYSICS_SCALE);
      this.#body.appendNode(vector, 1);
    }
    ammo.destroy(vector);
    const structural = this.#body.appendMaterial();
    structural.set_m_kLST(0.99);
    structural.set_m_kAST(0.99);
    const links = new Set();
    for (let face = 0; face < triangles.length; face += 3) {
      const a = triangles[face], b = triangles[face + 1], c = triangles[face + 2];
      if (a === b || b === c || a === c) {
        continue;
      }
      this.#body.appendFace(a, b, c, structural);
      this.#addLink(a, b, structural, links);
      this.#addLink(b, c, structural, links);
      this.#addLink(c, a, structural, links);
    }
    const bending = this.#body.appendMaterial();
    reinforceKingHem(this.#body, triangles, bindPoints);
    bending.set_m_kLST(0.08);
    bending.set_m_kAST(0.08);
    this.#body.generateBendingConstraints(2, bending);
    this.#body.setTotalMass(0.3, false);
    // Constraints describe the garment's authored shape, independent of which
    // animation happens to be active on its first visible frame.
    const bodyNodes = this.#body.get_m_nodes();
    for (let index = 0; index < this.#geometry.nodes.length; index++) {
      const point = this.#geometry.nodes[index].clone().mulScalar(PHYSICS_SCALE);
      bodyNodes.at(index).get_m_x().setValue(point.x, point.y, point.z);
      bodyNodes.at(index).get_m_q().setValue(point.x, point.y, point.z);
    }
    this.#geometry.updateFrames(this.#body.get_m_nodes(), PHYSICS_SCALE, this.#groundY + 0.012 * this.#scale);
    const trimMasses = this.#geometry.attachTrim();
    for (let index = 0; index < trimMasses.length; index++) {
      this.#body.setMass(index, trimMasses[index]);
    }
    for (const pin of this.#pins) {
      this.#body.setMass(pin.index, 0);
    }
    const config = this.#body.get_m_cfg();
    config.set_piterations(28);
    config.set_viterations(14);
    config.set_kDP(0.22);
    config.set_kDF(0.45);
    config.set_kCHR(1);
    config.set_kKHR(1);
    config.set_collisions(1);
    this.#body.getCollisionShape().setMargin(0.012 * this.#scale * PHYSICS_SCALE);
    this.#body.setActivationState(4);
    this.#world.addSoftBody(this.#body, 1, 2);
    this.#bodyRegistered = true;
    this.#addTorsoCollider();
    this.#addCoatCollider();
    this.#addFloorCollider();
    this.#geometry.cloneMeshes();
    this.#previousPosition.copy(this.#root.getPosition());
    this.#geometry.writeMeshes(this.#body.get_m_nodes(), PHYSICS_SCALE, this.#groundY + 0.012 * this.#scale);

    return true;
  }

  /**
   * @param {number} a
   * @param {number} b
   * @param {import("sync-ammo/dist/ammo").Material} material
   * @param {Set<string>} links
   */
  #addLink(a, b, material, links) {
    const key = `${Math.min(a, b)}:${Math.max(a, b)}`;
    if (!links.has(key)) {
      links.add(key);
      this.#body.appendLink(a, b, material, false);
    }
  }

  #addTorsoCollider() {
    const { minimum, maximum } = this.#geometry.torsoBounds;
    if (!Number.isFinite(minimum.x)) {
      minimum.set(-0.28, -0.32, -0.12);
      maximum.set(0.28, 0.16, 0.2);
    }
    const center = minimum.clone().add(maximum).mulScalar(0.5);
    const extents = maximum.clone().sub(minimum).mulScalar(0.5);
    const scale = this.#chest.getWorldTransform().getScale();
    // The complete torso supplies the volume. The hinged lap panels have their
    // own motion and must not enlarge this chest-owned collider while seated.
    const half = this.#own(new this.#ammo.btVector3(
      Math.max(0.02, extents.x * scale.x) * PHYSICS_SCALE,
      Math.max(0.02, extents.y * scale.y) * PHYSICS_SCALE,
      Math.max(0.04 * this.#scale, extents.z * scale.z) * PHYSICS_SCALE,
    ));
    const shape = this.#own(new this.#ammo.btBoxShape(half));
    shape.setMargin(0.008 * this.#scale * PHYSICS_SCALE);
    this.#addCollider(this.#chest, center, shape, false);
  }

  /**
   * The chest panel ends above the coat hem. Keep trailing cloth behind the
   * lower coat as well, so its fixed gold frame cannot poke through the cape.
   */
  #addCoatCollider() {
    const hips = this.#root.findByName("Royal hips") ?? this.#chest;
    const worldCenter = this.#root.getWorldTransform().transformPoint(
      new this.#pc.Vec3(0, 0.43, 0),
    );
    const bindWorld = this.#geometry.bindTransform(hips);
    // The offset belongs to the authored bind pose. Measuring it from a seated
    // startup pose raises the proxy after standing and rolls the hem upward.
    const center = bindWorld.clone().invert().transformPoint(worldCenter);
    const half = this.#own(new this.#ammo.btVector3(
      0.35 * this.#scale * PHYSICS_SCALE,
      0.32 * this.#scale * PHYSICS_SCALE,
      0.25 * this.#scale * PHYSICS_SCALE,
    ));
    const shape = this.#own(new this.#ammo.btBoxShape(half));
    shape.setMargin(0.008 * this.#scale * PHYSICS_SCALE);
    this.#addCollider(hips, center, shape, false);
  }

  #addFloorCollider() {
    // Bullet's soft-body sparse SDF does not reliably resolve a descending hem
    // against an infinite plane. A solid box provides a supported convex floor.
    const half = this.#own(new this.#ammo.btVector3(
      8 * this.#scale * PHYSICS_SCALE,
      0.05 * this.#scale * PHYSICS_SCALE,
      8 * this.#scale * PHYSICS_SCALE,
    ));
    const shape = this.#own(new this.#ammo.btBoxShape(half));
    shape.setMargin(0.002 * this.#scale * PHYSICS_SCALE);
    this.#addCollider(this.#root, new this.#pc.Vec3(0, -0.05, 0), shape, true);
  }

  /**
   * @param {import("playcanvas").Entity} entity
   * @param {import("playcanvas").Vec3} localCenter
   * @param {import("sync-ammo/dist/ammo").btCollisionShape} shape
   * @param {boolean} floor
   */
  #addCollider(entity, localCenter, shape, floor) {
    const transform = this.#own(new this.#ammo.btTransform());
    transform.setIdentity();
    const motion = this.#own(new this.#ammo.btDefaultMotionState(transform));
    const inertia = this.#own(new this.#ammo.btVector3(0, 0, 0));
    const info = this.#own(new this.#ammo.btRigidBodyConstructionInfo(0, motion, shape, inertia));
    const body = this.#own(new this.#ammo.btRigidBody(info));
    body.setCollisionFlags(2);
    body.setActivationState(4);
    const collider = {
      entity,
      localCenter,
      floor,
      previousPosition: new this.#pc.Vec3(),
      targetPosition: new this.#pc.Vec3(),
      previousRotation: new this.#pc.Quat(),
      targetRotation: new this.#pc.Quat(),
      body,
      motion,
      transform,
      position: this.#own(new this.#ammo.btVector3(0, 0, 0)),
      rotation: this.#own(new this.#ammo.btQuaternion(0, 0, 0, 1)),
    };
    this.#targetCollider(collider);
    collider.previousPosition.copy(collider.targetPosition);
    collider.previousRotation.copy(collider.targetRotation);
    this.#world.addRigidBody(body, 2, 1);
    this.#colliders.push(collider);
    this.#syncCollider(collider, 1);
  }

  /**
   * @param {KingCapeCollider} collider
   */
  #targetCollider(collider) {
    if (collider.floor) {
      collider.targetPosition.copy(this.#root.getPosition());
      collider.targetPosition.y = this.#groundY + collider.localCenter.y * this.#scale;
      collider.targetRotation.set(0, 0, 0, 1);
    } else {
      const matrix = collider.entity.getWorldTransform();
      matrix.transformPoint(collider.localCenter, collider.targetPosition);
      collider.targetRotation.setFromMat4(matrix);
    }
  }

  /**
   * @param {KingCapeCollider} collider
   * @param {number} amount
   */
  #syncCollider(collider, amount) {
    const point = new this.#pc.Vec3().lerp(collider.previousPosition, collider.targetPosition, amount);
    const rotation = new this.#pc.Quat().slerp(collider.previousRotation, collider.targetRotation, amount);
    collider.position.setValue(point.x * PHYSICS_SCALE, point.y * PHYSICS_SCALE, point.z * PHYSICS_SCALE);
    collider.rotation.setValue(rotation.x, rotation.y, rotation.z, rotation.w);
    collider.transform.setOrigin(collider.position);
    collider.transform.setRotation(collider.rotation);
    collider.motion.setWorldTransform(collider.transform);
    collider.body.setWorldTransform(collider.transform);
    this.#world.updateSingleAabb(collider.body);
  }

  /**
   * @param {number} amount
   */
  #syncPins(amount) {
    const nodes = this.#body.get_m_nodes();
    const point = new this.#pc.Vec3();
    for (const pin of this.#pins) {
      point.lerp(pin.previous, pin.target, amount).mulScalar(PHYSICS_SCALE);
      const node = nodes.at(pin.index);
      node.get_m_x().setValue(point.x, point.y, point.z);
      node.get_m_q().setValue(point.x, point.y, point.z);
      node.get_m_v().setValue(0, 0, 0);
    }
  }

  #reset() {
    const nodes = this.#body.get_m_nodes();
    for (const { index, point } of this.#geometry.sourcePose()) {
      point.mulScalar(PHYSICS_SCALE);
      const node = nodes.at(index);
      node.get_m_x().setValue(point.x, point.y, point.z);
      node.get_m_q().setValue(point.x, point.y, point.z);
      node.get_m_v().setValue(0, 0, 0);
    }
    this.#accumulator = 0;
    this.#resets++;
  }

  /**
   * Moving zero-mass seams can pull nodes through Bullet's soft-body SDF contact
   * tolerance even with a convex floor. Resolve only that remaining penetration;
   * Ammo still owns gravity, inertia, links, friction, and all body collisions.
   */
  #resolveFloorContact() {
    const nodes = this.#body.get_m_nodes();
    for (let index = 0; index < this.#geometry.nodes.length; index++) {
      const floor = (this.#groundY + 0.012 * this.#scale + this.#geometry.floorClearances[index]) * PHYSICS_SCALE;
      const node = nodes.at(index);
      const point = node.get_m_x();
      if (point.y() >= floor) {
        continue;
      }
      point.setValue(point.x(), floor, point.z());
      const previous = node.get_m_q();
      previous.setValue(previous.x(), Math.max(floor, previous.y()), previous.z());
      const velocity = node.get_m_v();
      velocity.setValue(velocity.x(), Math.max(0, velocity.y()), velocity.z());
    }
  }

  /**
   * The sparse SDF misses static friction on the same shallow contacts handled
   * by the floor projection. Give settled hem nodes floor supports in Bullet;
   * upper cloth stays dynamic. Standing or root motion releases every support
   * before solving, preserving the seated shape and avoiding a reset impulse.
   * @param {boolean} seated
   */
  #supportSeatedHem(seated) {
    const nodes = this.#body.get_m_nodes();
    if (!seated) {
      for (const [index, contact] of this.#floorContacts) {
        this.#body.setMass(index, contact.mass);
      }
      this.#floorContacts.clear();

      return;
    }
    for (let index = 0; index < this.#geometry.nodes.length; index++) {
      const floor = (this.#groundY + 0.012 * this.#scale + this.#geometry.floorClearances[index]) * PHYSICS_SCALE;
      const node = nodes.at(index);
      const point = node.get_m_x();
      const velocity = node.get_m_v();
      if (!this.#floorContacts.has(index) && this.#geometry.floorClearances[index] > 0 && node.get_m_im() > 0 &&
        point.y() <= floor + 0.012 * this.#scale * PHYSICS_SCALE &&
        Math.hypot(velocity.x(), velocity.y(), velocity.z()) < 0.08 * this.#scale * PHYSICS_SCALE) {
        this.#floorContacts.set(index, {
          mass: 1 / node.get_m_im(),
          point: new this.#pc.Vec3(point.x(), Math.max(floor, point.y()), point.z()),
        });
        this.#body.setMass(index, 0);
      }
      const contact = this.#floorContacts.get(index);
      if (contact) {
        contact.point.y = floor;
        const { x, y, z } = contact.point;
        point.setValue(x, y, z);
        node.get_m_q().setValue(x, y, z);
        velocity.setValue(0, 0, 0);
      }
    }
  }

  /**
   * Let heavy fabric sleep after it settles. Breathing must not keep exciting
   * sub-pixel solver vibration; a meaningful seam movement wakes Bullet again.
   * @param {boolean} seated
   */
  #settleRestingCloth(seated) {
    const moved = this.#sleepPins?.some(/**
     *
     * @param {import("playcanvas").Vec3} point
     * @param {number} index
     */
      (point, index) =>
        point.distance(this.#pins[index].target) > 0.006 * this.#scale);
    if (!seated || moved) {
      this.#restQuietTime = 0;
      this.#sleepPins = null;
      this.#body.forceActivationState(4);

      return;
    }
    if (!this.#sleepPins) {
      const nodes = this.#body.get_m_nodes();
      let energy = 0, mass = 0;
      for (let index = 0; index < this.#geometry.nodes.length; index++) {
        const node = nodes.at(index);
        if (node.get_m_im() > 0) {
          const nodeMass = 1 / node.get_m_im();
          const velocity = node.get_m_v();
          energy += nodeMass * (velocity.x() ** 2 + velocity.y() ** 2 + velocity.z() ** 2);
          mass += nodeMass;
        }
      }
      const speed = mass > 0 ? Math.sqrt(energy / mass) / PHYSICS_SCALE : 0;
      this.#restQuietTime = speed < 0.08 * this.#scale ? this.#restQuietTime + this.#pendingDelta : 0;
      if (this.#restQuietTime < 1) {
        return;
      }
      this.#sleepPins = this.#pins.map(/**
       *
       * @param {KingCapePin} pin
       */
        pin => pin.target.clone());
    }
    // The hanging side seams must settle with the heavy lower cloth too.
    // Keep the collar responsive to breathing; wake checks above still use
    // every live seam target before applying this resting support.
    const lowerSeamHeight = this.#chest.getPosition().y - 0.15 * this.#scale;
    for (let index = 0; index < this.#pins.length; index++) {
      if (this.#sleepPins[index].y < lowerSeamHeight) {
        this.#pins[index].target.copy(this.#sleepPins[index]);
      }
    }
    this.#body.forceActivationState(2);
  }

  #beforeRender() {
    if (this.#destroyed || this.#initializationFailed) {
      return;
    }
    if (!this.#root.enabled) {
      this.#resume = true;
      this.#pendingDelta = 0;

      return;
    }
    this.#geometry.beginFrame();
    if (!this.#world) {
      try {
        if (!this.#initialize()) {
          this.#pendingDelta = 0;

          return;
        }
      } catch (error) {
        this.#releasePhysics();
        this.#initializationFailed = true;
        throw error;
      }
    }
    const reset = this.#resume || this.#previousPosition.distance(this.#root.getPosition()) > 1;
    this.#geometry.updateFrames(this.#body.get_m_nodes(), PHYSICS_SCALE, this.#groundY + 0.012 * this.#scale);
    const resting = this.#root.anim?.baseLayer?.activeState === "GroundRest";
    const transform = this.#root.getWorldTransform();
    const seated = resting && !reset && (!this.#seatedRoot || this.#seatedRoot.equals(transform));
    this.#body.get_m_cfg().set_kDP(seated ? 0.85 : 0.22);
    this.#seatedRoot = resting ? transform.clone() : null;
    if (!seated) {
      this.#supportSeatedHem(false);
    }
    this.#resume = false;
    this.#previousPosition.copy(this.#root.getPosition());
    for (const pin of this.#pins) {
      this.#chest.getWorldTransform().transformPoint(pin.local, pin.target);
      // A ground-seated hem rests on the floor instead of pulling sewn edges
      // through it when the chest descends. Collar anchors remain unaffected.
      pin.target.y = Math.max(pin.target.y,
        this.#groundY + 0.012 * this.#scale + this.#geometry.floorClearances[pin.index]);
      if (reset) {
        pin.previous.copy(pin.target);
      }
    }
    for (const collider of this.#colliders) {
      this.#targetCollider(collider);
      if (reset) {
        collider.previousPosition.copy(collider.targetPosition);
        collider.previousRotation.copy(collider.targetRotation);
      }
    }
    if (reset) {
      this.#reset();
    }
    this.#settleRestingCloth(seated);
    this.#accumulator = Math.min(MAX_DELTA, this.#accumulator + this.#pendingDelta);
    this.#pendingDelta = 0;
    this.#substeps = Math.min(MAX_SUBSTEPS, Math.floor((this.#accumulator + 1e-9) / FIXED_STEP));
    for (let step = 1; step <= this.#substeps; step++) {
      const amount = step / this.#substeps;
      for (const collider of this.#colliders) {
        this.#syncCollider(collider, amount);
      }
      this.#syncPins(amount);
      this.#world.stepSimulation(FIXED_STEP, 0);
      this.#geometry.updateFrames(this.#body.get_m_nodes(), PHYSICS_SCALE, this.#groundY + 0.012 * this.#scale);
      this.#resolveFloorContact();
      this.#supportSeatedHem(seated);
    }
    this.#accumulator -= this.#substeps * FIXED_STEP;
    // Bullet can move even mass-zero nodes during contact resolution; enforce
    // the sewn boundary after solving and on render frames with no fixed step.
    this.#syncPins(1);
    for (const pin of this.#pins) {
      pin.previous.copy(pin.target);
    }
    for (const collider of this.#colliders) {
      collider.previousPosition.copy(collider.targetPosition);
      collider.previousRotation.copy(collider.targetRotation);
    }
    this.#geometry.writeMeshes(this.#body.get_m_nodes(), PHYSICS_SCALE, this.#groundY + 0.012 * this.#scale);
  }

  /**
   * World-space diagnostics do not alter the solver or expose Ammo ownership.
   * @returns {{initialized: boolean, enabled: boolean, nodes: number[][], pins: Array<{index: number, target: number[]}>, maxPinError: number, maxSpeed: number, resets: number, substeps: number,minHemExteriorDistance:number|null}}
   */
  get testState() {
    const positions = [], pins = [];
    let maxPinError = 0, maxSpeed = 0;
    if (this.#body) {
      const nodes = this.#body.get_m_nodes();
      for (let index = 0; index < this.#geometry.nodes.length; index++) {
        const node = nodes.at(index);
        const point = node.get_m_x();
        const speed = node.get_m_v();
        positions.push([point.x() / PHYSICS_SCALE, point.y() / PHYSICS_SCALE, point.z() / PHYSICS_SCALE]);
        maxSpeed = Math.max(maxSpeed, Math.hypot(speed.x(), speed.y(), speed.z()) / PHYSICS_SCALE);
      }
      for (const pin of this.#pins) {
        const actual = new this.#pc.Vec3(...positions[pin.index]);
        maxPinError = Math.max(maxPinError, actual.distance(pin.target));
        pins.push({
          index: pin.index,
          target: [pin.target.x, pin.target.y, pin.target.z],
        });
      }
    }

    const minHemExteriorDistance = this.#geometry.minHemExteriorDistance;

    return {
      initialized: Boolean(this.#world),
      enabled: this.#root.enabled,
      nodes: positions,
      pins,
      maxPinError,
      maxSpeed,
      resets: this.#resets,
      substeps: this.#substeps,
      minHemExteriorDistance: Number.isFinite(minHemExteriorDistance) ? minHemExteriorDistance : null,
    };
  }

  #releasePhysics() {
    if (this.#body) {
      if (this.#bodyRegistered) {
        this.#world.removeSoftBody(this.#body);
      }
      this.#ammo.destroy(this.#body);
      this.#body = null;
      this.#bodyRegistered = false;
    }
    for (const collider of this.#colliders) {
      this.#world.removeRigidBody(collider.body);
    }
    this.#geometry.destroy();
    for (const value of this.#owned.reverse()) {
      this.#ammo.destroy(value);
    }
    this.#world = null;
    this.#colliders = [];
    this.#owned = [];
    this.#pins = [];
    this.#floorContacts.clear();
    this.#seatedRoot = null;
    this.#restQuietTime = 0;
    this.#sleepPins = null;
  }

  destroy() {
    if (this.#destroyed) {
      return;
    }
    this.#destroyed = true;
    this.#updateHandle?.off();
    this.#renderHandle?.off();
    this.#releasePhysics();
  }
}
