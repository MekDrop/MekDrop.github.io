export class GroundCollisionWorld {
  #colliders = new Set();

  add(collider) {
    if (collider) this.#colliders.add(collider);
    return collider;
  }

  clear() {
    this.#colliders.clear();
  }

  isBlocked(x, z, radius = 0, elevation = -Infinity, stepClearance = 0) {
    return (
      this.#blockingDepthAt(x, z, radius, elevation, stepClearance) > 0
    );
  }

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
    );
    return currentDepth <= 0 || destinationDepth >= currentDepth - 0.000001;
  }

  #blockingDepthAt(x, z, radius, elevation, stepClearance) {
    let depth = 0;
    for (const collider of this.#colliders) {
      if (collider.collisionDepthAt) {
        depth += Math.max(
          0,
          collider.collisionDepthAt(
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

  surfaceHeightAt(x, z, radius = 0) {
    let highestSurface = null;
    for (const collider of this.#colliders) {
      const height = collider.surfaceHeightAt?.(x, z, radius);
      if (!Number.isFinite(height)) continue;
      highestSurface =
        highestSurface === null ? height : Math.max(highestSurface, height);
    }
    return highestSurface;
  }
}
