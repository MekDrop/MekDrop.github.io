/**
 * @typedef {object} ClothRoofCollider
 * @property {number} baseY
 * @property {number} height
 * @property {number} halfWidth
 * @property {number} halfDepth
 * @property {number} [centerX]
 * @property {number} [centerZ]
 * @property {number} [clearance]
 */

/**
 * @typedef {object} AmmoContactVector
 * @property {() => number} x
 * @property {() => number} y
 * @property {() => number} z
 * @property {(x: number, y: number, z: number) => void} setValue
 */

/**
 * @typedef {object} AmmoContactNode
 * @property {() => AmmoContactVector} get_m_x
 * @property {() => AmmoContactVector} get_m_v
 */

/**
 * @typedef {object} AmmoContactNodes
 * @property {() => number} size
 * @property {(index: number) => AmmoContactNode} at
 */

const ROOF_COLLISION_CLEARANCE = 0.065;
const ROOF_CONTACT_EPSILON = 0.000001;

/**
 * Projects Ammo nodes onto the roof after simulation. Bullet's node contacts
 * cannot prevent the interior of a coarse cloth face from crossing the roof.
 * Owns face topology only; borrows collider/pin data and nodes, allocates no Ammo
 * resources, and never advances or destroys the shared world or cloth body.
 */
export class ClothRoofContacts {
  /**
   * @type {ClothRoofCollider|null}
   */
  #collider;
  /**
   * @type {Set<number>}
   */
  #pinnedIndices;
  /**
   * @type {Array<import("../ObjectTypes.js").Triangle>}
   */
  #faces;

