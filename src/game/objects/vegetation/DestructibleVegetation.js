import { addGeneratedVoxelPhysics } from "../shared/GeneratedVoxelPhysics.js";

const DAMAGE_ROW_PATTERN = /^Voxel damage row (\d+)/;

export class DestructibleVegetation {
  /**
   *
    * @type {import("playcanvas").Entity}
   */
  #entity;
  /**
   *
    * @type {string}
   */
  #id;
  /**
   *
    * @type {string}
   */
  #variant;
  /**
   *
    * @type {string}
   */
  #kind;
  /**
   *
    * @type {number}
   */
  #health;
  /**
   *
    * @type {number}
   */
  #maxHealth;
  /**
   *
    * @type {number}
   */
  #damageStage = 0;
  /**
   *
    * @type {boolean}
   */
  #destroyed = false;
  /**
   *
    * @type {Array<{y: number, cells: Array<[number, number]>}>}
   */
  #damageRows;
  /**
   *
    * @type {{x: number, y: number, z: number}}
   */
  #origin;
  /**
   *
    * @type {number}
   */
  #interactionHeight;
  /**
   *
    * @type {number}
   */
  #collisionVoxels;
  /**
   *
    * @type {Map<number, number>}
   */
  #damageStageByRow;
  /**
   *
    * @type {number}
   */
  #voxelSize;
  /**
   *
    * @type {typeof import("playcanvas")}
   */
  #pc;
  /**
   *
    * @type {import("playcanvas").Entity|null}
   */
  #physicsCollider = null;
  /**
   *
    * @type {Array<{x: number, z: number, radius: number}>}
   */
  #collisionFootprints = [];
  /**
   *
    * @type {Array<{x: number, z: number, radius: number}>}
   */
  #grassFootprints = [];
  /**
   *
    * @type {number}
   */
  #rotationRadians;

