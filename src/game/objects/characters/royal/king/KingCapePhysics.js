import { reinforceKingHem, measureKingHemExterior, findKingHemAttachment, findKingHemEdges, sampleKingHemAttachment } from "./KingCapeHem.js";
import { KingCapeTrimSupport } from "./KingCapeTrimSupport.js";

/**
 * @typedef {{a:number,b:number,amount:number,sign:number,lift:number}} KingHemAttachment
 * @typedef {{instance: import("playcanvas").MeshInstance, originalMesh: import("playcanvas").Mesh, originalMaterial: import("playcanvas").Material, originalSkin: import("playcanvas").SkinInstance|null, mesh: import("playcanvas").Mesh, material: import("playcanvas").Material, source: number[], positions: number[], indices: number[], joints: number[], weights: number[], mapping: number[], trimOffsets?: import("playcanvas").Vec3[],trimEdges?:Array<KingHemAttachment|null>}} KingCapeBinding
 * @typedef {{tangent:import("playcanvas").Vec3,bitangent:import("playcanvas").Vec3,normal:import("playcanvas").Vec3}} KingCapeFrame
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
   * @type {number[]}
   */
  #surfaceTriangles = [];
  /**
   * @type {Array<{index:number,sign:number}>}
   */
  #frameNeighbors = [];
  /**
   * @type {KingCapeFrame[]}
   */
  #trimFrames = [];
  /**
   * @type {import("playcanvas").Vec3[]}
   */
  #clothPoints = [];
  /**
   * @type {number[]}
   */
  #clothPositions = [];
  /**
   * @type {import("playcanvas").Vec3}
   */
  #frameTangent;
  /**
   * @type {import("playcanvas").Vec3}
   */
  #frameNormal;
  /**
   * @type {import("playcanvas").Vec3}
   */
  #frameBitangent;
  /**
   * @type {import("playcanvas").Vec3}
   */
  #frameOutward;
  /**
   * @type {import("playcanvas").Vec3}
   */
  #sourcePosition;
  /**
   * @type {import("playcanvas").Vec3}
   */
  #sourceTransformed;
  /**
   * @type {Map<import("playcanvas").SkinInstance, import("playcanvas").Mat4[]>}
   */
  #skinPalettes = new Map();
  /**
   * @type {Array<[number,number]>}
   */
  #hemEdges = [];
  /**
   * @type {Map<KingHemAttachment,{point:import("playcanvas").Vec3,frame:KingCapeFrame}>}
   */
  #hemFrames = new Map();
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
   * Downward extent of attached fur below each cloth node, in world units.
   * @type {number[]}
   */
  #furFloorClearance = [];
  /**
   * @type {KingCapeTrimSupport|null}
   */
  #trimSupport = null;
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
    this.#frameTangent = new pc.Vec3();
    this.#frameNormal = new pc.Vec3();
    this.#frameBitangent = new pc.Vec3();
    this.#frameOutward = new pc.Vec3();
    this.#sourcePosition = new pc.Vec3();
    this.#sourceTransformed = new pc.Vec3();
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

    if (this.#skinPalettes.has(skin)) {
      return this.#skinPalettes.get(skin);
    }
    const matrices = skin.bones.map(/**
     * @param {import("playcanvas").GraphNode} bone
     * @param {number} index
     */
      (bone, index) => new this.#pc.Mat4().mul2(
        bone.getWorldTransform(), skin.skin.inverseBindPose[index],
      ));
    this.#skinPalettes.set(skin, matrices);

    return matrices;
  }

  /**
   * @param {KingCapeBinding} binding
   * @param {number} vertex
   * @param {import("playcanvas").Mat4[]|null} matrices
   * @param {import("playcanvas").Vec3} result
   * @returns {import("playcanvas").Vec3}
   */
  #sourceWorld(binding, vertex, matrices, result = new this.#pc.Vec3()) {
    const position = this.#sourcePosition.set(binding.source[vertex * 3],
      binding.source[vertex * 3 + 1], binding.source[vertex * 3 + 2]);
    if (!matrices) {
      return binding.instance.node.getWorldTransform().transformPoint(position, result);
    }
    result.set(0, 0, 0);
    const transformed = this.#sourceTransformed;
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
    const unique = new Map();
    const triangles = [];
    const bindPoints = [];
    const frontSeams = new Set();
    this.#bindings = instances.map(this.#readBinding.bind(this));
    let top = -Infinity, bottom = Infinity;
    for (const binding of this.#bindings) {
      const matrices = this.#skinMatrices(binding);
      for (let vertex = 0; vertex < binding.source.length / 3; vertex++) {
        const point = this.#sourceWorld(binding, vertex, matrices);
        const bindPoint = binding.instance.node.getWorldTransform().transformPoint(
          new this.#pc.Vec3(...binding.source.slice(vertex * 3, vertex * 3 + 3)));
        const key = `${point.x.toFixed(5)},${point.y.toFixed(5)},${point.z.toFixed(5)}`;
        let index = unique.get(key);
        if (index === undefined) {
          index = this.#nodes.length;
          unique.set(key, index);
          this.#nodes.push(point);
          bindPoints.push(bindPoint);
          const local = rootInverse.transformPoint(point);
          top = Math.max(top, local.y);
          bottom = Math.min(bottom, local.y);
        }
        binding.mapping.push(index);
        const rest = rootInverse.transformPoint(binding.instance.node.getWorldTransform().transformPoint(
          new this.#pc.Vec3(...binding.source.slice(vertex * 3, vertex * 3 + 3))));
        if (rest.z > 0.04 && Math.abs(rest.x) > 0.3) {
          frontSeams.add(index);
        }
      }
      for (const index of binding.indices) {
        triangles.push(binding.mapping[index]);
      }
    }
    // The folded shoulder seam slopes slightly in animated poses. Four percent
    // captures its corner vertices while leaving the next cloth row unpinned.
    const threshold = top - (top - bottom) * 0.04;
    this.#surfaceTriangles = triangles;
    this.#hemEdges = findKingHemEdges(triangles, bindPoints.map(/**
     * @param {import("playcanvas").Vec3} point
     */
      point => rootInverse.transformPoint(point).y));
    const right = this.#root.getWorldTransform().transformVector(new this.#pc.Vec3(1, 0, 0)).normalize();
    this.#frameNeighbors = this.#nodes.map(/**
     *
     * @param {import("playcanvas").Vec3} point
     * @param {number} index
     */
      (point, index) => {
        let nearest = index, score = -1, sign = 1;
        for (let face = 0; face < triangles.length; face += 3) {
          if (!triangles.slice(face, face + 3).includes(index)) {
            continue;
          }
          for (const neighbor of triangles.slice(face, face + 3)) {
            if (neighbor === index) {
              continue;
            }
            const delta = this.#nodes[neighbor].clone().sub(point).normalize();
            const alignment = delta.dot(right);
            if (Math.abs(alignment) > score) {
              nearest = neighbor;
              sign = alignment < 0 ? -1 : 1;
              score = Math.abs(alignment);
            }
          }
        }

        return {
          index: nearest,
          sign,
        };
      });
    for (let index = 0; index < this.#nodes.length; index++) {
      const point = this.#nodes[index];
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
    for (let index = 0; index < this.#nodes.length; index++) {
      const point = this.#nodes[index].clone().mulScalar(PHYSICS_SCALE);
      bodyNodes.at(index).get_m_x().setValue(point.x, point.y, point.z);
      bodyNodes.at(index).get_m_q().setValue(point.x, point.y, point.z);
    }
    this.#updateTrimFrames();
    this.#attachTrim();
    this.#trimSupport = new KingCapeTrimSupport(this.#bindings);
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
    const body = this.#root.findByName("Royal animation rig - Dynasty midnight wool");
    for (const instance of body?.render?.meshInstances ?? []) {
      const binding = this.#readBinding(instance);
      const matrices = this.#skinMatrices(binding);
      for (let vertex = 0; vertex < binding.source.length / 3; vertex++) {
        let lap = false;
        for (let influence = 0; influence < 4; influence++) {
          const offset = vertex * 4 + influence;
          if (binding.weights[offset] > 0 &&
            binding.originalSkin?.bones[binding.joints[offset]]?.name === "King lap cloth") {
            lap = true;
          }
        }
        if (lap) {
          continue;
        }
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
    let bindWorld = hips.getWorldTransform();
    for (const binding of this.#bindings) {
      const skin = binding.originalSkin;
      const index = skin?.bones.findIndex(/**
       *
       * @param {import("playcanvas").GraphNode} bone
       */
        bone => bone === hips) ?? -1;
      if (index >= 0) {
        bindWorld = binding.instance.node.getWorldTransform().clone()
          .mul(skin.skin.inverseBindPose[index].clone().invert());
        break;
      }
    }
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
    for (const binding of this.#bindings) {
      if (binding.trimOffsets) {
        continue;
      }
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

  /**
   * Moving zero-mass seams can pull nodes through Bullet's soft-body SDF contact
   * tolerance even with a convex floor. Resolve only that remaining penetration;
   * Ammo still owns gravity, inertia, links, friction, and all body collisions.
   */
  #resolveFloorContact() {
    const nodes = this.#body.get_m_nodes();
    for (let index = 0; index < this.#nodes.length; index++) {
      const floor = (this.#groundY + 0.012 * this.#scale + this.#furFloorClearance[index]) * PHYSICS_SCALE;
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
    for (let index = 0; index < this.#nodes.length; index++) {
      const floor = (this.#groundY + 0.012 * this.#scale + this.#furFloorClearance[index]) * PHYSICS_SCALE;
      const node = nodes.at(index);
      const point = node.get_m_x();
      const velocity = node.get_m_v();
      if (!this.#floorContacts.has(index) && this.#furFloorClearance[index] > 0 && node.get_m_im() > 0 &&
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
      for (let index = 0; index < this.#nodes.length; index++) {
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
    this.#skinPalettes.clear();
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
    this.#updateTrimFrames();
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
        this.#groundY + 0.012 * this.#scale + this.#furFloorClearance[pin.index]);
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
      this.#updateTrimFrames();
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
    this.#writeMeshes();
  }

  /**
   * @param {KingHemAttachment} edge
   * @returns {{point:import("playcanvas").Vec3,frame:KingCapeFrame}}
   */
  #sampleHem(edge) {
    if (this.#hemFrames.has(edge)) {
      return this.#hemFrames.get(edge);
    }
    const result = sampleKingHemAttachment({
      pc: this.#pc,
      edge,
      points: this.#clothPoints,
      frames: this.#trimFrames,
      root: this.#root.getPosition(),
      upright: true,
      bodyCenter: this.#chest.getPosition(),
    });
    this.#hemFrames.set(edge, result);

    return result;
  }

  /**
   * @param {import("playcanvas").Vec3} center
   * @returns {KingHemAttachment|null}
   */
  #nearestHem(center) {
    return findKingHemAttachment({
      pc: this.#pc,
      center,
      scale: this.#scale,
      points: this.#clothPoints,
      edges: this.#hemEdges,
      frames: this.#trimFrames,
      root: this.#root.getPosition(),
    });
  }

  /**
   * Rigid trim frames come from the live cloth tangent and normal. This keeps
   * each original block's volume while turning it with the fold beneath it.
   */
  #updateTrimFrames() {
    this.#hemFrames.clear();
    const nodes = this.#body.get_m_nodes();
    const points = this.#clothPoints;
    for (let index = 0; index < this.#nodes.length; index++) {
      const source = nodes.at(index).get_m_x();
      const point = points[index] ??= new this.#pc.Vec3();
      point.set(source.x(), source.y(), source.z()).mulScalar(1 / PHYSICS_SCALE);
      this.#clothPositions[index * 3] = point.x;
      this.#clothPositions[index * 3 + 1] = point.y;
      this.#clothPositions[index * 3 + 2] = point.z;
    }
    const normals = this.#pc.calculateNormals(this.#clothPositions, this.#surfaceTriangles);
    const chest = this.#chest.getPosition();
    for (let index = 0; index < points.length; index++) {
      const point = points[index];
      const neighbor = this.#frameNeighbors[index];
      const tangent = this.#frameTangent.sub2(points[neighbor.index], point).mulScalar(neighbor.sign).normalize();
      const normal = this.#frameNormal.set(normals[index * 3], normals[index * 3 + 1], normals[index * 3 + 2]);
      const bitangent = this.#frameBitangent.cross(normal, tangent);
      if (bitangent.lengthSq() < 0.000001 && this.#trimFrames[index]) {
        continue;
      }
      bitangent.normalize();
      normal.cross(tangent, bitangent).normalize();
      if (normal.dot(this.#frameOutward.sub2(point, chest)) < 0) {
        normal.mulScalar(-1);
        bitangent.mulScalar(-1);
      }
      const frame = this.#trimFrames[index] ??= {
        tangent: new this.#pc.Vec3(),
        bitangent: new this.#pc.Vec3(),
        normal: new this.#pc.Vec3(),
      };
      frame.tangent.copy(tangent);
      frame.bitangent.copy(bitangent);
      frame.normal.copy(normal);
    }
    this.#trimSupport?.update(this.#trimFrames, this.#sampleHem.bind(this),
      this.#groundY + 0.012 * this.#scale, this.#furFloorClearance);
  }

  #writeMeshes() {
    this.#updateTrimFrames();
    const nodes = this.#body.get_m_nodes();
    const point = new this.#pc.Vec3();
    for (const binding of this.#bindings) {
      const inverse = binding.instance.node.getWorldTransform().clone().invert();
      const matrices = binding.trimOffsets ? this.#skinMatrices(binding) : null;
      for (let vertex = 0; vertex < binding.mapping.length; vertex++) {
        const index = binding.mapping[vertex];
        if (index < 0) {
          this.#sourceWorld(binding, vertex, matrices, point);
        } else {
          const position = nodes.at(index).get_m_x();
          point.set(position.x() / PHYSICS_SCALE, position.y() / PHYSICS_SCALE, position.z() / PHYSICS_SCALE);
          if (binding.trimOffsets) {
            const edge = binding.trimEdges?.[vertex];
            const sample = edge ? this.#sampleHem(edge) : null;
            const frame = sample?.frame ?? this.#trimFrames[index], offset = binding.trimOffsets[vertex];
            if (sample) {
              point.copy(sample.point);
            }
            point.addScaled(frame.tangent, offset.x).addScaled(frame.bitangent, offset.y).addScaled(frame.normal, offset.z);
          }
        }
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
   * Sew nearby fur vertices to the cloth nodes and distribute their hem mass.
   */
  #attachTrim() {
    const counts = new Array(this.#nodes.length).fill(0);
    this.#furFloorClearance = new Array(this.#nodes.length).fill(0);
    let total = 0;
    const anchors = [];
    const renders = this.#root.findComponents("render").sort(/**
     *
     * @param {import("playcanvas").RenderComponent} a
     * @param {import("playcanvas").RenderComponent} b
     */
      (a, b) =>
        Number(/Dynasty ink/.test(a.meshInstances[0]?.node.name)) - Number(/Dynasty ink/.test(b.meshInstances[0]?.node.name)));
    for (const render of renders) {
      for (const instance of render.meshInstances) {
        if (!/Dynasty (fur tips|ivory ermine|ink)/.test(instance.node.name)) {
          continue;
        }
        const binding = this.#readBinding(instance);
        const matrices = this.#skinMatrices(binding);
        binding.trimOffsets = [];
        binding.trimEdges = [];
        const sources = [];
        const parents = [];
        const seams = new Map();
        for (let vertex = 0; vertex < binding.source.length / 3; vertex++) {
          const point = this.#sourceWorld(binding, vertex, matrices);
          sources.push(point);
          const key = `${Math.round(point.x * 100000)}:${Math.round(point.y * 100000)}:${Math.round(point.z * 100000)}`;
          parents.push(seams.get(key) ?? vertex);
          seams.set(key, parents[vertex]);
        }
        /**
         * @param {number} index @returns {number}
         */
        const find = (index) => {
          while (parents[index] !== index) {
            index = parents[index];
          }

          return index;
        };
        for (let face = 0; face < binding.indices.length; face += 3) {
          const first = find(binding.indices[face]);
          parents[find(binding.indices[face + 1])] = first;
          parents[find(binding.indices[face + 2])] = first;
        }
        const centers = new Map();
        for (let vertex = 0; vertex < sources.length; vertex++) {
          const group = find(vertex);
          if (!centers.has(group)) {
            centers.set(group, {
              point: new this.#pc.Vec3(),
              count: 0,
              cape: !binding.originalSkin,
              nearest: -1,
              edge: null,
            });
          }
          const center = centers.get(group);
          center.point.add(sources[vertex]);
          center.count++;
          for (let influence = 0; influence < 4; influence++) {
            const offset = vertex * 4 + influence;
            const bone = binding.originalSkin?.bones[binding.joints[offset]];
            if (binding.weights[offset] > 0 && /^King cape [012]$/.test(bone?.name ?? "")) {
              center.cape = true;
            }
          }
        }
        for (const center of centers.values()) {
          center.point.mulScalar(1 / center.count);
          if (!center.cape) {
            continue;
          }
          let distance = 0.1 * this.#scale;
          for (let index = 0; index < this.#nodes.length; index++) {
            const separation = center.point.distance(this.#nodes[index]);
            if (separation < distance) {
              center.nearest = index;
              distance = separation;
            }
          }
          center.edge = this.#nearestHem(center.point);
          if (center.edge) {
            center.nearest = center.edge.amount < 0.5 ? center.edge.a : center.edge.b;
          }
          if (/Dynasty ink/.test(instance.node.name)) {
            let nearest = null, separation = 0.09 * this.#scale;
            for (const anchor of anchors) {
              const gap = center.point.distance(anchor.point);
              if (gap < separation) {
                nearest = anchor;
                separation = gap;
              }
            }
            if (nearest) {
              center.nearest = nearest.nearest;
              center.edge = nearest.edge;
              center.lift = nearest.lift;
            }
          } else {
            anchors.push(center);
          }
        }
        if (!/Dynasty ink/.test(instance.node.name)) {
          for (const [group, center] of centers) {
            if (center.nearest < 0) {
              continue;
            }
            const sample = center.edge ? this.#sampleHem(center.edge) : {
              point: this.#nodes[center.nearest],
              frame: this.#trimFrames[center.nearest],
            };
            let minimum = Infinity;
            for (let vertex = 0; vertex < sources.length; vertex++) {
              if (find(vertex) === group) {
                minimum = Math.min(minimum, sources[vertex].clone().sub(sample.point).dot(sample.frame.normal));
              }
            }
            // Fur is sewn into the cloth: retain a shallow overlap rather
            // than floating the complete rigid block clear of the surface.
            center.lift = Math.max(0, -0.023 * this.#scale - minimum);
            if (center.edge) {
              center.edge.lift = center.lift;
            }
          }
        }
        let attached = false;
        for (let vertex = 0; vertex < binding.source.length / 3; vertex++) {
          const source = sources[vertex];
          const center = centers.get(find(vertex));
          const nearest = center.nearest;
          binding.mapping.push(nearest);
          const edge = nearest < 0 ? null : center.edge;
          binding.trimEdges.push(edge);
          const sample = edge ? this.#sampleHem(edge) : null;
          const delta = nearest < 0 ? new this.#pc.Vec3() : source.clone().sub(sample?.point ?? this.#nodes[nearest]);
          const frame = sample?.frame ?? this.#trimFrames[nearest];
          const offset = nearest < 0 ? delta : new this.#pc.Vec3(
            delta.dot(frame.tangent), delta.dot(frame.bitangent), delta.dot(frame.normal),
          );
          offset.x *= edge ? 1.2 : 1;
          offset.z += center.lift ?? 0;
          binding.trimOffsets.push(offset);
          if (nearest >= 0) {
            const downward = -(frame.tangent.y * offset.x + frame.bitangent.y * offset.y + frame.normal.y * offset.z);
            for (const anchor of edge ? [edge.a, edge.b] : [nearest]) {
              this.#furFloorClearance[anchor] = Math.max(this.#furFloorClearance[anchor], downward);
            }
            if (edge) {
              counts[edge.a] += 1 - edge.amount;
              counts[edge.b] += edge.amount;
            } else {
              counts[nearest]++;
            }
            total++;
            attached = true;
          }
        }
        if (attached) {
          this.#bindings.push(binding);
        }
      }
    }
    if (total > 0) {
      for (let index = 0; index < counts.length; index++) {
        this.#body.setMass(index, 0.3 / counts.length + 0.15 * counts[index] / total);
      }
    }
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

    const minHemExteriorDistance = measureKingHemExterior(this.#pc, this.#bindings, /**
     *
     * @param {KingHemAttachment} edge
     */
      edge => this.#sampleHem(edge));

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
    this.#surfaceTriangles = [];
    this.#frameNeighbors = [];
    this.#trimFrames = [];
    this.#clothPoints = [];
    this.#clothPositions = [];
    this.#skinPalettes.clear();
    this.#hemEdges = [];
    this.#hemFrames.clear();
    this.#furFloorClearance = [];
    this.#trimSupport = null;
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
