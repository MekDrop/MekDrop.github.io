import Ammo from "sync-ammo/dist/ammo.module.js";
import { ClothRoofContacts } from "./ClothRoofContacts.js";
import { getAmbientWind } from "./AmbientWind.js";

const GRAVITY = -3.2;
const FIXED_TIME_STEP = 1 / 120;
const MAXIMUM_SUB_STEPS = 4;
const VERTEX_MASS = 0.002;
const WIND_ACCELERATION = 3.2;
const TURBULENCE_ACCELERATION = 0.2;
const STRONG_WIND_SPEED = 0.28;
const STRONG_WIND_TURBULENCE_ACCELERATION = 2;
const TURBULENCE_BASE_FREQUENCY = 2.7;
const TURBULENCE_WIND_FREQUENCY = 2.4;
const MAXIMUM_LINK_STRETCH = 1.08;
const MINIMUM_LINK_LENGTH_RATIO = 0.8;
const STRETCH_LIMIT_ITERATIONS = 3;
const ROOF_CONTACT_ITERATIONS = 12;
const SOFT_RIGID_AND_SELF_COLLISION = 0x41;
const SELF_COLLISION_CLUSTERS = 8;
const LINK_DIRECTION_EPSILON = 0.000001;
const POINTER_RADIUS_SCALE = 0.28;
const MINIMUM_POINTER_RADIUS = 0.16;

/**
 * Runs deformable cloth meshes in an isolated Ammo soft-body world.
 */
export class AmmoClothPhysics {
  /**
   * @type {WeakMap<object, Set<AmmoClothPhysics>>}
   */
  static #worldOwners = new WeakMap();
  /**
   *
    * @type {typeof import("playcanvas")}
   */
  #pc;
  /**
   *
    * @type {typeof import("playcanvas")}
   */
  #ammo;
  /**
   *
    * @type {number}
   */
  #collisionConfiguration;
  /**
   *
    * @type {typeof import("playcanvas")}
   */
  #dispatcher;
  /**
   *
    * @type {typeof import("playcanvas")}
   */
  #broadphase;
  /**
   *
    * @type {typeof import("playcanvas")}
   */
  #solver;
  /**
   *
    * @type {typeof import("playcanvas")}
   */
  #softBodySolver;
  /**
   *
    * @type {typeof import("playcanvas")}
   */
  #world;
  /**
   *
    * @type {typeof import("playcanvas")}
   */
  #gravity;
  /**
   *
    * @type {number}
   */
  #force;
  /**
   *
    * @type {Array<{softBody: {update: (deltaTime: number) => void, destroy: () => void}, mesh: import("playcanvas").Mesh, entity: import("playcanvas").Entity}>}
   */
  #cloths = [];
  /**
   *
    * @type {typeof import("playcanvas")}
   */
  #elapsed = 0;

  /**
   *
   * @param {{pc: typeof import("playcanvas")}} options
   * @param {typeof import("playcanvas")} options.pc
   */
  constructor({ pc = null } = {}) {
    this.#pc = pc;
    this.#ammo = Ammo;
  }