  /**
   * @param {ClothRoofCollider|null} collider
   * @param {ArrayLike<number>} indices
   * @param {Set<number>} pinnedIndices Borrowed from the owning cloth.
   */
  constructor(collider, indices, pinnedIndices) {
    this.#collider = collider;
    this.#pinnedIndices = pinnedIndices;
    this.#faces = Array.from(
      { length: indices.length / 3 },
      /**
       * @param {undefined} _
       * @param {number} faceIndex
       */
      (_, faceIndex) => ({
        first: indices[faceIndex * 3],
        second: indices[faceIndex * 3 + 1],
        third: indices[faceIndex * 3 + 2],
      }),
    );
  }

  /**
   *
   * @param {AmmoContactNodes} nodes
   */
  solve(nodes) {
    const collider = this.#collider;
    if (!collider || collider.halfWidth <= 0 || collider.halfDepth <= 0) {
      return;
    }
    for (let index = 0; index < nodes.size(); index += 1) {
      this.#enforceRoofNodeContact(nodes, collider, index);
    }
    for (const face of this.#faces) {
      this.#enforceRoofFaceContacts(nodes, collider, face);
    }
  }

  /**
   *
   * @param {AmmoContactNodes} nodes
   * @param {ClothRoofCollider} collider
   * @param {number} index
   */
  #enforceRoofNodeContact(nodes, collider, index) {
    const node = nodes.at(index);
    const position = node.get_m_x();
    const contact = this.#roofContact(
      collider,
      position.x(),
      position.y(),
      position.z(),
    );
    if (!contact || this.#pinnedIndices.has(index)) {
      return;
    }
    position.setValue(position.x(), position.y() + contact.penetration, position.z());
    this.#removeRoofVelocity(node.get_m_v(), contact.normal, 1);
  }

  /**
   *
   * @param {AmmoContactNodes} nodes
   * @param {ClothRoofCollider} collider
   * @param {import("src/game/objects/ObjectTypes.js").Triangle} face
   */
  #enforceRoofFaceContacts(nodes, collider, face) {
    const facePositions = [face.first, face.second, face.third].map(/**
     *
     * @param {number} index
     */
      (index) =>
        nodes.at(index).get_m_x(),
    );
    const centerX = collider.centerX ?? 0;
    const centerZ = collider.centerZ ?? 0;
    const clearance = collider.clearance ?? ROOF_COLLISION_CLEARANCE;
    /**
     *
     * @param {AmmoContactVector} position
     */
    const isAboveCollider = (position) =>
      position.y() >= collider.baseY + collider.height + clearance;
    /**
     *
     * @param {AmmoContactVector} position
     */
    const isLeftOfCollider = (position) => position.x() < centerX - collider.halfWidth;
    /**
     *
     * @param {AmmoContactVector} position
     */
    const isRightOfCollider = (position) => position.x() > centerX + collider.halfWidth;
    /**
     *
     * @param {AmmoContactVector} position
     */
    const isBehindCollider = (position) => position.z() < centerZ - collider.halfDepth;
    /**
     *
     * @param {AmmoContactVector} position
     */
    const isInFrontOfCollider = (position) => position.z() > centerZ + collider.halfDepth;
    if (
      facePositions.every(isAboveCollider) ||
      facePositions.every(isLeftOfCollider) ||
      facePositions.every(isRightOfCollider) ||
      facePositions.every(isBehindCollider) ||
      facePositions.every(isInFrontOfCollider)
    ) {
      return;
    }
    this.#enforceRoofFaceSample(nodes, collider, face, 1 / 3, 1 / 3, 1 / 3);
    this.#enforceRoofFeaturePoint(nodes, collider, face, 0, 0);
    for (const x of [-collider.halfWidth, collider.halfWidth]) {
      for (const z of [-collider.halfDepth, collider.halfDepth]) {
        this.#enforceRoofFeaturePoint(nodes, collider, face, x, z);
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
        nodes,
        collider,
        face,
        0,
        1,
        line,
      );
      this.#enforceRoofEdgeIntersection(
        nodes,
        collider,
        face,
        1,
        2,
        line,
      );
      this.#enforceRoofEdgeIntersection(
        nodes,
        collider,
        face,
        2,
        0,
        line,
      );
    }
  }

  /**
   *
   * @param {AmmoContactNodes} nodes
   * @param {ClothRoofCollider} collider
   * @param {import("src/game/objects/ObjectTypes.js").Triangle} face
   * @param {number} x
   * @param {number} z
   */
  #enforceRoofFeaturePoint(nodes, collider, face, x, z) {
    const indices = [face.first, face.second, face.third];
    const points = indices.map(/**
     *
     * @param {number} index
     */
      (index) => nodes.at(index).get_m_x());
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
      nodes,
      collider,
      face,
      firstWeight,
      secondWeight,
      thirdWeight,
    );
  }

  /**
   *
   * @param {AmmoContactNodes} nodes
   * @param {ClothRoofCollider} collider
   * @param {import("src/game/objects/ObjectTypes.js").Triangle} face
   * @param {number} leftSlot
   * @param {number} rightSlot
   * @param {Array<number>} line
   */
  #enforceRoofEdgeIntersection(
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
      nodes,
      collider,
      face,
      weights[0],
      weights[1],
      weights[2],
    );
  }

  /**
   *
   * @param {AmmoContactNodes} nodes
   * @param {ClothRoofCollider} collider
   * @param {import("src/game/objects/ObjectTypes.js").Triangle} face
   * @param {number} firstWeight
   * @param {number} secondWeight
   * @param {number} thirdWeight
   */
  #enforceRoofFaceSample(
    nodes,
    collider,
    face,
    firstWeight,
    secondWeight,
    thirdWeight,
  ) {
    const indices = [face.first, face.second, face.third];
    const weights = [firstWeight, secondWeight, thirdWeight];
    const positions = indices.map(/**
     *
     * @param {number} index
     */
      (index) => nodes.at(index).get_m_x());
    const x = positions.reduce(
      /**
       *
       * @param {number} total
       * @param {AmmoContactVector} position
       * @param {number} index
       */
      (total, position, index) => total + position.x() * weights[index],
      0,
    );
    const y = positions.reduce(
      /**
       *
       * @param {number} total
       * @param {AmmoContactVector} position
       * @param {number} index
       */
      (total, position, index) => total + position.y() * weights[index],
      0,
    );
    const z = positions.reduce(
      /**
       *
       * @param {number} total
       * @param {AmmoContactVector} position
       * @param {number} index
       */
      (total, position, index) => total + position.z() * weights[index],
      0,
    );
    const contact = this.#roofContact(collider, x, y, z);
    if (!contact) {
      return;
    }
    let movableWeightSquared = 0;
    for (let slot = 0; slot < indices.length; slot += 1) {
      if (!this.#pinnedIndices.has(indices[slot])) {
        movableWeightSquared += weights[slot] * weights[slot];
      }
    }
    if (movableWeightSquared <= ROOF_CONTACT_EPSILON) {
      return;
    }
    for (let slot = 0; slot < indices.length; slot += 1) {
      if (this.#pinnedIndices.has(indices[slot])) {
        continue;
      }
      const correction =
        (contact.penetration * weights[slot]) / movableWeightSquared;
      const position = positions[slot];
      position.setValue(position.x(), position.y() + correction, position.z());
    }

    const velocities = indices.map(/**
     *
     * @param {number} index
     */
      (index) => nodes.at(index).get_m_v());
    const inwardSpeed = velocities.reduce(
      /**
       *
       * @param {number} total
       * @param {AmmoContactVector} velocity
       * @param {number} index
       */
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
      if (this.#pinnedIndices.has(indices[slot])) {
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

  /**
   *
   * @param {ClothRoofCollider} collider
   * @param {number} x
   * @param {number} y
   * @param {number} z
   */
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

    return {
      normal,
      penetration: roofY - y,
    };
  }

  /**
   *
   * @param {AmmoContactVector} velocity
   * @param {number[]} normal
   * @param {number} scale
   * @param {number} inwardSpeed
   */
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

}
