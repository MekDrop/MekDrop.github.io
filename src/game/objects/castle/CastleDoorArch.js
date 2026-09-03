const INNER_RADIUS = 1.02;
const OUTER_RADIUS = 1.31;
const ARCH_SPRING_HEIGHT = 1.25;
const ARCH_DEPTH = 0.3;
const ARCH_SEGMENTS = 9;
const MORTAR_GAP_RADIANS = 0.018;
const JAMB_BLOCK_HEIGHT = 0.31;

/** Chunky wedge-stone frame around one castle entrance. */
export class CastleDoorArch {
  #pc;
  #app;
  #entity;
  #material;
  #meshes = [];

  constructor({ pc, app, castlePosition, door, material }) {
    this.#pc = pc;
    this.#app = app;
    this.#material = material;
    this.#entity = new pc.Entity("Castle door stone arch");

    const placement = this.#placement(castlePosition, door);
    this.#entity.setLocalPosition(
      placement.x,
      castlePosition.elevation,
      placement.z,
    );
    this.#entity.setLocalEulerAngles(0, placement.yaw, 0);
    this.#buildJambs();
    this.#buildVoussoirs();
  }

  get entity() {
    return this.#entity;
  }

  destroy() {
    this.#entity?.destroy();
    this.#entity = null;
    for (const mesh of this.#meshes) {
      mesh.decRefCount();
      if (mesh.refCount < 1) mesh.destroy();
    }
    this.#meshes = [];
  }

  #placement(castlePosition, door) {
    const centerOffset = (door.offset ?? 0) + (door.width ?? 2) / 2;
    const placements = {
      WEST: {
        x: castlePosition.x - 0.035,
        z: castlePosition.z + centerOffset,
        yaw: 90,
      },
      EAST: {
        x: castlePosition.x + castlePosition.width + 0.035,
        z: castlePosition.z + centerOffset,
        yaw: 90,
      },
      NORTH: {
        x: castlePosition.x + centerOffset,
        z: castlePosition.z - 0.035,
        yaw: 0,
      },
      SOUTH: {
        x: castlePosition.x + centerOffset,
        z: castlePosition.z + castlePosition.depth + 0.035,
        yaw: 0,
      },
    };
    return placements[door.side] ?? placements.NORTH;
  }

  #buildJambs() {
    const jambWidth = OUTER_RADIUS - INNER_RADIUS;
    const rows = Math.ceil(ARCH_SPRING_HEIGHT / JAMB_BLOCK_HEIGHT);
    for (const side of [-1, 1]) {
      for (let row = 0; row < rows; row += 1) {
        const height = Math.min(
          JAMB_BLOCK_HEIGHT,
          ARCH_SPRING_HEIGHT - row * JAMB_BLOCK_HEIGHT,
        );
        const block = this.#box(`Castle arch jamb stone ${side} ${row}`);
        block.setLocalPosition(
          side * (INNER_RADIUS + jambWidth / 2),
          row * JAMB_BLOCK_HEIGHT + height / 2,
          0,
        );
        block.setLocalScale(
          jambWidth * (row % 2 === 0 ? 1.08 : 0.96),
          Math.max(0.04, height - 0.018),
          ARCH_DEPTH,
        );
        this.#entity.addChild(block);
      }
    }
  }

  #buildVoussoirs() {
    const positions = [];
    const uvs = [];
    const indices = [];
    const appendFace = (points) => {
      const start = positions.length / 3;
      const faceUvs = [
        [0, 0],
        [1, 0],
        [1, 1],
        [0, 1],
      ];
      points.forEach((point, index) => {
        positions.push(...point);
        uvs.push(...faceUvs[index]);
      });
      indices.push(start, start + 1, start + 2, start, start + 2, start + 3);
    };
    const point = (radius, angle, z) => [
      Math.cos(angle) * radius,
      ARCH_SPRING_HEIGHT + Math.sin(angle) * radius,
      z,
    ];

    for (let segment = 0; segment < ARCH_SEGMENTS; segment += 1) {
      const rawStart = Math.PI - (segment / ARCH_SEGMENTS) * Math.PI;
      const rawEnd =
        Math.PI - ((segment + 1) / ARCH_SEGMENTS) * Math.PI;
      const startAngle = rawStart - MORTAR_GAP_RADIANS;
      const endAngle = rawEnd + MORTAR_GAP_RADIANS;
      const frontZ = ARCH_DEPTH / 2;
      const backZ = -ARCH_DEPTH / 2;
      const innerStartFront = point(INNER_RADIUS, startAngle, frontZ);
      const innerEndFront = point(INNER_RADIUS, endAngle, frontZ);
      const outerStartFront = point(OUTER_RADIUS, startAngle, frontZ);
      const outerEndFront = point(OUTER_RADIUS, endAngle, frontZ);
      const innerStartBack = point(INNER_RADIUS, startAngle, backZ);
      const innerEndBack = point(INNER_RADIUS, endAngle, backZ);
      const outerStartBack = point(OUTER_RADIUS, startAngle, backZ);
      const outerEndBack = point(OUTER_RADIUS, endAngle, backZ);

      appendFace([
        innerStartFront,
        innerEndFront,
        outerEndFront,
        outerStartFront,
      ]);
      appendFace([
        outerStartBack,
        outerEndBack,
        innerEndBack,
        innerStartBack,
      ]);
      appendFace([
        innerStartBack,
        innerEndBack,
        innerEndFront,
        innerStartFront,
      ]);
      appendFace([
        outerStartFront,
        outerEndFront,
        outerEndBack,
        outerStartBack,
      ]);
      appendFace([
        innerStartBack,
        innerStartFront,
        outerStartFront,
        outerStartBack,
      ]);
      appendFace([
        innerEndFront,
        innerEndBack,
        outerEndBack,
        outerEndFront,
      ]);
    }

    const geometry = new this.#pc.Geometry();
    geometry.positions = positions;
    geometry.indices = indices;
    geometry.normals = this.#pc.calculateNormals(positions, indices);
    geometry.uvs = uvs;
    const mesh = this.#pc.Mesh.fromGeometry(
      this.#app.graphicsDevice,
      geometry,
    );
    mesh.incRefCount();
    this.#meshes.push(mesh);
    const arch = new this.#pc.Entity("Castle wedge stone arch");
    arch.addComponent("render", {
      meshInstances: [new this.#pc.MeshInstance(mesh, this.#material)],
      castShadows: false,
      receiveShadows: true,
    });
    this.#entity.addChild(arch);
  }

  #box(name) {
    const entity = new this.#pc.Entity(name);
    entity.addComponent("render", {
      type: "box",
      castShadows: false,
      receiveShadows: true,
    });
    for (const meshInstance of entity.render.meshInstances) {
      meshInstance.material = this.#material;
    }
    return entity;
  }
}
