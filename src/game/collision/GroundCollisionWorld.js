export class GroundCollisionWorld {
  /**
   *
   * @type {Set}
   */
  #colliders = new Set();
  /**
   *
   * @type {Set}
   */
  #physicsSurfaceColliders = new Set();

  /**
   *
   * @param {{entity: pc.Entity, destroy?: () => void}} collider
   * @param {{physicsSurface: TerrainPhysicsSurface}} options
   * @param {TerrainPhysicsSurface} options.physicsSurface
   */
  add(collider, { physicsSurface = true } = {}) {
    if (collider) {
      this.#colliders.add(collider);
      if (physicsSurface) {
        this.#physicsSurfaceColliders.add(collider);
      } else {
        this.#physicsSurfaceColliders.delete(collider);
      }
    }
    return collider;
  }

  clear() {
    this.#colliders.clear();
    this.#physicsSurfaceColliders.clear();
  }

  /**
   * Registered ground objects are solid to grass by default. They may expose a
   * normalized grassWeight or grassWeightAt() to tune the surrounding bend.
   *
   * @param {number} x
   * @param {number} z
   * @param {number} elevation
   */
  grassWeightAt(x, z, elevation) {
    let weight = 0;
    for (const collider of this.#colliders) {
      const explicitWeight = collider.grassWeightAt?.(x, z, elevation);
      if (Number.isFinite(explicitWeight)) {
        weight = Math.max(
          weight,
          Math.max(0, Math.min(1, explicitWeight)),
        );
        continue;
      }
      const objectWeight = Number.isFinite(collider.grassWeight)
        ? Math.max(0, Math.min(1, collider.grassWeight))
        : 1;
      const surfaceHeight = collider.surfaceHeightAt?.(x, z, 0);
      const lowSurface =
        Number.isFinite(surfaceHeight) &&
        surfaceHeight >= elevation + 0.004 &&
        surfaceHeight <= elevation + 0.3;
      const collisionDepth = collider.collisionDepthAt?.(
        x,
        z,
        0,
        elevation,
        0.05,
      ) ?? 0;
      const blocks = collider.blocksMovementAt?.(
        x,
        z,
        0,
        elevation,
        0.05,
      ) ?? false;
      const intersects =
        collider.intersectsGroundFootprint?.(x, z, 0) ?? false;
      if (lowSurface || collisionDepth > 0 || blocks || intersects) {
        weight = Math.max(weight, objectWeight);
      }
    }
    return weight;
  }

  /**
   *
   * @param {number} x
   * @param {number} z
   * @param {number} radius
   * @param {number} elevation
   * @param {number} stepClearance
   */
  isBlocked(x, z, radius = 0, elevation = -Infinity, stepClearance = 0) {
    return (
      this.#blockingDepthAt(x, z, radius, elevation, stepClearance) > 0
    );
  }

  /**
   *
   * @param {number} x
   * @param {number} y
   * @param {number} z
   * @param {number} radius
   */
  isCameraBlocked(x, y, z, radius = 0) {
    for (const collider of this.#colliders) {
      if (collider.blocksCameraAt?.(x, y, z, radius)) {
        return true;
      }
    }
    return false;
  }

  /**
   *
   * @param {number} fromX
   * @param {number} fromZ
   * @param {number} toX
   * @param {number} toZ
   * @param {number} radius
   * @param {number} elevation
   * @param {number} stepClearance
   */
  isMovementBlocked(
    fromX,
    fromZ,
    toX,
    toZ,
    radius = 0,
    elevation = -Infinity,
    stepClearance = 0,
  ) {
    const destinationDepth = this.#blockingDepthAt(
      toX,
      toZ,
      radius,
      elevation,
      stepClearance,
      true,
    );
    if (destinationDepth <= 0) {
      return false;
    }

    const currentDepth = this.#blockingDepthAt(
      fromX,
      fromZ,
      radius,
      elevation,
      stepClearance,
      true,
    );
    return currentDepth <= 0 || destinationDepth >= currentDepth - 0.000001;
  }

  /**
   *
   * @param {number} x
   * @param {number} z
   * @param {number} radius
   * @param {number} elevation
   */
  movementRefusalAt(x, z, radius = 0, elevation = -Infinity) {
    for (const collider of this.#colliders) {
      const refusal = collider.movementRefusalAt?.(
        x,
        z,
        radius,
        elevation,
      );
      if (refusal) {
        return refusal;
      }
    }
    return null;
  }

  /**
   *
   * @param {number} fromX
   * @param {number} fromZ
   * @param {number} toX
   * @param {number} toZ
   * @param {number} radius
   */
  movementRepulsionFor(fromX, fromZ, toX, toZ, radius = 0) {
    for (const collider of this.#colliders) {
      const direction = collider.repulsionForMovement?.(
        fromX,
        fromZ,
        toX,
        toZ,
        radius,
      );
      if (direction) {
        return direction;
      }
    }
    return null;
  }

  /**
   *
   * @param {number} x
   * @param {number} z
   * @param {number} radius
   * @param {number} elevation
   * @param {number} stepClearance
   * @param {boolean} movement
   */
  #blockingDepthAt(
    x,
    z,
    radius,
    elevation,
    stepClearance,
    movement = false,
  ) {
    let depth = 0;
    for (const collider of this.#colliders) {
      const collisionDepthAt = movement
        ? collider.movementCollisionDepthAt ?? collider.collisionDepthAt
        : collider.collisionDepthAt;
      if (collisionDepthAt) {
        depth += Math.max(
          0,
          collisionDepthAt.call(
            collider,
            x,
            z,
            radius,
            elevation,
            stepClearance,
          ),
        );
        continue;
      }
      if (
        this.#colliderBlocks(
          collider,
          x,
          z,
          radius,
          elevation,
          stepClearance,
        )
      ) {
        depth += 1;
      }
    }
    return depth;
  }

  /**
   *
   * @param {{entity: pc.Entity, destroy?: () => void}} collider
   * @param {number} x
   * @param {number} z
   * @param {number} radius
   * @param {number} elevation
   * @param {number} stepClearance
   */
  #colliderBlocks(collider, x, z, radius, elevation, stepClearance) {
    if (collider.blocksMovementAt) {
      return collider.blocksMovementAt(
        x,
        z,
        radius,
        elevation,
        stepClearance,
      );
    }
    if (!collider.intersectsGroundFootprint?.(x, z, radius)) {
      return false;
    }
    const surfaceHeight = collider.surfaceHeightAt?.(x, z, radius);
    return !(
      Number.isFinite(surfaceHeight) &&
      surfaceHeight <= elevation + stepClearance
    );
  }

  /**
   *
   * @param {number} x
   * @param {number} z
   * @param {number} radius
   */
  surfaceHeightAt(x, z, radius = 0) {
    return this.#surfaceHeightAt(this.#colliders, x, z, radius);
  }

  /**
   *
   * @param {number} x
   * @param {number} z
   * @param {number} radius
   */
  physicsSurfaceHeightAt(x, z, radius = 0) {
    return this.#surfaceHeightAt(
      this.#physicsSurfaceColliders,
      x,
      z,
      radius,
    );
  }

  /**
   *
   * @param {Array} colliders
   * @param {number} x
   * @param {number} z
   * @param {number} radius
   */
  #surfaceHeightAt(colliders, x, z, radius) {
    let highestSurface = null;
    for (const collider of colliders) {
      const height = collider.surfaceHeightAt?.(x, z, radius);
      if (!Number.isFinite(height)) continue;
      highestSurface =
        highestSurface === null ? height : Math.max(highestSurface, height);
    }
    return highestSurface;
  }

  /**
   *
   * @param {number} x
   * @param {number} z
   * @param {number} radius
   * @param {number} minimumHeight
   */
  ceilingHeightAt(x, z, radius = 0, minimumHeight = -Infinity) {
    let lowestCeiling = null;
    for (const collider of this.#colliders) {
      const height = collider.ceilingHeightAt?.(x, z, radius);
      if (!Number.isFinite(height) || height <= minimumHeight) {
        continue;
      }
      lowestCeiling =
        lowestCeiling === null ? height : Math.min(lowestCeiling, height);
    }
    return lowestCeiling;
  }
}
