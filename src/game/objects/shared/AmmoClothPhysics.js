import { getAmbientWind } from "./AmbientWind.js";

const GRAVITY = -3.2;
const FIXED_TIME_STEP = 1 / 120;
const MAXIMUM_SUB_STEPS = 4;
const VERTEX_MASS = 0.002;
const WIND_ACCELERATION = 3.2;
const TURBULENCE_ACCELERATION = 0.2;
const MAXIMUM_LINK_STRETCH = 1.08;
const MINIMUM_LINK_LENGTH_RATIO = 0.8;
const STRETCH_LIMIT_ITERATIONS = 3;
const ROOF_CONTACT_ITERATIONS = 12;
const SOFT_RIGID_AND_SELF_COLLISION = 0x41;
const SELF_COLLISION_CLUSTERS = 8;
const ROOF_COLLISION_CLEARANCE = 0.065;
const ROOF_CONTACT_EPSILON = 0.000001;
const POINTER_RADIUS_SCALE = 0.28;
const MINIMUM_POINTER_RADIUS = 0.16;

/** Runs deformable cloth meshes in an isolated Ammo soft-body world. */
export class AmmoClothPhysics {
  #pc;
  #ammo;
  #collisionConfiguration;
  #dispatcher;
  #broadphase;
  #solver;
  #softBodySolver;
  #world;
  #gravity;
  #force;
  #cloths = [];
  #elapsed = 0;

  constructor({ pc = null } = {}) {
    this.#pc = pc;
    this.#ammo = globalThis.Ammo;
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
  }

