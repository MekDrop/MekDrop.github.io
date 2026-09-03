const STONE_MATERIAL_NAMES = [
  "castleStoneDark",
  "castleStoneMid",
  "castleStoneMid",
  "castleStoneMid",
  "castleStoneMid",
  "castleStoneMid",
  "castleStoneMid",
  "castleStoneDark",
];
const STAIR_TREAD_DEPTH_BLOCKS = 2;

export class CastleStairs {
  #pc;
  #app;
  #position;
  #doors;
  #cubeSize;
  #blockMesh;
  #materials;
  #entity;
  #surfaces = [];
  #vertexBuffers = [];

  constructor({
    pc,
    app,
    position,
    doors = [],
    cubeSize,
    blockMesh,
    materials,
  }) {
    this.#pc = pc;
    this.#app = app;
    this.#position = position;
    this.#doors = doors;
    this.#cubeSize = cubeSize;
    this.#blockMesh = blockMesh;
    this.#materials = materials;
    this.#entity = new pc.Entity("Castle stone stairs");

    this.#render();
  }

  get entity() {
    return this.#entity;
  }

  surfaceHeightAt(x, z) {
    for (const surface of this.#surfaces) {
      const across = surface.vertical ? z : x;
      if (across < surface.acrossStart || across > surface.acrossEnd) {
        continue;
      }

      let inward;
      if (surface.side === "WEST") inward = x - surface.outerEdge;
      else if (surface.side === "EAST") inward = surface.outerEdge - x;
      else if (surface.side === "NORTH") inward = z - surface.outerEdge;
      else inward = surface.outerEdge - z;
      if (inward < 0 || inward > surface.run) continue;

      return (
        surface.approachElevation +
        (inward / surface.run) * surface.rise
      );
    }
    return null;
  }

  destroy() {
    this.#entity?.destroy();
    this.#entity = null;
    for (const buffer of this.#vertexBuffers) buffer.destroy();
    this.#vertexBuffers = [];
    this.#surfaces = [];
  }

  #render() {
    if (!this.#position || !this.#doors.length || !this.#cubeSize) return;

    const batches = new Map();
    const baseY = Math.max(0, this.#position.elevation ?? 0);
    const blocksPerTile = 1 / this.#cubeSize;

    for (const door of this.#doors) {
      const approachElevation = Number.isFinite(door.approachElevation)
        ? door.approachElevation
        : baseY;
      const riseBlocks = Math.max(
        0,
        Math.round((baseY - approachElevation) / this.#cubeSize),
      );
      const widthBlocks = Math.round(door.width * blocksPerTile);
      const offsetBlocks = Math.round(door.offset * blocksPerTile);
      this.#addSurface(door, approachElevation, riseBlocks);

      for (let level = 0; level < riseBlocks; level += 1) {
        for (
          let treadBlock = 0;
          treadBlock < STAIR_TREAD_DEPTH_BLOCKS;
          treadBlock += 1
        ) {
          const distanceBlocks =
            (riseBlocks - level) * STAIR_TREAD_DEPTH_BLOCKS - treadBlock;
          for (
            let horizontal = 0;
            horizontal < widthBlocks;
            horizontal += 1
          ) {
            for (let layer = 0; layer <= level; layer += 1) {
              const acrossBlocks = offsetBlocks + horizontal;
              const position = this.#blockPosition(
                door.side,
                distanceBlocks,
                acrossBlocks,
                approachElevation,
                layer,
              );
              if (!position) continue;
              this.#addBlockMatrix(
                batches,
                this.#materialFor(distanceBlocks, acrossBlocks, layer),
                position,
              );
            }
          }
        }
      }
    }

    this.#createInstancedBatches(batches);
  }

  #addSurface(door, approachElevation, riseBlocks) {
    if (riseBlocks <= 0) return;
    const run = riseBlocks * STAIR_TREAD_DEPTH_BLOCKS * this.#cubeSize;
    const rise = riseBlocks * this.#cubeSize;
    const left = this.#position.x;
    const right = left + this.#position.width;
    const top = this.#position.z;
    const bottom = top + this.#position.depth;
    const vertical = door.side === "WEST" || door.side === "EAST";
    const acrossOrigin = vertical ? top : left;
    const boundaryEdge = {
      WEST: left,
      EAST: right,
      NORTH: top,
      SOUTH: bottom,
    }[door.side];
    const outwardSign =
      door.side === "WEST" || door.side === "NORTH" ? -1 : 1;
    if (!Number.isFinite(boundaryEdge)) return;

    this.#surfaces.push({
      side: door.side,
      vertical,
      outerEdge: boundaryEdge + outwardSign * run,
      acrossStart: acrossOrigin + door.offset,
      acrossEnd: acrossOrigin + door.offset + door.width,
      approachElevation,
      rise,
      run,
    });
  }

  #blockPosition(side, distanceBlocks, acrossBlocks, approachElevation, layer) {
    const distance = (distanceBlocks - 0.5) * this.#cubeSize;
    const across = (acrossBlocks + 0.5) * this.#cubeSize;
    const y = approachElevation + (layer + 0.5) * this.#cubeSize;
    const left = this.#position.x;
    const right = left + this.#position.width;
    const top = this.#position.z;
    const bottom = top + this.#position.depth;

    const positions = {
      WEST: { x: left - distance, y, z: top + across },
      EAST: { x: right + distance, y, z: top + across },
      NORTH: { x: left + across, y, z: top - distance },
      SOUTH: { x: left + across, y, z: bottom + distance },
    };
    return positions[side] ?? null;
  }

  #materialFor(distanceBlocks, acrossBlocks, layer) {
    const hash =
      Math.imul(distanceBlocks + 11, 73856093) ^
      Math.imul(acrossBlocks + 17, 19349663) ^
      Math.imul(layer + 23, 83492791);
    return STONE_MATERIAL_NAMES[(hash >>> 0) % STONE_MATERIAL_NAMES.length];
  }

  #addBlockMatrix(batches, material, position) {
    const matrix = new this.#pc.Mat4();
    matrix.setTRS(
      new this.#pc.Vec3(position.x, position.y, position.z),
      new this.#pc.Quat(),
      new this.#pc.Vec3(this.#cubeSize, this.#cubeSize, this.#cubeSize),
    );
    const data = batches.get(material) ?? [];
    for (const value of matrix.data) data.push(value);
    batches.set(material, data);
  }

  #createInstancedBatches(batches) {
    for (const [materialName, matrices] of batches.entries()) {
      if (!matrices.length) continue;
      const vertexBuffer = new this.#pc.VertexBuffer(
        this.#app.graphicsDevice,
        this.#pc.VertexFormat.getDefaultInstancingFormat(
          this.#app.graphicsDevice,
        ),
        matrices.length / 16,
        { data: new Float32Array(matrices) },
      );
      this.#vertexBuffers.push(vertexBuffer);

      const meshInstance = new this.#pc.MeshInstance(
        this.#blockMesh,
        this.#materials.get(materialName),
      );
      meshInstance.setInstancing(vertexBuffer, false);
      meshInstance.castShadow = false;
      meshInstance.receiveShadow = true;

      const entity = new this.#pc.Entity(`${materialName} stair blocks`);
      entity.addComponent("render", {
        meshInstances: [meshInstance],
        castShadows: false,
        receiveShadows: true,
      });
      this.#entity.addChild(entity);
    }
  }
}
