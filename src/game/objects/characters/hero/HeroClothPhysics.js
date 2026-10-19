
import Ammo from "sync-ammo/dist/ammo.module.js";

/**
 * @typedef {{instance: import("playcanvas").MeshInstance, original: import("playcanvas").Mesh, originalMaterial: import("playcanvas").Material, material: import("playcanvas").Material, mesh: import("playcanvas").Mesh, positions: number[], indices: number[], mapping: number[], offsets?: import("playcanvas").Vec3[]}} HeroClothBinding
 * @typedef {{body: import("sync-ammo/dist/ammo").btSoftBody|null, nodes: import("playcanvas").Vec3[], bindings: HeroClothBinding[], pins: Array<{index: number, local: import("playcanvas").Vec3, entity: import("playcanvas").Entity}>, decorations: HeroClothBinding[]}} HeroClothGarment
 * @typedef {{entity: import("playcanvas").Entity, center: import("playcanvas").Vec3, body: import("sync-ammo/dist/ammo").btRigidBody, motion: import("sync-ammo/dist/ammo").btDefaultMotionState, transform: import("sync-ammo/dist/ammo").btTransform, position: import("sync-ammo/dist/ammo").btVector3, rotation: import("sync-ammo/dist/ammo").btQuaternion}} HeroClothCollider
 */

// Ammo's sparse signed-distance contacts lose detail at this small model scale.
// Simulate in larger units, scaling positions, gravity and margins together.
const PHYSICS_SCALE = 20;
const COLLISION_MARGIN = 0.018;
const LEG_CLEARANCE = 0.025;
const FIXED_STEP = 1 / 120;
const LEG_PARTS = [
  "Thick trouser leg", "Thick trouser leg.001",
  "Boot shaft", "Boot shaft.001", "Boot cuff", "Boot cuff.001",
  "Boot foot", "Boot foot.001",
  "Boot front strap", "Boot front strap.001",
  "Boot toe", "Boot toe.001",
];

/**
 * Cloth and its animated body colliders share the hero model's coordinate space.
 */
export class HeroClothPhysics {
  /**
   * @type {typeof import("playcanvas")}
   */
  #pc;
  /**
   * @type {import("playcanvas").Entity}
   */
  #root;
  /**
   * @type {import("sync-ammo/dist/ammo").btSoftRigidDynamicsWorld}
   */
  #world;
  /**
   * @type {Array<{ptr: number}>}
   */
  #owned = [];
  /**
   * @type {HeroClothGarment[]}
   */
  #garments = [];
  /**
   * @type {HeroClothCollider[]}
   */
  #colliders = [];
  /**
   * @type {import("playcanvas").Mat4}
   */
  #inverse;
  /**
   * @type {import("playcanvas").Vec3}
   */
  #point;
  /**
   * @type {import("playcanvas").Vec3}
   */
  #previousPosition;