  createCloth({
    positions,
    indices,
    pinnedIndices,
    vertexUv = null,
    root = null,
    normalAxis = 2,
    seed = 0,
    wallPlane = null,
    roofCollider = null,
    bendingStiffness = 0.86,
    selfCollision = false,
  }) {
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
      roofFaces: Array.from(
        { length: indices.length / 3 },
        (_, faceIndex) => ({
          first: indices[faceIndex * 3],
          second: indices[faceIndex * 3 + 1],
          third: indices[faceIndex * 3 + 2],
        }),
      ),
      stretchConstraints,
      vertexUv,
      wallPlane,
      worldWind: this.#pc && root ? new this.#pc.Vec3() : null,
    };
    this.#cloths.push(cloth);
    return cloth;
  }

  beginPointer(cloth, point) {
    if (!cloth || !point) {
      return;
    }
    cloth.pointerPoint = this.#copyPoint(point);
    this.#applyPointerVelocity(cloth, point, { x: 0, y: 0, z: 0 }, 0.12);
  }

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

  endPointer(cloth) {
    if (cloth) {
      cloth.pointerPoint = null;
    }
  }

  step(deltaTime) {
    if (!this.#world) {
      return;
    }
    const elapsed = Math.max(0, Math.min(0.05, deltaTime));
    this.#elapsed += elapsed;
    const wind = getAmbientWind(this.#elapsed);
    for (const cloth of this.#cloths) {
      this.#applyWind(cloth, wind);
    }
    this.#world.stepSimulation(elapsed, MAXIMUM_SUB_STEPS, FIXED_TIME_STEP);
    for (const cloth of this.#cloths) {
      this.#limitStretch(cloth);
    }
  }

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
    if (!this.#ammo) {
      return;
    }
    for (const cloth of this.#cloths) {
      this.#world.removeSoftBody(cloth.body);
      this.#ammo.destroy(cloth.body);
    }
    this.#cloths = [];
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

  #applyWind(cloth, wind) {
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

    let exposure = 1;
    if (cloth.wallPlane !== null) {
      if (cloth.normalAxis === 0) {
        windX = 0;
      } else {
        windZ = 0;
      }
      exposure = Math.hypot(windX, windZ);
    }

    // btSoftBody.addForce applies this force to every dynamic node, so this
    // must be a per-vertex force rather than the cloth's total force.
    const forceScale = VERTEX_MASS * wind.speed * WIND_ACCELERATION;
    const force = [windX * forceScale, 0, windZ * forceScale];
    force[cloth.normalAxis] +=
      Math.sin(this.#elapsed * 2.7 + cloth.phase) *
      VERTEX_MASS *
      TURBULENCE_ACCELERATION *
      exposure;
    this.#force.setValue(force[0], force[1], force[2]);
    cloth.body.addForce(this.#force);
    cloth.body.activate();
  }

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
        restDirection: restDelta.map((value) => value / restLength),
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
    return { body, material, stretchConstraints };
  }

  #limitStretch(cloth) {
    const nodes = cloth.body.get_m_nodes();
    const iterations = cloth.roofCollider
      ? ROOF_CONTACT_ITERATIONS
      : STRETCH_LIMIT_ITERATIONS;
    for (let iteration = 0; iteration < iterations; iteration += 1) {
      this.#enforceWallPlane(cloth, nodes);
      this.#enforceRoofCollider(cloth, nodes);
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
          distance > ROOF_CONTACT_EPSILON
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
      this.#enforceRoofCollider(cloth, nodes);
    }
  }

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

  #enforceRoofCollider(cloth, nodes) {
    const collider = cloth.roofCollider;
    if (!collider || collider.halfWidth <= 0 || collider.halfDepth <= 0) {
      return;
    }
    for (let index = 0; index < nodes.size(); index += 1) {
      this.#enforceRoofNodeContact(cloth, nodes, collider, index);
    }
    for (const face of cloth.roofFaces) {
      this.#enforceRoofFaceContacts(cloth, nodes, collider, face);
    }
  }

  #enforceRoofNodeContact(cloth, nodes, collider, index) {
    const node = nodes.at(index);
    const position = node.get_m_x();
    const contact = this.#roofContact(
      collider,
      position.x(),
      position.y(),
      position.z(),
    );
    if (!contact || cloth.pinnedIndices.has(index)) {
      return;
    }
    position.setValue(position.x(), position.y() + contact.penetration, position.z());
    this.#removeRoofVelocity(node.get_m_v(), contact.normal, 1);
  }

  #enforceRoofFaceContacts(cloth, nodes, collider, face) {
    const facePositions = [face.first, face.second, face.third].map((index) =>
      nodes.at(index).get_m_x(),
    );
    const centerX = collider.centerX ?? 0;
    const centerZ = collider.centerZ ?? 0;
    const clearance = collider.clearance ?? ROOF_COLLISION_CLEARANCE;
    if (
      facePositions.every(
        (position) =>
          position.y() >= collider.baseY + collider.height + clearance,
      ) ||
      facePositions.every(
        (position) => position.x() < centerX - collider.halfWidth,
      ) ||
      facePositions.every(
        (position) => position.x() > centerX + collider.halfWidth,
      ) ||
      facePositions.every(
        (position) => position.z() < centerZ - collider.halfDepth,
      ) ||
      facePositions.every(
        (position) => position.z() > centerZ + collider.halfDepth,
      )
    ) {
      return;
    }
    this.#enforceRoofFaceSample(cloth, nodes, collider, face, 1 / 3, 1 / 3, 1 / 3);
    this.#enforceRoofFeaturePoint(cloth, nodes, collider, face, 0, 0);
    for (const x of [-collider.halfWidth, collider.halfWidth]) {
      for (const z of [-collider.halfDepth, collider.halfDepth]) {
        this.#enforceRoofFeaturePoint(cloth, nodes, collider, face, x, z);
      }
    }

    const lines = [
      [1 / collider.halfWidth, -1 / collider.halfDepth, 0],
      [1 / collider.halfWidth, 1 / collider.halfDepth, 0],
      [1, 0, -collider.halfWidth],
      [1, 0, collider.halfWidth],
      [0, 1, -collider.halfDepth],
      [0, 1, collider.halfDepth],
    ];
    for (const line of lines) {
      this.#enforceRoofEdgeIntersection(
        cloth,
        nodes,
        collider,
        face,
        0,
        1,
        line,
      );
      this.#enforceRoofEdgeIntersection(
        cloth,
        nodes,
        collider,
        face,
        1,
        2,
        line,
      );
      this.#enforceRoofEdgeIntersection(
        cloth,
        nodes,
        collider,
        face,
        2,
        0,
        line,
      );
    }
  }

  #enforceRoofFeaturePoint(cloth, nodes, collider, face, x, z) {
    const indices = [face.first, face.second, face.third];
    const points = indices.map((index) => nodes.at(index).get_m_x());
    const denominator =
      (points[1].z() - points[2].z()) * (points[0].x() - points[2].x()) +
      (points[2].x() - points[1].x()) * (points[0].z() - points[2].z());
    if (Math.abs(denominator) <= ROOF_CONTACT_EPSILON) {
      return;
    }
    const firstWeight =
      ((points[1].z() - points[2].z()) * (x - points[2].x()) +
        (points[2].x() - points[1].x()) * (z - points[2].z())) /
      denominator;
    const secondWeight =
      ((points[2].z() - points[0].z()) * (x - points[2].x()) +
        (points[0].x() - points[2].x()) * (z - points[2].z())) /
      denominator;
    const thirdWeight = 1 - firstWeight - secondWeight;
    if (
      firstWeight < -ROOF_CONTACT_EPSILON ||
      secondWeight < -ROOF_CONTACT_EPSILON ||
      thirdWeight < -ROOF_CONTACT_EPSILON
    ) {
      return;
    }
    this.#enforceRoofFaceSample(
      cloth,
      nodes,
      collider,
      face,
      firstWeight,
      secondWeight,
      thirdWeight,
    );
  }

  #enforceRoofEdgeIntersection(
    cloth,
    nodes,
    collider,
    face,
    leftSlot,
    rightSlot,
    line,
  ) {
    const indices = [face.first, face.second, face.third];
    const left = nodes.at(indices[leftSlot]).get_m_x();
    const right = nodes.at(indices[rightSlot]).get_m_x();
    const leftDistance = line[0] * left.x() + line[1] * left.z() + line[2];
    const rightDistance =
      line[0] * right.x() + line[1] * right.z() + line[2];
    const distanceDifference = leftDistance - rightDistance;
    if (Math.abs(distanceDifference) <= ROOF_CONTACT_EPSILON) {
      return;
    }
    const ratio = leftDistance / distanceDifference;
    if (ratio <= ROOF_CONTACT_EPSILON || ratio >= 1 - ROOF_CONTACT_EPSILON) {
      return;
    }
    const weights = [0, 0, 0];
    weights[leftSlot] = 1 - ratio;
    weights[rightSlot] = ratio;
    this.#enforceRoofFaceSample(
      cloth,
      nodes,
      collider,
      face,
      weights[0],
      weights[1],
      weights[2],
    );
  }

  #enforceRoofFaceSample(
    cloth,
    nodes,
    collider,
    face,
    firstWeight,
    secondWeight,
    thirdWeight,
  ) {
    const indices = [face.first, face.second, face.third];
    const weights = [firstWeight, secondWeight, thirdWeight];
    const positions = indices.map((index) => nodes.at(index).get_m_x());
    const x = positions.reduce(
      (total, position, index) => total + position.x() * weights[index],
      0,
    );
    const y = positions.reduce(
      (total, position, index) => total + position.y() * weights[index],
      0,
    );
    const z = positions.reduce(
      (total, position, index) => total + position.z() * weights[index],
      0,
    );
    const contact = this.#roofContact(collider, x, y, z);
    if (!contact) {
      return;
    }
    let movableWeightSquared = 0;
    for (let slot = 0; slot < indices.length; slot += 1) {
      if (!cloth.pinnedIndices.has(indices[slot])) {
        movableWeightSquared += weights[slot] * weights[slot];
      }
    }
    if (movableWeightSquared <= ROOF_CONTACT_EPSILON) {
      return;
    }
    for (let slot = 0; slot < indices.length; slot += 1) {
      if (cloth.pinnedIndices.has(indices[slot])) {
        continue;
      }
      const correction =
        (contact.penetration * weights[slot]) / movableWeightSquared;
      const position = positions[slot];
      position.setValue(position.x(), position.y() + correction, position.z());
    }

    const velocities = indices.map((index) => nodes.at(index).get_m_v());
    const inwardSpeed = velocities.reduce(
      (total, velocity, index) =>
        total +
        weights[index] *
          (velocity.x() * contact.normal[0] +
            velocity.y() * contact.normal[1] +
            velocity.z() * contact.normal[2]),
      0,
    );
    if (inwardSpeed >= 0) {
      return;
    }
    for (let slot = 0; slot < indices.length; slot += 1) {
      if (cloth.pinnedIndices.has(indices[slot])) {
        continue;
      }
      this.#removeRoofVelocity(
        velocities[slot],
        contact.normal,
        weights[slot] / movableWeightSquared,
        inwardSpeed,
      );
    }
  }

  #roofContact(collider, x, y, z) {
    const centerX = collider.centerX ?? 0;
    const centerZ = collider.centerZ ?? 0;
    const offsetX = x - centerX;
    const offsetZ = z - centerZ;
    const normalizedX = Math.abs(offsetX) / collider.halfWidth;
    const normalizedZ = Math.abs(offsetZ) / collider.halfDepth;
    const roofRatio = Math.max(normalizedX, normalizedZ);
    if (roofRatio > 1) {
      return null;
    }
    const clearance = collider.clearance ?? ROOF_COLLISION_CLEARANCE;
    const roofY =
      collider.baseY + collider.height * (1 - roofRatio) + clearance;
    if (y >= roofY) {
      return null;
    }
    const normal =
      normalizedX >= normalizedZ
        ? [
            (Math.sign(offsetX) * collider.height) / collider.halfWidth,
            1,
            0,
          ]
        : [
            0,
            1,
            (Math.sign(offsetZ) * collider.height) / collider.halfDepth,
          ];
    const inverseNormalLength = 1 / Math.hypot(...normal);
    normal[0] *= inverseNormalLength;
    normal[1] *= inverseNormalLength;
    normal[2] *= inverseNormalLength;
    return { normal, penetration: roofY - y };
  }

  #removeRoofVelocity(velocity, normal, scale, inwardSpeed = null) {
    const speed =
      inwardSpeed ??
      velocity.x() * normal[0] +
        velocity.y() * normal[1] +
        velocity.z() * normal[2];
    if (speed >= 0) {
      return;
    }
    velocity.setValue(
      velocity.x() - normal[0] * speed * scale,
      velocity.y() - normal[1] * speed * scale,
      velocity.z() - normal[2] * speed * scale,
    );
  }

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

  #copyPoint(point) {
    return { x: point.x, y: point.y, z: point.z };
  }
}
