/**
 * @typedef {{instance: import("playcanvas").MeshInstance, originalMesh: import("playcanvas").Mesh, originalMaterial: import("playcanvas").Material, originalSkin: import("playcanvas").SkinInstance|null, mesh: import("playcanvas").Mesh, material: import("playcanvas").Material, source: number[], positions: number[], indices: number[], joints: number[], weights: number[], mapping: number[]}} KingCapeBinding
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
   * @type {KingCapeBinding[]}
   */
  #bindings = [];
  /**
   * @type {import("playcanvas").Vec3[]}
   */
  #nodes = [];
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
   * CPU skinning follows PlayCanvas SkinInstance: bone world × inverse bind.
   * @param {KingCapeBinding} binding
   * @returns {import("playcanvas").Mat4[]|null}
   */
  #skinMatrices(binding) {
    const skin = binding.originalSkin;
    if (!skin || !binding.weights.length || !binding.joints.length) {
      return null;
    }

    return skin.bones.map(/**
     * @param {import("playcanvas").GraphNode} bone
     * @param {number} index
     */
      (bone, index) => new this.#pc.Mat4().mul2(
        bone.getWorldTransform(), skin.skin.inverseBindPose[index],
      ));
  }

  /**
   * @param {KingCapeBinding} binding
   * @param {number} vertex
   * @param {import("playcanvas").Mat4[]|null} matrices
   * @returns {import("playcanvas").Vec3}
   */
  #sourceWorld(binding, vertex, matrices) {
    const position = new this.#pc.Vec3(...binding.source.slice(vertex * 3, vertex * 3 + 3));
    if (!matrices) {
      return binding.instance.node.getWorldTransform().transformPoint(position);
    }
    const result = new this.#pc.Vec3();
    const transformed = new this.#pc.Vec3();
    for (let influence = 0; influence < 4; influence++) {
      const offset = vertex * 4 + influence;
      const weight = binding.weights[offset];
      if (weight > 0) {
        matrices[binding.joints[offset]].transformPoint(position, transformed);
        result.addScaled(transformed, weight);
      }
    }

    return result;
  }

  /**
   * @param {import("playcanvas").MeshInstance} instance
   * @returns {KingCapeBinding}
   */
  #readBinding(instance) {
    const source = [], indices = [], joints = [], weights = [];
    instance.mesh.getPositions(source);
    instance.mesh.getIndices(indices);
    if (instance.skinInstance) {
      instance.mesh.getVertexStream(this.#pc.SEMANTIC_BLENDINDICES, joints);
      instance.mesh.getVertexStream(this.#pc.SEMANTIC_BLENDWEIGHT, weights);
    }

    return {
      instance,
      originalMesh: instance.mesh,
      originalMaterial: instance.material,
      originalSkin: instance.skinInstance ?? null,
      mesh: null,
      material: null,
      source,
      positions: [...source],
      indices,
      joints,
      weights,
      mapping: [],
    };
  }

  /**
   * Clone only this resident's cape; its original skin remains owned by the model.
   * @param {KingCapeBinding} binding
   */
  #cloneBinding(binding) {
    const mesh = new this.#pc.Mesh(binding.originalMesh.device);
    binding.mesh = mesh;
    const normals = [], uv = [];
    binding.originalMesh.getNormals(normals);
    binding.originalMesh.getUvs(0, uv);
    mesh.clear(true, false, binding.source.length / 3, binding.indices.length);
    mesh.setPositions(binding.positions);
    if (normals.length) {
      mesh.setNormals(normals);
    }
    if (uv.length) {
      mesh.setUvs(0, uv);
    }
    mesh.setIndices(binding.indices);
    mesh.update(this.#pc.PRIMITIVE_TRIANGLES, true);
    const material = binding.originalMaterial.clone();
    binding.material = material;
    material.cull = this.#pc.CULLFACE_NONE;
    material.update();
    binding.instance.skinInstance = null;
    binding.instance.mesh = mesh;
    binding.instance.material = material;
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
    const chestInverse = this.#chest.getWorldTransform().clone().invert();
    const unique = new Map();
    const triangles = [];
    this.#bindings = instances.map(this.#readBinding.bind(this));
    let top = -Infinity, bottom = Infinity;
    for (const binding of this.#bindings) {
      const matrices = this.#skinMatrices(binding);
      for (let vertex = 0; vertex < binding.source.length / 3; vertex++) {
        const point = this.#sourceWorld(binding, vertex, matrices);
        const key = `${point.x.toFixed(5)},${point.y.toFixed(5)},${point.z.toFixed(5)}`;
        let index = unique.get(key);
        if (index === undefined) {
          index = this.#nodes.length;
          unique.set(key, index);
          this.#nodes.push(point);
          const local = rootInverse.transformPoint(point);
          top = Math.max(top, local.y);
          bottom = Math.min(bottom, local.y);
        }
        binding.mapping.push(index);
      }
      for (const index of binding.indices) {
        triangles.push(binding.mapping[index]);
      }
    }
    // The folded shoulder seam slopes slightly in animated poses. Four percent
    // captures its corner vertices while leaving the next cloth row unpinned.
    const threshold = top - (top - bottom) * 0.04;
    for (let index = 0; index < this.#nodes.length; index++) {
      const point = this.#nodes[index];
      if (rootInverse.transformPoint(point).y >= threshold - 0.0001) {
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
    for (const point of this.#nodes) {
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
    bending.set_m_kLST(0.98);
    bending.set_m_kAST(0.98);
    this.#body.generateBendingConstraints(2, bending);
    this.#body.setTotalMass(0.3, false);
    for (const pin of this.#pins) {
      this.#body.setMass(pin.index, 0);
    }
    const config = this.#body.get_m_cfg();
    config.set_piterations(28);
    config.set_viterations(14);
    config.set_kDP(0.24);
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
    for (const binding of this.#bindings) {
      this.#cloneBinding(binding);
    }
    this.#previousPosition.copy(this.#root.getPosition());
    this.#writeMeshes();

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
    const inverse = this.#chest.getWorldTransform().clone().invert();
    const minimum = new this.#pc.Vec3(Infinity, Infinity, Infinity);
    const maximum = new this.#pc.Vec3(-Infinity, -Infinity, -Infinity);
    const body = this.#root.findByName("Indigo bodice front");
    for (const instance of body?.render?.meshInstances ?? []) {
      const binding = this.#readBinding(instance);
      const matrices = this.#skinMatrices(binding);
      for (let vertex = 0; vertex < binding.source.length / 3; vertex++) {
        const local = inverse.transformPoint(this.#sourceWorld(binding, vertex, matrices));
        minimum.min(local);
        maximum.max(local);
      }
    }
    if (!Number.isFinite(minimum.x)) {
      minimum.set(-0.28, -0.32, -0.12);
      maximum.set(0.28, 0.16, 0.2);
    }
    const center = minimum.clone().add(maximum).mulScalar(0.5);
    const extents = maximum.clone().sub(minimum).mulScalar(0.5);
    const scale = this.#chest.getWorldTransform().getScale();
    // The bodice is a thin front panel. Extend its proxy toward the cape to
    // cover the actual chest volume rather than treating that panel as a wall.
    const capeCenter = new this.#pc.Vec3();
    for (const point of this.#nodes) {
      capeCenter.add(inverse.transformPoint(point));
    }
    capeCenter.mulScalar(1 / this.#nodes.length).sub(center);
    capeCenter.y = 0;
    if (capeCenter.lengthSq() > 0.000001) {
      capeCenter.normalize();
      const halfDepth = 0.18 * this.#scale / Math.max(0.001, scale.z);
      center.addScaled(capeCenter, halfDepth);
      extents.x += Math.abs(capeCenter.x) * halfDepth;
      extents.z += Math.abs(capeCenter.z) * halfDepth;
    }
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
      new this.#pc.Vec3(0, 0.43, 0.115),
    );
    const center = hips.getWorldTransform().clone().invert().transformPoint(worldCenter);
    const half = this.#own(new this.#ammo.btVector3(
      0.48 * this.#scale * PHYSICS_SCALE,
      0.32 * this.#scale * PHYSICS_SCALE,
      0.265 * this.#scale * PHYSICS_SCALE,
    ));
    const shape = this.#own(new this.#ammo.btBoxShape(half));
    shape.setMargin(0.008 * this.#scale * PHYSICS_SCALE);
    this.#addCollider(hips, center, shape, false);
  }

  #addFloorCollider() {
    const normal = this.#own(new this.#ammo.btVector3(0, 1, 0));
    const shape = this.#own(new this.#ammo.btStaticPlaneShape(normal, 0));
    this.#addCollider(this.#root, new this.#pc.Vec3(), shape, true);
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
      collider.targetPosition.set(0, this.#root.getPosition().y, 0);
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
    for (const binding of this.#bindings) {
      const matrices = this.#skinMatrices(binding);
      for (let vertex = 0; vertex < binding.mapping.length; vertex++) {
        const point = this.#sourceWorld(binding, vertex, matrices).mulScalar(PHYSICS_SCALE);
        const node = nodes.at(binding.mapping[vertex]);
        node.get_m_x().setValue(point.x, point.y, point.z);
        node.get_m_q().setValue(point.x, point.y, point.z);
        node.get_m_v().setValue(0, 0, 0);
      }
    }
    this.#accumulator = 0;
    this.#resets++;
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
    this.#resume = false;
    this.#previousPosition.copy(this.#root.getPosition());
    for (const pin of this.#pins) {
      this.#chest.getWorldTransform().transformPoint(pin.local, pin.target);
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
    this.#writeMeshes();
  }

  #writeMeshes() {
    const nodes = this.#body.get_m_nodes();
    const point = new this.#pc.Vec3();
    for (const binding of this.#bindings) {
      const inverse = binding.instance.node.getWorldTransform().clone().invert();
      for (let vertex = 0; vertex < binding.mapping.length; vertex++) {
        const position = nodes.at(binding.mapping[vertex]).get_m_x();
        point.set(position.x() / PHYSICS_SCALE, position.y() / PHYSICS_SCALE, position.z() / PHYSICS_SCALE);
        inverse.transformPoint(point, point);
        binding.positions[vertex * 3] = point.x;
        binding.positions[vertex * 3 + 1] = point.y;
        binding.positions[vertex * 3 + 2] = point.z;
      }
      binding.mesh.setPositions(binding.positions);
      binding.mesh.setNormals(this.#pc.calculateNormals(binding.positions, binding.indices));
      binding.mesh.update(this.#pc.PRIMITIVE_TRIANGLES, true);
    }
  }

  /**
   * World-space diagnostics do not alter the solver or expose Ammo ownership.
   * @returns {{initialized: boolean, enabled: boolean, nodes: number[][], pins: Array<{index: number, target: number[]}>, maxPinError: number, maxSpeed: number, resets: number, substeps: number}}
   */
  get testState() {
    const positions = [], pins = [];
    let maxPinError = 0, maxSpeed = 0;
    if (this.#body) {
      const nodes = this.#body.get_m_nodes();
      for (let index = 0; index < this.#nodes.length; index++) {
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

    return {
      initialized: Boolean(this.#world),
      enabled: this.#root.enabled,
      nodes: positions,
      pins,
      maxPinError,
      maxSpeed,
      resets: this.#resets,
      substeps: this.#substeps,
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
    for (const binding of this.#bindings) {
      binding.instance.mesh = binding.originalMesh;
      binding.instance.material = binding.originalMaterial;
      binding.instance.skinInstance = binding.originalSkin;
      binding.mesh?.destroy();
      binding.material?.destroy();
    }
    for (const value of this.#owned.reverse()) {
      this.#ammo.destroy(value);
    }
    this.#world = null;
    this.#bindings = [];
    this.#colliders = [];
    this.#owned = [];
    this.#nodes = [];
    this.#pins = [];
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
