import { colorFromHex } from "../../helpers/colors.js";

const ROOF_TILE_COLORS = [0x168bea, 0x117ddd, 0x0d70cf, 0x0a62bd];

const ROOF_TILE_SIZE = 0.46;
const ROOF_TILE_GAP = 0.025;
const ROOF_TILE_LIFT = 0.032;
const ROOF_TILE_INNER_LIFT = 0.004;

export class CastleRoof {
  #pc;
  #app;
  #entity;
  #tileMaterials = [];
  #backingMaterial;
  #trimMaterial;
  #meshes = [];

  constructor({ pc, app }) {
    this.#pc = pc;
    this.#app = app;
    this.#entity = new pc.Entity("Castle roofs");
    this.#tileMaterials = ROOF_TILE_COLORS.map((color, index) =>
      this.#createMaterial(color, `Castle blue roof tile ${index + 1}`),
    );
    this.#backingMaterial = this.#createMaterial(
      0x083f80,
      "Castle roof tile joints",
      0.03,
    );
    this.#trimMaterial = this.#createMaterial(
      0x0d6fca,
      "Castle blue roof eaves",
      0.08,
    );
  }

  get entity() {
    return this.#entity;
  }

  add({ x, y, z, yaw = 0, width = 1.4, depth = 1.4, height = 0.9 }) {
    const root = new this.#pc.Entity("Block-tiled blue roof");
    root.setPosition(x, y, z);
    root.setEulerAngles(0, yaw, 0);
    this.#entity.addChild(root);

    const halfWidth = width / 2;
    const halfDepth = depth / 2;
    const meshInstances = [];

    for (let face = 0; face < 4; face += 1) {
      const backingMesh = this.#createFaceBacking(
        face,
        halfWidth,
        halfDepth,
        height,
      );
      meshInstances.push(
        new this.#pc.MeshInstance(backingMesh, this.#backingMaterial),
        ...this.#createFaceTiles(face, halfWidth, halfDepth, height),
      );
    }

    const roof = new this.#pc.Entity("Individual blue roof tiles");
    roof.addComponent("render", {
      meshInstances,
      castShadows: true,
      receiveShadows: true,
    });
    for (const instance of meshInstances) {
      instance.castShadow = true;
      instance.receiveShadow = true;
      instance.pick = false;
    }
    root.addChild(roof);

    this.#addBaseEave(
      root,
      "Front blue eave",
      0,
      -halfDepth,
      width + 0.08,
      0.05,
    );
    this.#addBaseEave(root, "Back blue eave", 0, halfDepth, width + 0.08, 0.05);
    this.#addBaseEave(
      root,
      "Left blue eave",
      -halfWidth,
      0,
      0.05,
      depth + 0.08,
    );
    this.#addBaseEave(
      root,
      "Right blue eave",
      halfWidth,
      0,
      0.05,
      depth + 0.08,
    );
  }

  destroy() {
    this.#entity?.destroy();
    this.#entity = null;
    for (const mesh of this.#meshes) {
      mesh.decRefCount();
      if (mesh.refCount < 1) mesh.destroy();
    }
    this.#meshes = [];
    for (const material of this.#tileMaterials) material.destroy();
    this.#tileMaterials = [];
    this.#backingMaterial?.destroy();
    this.#backingMaterial = null;
    this.#trimMaterial?.destroy();
    this.#trimMaterial = null;
  }

  #createMaterial(color, name, gloss = 0.08) {
    const material = new this.#pc.StandardMaterial();
    material.name = name;
    material.diffuse = colorFromHex(this.#pc, color);
    material.gloss = gloss;
    material.cull = this.#pc.CULLFACE_NONE;
    material.useLighting = false;
    material.update();
    return material;
  }

  #createFaceBacking(face, halfWidth, halfDepth, height) {
    return this.#createMesh(
      [
        ...this.#surfacePoint(face, -1, 0, halfWidth, halfDepth, height),
        ...this.#surfacePoint(face, 1, 0, halfWidth, halfDepth, height),
        ...this.#surfacePoint(face, 0, 1, halfWidth, halfDepth, height),
      ],
      [0, 1, 2],
      [0, 1, 1, 1, 0.5, 0],
    );
  }

  #createFaceTiles(face, halfWidth, halfDepth, height) {
    const faceSpan = face % 2 === 0 ? halfWidth * 2 : halfDepth * 2;
    const courses = this.#courseCount(height);
    const baseTiles = Math.max(3, Math.round(faceSpan / ROOF_TILE_SIZE));
    const instances = [];

    for (let row = 0; row < courses; row += 1) {
      const rawT0 = row / courses;
      const rawT1 = (row + 1) / courses;
      const tiles = row === courses - 1 ? 1 : baseTiles;
      const verticalGap = Math.min(0.01, (rawT1 - rawT0) * 0.06);
      const t0 = rawT0 + verticalGap;
      const t1 = rawT1 - verticalGap;

      for (let column = 0; column < tiles; column += 1) {
        const rawU0 = -1 + (column / tiles) * 2;
        const rawU1 = -1 + ((column + 1) / tiles) * 2;
        const horizontalGap = (rawU1 - rawU0) * ROOF_TILE_GAP;
        const u0 = rawU0 + horizontalGap;
        const u1 = rawU1 - horizontalGap;
        const outerPositions = [
          ...this.#surfacePoint(
            face,
            u0,
            t0,
            halfWidth,
            halfDepth,
            height,
            ROOF_TILE_LIFT,
          ),
          ...this.#surfacePoint(
            face,
            u1,
            t0,
            halfWidth,
            halfDepth,
            height,
            ROOF_TILE_LIFT,
          ),
          ...this.#surfacePoint(
            face,
            u1,
            t1,
            halfWidth,
            halfDepth,
            height,
            ROOF_TILE_LIFT,
          ),
          ...this.#surfacePoint(
            face,
            u0,
            t1,
            halfWidth,
            halfDepth,
            height,
            ROOF_TILE_LIFT,
          ),
        ];
        const innerPositions = [
          ...this.#surfacePoint(
            face,
            u0,
            t0,
            halfWidth,
            halfDepth,
            height,
            ROOF_TILE_INNER_LIFT,
          ),
          ...this.#surfacePoint(
            face,
            u1,
            t0,
            halfWidth,
            halfDepth,
            height,
            ROOF_TILE_INNER_LIFT,
          ),
          ...this.#surfacePoint(
            face,
            u1,
            t1,
            halfWidth,
            halfDepth,
            height,
            ROOF_TILE_INNER_LIFT,
          ),
          ...this.#surfacePoint(
            face,
            u0,
            t1,
            halfWidth,
            halfDepth,
            height,
            ROOF_TILE_INNER_LIFT,
          ),
        ];
        const mesh = this.#createTileMesh(outerPositions, innerPositions);
        const materialIndex = face % this.#tileMaterials.length;
        instances.push(
          new this.#pc.MeshInstance(mesh, this.#tileMaterials[materialIndex]),
        );
      }
    }

    return instances;
  }

  #surfacePoint(face, u, t, halfWidth, halfDepth, height, lift = 0) {
    const taper = 1 - t;
    if (face === 0) {
      return [u * halfWidth * taper, t * height, -halfDepth * taper - lift];
    }
    if (face === 1) {
      return [halfWidth * taper + lift, t * height, u * halfDepth * taper];
    }
    if (face === 2) {
      return [-u * halfWidth * taper, t * height, halfDepth * taper + lift];
    }
    return [-halfWidth * taper - lift, t * height, -u * halfDepth * taper];
  }

  #courseCount(height) {
    return height > 1.1 ? 3 : 2;
  }

  #createTileMesh(outerPositions, innerPositions) {
    return this.#createMesh(
      [...outerPositions, ...innerPositions],
      [
        0, 1, 2, 0, 2, 3, 4, 6, 5, 4, 7, 6, 0, 4, 5, 0, 5, 1, 1, 5, 6, 1, 6, 2,
        2, 6, 7, 2, 7, 3, 3, 7, 4, 3, 4, 0,
      ],
      [0, 1, 1, 1, 1, 0, 0, 0, 0, 1, 1, 1, 1, 0, 0, 0],
    );
  }

  #createMesh(positions, indices, uvs) {
    const geometry = new this.#pc.Geometry();
    geometry.positions = positions;
    geometry.indices = indices;
    geometry.normals = this.#pc.calculateNormals(positions, indices);
    geometry.uvs = uvs;
    const mesh = this.#pc.Mesh.fromGeometry(this.#app.graphicsDevice, geometry);
    mesh.incRefCount();
    this.#meshes.push(mesh);
    return mesh;
  }

  #addBaseEave(root, name, x, z, width, depth) {
    const eave = new this.#pc.Entity(name);
    eave.addComponent("render", {
      type: "box",
      castShadows: true,
      receiveShadows: true,
    });
    for (const instance of eave.render.meshInstances) {
      instance.material = this.#trimMaterial;
    }
    eave.setLocalPosition(x, 0.018, z);
    eave.setLocalScale(width, 0.05, depth);
    root.addChild(eave);
  }
}
