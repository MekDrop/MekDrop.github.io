import { GRASS_SURFACE_LIFT } from "../../config/terrain.js";
import { buildStoneVoxelGeometry } from "./StoneVoxelGeometry.js";

/** Runtime-built cubic stone clusters with solid tops the hero can land on. */
export class StoneField {
  #entity;
  #parts = [];
  #mesh = null;
  #material = null;

  constructor({ pc, app, mapData }) {
    this.#entity = new pc.Entity("Stone clusters");
    const stones = [];
    for (const cluster of mapData.stoneData ?? []) {
      const ground =
        mapData.heightmap[cluster.row][cluster.col] + GRASS_SURFACE_LIFT;
      for (const stone of cluster.parts) {
        const x = cluster.col - (mapData.cols - 1) / 2 + stone.offsetX;
        const z = cluster.row - (mapData.rows - 1) / 2 + stone.offsetZ;
        const halfWidth = stone.diameter / 2;
        const top = ground + stone.height;
        stones.push({ ...stone, x, z, ground });
        this.#parts.push({ x, z, ground, top, halfWidth });

        const collider = new pc.Entity("Stone landing surface");
        collider.setLocalPosition(x, ground + stone.height / 2, z);
        collider.addComponent("collision", {
          type: "box",
          halfExtents: new pc.Vec3(halfWidth, stone.height / 2, halfWidth),
        });
        collider.addComponent("rigidbody", {
          type: "static",
          friction: 0.7,
          restitution: 0,
        });
        this.#entity.addChild(collider);
      }
    }
    if (!stones.length) {
      return;
    }

    const geometry = buildStoneVoxelGeometry(stones);
    this.#mesh = new pc.Mesh(app.graphicsDevice);
    this.#mesh.setPositions(geometry.positions);
    this.#mesh.setNormals(geometry.normals);
    this.#mesh.setColors32(geometry.colors);
    this.#mesh.setIndices(geometry.indices);
    this.#mesh.update();

    this.#material = new pc.StandardMaterial();
    this.#material.name = "Generated cubic stone";
    this.#material.diffuse = new pc.Color(1, 1, 1);
    this.#material.diffuseVertexColor = true;
    this.#material.gloss = 0.08;
    this.#material.metalness = 0;
    this.#material.useMetalness = true;
    this.#material.update();
    const meshInstance = new pc.MeshInstance(this.#mesh, this.#material);
    this.#entity.addComponent("render", {
      meshInstances: [meshInstance],
      castShadows: true,
      receiveShadows: true,
    });
  }

  get entity() {
    return this.#entity;
  }

  surfaceHeightAt(x, z, radius = 0) {
    let height = null;
    for (const part of this.#parts) {
      if (
        Math.abs(x - part.x) >= part.halfWidth + radius ||
        Math.abs(z - part.z) >= part.halfWidth + radius
      ) {
        continue;
      }
      height = height === null ? part.top : Math.max(height, part.top);
    }
    return height;
  }

  collisionDepthAt(x, z, radius = 0, elevation = -Infinity, stepClearance = 0) {
    let depth = 0;
    for (const part of this.#parts) {
      if (
        elevation + stepClearance >= part.top ||
        elevation + 1 < part.ground
      ) {
        continue;
      }
      depth = Math.max(
        depth,
        Math.min(
          part.halfWidth + radius - Math.abs(x - part.x),
          part.halfWidth + radius - Math.abs(z - part.z),
        ),
      );
    }
    return Math.max(0, depth);
  }

  grassWeightAt(x, z, elevation) {
    return this.#parts.some(
      (part) =>
        Math.abs(elevation - part.ground) < 0.18 &&
        Math.abs(x - part.x) < part.halfWidth + 0.04 &&
        Math.abs(z - part.z) < part.halfWidth + 0.04,
    )
      ? 1
      : 0;
  }

  destroy() {
    this.#entity?.destroy();
    this.#entity = null;
    this.#mesh?.destroy();
    this.#mesh = null;
    this.#material?.destroy();
    this.#material = null;
    this.#parts = [];
  }
}