  /**
   * @param {{pc: typeof import("playcanvas"), modelRoot: import("playcanvas").Entity}} options
   */
  constructor({ pc, modelRoot }) {
    this.#pc = pc;
    this.#root = modelRoot;
    this.#inverse = new pc.Mat4();
    this.#point = new pc.Vec3();
    this.#previousPosition = modelRoot.getPosition().clone();
    const configuration = this.#own(new Ammo.btSoftBodyRigidBodyCollisionConfiguration());
    const dispatcher = this.#own(new Ammo.btCollisionDispatcher(configuration));
    const broadphase = this.#own(new Ammo.btDbvtBroadphase());
    const solver = this.#own(new Ammo.btSequentialImpulseConstraintSolver());
    const softSolver = this.#own(new Ammo.btDefaultSoftBodySolver());
    this.#world = this.#own(new Ammo.btSoftRigidDynamicsWorld(
      dispatcher, broadphase, solver, configuration, softSolver,
    ));
    const gravity = this.#own(new Ammo.btVector3(0, -9.8 * PHYSICS_SCALE, 0));
    this.#world.setGravity(gravity);
    this.#world.getWorldInfo().set_m_gravity(gravity);
    this.#inverse.copy(modelRoot.getWorldTransform()).invert();
    for (const name of LEG_PARTS) {
      const entity = modelRoot.findByName(name);
      if (entity) {
        this.#addCollider(entity);
      }
    }
    this.#addGarment("Red lower tunic flap", null, [
      "Left tunic flap piping", "Right tunic flap piping", "Tunic hem facing",
    ]);
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
   * @param {import("playcanvas").Entity} entity
   */
  #relative(entity) {
    return new this.#pc.Mat4().mul2(this.#inverse, entity.getWorldTransform());
  }

  /**
   * @param {import("playcanvas").Entity} entity
   */
  #addCollider(entity) {
    const mesh = entity.render?.meshInstances[0]?.mesh;
    if (!mesh) {
      return;
    }
    const bounds = mesh.aabb;
    const matrix = this.#relative(entity);
    const scale = matrix.getScale();
    const extents = bounds.halfExtents;
    const half = this.#own(new Ammo.btVector3(
      (Math.abs(extents.x * scale.x) + LEG_CLEARANCE) * PHYSICS_SCALE,
      (Math.abs(extents.y * scale.y) + LEG_CLEARANCE) * PHYSICS_SCALE,
      (Math.abs(extents.z * scale.z) + LEG_CLEARANCE) * PHYSICS_SCALE,
    ));
    const shape = this.#own(new Ammo.btBoxShape(half));
    shape.setMargin(0.005 * PHYSICS_SCALE);
    const transform = this.#own(new Ammo.btTransform());
    transform.setIdentity();
    const center = matrix.transformPoint(bounds.center);
    const orientation = new this.#pc.Quat().setFromMat4(matrix);
    const position = this.#own(new Ammo.btVector3(center.x * PHYSICS_SCALE, center.y * PHYSICS_SCALE, center.z * PHYSICS_SCALE));
    const rotation = this.#own(new Ammo.btQuaternion(orientation.x, orientation.y, orientation.z, orientation.w));
    transform.setOrigin(position);
    transform.setRotation(rotation);
    const motion = this.#own(new Ammo.btDefaultMotionState(transform));
    const inertia = this.#own(new Ammo.btVector3(0, 0, 0));
    const info = this.#own(new Ammo.btRigidBodyConstructionInfo(0, motion, shape, inertia));
    const body = this.#own(new Ammo.btRigidBody(info));
    body.setCollisionFlags(2);
    body.setActivationState(4);
    const collider = {
      entity,
      center: bounds.center.clone(),
      body,
      motion,
      transform,
      position,
      rotation,
    };
    this.#colliders.push(collider);
    this.#syncCollider(collider);
    this.#world.addRigidBody(body, 2, 1);
  }

  /**
   * @param {HeroClothCollider} collider
   */
  #syncCollider(collider) {
    const matrix = this.#relative(collider.entity);
    const position = matrix.transformPoint(collider.center);
    const rotation = new this.#pc.Quat().setFromMat4(matrix);
    collider.position.setValue(position.x * PHYSICS_SCALE, position.y * PHYSICS_SCALE, position.z * PHYSICS_SCALE);
    collider.rotation.setValue(rotation.x, rotation.y, rotation.z, rotation.w);
    collider.transform.setOrigin(collider.position);
    collider.transform.setRotation(collider.rotation);
    collider.motion.setWorldTransform(collider.transform);
    collider.body.setWorldTransform(collider.transform);
  }

  /**
   * @param {import("playcanvas").MeshInstance} instance
   */
  #copyMesh(instance) {
    const original = instance.mesh;
    const positions = [];
    const normals = [];
    const indices = [];
    const uv = [];
    original.getPositions(positions);
    original.getNormals(normals);
    original.getIndices(indices);
    original.getUvs(0, uv);
    const mesh = new this.#pc.Mesh(original.device);
    mesh.clear(true, false, positions.length / 3, indices.length);
    mesh.setPositions(positions);
    if (normals.length) {
      mesh.setNormals(normals);
    }
    if (uv.length) {
      mesh.setUvs(0, uv);
    }
    mesh.setIndices(indices);
    mesh.update(this.#pc.PRIMITIVE_TRIANGLES);
    instance.mesh = mesh;
    const material = instance.material.clone();
    const originalMaterial = instance.material;
    material.cull = this.#pc.CULLFACE_NONE;
    material.update();
    instance.material = material;

    return {
      instance,
      original,
      originalMaterial,
      material,
      mesh,
      positions,
      indices,
    };
  }

  /**
   * @param {string} name
   * @param {number|null} pinHeight
   * @param {string[]} decorations
   */
  #addGarment(name, pinHeight, decorations) {
    const entity = this.#root.findByName(name);
    if (!entity?.render) {
      return;
    }
    const garment = {
      body: null,
      nodes: [],
      bindings: [],
      pins: [],
      decorations: [],
    };
    const keys = new Map();
    const triangles = [];
    for (const instance of entity.render.meshInstances) {
      const binding = this.#copyMesh(instance);
      binding.mapping = [];
      const matrix = this.#relative(instance.node);
      const values = binding.positions;
      let top = -Infinity;
      let bottom = Infinity;
      for (let i = 1; i < values.length; i += 3) {
        top = Math.max(top, values[i]);
        bottom = Math.min(bottom, values[i]);
      }
      const threshold = pinHeight ?? top - (top - bottom) * 0.005;
      for (let i = 0; i < values.length; i += 3) {
        const local = new this.#pc.Vec3(values[i], values[i + 1], values[i + 2]);
        const position = matrix.transformPoint(local);
        const key = `${position.x.toFixed(5)},${position.y.toFixed(5)},${position.z.toFixed(5)}`;
        let index = keys.get(key);
        if (index === undefined) {
          index = garment.nodes.length;
          keys.set(key, index);
          garment.nodes.push(position);
          if (local.y >= threshold - 0.0001) {
            garment.pins.push({
              index,
              local,
              entity: instance.node,
            });
          }
        }
        binding.mapping.push(index);
      }
      for (const index of binding.indices) {
        triangles.push(binding.mapping[index]);
      }
      garment.bindings.push(binding);
    }
    const body = new Ammo.btSoftBody(this.#world.getWorldInfo());
    garment.body = body;
    const vector = new Ammo.btVector3(0, 0, 0);
    for (const position of garment.nodes) {
      vector.setValue(position.x * PHYSICS_SCALE, position.y * PHYSICS_SCALE, position.z * PHYSICS_SCALE);
      body.appendNode(vector, 1);
    }
    Ammo.destroy(vector);
    const material = body.appendMaterial();
    material.set_m_kLST(0.97);
    material.set_m_kAST(0.95);
    const links = new Set();
    for (let i = 0; i < triangles.length; i += 3) {
      const corners = triangles.slice(i, i + 3);
      if (new Set(corners).size !== 3) {
        continue;
      }
      body.appendFace(corners[0], corners[1], corners[2], material);
      for (let side = 0; side < 3; side++) {
        const a = corners[side];
        const b = corners[(side + 1) % 3];
        const key = `${Math.min(a, b)}:${Math.max(a, b)}`;
        if (links.has(key)) {
          continue;
        }
        links.add(key);
        body.appendLink(a, b, material, false);
      }
    }
    const bending = body.appendMaterial();
    bending.set_m_kLST(0.95);
    bending.set_m_kAST(0.95);
    body.generateBendingConstraints(3, bending);
    body.setTotalMass(0.08, false);
    for (const pin of garment.pins) {
      body.setMass(pin.index, 0);
    }
    const config = body.get_m_cfg();
    config.set_piterations(24);
    config.set_viterations(12);
    config.set_kDP(0.12);
    config.set_kDF(0.4);
    config.set_kCHR(1);
    config.set_kKHR(1);
    config.set_collisions(1);
    body.getCollisionShape().setMargin(COLLISION_MARGIN * PHYSICS_SCALE);
    body.setActivationState(4);
    this.#world.addSoftBody(body, 1, 2);
    for (const decoration of decorations) {
      const part = this.#root.findByName(decoration);
      for (const instance of part?.render?.meshInstances ?? []) {
        const binding = this.#copyMesh(instance);
        binding.mapping = [];
        binding.offsets = [];
        const matrix = this.#relative(instance.node);
        for (let i = 0; i < binding.positions.length; i += 3) {
          const position = matrix.transformPoint(new this.#pc.Vec3(
            binding.positions[i], binding.positions[i + 1], binding.positions[i + 2],
          ));
          let closest = 0;
          let distance = Infinity;
          for (let j = 0; j < garment.nodes.length; j++) {
            const candidate = position.distance(garment.nodes[j]);
            if (candidate < distance) {
              distance = candidate; closest = j;
            }
          }
          binding.mapping.push(closest);
          binding.offsets.push(position.sub(garment.nodes[closest]));
        }
        garment.decorations.push(binding);
      }
    }
    this.#garments.push(garment);
  }

  /**
   * @param {number} deltaTime
   */
  update(deltaTime) {
    const elapsed = Math.max(0, Math.min(deltaTime, 0.05));
    if (!elapsed) {
      return;
    }
    this.#inverse.copy(this.#root.getWorldTransform()).invert();
    for (const collider of this.#colliders) {
      this.#syncCollider(collider);
      this.#world.updateSingleAabb(collider.body);
    }
    const reset = this.#previousPosition.distance(this.#root.getPosition()) > 1;
    this.#previousPosition.copy(this.#root.getPosition());
    for (const garment of this.#garments) {
      const nodes = garment.body.get_m_nodes();
      for (const pin of garment.pins) {
        const target = this.#relative(pin.entity).transformPoint(pin.local);
        const node = nodes.at(pin.index);
        node.get_m_x().setValue(target.x * PHYSICS_SCALE, target.y * PHYSICS_SCALE, target.z * PHYSICS_SCALE);
        node.get_m_q().setValue(target.x * PHYSICS_SCALE, target.y * PHYSICS_SCALE, target.z * PHYSICS_SCALE);
        node.get_m_v().setValue(0, 0, 0);
      }
      if (reset) {
        this.#resetGarment(garment);
      }
    }
    this.#world.stepSimulation(elapsed, 6, FIXED_STEP);
    for (const garment of this.#garments) {
      for (const binding of [...garment.bindings, ...garment.decorations]) {
        this.#writeMesh(garment, binding);
      }
    }
  }

  /**
   * @param {HeroClothGarment} garment
   */
  #resetGarment(garment) {
    const nodes = garment.body.get_m_nodes();
    for (const binding of garment.bindings) {
      const matrix = this.#relative(binding.instance.node);
      const original = [];
      binding.original.getPositions(original);
      for (let i = 0; i < binding.mapping.length; i++) {
        this.#point.set(original[i * 3], original[i * 3 + 1], original[i * 3 + 2]);
        matrix.transformPoint(this.#point, this.#point);
        const node = nodes.at(binding.mapping[i]);
        node.get_m_x().setValue(this.#point.x * PHYSICS_SCALE, this.#point.y * PHYSICS_SCALE, this.#point.z * PHYSICS_SCALE);
        node.get_m_q().setValue(this.#point.x * PHYSICS_SCALE, this.#point.y * PHYSICS_SCALE, this.#point.z * PHYSICS_SCALE);
        node.get_m_v().setValue(0, 0, 0);
      }
    }
  }

  /**
   * @param {HeroClothGarment} garment
   * @param {HeroClothBinding} binding
   */
  #writeMesh(garment, binding) {
    const inverse = this.#relative(binding.instance.node).invert();
    const nodes = garment.body.get_m_nodes();
    for (let i = 0; i < binding.mapping.length; i++) {
      const point = nodes.at(binding.mapping[i]).get_m_x();
      this.#point.set(point.x() / PHYSICS_SCALE, point.y() / PHYSICS_SCALE, point.z() / PHYSICS_SCALE);
      if (binding.offsets) {
        this.#point.add(binding.offsets[i]);
      }
      inverse.transformPoint(this.#point, this.#point);
      binding.positions[i * 3] = this.#point.x;
      binding.positions[i * 3 + 1] = this.#point.y;
      binding.positions[i * 3 + 2] = this.#point.z;
    }
    binding.mesh.setPositions(binding.positions);
    binding.mesh.setNormals(this.#pc.calculateNormals(binding.positions, binding.indices));
    binding.mesh.update(this.#pc.PRIMITIVE_TRIANGLES, true);
  }

  destroy() {
    for (const garment of this.#garments) {
      this.#world.removeSoftBody(garment.body);
      Ammo.destroy(garment.body);
      for (const binding of [...garment.bindings, ...garment.decorations]) {
        binding.instance.mesh = binding.original;
        binding.instance.material = binding.originalMaterial;
        binding.mesh.destroy();
        binding.material.destroy();
      }
    }
    for (const collider of this.#colliders) {
      this.#world.removeRigidBody(collider.body);
    }
    for (const object of this.#owned.reverse()) {
      Ammo.destroy(object);
    }
    this.#garments = [];
    this.#colliders = [];
    this.#owned = [];
  }
}





