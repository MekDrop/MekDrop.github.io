import { SLOPE_DIRECTION } from "../../enum/SlopeDirection.js";
import {
  CUBE_SCALE,
  SURFACE_ELEVATION_BIAS,
} from "./TerrainMaterialMaps.js";

export class TerrainInstanceRenderer {
  /**
   *
   * @type {typeof pc}
   */
  #pc;
  /**
   *
   * @type {pc.Application}
   */
  #app;
  /**
   *
   * @type {pc.Entity}
   */
  #root;
  /**
   *
   * @type {pc.Material[]}
   */
  #materials;
  /**
   *
   * @type {Map}
   */
  #batches = new Map();
  /**
   *
   * @type {Array}
   */
  #meshes;
  /**
   *
   * @type {Array}
   */
  #entities = [];
  /**
   *
   * @type {Array}
   */
  #vertexBuffers = [];

  /**
   *
   * @param {{pc: typeof pc, app: pc.Application, root: pc.Entity, materials: pc.Material[]}} options
   * @param {typeof pc} options.pc
   * @param {pc.Application} options.app
   * @param {pc.Entity} options.root
   * @param {pc.Material[]} options.materials
   */
  constructor({ pc, app, root, materials }) {
    /**
     *
     * @type {typeof pc}
     */
    this.#pc = pc;
    /**
     *
     * @type {pc.Application}
     */
    this.#app = app;
    /**
     *
     * @type {pc.Entity}
     */
    this.#root = root;
    /**
     *
     * @type {pc.Material[]}
     */
    this.#materials = materials;
    /**
     *
     * @type {Array}
     */
    this.#meshes = this.#createMeshes();
  }

  /**
   *
   * @param {pc.Material} topMaterial
   * @param {pc.Material} sideMaterial
   * @param {number} x
   * @param {number} y
   * @param {number} z
   * @param {string} coverage
   * @param {pc.Material} underlayMaterial
   * @param {number} surfaceLift
   */
  addCubeMatrix(
    topMaterial,
    sideMaterial,
    x,
    y,
    z,
    coverage = "full",
    underlayMaterial = sideMaterial,
    surfaceLift = 0,
  ) {
    this.addBoxMatrix(
      topMaterial,
      sideMaterial,
      x,
      y + surfaceLift / 2,
      z,
      0,
      CUBE_SCALE,
      CUBE_SCALE + surfaceLift,
      CUBE_SCALE,
      coverage,
      underlayMaterial,
    );
  }

  /**
   *
   * @param {pc.Material} topMaterial
   * @param {pc.Material} sideMaterial
   * @param {number} x
   * @param {number} y
   * @param {number} z
   * @param {number} yaw
   * @param {number} sx
   * @param {number} sy
   * @param {number} sz
   * @param {string} coverage
   * @param {pc.Material} underlayMaterial
   * @param {number} pitch
   */
  addBoxMatrix(
    topMaterial,
    sideMaterial,
    x,
    y,
    z,
    yaw,
    sx,
    sy,
    sz,
    coverage = "full",
    underlayMaterial = sideMaterial,
    pitch = 0,
  ) {
    const pc = this.#pc;
    const matrix = new pc.Mat4();
    const rotation = new pc.Quat();
    rotation.setFromEulerAngles(pitch, yaw, 0);
    matrix.setTRS(new pc.Vec3(x, y, z), rotation, new pc.Vec3(sx, sy, sz));
    const materialBatch = `${topMaterial}|${sideMaterial}|${underlayMaterial}|${coverage}`;
    const data = this.#batches.get(materialBatch) ?? [];
    for (const value of matrix.data) {
      data.push(value);
    }
    this.#batches.set(materialBatch, data);
  }

