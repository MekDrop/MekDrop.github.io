const DAMAGE_ROW_PATTERN = /^Voxel damage row (\d+)/;

export class DestructibleVegetation {
  #entity;
  #id;
  #variant;
  #kind;
  #health;
  #maxHealth;
  #damageStage = 0;
  #destroyed = false;
  #damageRows;
  #origin;
  #interactionHeight;
  #collisionVoxels;
  #damageStageByRow;
  #voxelSize;
  #collisionFootprints = [];
  #grassFootprints = [];
  #rotationRadians;

  constructor({
    modelLibrary,
    modelUrl,
    id,
    variant,
    kind,
    cutsRequired,
    collisionRows,
    voxelSize = 0.25,
    x,
    y,
    z,
    rotation = 0,
  }) {
    this.#id = id;
    this.#variant = variant;
    this.#kind = kind;
    this.#health = cutsRequired;
    this.#maxHealth = cutsRequired;
    this.#entity = modelLibrary.instantiate(modelUrl);
    this.#entity.name = `Voxel ${variant}`;
    this.#entity.setLocalPosition(x, y, z);
    this.#entity.setLocalEulerAngles(0, rotation, 0);
    this.#damageRows = this.#findDamageRows();
    this.#collisionVoxels = collisionRows.flatMap(({ y: row, cells }) =>
      cells.map(([x, z]) => ({ x, y: row, z })),
    );
    this.#voxelSize = voxelSize;
    const rows = [...new Set(collisionRows.map(({ y: row }) => row))].sort(
      (left, right) => right - left,
    );
    this.#damageStageByRow = new Map(
      rows.map((row, index) => [row, index + 1]),
    );
    this.#interactionHeight = (Math.max(...rows) + 1) * voxelSize;
    this.#origin = {
      x,
      z,
      baseHeight: y,
    };
    this.#rotationRadians = (rotation * Math.PI) / 180;
    this.#applyCollisionState();
  }

  get entity() {
    return this.#entity;
  }

  get id() {
    return this.#id;
  }

  get canInteract() {
    return !this.#destroyed;
  }

  interact() {
    return this.cut();
  }

  describe() {
    return {
      id: this.#id,
      x: this.#origin.x,
      y: this.#origin.baseHeight,
      z: this.#origin.z,
      heightClass: this.#heightClass(),
      kind: this.#kind,
      health: this.#health,
      maxHealth: this.#maxHealth,
      damageStage: this.#damageStage,
      variant: this.#variant,
    };
  }

  cut() {
    if (this.#destroyed) {
      return null;
    }

    this.#health -= 1;
    if (this.#health <= 0) {
      const description = this.describe();
      this.#destroyed = true;
      this.#entity.destroy();
      return { ...description, destroyed: true };
    }

    const cutsTaken = this.#maxHealth - this.#health;
    this.#damageStage = cutsTaken;
    this.#applyCollisionState();
    this.#damageRows.get(this.#damageStage)?.forEach((rowPart) => {
      rowPart.enabled = false;
    });
    return { ...this.describe(), destroyed: false };
  }

  interactionDistanceFrom({ x, y, z }, heightTolerance) {
    if (
      this.#destroyed ||
      Math.abs(this.#origin.baseHeight - y) > heightTolerance
    ) {
      return Infinity;
    }
    const local = this.#toLocalCoordinates(x, z);
    return this.#collisionFootprints.reduce(
      (nearest, footprint) =>
        Math.min(
          nearest,
          this.#distanceFromFootprint(local.x, local.z, footprint),
        ),
      Infinity,
    );
  }

  intersectsGroundFootprint(x, z, radius = 0) {
    if (this.#destroyed) {
      return false;
    }
    const local = this.#toLocalCoordinates(x, z);
    return this.#collisionFootprints.some(
      (footprint) =>
        this.#distanceFromFootprint(local.x, local.z, footprint) <= radius,
    );
  }

  grassWeightAt(x, z, elevation) {
    if (
      this.#destroyed ||
      Math.abs(elevation - this.#origin.baseHeight) > 0.08
    ) {
      return 0;
    }
    const local = this.#toLocalCoordinates(x, z);
    return this.#grassFootprints.some(
      (footprint) =>
        this.#distanceFromFootprint(local.x, local.z, footprint) <= 0,
    )
      ? 1
      : 0;
  }

  collisionDepthAt(
    x,
    z,
    radius = 0,
    elevation = -Infinity,
    stepClearance = 0,
  ) {
    if (this.#destroyed) {
      return 0;
    }
    const local = this.#toLocalCoordinates(x, z);
    let deepestCollision = 0;
    for (const footprint of this.#collisionFootprints) {
      if (footprint.surfaceHeight <= elevation + stepClearance) continue;
      const deltaX = Math.abs(local.x - footprint.x) - footprint.width / 2;
      const deltaZ = Math.abs(local.z - footprint.z) - footprint.depth / 2;
      const signedDistance =
        deltaX <= 0 && deltaZ <= 0
          ? Math.max(deltaX, deltaZ)
          : Math.hypot(Math.max(deltaX, 0), Math.max(deltaZ, 0));
      deepestCollision = Math.max(
        deepestCollision,
        radius - signedDistance,
      );
    }
    return Math.max(0, deepestCollision);
  }

  surfaceHeightAt(x, z, radius = 0) {
    if (this.#destroyed) {
      return null;
    }
    const local = this.#toLocalCoordinates(x, z);
    let highestSurface = null;
    for (const footprint of this.#collisionFootprints) {
      if (this.#distanceFromFootprint(local.x, local.z, footprint) > radius) {
        continue;
      }
      highestSurface =
        highestSurface === null
          ? footprint.surfaceHeight
          : Math.max(highestSurface, footprint.surfaceHeight);
    }
    return highestSurface;
  }

  #heightClass() {
    if (this.#interactionHeight < 0.9) {
      return "low";
    }
    if (this.#interactionHeight >= 1.4) {
      return "high";
    }
    return "middle";
  }

  #applyCollisionState() {
    const remainingVoxels = this.#collisionVoxels.filter(
      (voxel) =>
        this.#damageStageByRow.get(voxel.y) > this.#damageStage,
    );
    if (!remainingVoxels.length) {
      this.#collisionFootprints = [];
      this.#grassFootprints = [];
      return;
    }

    this.#grassFootprints = remainingVoxels
      .filter(({ y }) => y === 0)
      .map(({ x, z }) => ({
        x: x * this.#voxelSize,
        z: z * this.#voxelSize,
        width: this.#voxelSize,
        depth: this.#voxelSize,
      }));

    const xValues = remainingVoxels.map(({ x }) => x);
    const yValues = remainingVoxels.map(({ y }) => y);
    const zValues = remainingVoxels.map(({ z }) => z);
    const minimumX = Math.min(...xValues);
    const maximumX = Math.max(...xValues);
    const maximumY = Math.max(...yValues);
    const minimumZ = Math.min(...zValues);
    const maximumZ = Math.max(...zValues);
    this.#interactionHeight = (maximumY + 1) * this.#voxelSize;
    this.#collisionFootprints = [
      {
        x: ((minimumX + maximumX) / 2) * this.#voxelSize,
        z: ((minimumZ + maximumZ) / 2) * this.#voxelSize,
        width: (maximumX - minimumX + 1) * this.#voxelSize,
        depth: (maximumZ - minimumZ + 1) * this.#voxelSize,
        surfaceHeight:
          this.#origin.baseHeight + (maximumY + 1) * this.#voxelSize,
      },
    ];
  }

  #toLocalCoordinates(x, z) {
    const deltaX = x - this.#origin.x;
    const deltaZ = z - this.#origin.z;
    const cosine = Math.cos(this.#rotationRadians);
    const sine = Math.sin(this.#rotationRadians);
    return {
      x: cosine * deltaX - sine * deltaZ,
      z: sine * deltaX + cosine * deltaZ,
    };
  }

  #distanceFromFootprint(x, z, footprint) {
    const distanceX = Math.max(
      Math.abs(x - footprint.x) - footprint.width / 2,
      0,
    );
    const distanceZ = Math.max(
      Math.abs(z - footprint.z) - footprint.depth / 2,
      0,
    );
    return Math.hypot(distanceX, distanceZ);
  }

  #findDamageRows() {
    const groups = new Map();
    const pending = [this.#entity];
    while (pending.length) {
      const entity = pending.pop();
      const match = entity.name.match(DAMAGE_ROW_PATTERN);
      if (match) {
        const index = Number(match[1]);
        const matches = groups.get(index) ?? [];
        matches.push(entity);
        groups.set(index, matches);
      }
      pending.push(...entity.children);
    }
    return groups;
  }
}