  /**
   * Bullet reserves large pools per world; empty flag collections need none.
   */
  #initializeWorld() {
    if (this.#world) {
      return;
    }
    const owners = AmmoClothPhysics.#worldOwners.get(this.#ammo);
    if (owners?.size) {
      const owner = owners.values().next().value;
      this.#collisionConfiguration = owner.#collisionConfiguration;
      this.#dispatcher = owner.#dispatcher;
      this.#broadphase = owner.#broadphase;
      this.#solver = owner.#solver;
      this.#softBodySolver = owner.#softBodySolver;
      this.#world = owner.#world;
      this.#gravity = owner.#gravity;
      this.#force = owner.#force;
      owners.add(this);

      return;
    }
    this.#collisionConfiguration =
      new this.#ammo.btSoftBodyRigidBodyCollisionConfiguration();
    this.#dispatcher = new this.#ammo.btCollisionDispatcher(
      this.#collisionConfiguration,
    );
    this.#broadphase = new this.#ammo.btDbvtBroadphase();
    this.#solver = new this.#ammo.btSequentialImpulseConstraintSolver();
    this.#softBodySolver = new this.#ammo.btDefaultSoftBodySolver();
    this.#world = new this.#ammo.btSoftRigidDynamicsWorld(
      this.#dispatcher,
      this.#broadphase,
      this.#solver,
      this.#collisionConfiguration,
      this.#softBodySolver,
    );
    this.#gravity = new this.#ammo.btVector3(0, GRAVITY, 0);
    this.#force = new this.#ammo.btVector3(0, 0, 0);
    this.#world.setGravity(this.#gravity);
    this.#world.getWorldInfo().set_m_gravity(this.#gravity);
    AmmoClothPhysics.#worldOwners.set(this.#ammo, new Set([this]));
  }

  /**
   *
   * @param {{positions: Array<{x: number, y: number, z: number}>, indices: Array<number>, pinnedIndices: Array<number>, vertexUv: import("src/game/objects/ObjectTypes.js").Point3, root: import("playcanvas").Entity, normalAxis: {x: number, y: number, z: number}, seed: number, wallPlane: {normal: import("src/game/objects/ObjectTypes.js").Point3, distance: number}|null, wallOpeningWindExposure: (position: import("src/game/objects/ObjectTypes.js").Point3) => number, roofCollider: import("./ClothRoofContacts.js").ClothRoofCollider|null, bendingStiffness: number, selfCollision: boolean, windExposure?: (direction: import("../ObjectTypes.js").Point3, elapsed: number) => number}} options
   * @param {Array<{x: number, y: number, z: number}>} options.positions
   * @param {Array<number>} options.indices
   * @param {Array<number>} options.pinnedIndices
   * @param {import("src/game/objects/ObjectTypes.js").Point3} options.vertexUv
   * @param {import("playcanvas").Entity} options.root
   * @param {{x: number, y: number, z: number}} options.normalAxis
   * @param {number} options.seed
   * @param {{normal: import("src/game/objects/ObjectTypes.js").Point3, distance: number}|null} options.wallPlane
   * @param {(position: import("src/game/objects/ObjectTypes.js").Point3) => number} options.wallOpeningWindExposure
   * @param {(direction: import("../ObjectTypes.js").Point3, elapsed: number) => number} [options.windExposure] Fraction of ambient wind reaching this cloth.
   * @param {import("./ClothRoofContacts.js").ClothRoofCollider|null} options.roofCollider
   * @param {number} options.bendingStiffness
   * @param {boolean} options.selfCollision
   */
  createCloth({
    positions,
    indices,
    pinnedIndices,
    vertexUv = null,
    root = null,
    normalAxis = 2,
    seed = 0,
    wallPlane = null,
    wallOpeningWindExposure = null,
    windExposure = null,
    roofCollider = null,
    bendingStiffness = 0.86,
    selfCollision = false,
  }) {
    this.#initializeWorld();
    const vertexCount = positions.length / 3;
    const { body, material, stretchConstraints } = this.#createBody(
      positions,
      indices,
    );
    const totalMass = Math.max(VERTEX_MASS, vertexCount * VERTEX_MASS);
    body.setTotalMass(totalMass, false);
    for (const index of pinnedIndices) {
      body.setMass(index, 0);
    }

    material.set_m_kLST(0.86);
    material.set_m_kAST(0.82);
    const bendingMaterial = body.appendMaterial();
    bendingMaterial.set_m_kLST(bendingStiffness);
    bendingMaterial.set_m_kAST(bendingStiffness);
    body.generateBendingConstraints(2, bendingMaterial);
    const configuration = body.get_m_cfg();
    configuration.set_viterations(8);
    configuration.set_piterations(8);
    configuration.set_kDP(0.08);
    configuration.set_kDF(0.35);
    if (selfCollision) {
      configuration.set_collisions(SOFT_RIGID_AND_SELF_COLLISION);
      body.generateClusters(SELF_COLLISION_CLUSTERS);
    }
    body.getCollisionShape().setMargin(0.012);
    body.setActivationState(4);

    // Cloths share local-coordinate space in this lightweight world. They do
    // not collide with one another; Ammo still solves every cloth constraint.
    this.#world.addSoftBody(body, 1, 0);

    const cloth = {
      body,
      inverseWorldTransform: this.#pc && root ? new this.#pc.Mat4() : null,
      localWind: this.#pc && root ? new this.#pc.Vec3() : null,
      normalAxis,
      phase: seed * Math.PI * 2,
      pinnedIndices: new Set(pinnedIndices),
      pointerPoint: null,
      positions,
      root,
      roofCollider,
      stretchConstraints,
      vertexUv,
      wallPlane,
      wallOpeningWindExposure,
      windExposure,
      worldWind: this.#pc && root ? new this.#pc.Vec3() : null,
    };
    cloth.roofContacts = new ClothRoofContacts(
      roofCollider,
      indices,
      cloth.pinnedIndices,
    );
    this.#cloths.push(cloth);

    return cloth;
  }

  /**
   *
   * @param {number} cloth
   * @param {{x: number, y: number, z: number}} point
   */
  beginPointer(cloth, point) {
    if (!cloth || !point) {
      return;
    }
    cloth.pointerPoint = this.#copyPoint(point);
    this.#applyPointerVelocity(cloth, point, {
      x: 0,
      y: 0,
      z: 0,
    }, 0.12);
  }

  /**
   *
   * @param {number} cloth
   * @param {{x: number, y: number, z: number}} point
   * @param {number} deltaTime
   */
  applyPointer(cloth, point, deltaTime) {
    if (!cloth?.pointerPoint || !point) {
      return;
    }
    const elapsed = Math.max(1 / 120, Math.min(0.08, deltaTime));
    const velocity = {
      x: (point.x - cloth.pointerPoint.x) / elapsed,
      y: (point.y - cloth.pointerPoint.y) / elapsed,
      z: (point.z - cloth.pointerPoint.z) / elapsed,
    };
    const speed = Math.hypot(velocity.x, velocity.y, velocity.z);
    if (speed > 0.001) {
      const inverseSpeed = 1 / speed;
      velocity.x *= inverseSpeed;
      velocity.y *= inverseSpeed;
      velocity.z *= inverseSpeed;
      this.#applyPointerVelocity(
        cloth,
        cloth.pointerPoint,
        velocity,
        Math.min(1.4, 0.22 + speed * 0.12),
      );
    }
    cloth.pointerPoint = this.#copyPoint(point);
  }

  /**
   *
   * @param {number} cloth
   */
  endPointer(cloth) {
    if (cloth) {
      cloth.pointerPoint = null;
    }
  }

  /**
   *
   * @param {number} deltaTime
   */
  step(deltaTime) {
    if (!this.#world) {
      return;
    }
    const owners = AmmoClothPhysics.#worldOwners.get(this.#ammo);
    // One owner advances the shared world; other collections only read their
    // meshes. Apply every collection's forces before that single simulation.
    if (owners.values().next().value !== this) {
      return;
    }
    const elapsed = Math.max(0, Math.min(0.05, deltaTime));
    for (const owner of owners) {
      owner.#elapsed += elapsed;
      const wind = getAmbientWind(owner.#elapsed);
      for (const cloth of owner.#cloths) {
        owner.#applyWind(cloth, wind);
      }
    }
    this.#world.stepSimulation(elapsed, MAXIMUM_SUB_STEPS, FIXED_TIME_STEP);
    for (const owner of owners) {
      for (const cloth of owner.#cloths) {
        owner.#limitStretch(cloth);
      }
    }
  }

  /**
   *
   * @param {number} cloth
   * @param {{x: number, y: number, z: number}} target
   */
  writePositions(cloth, target) {
    const nodes = cloth.body.get_m_nodes();
    for (let index = 0; index < nodes.size(); index += 1) {
      const position = nodes.at(index).get_m_x();
      const offset = index * 3;
      target[offset] = position.x();
      target[offset + 1] = position.y();
      target[offset + 2] = position.z();
    }
  }

  /**
   *
   * @param {number} cloth
   * @param {number} u
   * @param {number} v
   */
  sample(cloth, u, v) {
    if (!cloth?.vertexUv) {
      return null;
    }
    const nodes = cloth.body.get_m_nodes();
    let closestIndex = -1;
    let closestDistance = Number.POSITIVE_INFINITY;
    for (let index = 0; index < nodes.size(); index += 1) {
      const uvIndex = index * 2;
      const distance = Math.hypot(
        cloth.vertexUv[uvIndex] - u,
        cloth.vertexUv[uvIndex + 1] - v,
      );
      if (distance < closestDistance) {
        closestDistance = distance;
        closestIndex = index;
      }
    }
    if (closestIndex < 0) {
      return null;
    }
    const node = nodes.at(closestIndex);
    const position = node.get_m_x();
    const normal = node.get_m_n();

    return {
      position: {
        x: position.x(),
        y: position.y(),
        z: position.z(),
      },
      normal: {
        x: normal.x(),
        y: normal.y(),
        z: normal.z(),
      },
    };
  }

  destroy() {
    if (!this.#world) {
      return;
    }
    for (const cloth of this.#cloths) {
      this.#world.removeSoftBody(cloth.body);
      this.#ammo.destroy(cloth.body);
    }
    this.#cloths = [];
    const owners = AmmoClothPhysics.#worldOwners.get(this.#ammo);
    owners.delete(this);
    if (owners.size) {
      this.#world = null;

      return;
    }
    AmmoClothPhysics.#worldOwners.delete(this.#ammo);
    this.#ammo.destroy(this.#force);
    this.#ammo.destroy(this.#gravity);
    this.#ammo.destroy(this.#world);
    this.#ammo.destroy(this.#softBodySolver);
    this.#ammo.destroy(this.#solver);
    this.#ammo.destroy(this.#broadphase);
    this.#ammo.destroy(this.#dispatcher);
    this.#ammo.destroy(this.#collisionConfiguration);
    this.#force = null;
    this.#gravity = null;
    this.#world = null;
    this.#softBodySolver = null;
    this.#solver = null;
    this.#broadphase = null;
    this.#dispatcher = null;
    this.#collisionConfiguration = null;
    this.#ammo = null;
  }

  /**
   *
   * @param {number} cloth
   * @param {{direction: import("src/game/objects/ObjectTypes.js").Point3, speed: number}} wind
   */
  #applyWind(cloth, wind) {
    const environmentExposure = Math.max(0, Math.min(1, cloth.windExposure?.(wind.direction, this.#elapsed) ?? 1));
    // Sheltered cloth must dissipate prior gust/gesture energy rather than keep
    // ringing with the outdoor flutter damping after the airflow is blocked.
    cloth.body.get_m_cfg().set_kDP(0.08 + (1 - environmentExposure) * 0.42);
    if (environmentExposure === 0) {
      return;
    }
    let windX = wind.direction.x;
    let windZ = wind.direction.z;
    if (cloth.root && cloth.inverseWorldTransform) {
      cloth.worldWind.set(windX, 0, windZ);
      cloth.inverseWorldTransform.copy(cloth.root.getWorldTransform()).invert();
      cloth.inverseWorldTransform.transformVector(
        cloth.worldWind,
        cloth.localWind,
      );
      windX = cloth.localWind.x;
      windZ = cloth.localWind.z;
    }

    const openWindX = windX;
    const openWindZ = windZ;
    let exposure = 1;
    if (cloth.wallPlane !== null) {
      const normalWind = cloth.normalAxis === 0 ? windX : windZ;
      const unobstructedWind = Math.min(0, normalWind);
      windX = cloth.normalAxis === 0 ? unobstructedWind : 0;
      windZ = cloth.normalAxis === 2 ? unobstructedWind : 0;
      exposure = Math.abs(unobstructedWind);
    }

    // btSoftBody.addForce applies this force to every dynamic node, so this
    // must be a per-vertex force rather than the cloth's total force.
    const forceScale = VERTEX_MASS * wind.speed * WIND_ACCELERATION * environmentExposure;
    const force = [windX * forceScale, 0, windZ * forceScale];
    const turbulenceFrequency =
      TURBULENCE_BASE_FREQUENCY +
      Math.sqrt(Math.max(0, wind.speed - STRONG_WIND_SPEED)) *
        TURBULENCE_WIND_FREQUENCY;
    const primaryFlutter = Math.sin(
      this.#elapsed * turbulenceFrequency + cloth.phase,
    );
    const secondaryFlutter = Math.sin(
      this.#elapsed * turbulenceFrequency * 1.73 + cloth.phase * 1.37,
    );
    const turbulenceAcceleration =
      TURBULENCE_ACCELERATION +
      Math.max(0, wind.speed - STRONG_WIND_SPEED) *
        STRONG_WIND_TURBULENCE_ACCELERATION;
    const flutterForce =
      (primaryFlutter * 0.72 + secondaryFlutter * 0.28) *
      VERTEX_MASS *
      turbulenceAcceleration * environmentExposure;
    force[cloth.normalAxis] += flutterForce * exposure;
    if (
      cloth.wallPlane !== null &&
      cloth.wallOpeningWindExposure?.length
    ) {
      for (
        let index = 0;
        index < cloth.positions.length / 3;
        index += 1
      ) {
        const openingExposure = Math.max(
          0,
          Math.min(1, cloth.wallOpeningWindExposure[index] ?? 0),
        );
        const openingForce = [
          (windX + (openWindX - windX) * openingExposure) * forceScale,
          0,
          (windZ + (openWindZ - windZ) * openingExposure) * forceScale,
        ];
        const nodeExposure =
          exposure + (1 - exposure) * openingExposure;
        openingForce[cloth.normalAxis] += flutterForce * nodeExposure;
        this.#force.setValue(
          openingForce[0],
          openingForce[1],
          openingForce[2],
        );
        cloth.body.addForce(this.#force, index);
      }
      cloth.body.activate();

      return;
    }
    this.#force.setValue(force[0], force[1], force[2]);
    cloth.body.addForce(this.#force);
    cloth.body.activate();
  }

  /**
   *
   * @param {Array<{x: number, y: number, z: number}>} positions
   * @param {Array<number>} indices
   */
  #createBody(positions, indices) {
    const body = new this.#ammo.btSoftBody(this.#world.getWorldInfo());
    for (let index = 0; index < positions.length; index += 3) {
      const position = new this.#ammo.btVector3(
        positions[index],
        positions[index + 1],
        positions[index + 2],
      );
      body.appendNode(position, 1);
      this.#ammo.destroy(position);
    }

    const material = body.appendMaterial();
    const nodes = body.get_m_nodes();
    const links = new Set();
    const stretchConstraints = [];
    /**
     *
     * @param {boolean} left
     * @param {number} right
     */
    const appendLink = (left, right) => {
      const minimum = Math.min(left, right);
      const maximum = Math.max(left, right);
      const key = `${minimum}:${maximum}`;
      if (links.has(key)) {
        return;
      }
      links.add(key);
      const leftOffset = left * 3;
      const rightOffset = right * 3;
      const restDelta = [
        positions[rightOffset] - positions[leftOffset],
        positions[rightOffset + 1] - positions[leftOffset + 1],
        positions[rightOffset + 2] - positions[leftOffset + 2],
      ];
      const restLength = Math.hypot(...restDelta);
      stretchConstraints.push({
        left,
        maximumLength: restLength * MAXIMUM_LINK_STRETCH,
        minimumLength: restLength * MINIMUM_LINK_LENGTH_RATIO,
        restDirection: restDelta.map(/**
         *
         * @param {number} value
         */
          (value) => value / restLength),
        right,
      });
      body.appendLink(nodes.at(left), nodes.at(right), material, false);
    };

    for (let index = 0; index < indices.length; index += 3) {
      const first = indices[index];
      const second = indices[index + 1];
      const third = indices[index + 2];
      appendLink(first, second);
      appendLink(second, third);
      appendLink(third, first);
      body.appendFace(
        nodes.at(first),
        nodes.at(second),
        nodes.at(third),
        material,
      );
    }

    return {
      body,
      material,
      stretchConstraints,
    };
  }

  /**
   *
   * @param {number} cloth
   */
  #limitStretch(cloth) {
    const nodes = cloth.body.get_m_nodes();
    const iterations = cloth.roofCollider
      ? ROOF_CONTACT_ITERATIONS
      : STRETCH_LIMIT_ITERATIONS;
    for (let iteration = 0; iteration < iterations; iteration += 1) {
      this.#enforceWallPlane(cloth, nodes);
      cloth.roofContacts.solve(nodes);
      for (const constraint of cloth.stretchConstraints) {
        const leftNode = nodes.at(constraint.left);
        const rightNode = nodes.at(constraint.right);
        const leftPosition = leftNode.get_m_x();
        const rightPosition = rightNode.get_m_x();
        const deltaX = rightPosition.x() - leftPosition.x();
        const deltaY = rightPosition.y() - leftPosition.y();
        const deltaZ = rightPosition.z() - leftPosition.z();
        const distance = Math.hypot(deltaX, deltaY, deltaZ);
        if (
          distance >= constraint.minimumLength &&
          distance <= constraint.maximumLength
        ) {
          continue;
        }

        const leftPinned = cloth.pinnedIndices.has(constraint.left);
        const rightPinned = cloth.pinnedIndices.has(constraint.right);
        if (leftPinned && rightPinned) {
          continue;
        }
        const compressed = distance < constraint.minimumLength;
        const targetLength = compressed
          ? constraint.minimumLength
          : constraint.maximumLength;
        const direction =
          distance > LINK_DIRECTION_EPSILON
            ? [deltaX / distance, deltaY / distance, deltaZ / distance]
            : constraint.restDirection;
        const correction = distance - targetLength;
        const leftShare = leftPinned ? 0 : rightPinned ? 1 : 0.5;
        const rightShare = rightPinned ? 0 : leftPinned ? 1 : 0.5;
        leftPosition.setValue(
          leftPosition.x() + direction[0] * correction * leftShare,
          leftPosition.y() + direction[1] * correction * leftShare,
          leftPosition.z() + direction[2] * correction * leftShare,
        );
        rightPosition.setValue(
          rightPosition.x() - direction[0] * correction * rightShare,
          rightPosition.y() - direction[1] * correction * rightShare,
          rightPosition.z() - direction[2] * correction * rightShare,
        );
        this.#removeConstraintVelocity(
          leftNode,
          rightNode,
          direction,
          leftPinned,
          rightPinned,
          compressed,
        );
      }
      this.#enforceWallPlane(cloth, nodes);
      cloth.roofContacts.solve(nodes);
    }
  }

  /**
   *
   * @param {number} cloth
   * @param {Array<import("playcanvas").Entity>} nodes
   */
  #enforceWallPlane(cloth, nodes) {
    if (cloth.wallPlane === null) {
      return;
    }
    for (let index = 0; index < nodes.size(); index += 1) {
      const node = nodes.at(index);
      const position = node.get_m_x();
      const coordinates = [position.x(), position.y(), position.z()];
      if (coordinates[cloth.normalAxis] >= cloth.wallPlane) {
        continue;
      }
      coordinates[cloth.normalAxis] = cloth.wallPlane;
      position.setValue(coordinates[0], coordinates[1], coordinates[2]);

      const velocity = node.get_m_v();
      const velocityCoordinates = [
        velocity.x(),
        velocity.y(),
        velocity.z(),
      ];
      if (velocityCoordinates[cloth.normalAxis] < 0) {
        velocityCoordinates[cloth.normalAxis] = 0;
        velocity.setValue(
          velocityCoordinates[0],
          velocityCoordinates[1],
          velocityCoordinates[2],
        );
      }
    }
  }

  /**
   *
   * @param {import("playcanvas").Entity} leftNode
   * @param {import("playcanvas").Entity} rightNode
   * @param {{x: number, y: number, z: number}} direction
   * @param {boolean} leftPinned
   * @param {number} rightPinned
   * @param {number} compressed
   */
  #removeConstraintVelocity(
    leftNode,
    rightNode,
    direction,
    leftPinned,
    rightPinned,
    compressed,
  ) {
    const leftVelocity = leftNode.get_m_v();
    const rightVelocity = rightNode.get_m_v();
    const relativeSpeed =
      (rightVelocity.x() - leftVelocity.x()) * direction[0] +
      (rightVelocity.y() - leftVelocity.y()) * direction[1] +
      (rightVelocity.z() - leftVelocity.z()) * direction[2];
    if ((compressed && relativeSpeed >= 0) || (!compressed && relativeSpeed <= 0)) {
      return;
    }
    const leftShare = leftPinned ? 0 : rightPinned ? 1 : 0.5;
    const rightShare = rightPinned ? 0 : leftPinned ? 1 : 0.5;
    leftVelocity.setValue(
      leftVelocity.x() + direction[0] * relativeSpeed * leftShare,
      leftVelocity.y() + direction[1] * relativeSpeed * leftShare,
      leftVelocity.z() + direction[2] * relativeSpeed * leftShare,
    );
    rightVelocity.setValue(
      rightVelocity.x() - direction[0] * relativeSpeed * rightShare,
      rightVelocity.y() - direction[1] * relativeSpeed * rightShare,
      rightVelocity.z() - direction[2] * relativeSpeed * rightShare,
    );
  }

  /**
   *
   * @param {number} cloth
   * @param {{x: number, y: number, z: number}} point
   * @param {{x: number, y: number, z: number}} direction
   * @param {number} strength
   */
  #applyPointerVelocity(cloth, point, direction, strength) {
    const nodes = cloth.body.get_m_nodes();
    const bounds = this.#measureBounds(cloth.positions);
    const radius = Math.max(
      MINIMUM_POINTER_RADIUS,
      Math.max(bounds.x, bounds.y, bounds.z) * POINTER_RADIUS_SCALE,
    );
    for (let index = 0; index < nodes.size(); index += 1) {
      if (cloth.pinnedIndices.has(index)) {
        continue;
      }
      const node = nodes.at(index);
      const position = node.get_m_x();
      const distance = Math.hypot(
        position.x() - point.x,
        position.y() - point.y,
        position.z() - point.z,
      );
      if (distance > radius) {
        continue;
      }
      const weight = 1 - distance / radius;
      const velocity = node.get_m_v();
      const normalDirection =
        cloth.normalAxis === 0 ? direction.x : direction.z;
      const next = [
        velocity.x() + direction.x * strength * weight,
        velocity.y() + direction.y * strength * weight,
        velocity.z() + direction.z * strength * weight,
      ];
      next[cloth.normalAxis] +=
        (0.3 + Math.abs(normalDirection) * 0.18) * strength * weight;
      velocity.setValue(next[0], next[1], next[2]);
    }
    cloth.body.activate();
  }

  /**
   *
   * @param {Array<{x: number, y: number, z: number}>} positions
   */
  #measureBounds(positions) {
    const minimum = [Infinity, Infinity, Infinity];
    const maximum = [-Infinity, -Infinity, -Infinity];
    for (let index = 0; index < positions.length; index += 3) {
      for (let axis = 0; axis < 3; axis += 1) {
        minimum[axis] = Math.min(minimum[axis], positions[index + axis]);
        maximum[axis] = Math.max(maximum[axis], positions[index + axis]);
      }
    }

    return {
      x: maximum[0] - minimum[0],
      y: maximum[1] - minimum[1],
      z: maximum[2] - minimum[2],
    };
  }

  /**
   *
   * @param {{x: number, y: number, z: number}} point
   */
  #copyPoint(point) {
    return {
      x: point.x,
      y: point.y,
      z: point.z,
    };
  }
}
