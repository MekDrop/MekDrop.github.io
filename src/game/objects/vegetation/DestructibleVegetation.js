import { addGeneratedVoxelPhysics } from "../shared/GeneratedVoxelPhysics.js";
import { mergeCollisionVoxels } from "../shared/MergeCollisionVoxels.js";

const CELL_PATTERN = /^Voxel cell (-?\d+) (-?\d+) (-?\d+)/;

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
   * @type {Map<string, import("playcanvas").Entity[]>}
   */
  #cellParts;
  /**
   * @type {Set<string>}
   */
  #removed = new Set();
  /**
   * @type {{x:number,z:number}}
   */
  #cutNormal = {
    x: 0,
    z: -1,
  };
  /**
   *
   * @type {{x: number, baseHeight: number, z: number}}
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
   * @type {Array<{x: number, z: number, width: number, depth: number}>}
   */
  #originalGroundFootprint = [];
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

    const model = modelLibrary.instantiate(modelUrl);

    this.#entity = pc ? new pc.Entity(`Voxel ${variant}`) : model;
    if (pc) {
      this.#entity.addChild(model);
    }
    this.#entity.name = `Voxel ${variant}`;
    this.#entity.setLocalPosition(x, y, z);
    this.#entity.setLocalEulerAngles(0, rotation, 0);

    this.#cellParts = this.#findCellParts();

    this.#collisionVoxels = collisionRows.flatMap(
      DestructibleVegetation.#flatMap,
    );

    this.#voxelSize = voxelSize;
    this.#health = this.#collisionVoxels.length;
    this.#maxHealth = this.#health;
    const rows = [
      ...new Set(collisionRows.map(DestructibleVegetation.#map)),
    ].sort(DestructibleVegetation.#sortLeft);

    this.#interactionHeight = (Math.max(...rows) + 1) * voxelSize;

    this.#origin = {
      x,
      z,
      baseHeight: y,
    };

    this.#rotationRadians = (rotation * Math.PI) / 180;
    this.#applyCollisionState();
    this.#originalGroundFootprint = this.#grassFootprints.map(DestructibleVegetation.#mapFootprint);
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
      cutHeight: this.#interactionHeight - this.#voxelSize / 2,
      kind: this.#kind,
      health: this.#health,
      maxHealth: this.#maxHealth,
      damageStage: this.#damageStage,
      variant: this.#variant,
    };
  }

  /**
   * Aim at an exposed face of the remaining plant, rather than inside its canopy.
   * @param {{x:number, z:number}} position
   * @returns {{x:number,y:number,z:number,yaw:number}}
   */
  cuttingTargetFrom(position) {
    const local = this.#toLocalCoordinates(position.x, position.z);
    const dx = local.x;
    const dz = local.z;
    const alongX = Math.abs(dx) > Math.abs(dz);
    const nx = alongX ? Math.sign(dx) || 1 : 0;
    const nz = alongX ? 0 : Math.sign(dz) || 1;
    const remaining = this.#collisionVoxels.filter(this.#filterVoxel.bind(this));
    const row = Math.max(...remaining.map(/**
     *
     * @param {{x: number, y: number, z: number}} v
     */
      v => v.y));
    const choices = remaining.filter(/**
     *
     * @param {{x:number,y:number,z:number}} v
     */
      v => v.y === row);
    const front = Math.max(...remaining.map(/**
     *
     * @param {{x:number,y:number,z:number}} v
     */
      v => v.x * nx + v.z * nz));
    this.#cutNormal = {
      x: nx,
      z: nz,
    };
    /* Keep hands and body outside lower branches while centering the slice
       on the highest layer. Each lateral slice includes the layer's depth. */
    this.#interactionHeight = (row + 1) * this.#voxelSize;
    const centerX = (Math.min(...choices.map(/**
     *
     * @param {{x:number,y:number,z:number}} v
     */
      v => v.x)) + Math.max(...choices.map(/**
     *
     * @param {{x:number,y:number,z:number}} v
     */
      v => v.x))) / 2;
    const centerZ = (Math.min(...choices.map(/**
     *
     * @param {{x:number,y:number,z:number}} v
     */
      v => v.z)) + Math.max(...choices.map(/**
     *
     * @param {{x:number,y:number,z:number}} v
     */
      v => v.z))) / 2;
    const x = (nx ? nx * (front + .5) : centerX) * this.#voxelSize;
    const z = (nz ? nz * (front + .5) : centerZ) * this.#voxelSize;
    const cosine = Math.cos(this.#rotationRadians);
    const sine = Math.sin(this.#rotationRadians);

    return {
      x: this.#origin.x + cosine * x + sine * z,
      y: this.#origin.baseHeight,
      z: this.#origin.z - sine * x + cosine * z,
      yaw: Math.atan2(-cosine * nx - sine * nz, sine * nx - cosine * nz),
    };
  }

  /**
   * Slice the active level progressively along the actual blade's lateral sweep.
   * A column includes its depth: one pass cuts one layer, rather than nibbling
   * through front cells and requiring another swing for their rear neighbours.
   * This is a gameplay slice query; remaining physical cells still use the engine.
   * @param {import("playcanvas").Vec3[]} previous
   * @param {import("playcanvas").Vec3[]} current
   * @param {number} cutHeight
   * @returns {object|null}
   */
  cutSweep(previous, current, cutHeight) {
    if (this.#destroyed || !this.#physicsCollider) {
      return null;
    }
    const inverse = this.#entity.getWorldTransform().clone().invert();
    const row = Math.round((cutHeight - this.#voxelSize / 2) / this.#voxelSize);
    const points = [...previous, ...current].map(/**
     *
     * @param {import("playcanvas").Vec3} point
     */
      point => inverse.transformPoint(point));
    const onLevel = points.filter(/**
     *
     * @param {import("playcanvas").Vec3} point
     */
      point => Math.abs(point.y - cutHeight) <= this.#voxelSize / 2);
    if (!onLevel.length) {
      return null;
    }
    const normal = this.#cutNormal;
    /**
     * @param {{x:number,z:number}} point
     */
    const lateral = point => -normal.z * point.x + normal.x * point.z;
    const minimum = Math.min(...onLevel.map(lateral));
    const maximum = Math.max(...onLevel.map(lateral));
    let changed = false;
    for (const voxel of this.#collisionVoxels) {
      const column = lateral(voxel) * this.#voxelSize;
      if (voxel.y === row && column + this.#voxelSize / 2 >= minimum
        && column - this.#voxelSize / 2 <= maximum) {
        changed = this.#removeCell(voxel.x, voxel.y, voxel.z) || changed;
      }
    }

    return changed ? this.#finishCut() : null;
  }

  /**
   * @param {{x: number, y: number, z: number}} point Plant-local contact point.
   * @returns {object|null}
   */
  cut(point) {
    if (!point || this.#destroyed) {
      return null;
    }
    return this.#removeCell(Math.round(point.x / this.#voxelSize),
      Math.floor(point.y / this.#voxelSize), Math.round(point.z / this.#voxelSize))
      ? this.#finishCut() : null;
  }

  /**
   * @param {number} x
   * @param {number} y
   * @param {number} z
   * @returns {boolean}
   */
  #removeCell(x, y, z) {
    const key = x + "," + y + "," + z;
    const exists = this.#collisionVoxels.some(/**
     *
     * @param {{x: number, y: number, z: number}} v
     */
      v => v.x === x && v.y === y && v.z === z);
    if (this.#removed.has(key) || !exists) {
      return false;
    }
    this.#removed.add(key);
    for (const part of this.#cellParts.get(key) ?? []) {
      part.enabled = false;
    }

    return true;
  }

  #finishCut() {
    const groundFootprint = this.#originalGroundFootprint;
    this.#health = this.#maxHealth - this.#removed.size;
    this.#damageStage = this.#removed.size;
    this.#applyCollisionState();
    if (this.#health === 0) {
      this.#destroyed = true;
      this.#entity.destroy();
    }
    return {
      ...this.describe(),
      destroyed: this.#destroyed,
      groundFootprint,
    };
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
      if (footprint.surfaceHeight <= elevation + stepClearance) {
        continue;
      }
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

  /**
   * Conservative X/Z bounds stay valid as damage removes collision voxels.
   * @returns {{minX: number, maxX: number, minZ: number, maxZ: number}}
   */
  get surfaceBounds() {
    let radius = 0;
    for (const footprint of this.#collisionFootprints) {
      radius = Math.max(radius, Math.hypot(
        Math.abs(footprint.x) + footprint.width / 2,
        Math.abs(footprint.z) + footprint.depth / 2,
      ));
    }

    return {
      minX: this.#origin.x - radius,
      maxX: this.#origin.x + radius,
      minZ: this.#origin.z - radius,
      maxZ: this.#origin.z + radius,
    };
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
      this.#filterVoxel.bind(this),
    );
    if (!remainingVoxels.length) {
      this.#destroyPhysicsCollider();
      this.#collisionFootprints = [];
      this.#grassFootprints = [];

      return;
    }

    this.#grassFootprints = remainingVoxels
      .filter(DestructibleVegetation.#filter)
      .map(this.#map2.bind(this));

    const xValues = remainingVoxels.map(DestructibleVegetation.#map3);
    const yValues = remainingVoxels.map(DestructibleVegetation.#map4);
    const zValues = remainingVoxels.map(DestructibleVegetation.#map5);
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
    const physicsVoxels = mergeCollisionVoxels(voxels, this.#kind === "tree" ? "trees" : "bushes").map(
      this.#mapVoxel.bind(this),
    );
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

  #findCellParts() {
    const groups = new Map();
    const pending = [this.#entity];
    while (pending.length) {
      const entity = pending.pop();
      const match = entity.name.match(CELL_PATTERN);
      if (match) {
        const index = match.slice(1, 4).map(Number).join(",");
        const matches = groups.get(index) ?? [];
        matches.push(entity);
        groups.set(index, matches);
      }
      pending.push(...entity.children);
    }

    return groups;
  }

  /**
   *
   * @param {{y: number, cells: number}} options
   * @param {number} options.y
   * @param {number} options.cells
   */
  static #flatMap({ y: row, cells }) {
    return cells.map(/**
       *
       * @param {Array<number>} options
       * @param {number} options."0"
       * @param {number} options."1"
       */
      ([x, z]) => ({
        x,
        y: row,
        z,
      }));
  }

  /**
   *
   * @param {{y: number}} options
   * @param {number} options.y
   */
  static #map({ y: row }) {
    return row;
  }

  /**
   *
   * @param {boolean} left
   * @param {number} right
   */
  static #sortLeft(left, right) {
    return right - left;
  }

  /**
   *
   * @param {import("src/game/objects/ObjectTypes.js").HeroFootRig} footprint
   */
  static #mapFootprint(footprint) {
    return {
      ...footprint,
    };
  }

  /**
   *
   * @param {{x: number, y: number, z: number}} voxel
   */
  #filterVoxel(voxel) {
    return !this.#removed.has(voxel.x + "," + voxel.y + "," + voxel.z);
  }

  /**
   *
   * @param {{y: number}} options
   * @param {number} options.y
   */
  static #filter({ y }) {
    return y === 0;
  }

  /**
   *
   * @param {{x: number, z: number}} options
   * @param {number} options.x
   * @param {number} options.z
   */
  #map2({ x, z }) {
    return {
      x: x * this.#voxelSize,
      z: z * this.#voxelSize,
      width: this.#voxelSize,
      depth: this.#voxelSize,
    };
  }

  /**
   *
   * @param {{x: number}} options
   * @param {number} options.x
   */
  static #map3({ x }) {
    return x;
  }

  /**
   *
   * @param {{y: number}} options
   * @param {number} options.y
   */
  static #map4({ y }) {
    return y;
  }

  /**
   *
   * @param {{z: number}} options
   * @param {number} options.z
   */
  static #map5({ z }) {
    return z;
  }

  /**
   *
   * @param {import("../shared/MergeCollisionVoxels.js").CollisionBox} voxel
   */
  #mapVoxel(voxel) {
    return {
      x: (voxel.x + (voxel.width - 1) / 2) * this.#voxelSize,
      y: (voxel.y + voxel.height / 2) * this.#voxelSize,
      z: (voxel.z + (voxel.depth - 1) / 2) * this.#voxelSize,
      width: voxel.width * this.#voxelSize,
      height: voxel.height * this.#voxelSize,
      depth: voxel.depth * this.#voxelSize,
    };
  }
}