  /**
   *
   * @param {{pc: typeof import("playcanvas"), modelLibrary: string, modelUrl: string, id: string, variant: string, kind: string, cutsRequired: number, collisionRows: number, voxelSize: number, x: number, y: number, z: number, rotation: number}} options
   * @param {typeof import("playcanvas")} options.pc
   * @param {string} options.modelLibrary
   * @param {string} options.modelUrl
   * @param {string} options.id
   * @param {string} options.variant
   * @param {string} options.kind
   * @param {number} options.cutsRequired
   * @param {number} options.collisionRows
   * @param {number} options.voxelSize
   * @param {number} options.x
   * @param {number} options.y
   * @param {number} options.z
   * @param {number} options.rotation
   */
  constructor({
    pc,
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

    this.#pc = pc;

    this.#id = id;

    this.#variant = variant;

    this.#kind = kind;

    this.#health = cutsRequired;

    this.#maxHealth = cutsRequired;
    const model = modelLibrary.instantiate(modelUrl);

    this.#entity = pc ? new pc.Entity(`Voxel ${variant}`) : model;
    if (pc) {
      this.#entity.addChild(model);
    }
    this.#entity.name = `Voxel ${variant}`;
    this.#entity.setLocalPosition(x, y, z);
    this.#entity.setLocalEulerAngles(0, rotation, 0);

    this.#damageRows = this.#findDamageRows();

    this.#collisionVoxels = collisionRows.flatMap(/**
     *
     * @param {{y: number, cells: number}} options
     * @param {number} options.y
     * @param {number} options.cells
     */
    ({ y: row, cells }) =>
      cells.map(/**
       *
       * @param {Array<number>} options
       * @param {number} options."0"
       * @param {number} options."1"
       */
      ([x, z]) => ({ x, y: row, z })),
    );

    this.#voxelSize = voxelSize;
    const rows = [...new Set(collisionRows.map(/**
     *
     * @param {{y: number}} options
     * @param {number} options.y
     */
    ({ y: row }) => row))].sort(
      /**
       *
       * @param {boolean} left
       * @param {number} right
       */
      (left, right) => right - left,
    );

    this.#damageStageByRow = new Map(
      rows.map(/**
       *
       * @param {number} row
       * @param {number} index
       */
      (row, index) => [row, index + 1]),
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

  /**
   *
    * @returns {boolean}
   */
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
      const groundFootprint = this.#grassFootprints.map(/**
       *
       * @param {import("src/game/objects/ObjectTypes.js").HeroFootRig} footprint
       */
      (footprint) => ({
        ...footprint,
      }));
      this.#destroyed = true;
      this.#physicsCollider = null;
      this.#entity.destroy();
      return { ...description, destroyed: true, groundFootprint };
    }

    const cutsTaken = this.#maxHealth - this.#health;
    this.#damageStage = cutsTaken;
    this.#applyCollisionState();
    this.#damageRows.get(this.#damageStage)?.forEach(/**
     *
     * @param {number} rowPart
     */
    (rowPart) => {
      rowPart.enabled = false;
    });
    return { ...this.describe(), destroyed: false };
  }

  /**
   *
   * @param {{x: number, y: number, z: number}} options
   * @param {number} options.x
   * @param {number} options.y
   * @param {number} options.z
   * @param {number} heightTolerance
   */
  interactionDistanceFrom({ x, y, z }, heightTolerance) {
    if (
      this.#destroyed ||
      Math.abs(this.#origin.baseHeight - y) > heightTolerance
    ) {
      return Infinity;
    }
    const local = this.#toLocalCoordinates(x, z);
    return this.#collisionFootprints.reduce(
      /**
       *
       * @param {number} nearest
       * @param {import("src/game/objects/ObjectTypes.js").HeroFootRig} footprint
       */
      (nearest, footprint) =>
        Math.min(
          nearest,
          this.#distanceFromFootprint(local.x, local.z, footprint),
        ),
      Infinity,
    );
  }

  /**
   *
   * @param {number} x
   * @param {number} z
   * @param {number} radius
   */
  intersectsGroundFootprint(x, z, radius = 0) {
    if (this.#destroyed) {
      return false;
    }
    const local = this.#toLocalCoordinates(x, z);
    return this.#collisionFootprints.some(
      /**
       *
       * @param {import("src/game/objects/ObjectTypes.js").HeroFootRig} footprint
       */
      (footprint) =>
        this.#distanceFromFootprint(local.x, local.z, footprint) <= radius,
    );
  }

  /**
   *
   * @param {number} x
   * @param {number} z
   * @param {number} elevation
   */
  grassWeightAt(x, z, elevation) {
    if (
      this.#destroyed ||
      Math.abs(elevation - this.#origin.baseHeight) > 0.08
    ) {
      return 0;
    }
    const local = this.#toLocalCoordinates(x, z);
    return this.#grassFootprints.some(
      /**
       *
       * @param {import("src/game/objects/ObjectTypes.js").HeroFootRig} footprint
       */
      (footprint) =>
        this.#distanceFromFootprint(local.x, local.z, footprint) <= 0,
    )
      ? 1
      : 0;
  }

  /**
   *
   * @param {number} x
   * @param {number} z
   * @param {number} radius
   * @param {number} elevation
   * @param {number} stepClearance
   */
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

  /**
   *
   * @param {number} x
   * @param {number} z
   * @param {number} radius
   * @param {number} elevation
   * @param {number} stepClearance
   */
  movementCollisionDepthAt(
    x,
    z,
    radius = 0,
    elevation = -Infinity,
    stepClearance = 0,
  ) {
    if (this.#physicsCollider) {
      return 0;
    }
    return this.collisionDepthAt(
      x,
      z,
      radius,
      elevation,
      stepClearance,
    );
  }

  /**
   *
   * @param {number} x
   * @param {number} z
   * @param {number} radius
   */
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
      /**
       *
       * @param {{x: number, y: number, z: number}} voxel
       */
      (voxel) =>
        this.#damageStageByRow.get(voxel.y) > this.#damageStage,
    );
    if (!remainingVoxels.length) {
      this.#destroyPhysicsCollider();
      this.#collisionFootprints = [];
      this.#grassFootprints = [];
      return;
    }

    this.#grassFootprints = remainingVoxels
      .filter(/**
       *
       * @param {{y: number}} options
       * @param {number} options.y
       */
      ({ y }) => y === 0)
      .map(/**
       *
       * @param {{x: number, z: number}} options
       * @param {number} options.x
       * @param {number} options.z
       */
      ({ x, z }) => ({
        x: x * this.#voxelSize,
        z: z * this.#voxelSize,
        width: this.#voxelSize,
        depth: this.#voxelSize,
      }));

    const xValues = remainingVoxels.map(/**
     *
     * @param {{x: number}} options
     * @param {number} options.x
     */
    ({ x }) => x);
    const yValues = remainingVoxels.map(/**
     *
     * @param {{y: number}} options
     * @param {number} options.y
     */
    ({ y }) => y);
    const zValues = remainingVoxels.map(/**
     *
     * @param {{z: number}} options
     * @param {number} options.z
     */
    ({ z }) => z);
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
    this.#rebuildPhysicsCollider(remainingVoxels);
  }

  /**
   *
   * @param {Array<{x: number, y: number, z: number, width?: number, height?: number, depth?: number}>} voxels
   */
  #rebuildPhysicsCollider(voxels) {
    this.#destroyPhysicsCollider();
    if (!this.#pc || (this.#kind !== "tree" && this.#kind !== "bush")) {
      return;
    }
    const physicsName = this.#kind === "tree" ? "Tree" : "Bush";
    const physicsVoxels = voxels.map(/**
     *
     * @param {{x: number, y: number, z: number}} voxel
     */
    (voxel) => ({
      x: voxel.x * this.#voxelSize,
      y: (voxel.y + 0.5) * this.#voxelSize,
      z: voxel.z * this.#voxelSize,
      width: this.#voxelSize,
      height: this.#voxelSize,
      depth: this.#voxelSize,
    }));
    this.#physicsCollider = addGeneratedVoxelPhysics({
      pc: this.#pc,
      parent: this.#entity,
      name: physicsName,
      voxels: physicsVoxels,
    });
  }

  #destroyPhysicsCollider() {
    this.#physicsCollider?.destroy();
    this.#physicsCollider = null;
  }

  /**
   *
   * @param {number} x
   * @param {number} z
   */
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

  /**
   *
   * @param {number} x
   * @param {number} z
   * @param {import("src/game/objects/ObjectTypes.js").HeroFootRig} footprint
   */
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