  build() {
    const pc = this.#pc;
    for (const [materialBatch, matrices] of this.#batches.entries()) {
      if (matrices.length === 0) {
        continue;
      }
      const [topMaterial, sideMaterial, underlayMaterial, coverage] =
        materialBatch.split("|");
      const instanceCount = matrices.length / 16;
      const vertexBuffer = new pc.VertexBuffer(
        this.#app.graphicsDevice,
        pc.VertexFormat.getDefaultInstancingFormat(this.#app.graphicsDevice),
        instanceCount,
        { data: new Float32Array(matrices) },
      );
      this.#vertexBuffers.push(vertexBuffer);

      const entity = new pc.Entity(`${topMaterial}/${sideMaterial} cubes`);
      const bridgeSideMesh =
        coverage === "bridgeHorizontal" ||
        coverage === "bridgeHorizontalSidesOnly"
          ? this.#meshes.bridgeHorizontalSides
          : coverage === "bridgeVertical" ||
              coverage === "bridgeVerticalSidesOnly"
            ? this.#meshes.bridgeVerticalSides
            : null;
      const slopeMeshes = this.#meshes.slopes[coverage] ?? null;
      const sidesOnly = coverage.endsWith("SidesOnly");
      const surfaceOnly = coverage === "surfaceOnly";
      const sideMeshInstance = surfaceOnly
        ? null
        : new pc.MeshInstance(
            slopeMeshes?.sides ?? bridgeSideMesh ?? this.#meshes.wallSides,
            this.#materials.get(sideMaterial),
          );
      const surfaceMesh = surfaceOnly
        ? this.#meshes.surfaces.full
        : sidesOnly
          ? null
          : (slopeMeshes?.surface ??
            this.#meshes.surfaces[coverage] ??
            (bridgeSideMesh ? this.#meshes.surfaces.full : null));
      const topMeshInstance = surfaceMesh
        ? new pc.MeshInstance(surfaceMesh, this.#materials.get(topMaterial))
        : null;
      const underlayMeshInstance =
        underlayMaterial === "none"
          ? null
          : new pc.MeshInstance(
              this.#meshes.underlay,
              this.#materials.get(underlayMaterial),
            );
      const meshInstances = [
        sideMeshInstance,
        underlayMeshInstance,
        topMeshInstance,
      ].filter(Boolean);
      entity.addComponent("render", {
        meshInstances,
        castShadows: true,
        receiveShadows: true,
      });
      for (const meshInstance of meshInstances) {
        meshInstance.setInstancing(vertexBuffer, false);
        meshInstance.castShadow = true;
        meshInstance.receiveShadow = true;
      }
      this.#root.addChild(entity);
      this.#entities.push(entity);
    }
    this.#batches.clear();
  }

  destroy() {
    for (const entity of this.#entities) {
      entity.destroy();
    }
    this.#entities = [];
    for (const vertexBuffer of this.#vertexBuffers) {
      vertexBuffer.destroy();
    }
    this.#vertexBuffers = [];
    this.#batches.clear();
    this.#destroyMesh(this.#meshes.sides);
    this.#destroyMesh(this.#meshes.wallSides);
    this.#destroyMesh(this.#meshes.bridgeHorizontalSides);
    this.#destroyMesh(this.#meshes.bridgeVerticalSides);
    this.#destroyMesh(this.#meshes.underlay);
    for (const slope of Object.values(this.#meshes.slopes)) {
      this.#destroyMesh(slope.sides);
      this.#destroyMesh(slope.surface);
    }
    for (const mesh of Object.values(this.#meshes.surfaces)) {
      this.#destroyMesh(mesh);
    }
    this.#meshes = null;
  }

  #createMeshes() {
    const pc = this.#pc;
    const groups = {
      underlay: { positions: [], normals: [], uvs: [], indices: [] },
      sides: { positions: [], normals: [], uvs: [], indices: [] },
      wallSides: { positions: [], normals: [], uvs: [], indices: [] },
      bridgeHorizontalSides: {
        positions: [],
        normals: [],
        uvs: [],
        indices: [],
      },
      bridgeVerticalSides: {
        positions: [],
        normals: [],
        uvs: [],
        indices: [],
      },
      full: { positions: [], normals: [], uvs: [], indices: [] },
      block: { positions: [], normals: [], uvs: [], indices: [] },
    };
    const slopeGroupNames = {};
    for (const direction of Object.values(SLOPE_DIRECTION)) {
      for (const stage of ["Lower", "Upper"]) {
        const coverage = `slope${direction}${stage}`;
        const surface = `${coverage}Surface`;
        const sides = `${coverage}Sides`;
        groups[surface] = { positions: [], normals: [], uvs: [], indices: [] };
        groups[sides] = { positions: [], normals: [], uvs: [], indices: [] };
        slopeGroupNames[coverage] = { surface, sides };
      }
    }
    const half = 0.5;
    const inner = 0.49;

    /**
     *
     * @param {string} groupName
     * @param {number[][]} sourcePoints
     */
    const addFace = (groupName, sourcePoints) => {
      const group = groups[groupName];
      const points = sourcePoints.map(/**
       *
       * @param {import("src/game/GameContracts.js").GridPoint} point
       */
      (point) => [...point]);
      const edgeA = points[1].map(/**
       *
       * @param {number} value
       * @param {string} axis
       */
      (value, axis) => value - points[0][axis]);
      const edgeB = points[2].map(/**
       *
       * @param {number} value
       * @param {string} axis
       */
      (value, axis) => value - points[0][axis]);
      let normal = [
        edgeA[1] * edgeB[2] - edgeA[2] * edgeB[1],
        edgeA[2] * edgeB[0] - edgeA[0] * edgeB[2],
        edgeA[0] * edgeB[1] - edgeA[1] * edgeB[0],
      ];
      const center = [0, 1, 2].map(
        /**
         *
         * @param {string} axis
         */
        (axis) =>
          points.reduce(/**
           *
           * @param {number} sum
           * @param {import("src/game/GameContracts.js").GridPoint} point
           */
          (sum, point) => sum + point[axis], 0) / points.length,
      );
      if (
        normal.reduce(/**
         *
         * @param {number} sum
         * @param {number} value
         * @param {string} axis
         */
        (sum, value, axis) => sum + value * center[axis], 0) < 0
      ) {
        points.reverse();
        normal = normal.map(/**
         *
         * @param {number} value
         */
        (value) => -value);
      }
      const normalLength = Math.hypot(...normal);
      normal = normal.map(/**
       *
       * @param {number} value
       */
      (value) => value / normalLength);

      const start = group.positions.length / 3;
      const xRange =
        Math.max(...points.map(/**
         *
         * @param {import("src/game/GameContracts.js").GridPoint} point
         */
        (point) => point[0])) -
        Math.min(...points.map(/**
         *
         * @param {import("src/game/GameContracts.js").GridPoint} point
         */
        (point) => point[0]));
      const zRange =
        Math.max(...points.map(/**
         *
         * @param {import("src/game/GameContracts.js").GridPoint} point
         */
        (point) => point[2])) -
        Math.min(...points.map(/**
         *
         * @param {import("src/game/GameContracts.js").GridPoint} point
         */
        (point) => point[2]));
      const horizontalAxis = xRange >= zRange ? 0 : 2;
      const minX = Math.min(...points.map(/**
       *
       * @param {import("src/game/GameContracts.js").GridPoint} point
       */
      (point) => point[0]));
      const maxX = Math.max(...points.map(/**
       *
       * @param {import("src/game/GameContracts.js").GridPoint} point
       */
      (point) => point[0]));
      const minZ = Math.min(...points.map(/**
       *
       * @param {import("src/game/GameContracts.js").GridPoint} point
       */
      (point) => point[2]));
      const maxZ = Math.max(...points.map(/**
       *
       * @param {import("src/game/GameContracts.js").GridPoint} point
       */
      (point) => point[2]));
      points.forEach(/**
       *
       * @param {import("src/game/GameContracts.js").GridPoint} point
       */
      (point) => {
        group.positions.push(...point);
        group.normals.push(...normal);
        if (!groupName.toLowerCase().endsWith("sides")) {
          group.uvs.push(
            (point[0] - minX) / Math.max(0.001, maxX - minX),
            (point[2] - minZ) / Math.max(0.001, maxZ - minZ),
          );
        } else {
          group.uvs.push(point[horizontalAxis] + half, half - point[1]);
        }
      });
      for (let index = 1; index < points.length - 1; index += 1) {
        group.indices.push(start, start + index, start + index + 1);
      }
    };

    for (const sign of [-1, 1]) {
      addFace("sides", [
        [sign * half, -inner, -inner],
        [sign * half, half, -inner],
        [sign * half, half, inner],
        [sign * half, -inner, inner],
      ]);
      addFace(sign === 1 ? "underlay" : "sides", [
        [-inner, sign * half, -inner],
        [-inner, sign * half, inner],
        [inner, sign * half, inner],
        [inner, sign * half, -inner],
      ]);
      addFace("sides", [
        [-inner, -inner, sign * half],
        [inner, -inner, sign * half],
        [inner, half, sign * half],
        [-inner, half, sign * half],
      ]);
    }

    const axisPairs = [
      [0, 1, 2],
      [0, 2, 1],
      [1, 2, 0],
    ];
    for (const [axisA, axisB, freeAxis] of axisPairs) {
      for (const signA of [-1, 1]) {
        for (const signB of [-1, 1]) {
          /**
           *
           * @param {(axis: string, value: number) => void} onAxis
           * @param {number} freeValue
           */
          const point = (onAxis, freeValue) => {
            const result = [0, 0, 0];
            result[axisA] = signA * (onAxis === axisA ? half : inner);
            result[axisB] = signB * (onAxis === axisB ? half : inner);
            result[freeAxis] = freeValue;
            const touchesTopEdge =
              (axisA === 1 && signA === 1) ||
              (axisB === 1 && signB === 1) ||
              (freeAxis === 1 && freeValue === inner);
            if (touchesTopEdge) {
              result[1] = half;
            }
            return result;
          };
          addFace("sides", [
            point(axisA, -inner),
            point(axisA, inner),
            point(axisB, inner),
            point(axisB, -inner),
          ]);
        }
      }
    }

    for (const signX of [-1, 1]) {
      for (const signY of [-1, 1]) {
        for (const signZ of [-1, 1]) {
          addFace("sides", [
            [signX * half, signY === 1 ? half : -inner, signZ * inner],
            [signX * inner, signY * half, signZ * inner],
            [signX * inner, signY === 1 ? half : -inner, signZ * half],
          ]);
        }
      }
    }

    for (const sign of [-1, 1]) {
      addFace("bridgeHorizontalSides", [
        [-half, -half, sign * half],
        [half, -half, sign * half],
        [half, half, sign * half],
        [-half, half, sign * half],
      ]);
      addFace("bridgeVerticalSides", [
        [sign * half, -half, -half],
        [sign * half, half, -half],
        [sign * half, half, half],
        [sign * half, -half, half],
      ]);
    }

    // Terrain cubes are stacked into cliffs. Their visible wall faces span the
    // complete tile so adjacent cubes meet coplanarly; per-cube edge bevels
    // otherwise form dark horizontal and vertical grooves through one wall.
    for (const sign of [-1, 1]) {
      addFace("wallSides", [
        [sign * half, -half, -half],
        [sign * half, half, -half],
        [sign * half, half, half],
        [sign * half, -half, half],
      ]);
      addFace("wallSides", [
        [-half, -half, sign * half],
        [half, -half, sign * half],
        [half, half, sign * half],
        [-half, half, sign * half],
      ]);
    }

    const surfaceY = half + SURFACE_ELEVATION_BIAS;
    addFace("full", [
      [-half, surfaceY, -half],
      [-half, surfaceY, half],
      [half, surfaceY, half],
      [half, surfaceY, -half],
    ]);
    addFace("block", [
      [-inner, surfaceY, -inner],
      [-inner, surfaceY, inner],
      [inner, surfaceY, inner],
      [inner, surfaceY, -inner],
    ]);

    for (const [coverage, groupNames] of Object.entries(slopeGroupNames)) {
      const direction = coverage.match(/^slope(NORTH|SOUTH|EAST|WEST)/)?.[1];
      const isUpper = coverage.endsWith("Upper");
      const low = isUpper ? 0.5 : 0;
      const high = isUpper ? 1 : 0.5;
      /**
       *
       * @param {number} x
       * @param {number} z
       */
      const cornerHeight = (x, z) => {
        if (direction === SLOPE_DIRECTION.NORTH) {
          return z < 0 ? high : low;
        }
        if (direction === SLOPE_DIRECTION.SOUTH) {
          return z > 0 ? high : low;
        }
        if (direction === SLOPE_DIRECTION.EAST) {
          return x > 0 ? high : low;
        }
        return x < 0 ? high : low;
      };
      const northWest = [-half, cornerHeight(-half, -half), -half];
      const southWest = [-half, cornerHeight(-half, half), half];
      const southEast = [half, cornerHeight(half, half), half];
      const northEast = [half, cornerHeight(half, -half), -half];
      addFace(groupNames.surface, [northWest, southWest, southEast, northEast]);
      /**
       *
       * @param {pc.Vec3|pc.Vec3} bottomA
       * @param {pc.Vec3|pc.Vec3} bottomB
       * @param {pc.Vec3|pc.Vec3} topB
       * @param {pc.Vec3|pc.Vec3} topA
       */
      const addSlopeSide = (bottomA, bottomB, topB, topA) => {
        if (topA[1] <= 0 && topB[1] <= 0) {
          return;
        }
        addFace(groupNames.sides, [bottomA, bottomB, topB, topA]);
      };
      addSlopeSide([-half, 0, -half], [-half, 0, half], southWest, northWest);
      addSlopeSide([half, 0, half], [half, 0, -half], northEast, southEast);
      addSlopeSide([half, 0, -half], [-half, 0, -half], northWest, northEast);
      addSlopeSide([-half, 0, half], [half, 0, half], southEast, southWest);
    }

    /**
     *
     * @param {string|number|symbol} group
     */
    const createMesh = (group) => {
      const geometry = new pc.Geometry();
      geometry.positions = group.positions;
      geometry.normals = group.normals;
      geometry.uvs = group.uvs;
      geometry.indices = group.indices;
      const mesh = pc.Mesh.fromGeometry(this.#app.graphicsDevice, geometry);
      mesh.incRefCount();
      return mesh;
    };

    return {
      sides: createMesh(groups.sides),
      wallSides: createMesh(groups.wallSides),
      bridgeHorizontalSides: createMesh(groups.bridgeHorizontalSides),
      bridgeVerticalSides: createMesh(groups.bridgeVerticalSides),
      underlay: createMesh(groups.underlay),
      slopes: Object.fromEntries(
        Object.entries(slopeGroupNames).map(/**
         *
         * @param {{"0": Array, "1": Array}} options
         * @param {Array} options."0"
         * @param {Array} options."1"
         */
        ([coverage, groupNames]) => [
          coverage,
          {
            surface: createMesh(groups[groupNames.surface]),
            sides: createMesh(groups[groupNames.sides]),
          },
        ]),
      ),
      surfaces: {
        full: createMesh(groups.full),
        block: createMesh(groups.block),
      },
    };
  }

  /**
   *
   * @param {pc.Mesh} mesh
   */
  #destroyMesh(mesh) {
    mesh.decRefCount();
    if (mesh.refCount < 1) {
      mesh.destroy();
    }
  }
}
