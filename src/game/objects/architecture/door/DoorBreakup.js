const COLUMNS = 8;
const ROWS = 6;
const FALL_TIME = 0.55;
const SINK_TIME = 0.45;
const LIFETIME = 1.1;

/**
 * @typedef {{point:import("playcanvas").Vec3,local:import("playcanvas").Vec3,uv:import("playcanvas").Vec2,color:number[]}} DoorFragmentVertex
 */

/**
 * The damaged leaf becomes bounded pieces of its own current geometry. Ammo
 * owns their fall, spin and contacts; the stone frame remains in place.
 */
export class DoorBreakup {
  /**
   * @param {typeof import("playcanvas")} pc
   * @param {import("playcanvas").Application} app
   * @param {import("./Door.js").Door} door
   * @param {import("../../enemies/shared/Enemy.js").Enemy|null} source
   */
  constructor(pc, app, door, source) {
    this.pc = pc;
    this.age = 0;
    this.pieces = [];
    this.meshes = [];
    this.sinking = new Map();
    this.floorY = door.entity.getPosition().y;
    if (!app?.root || !app.graphicsDevice || !app.systems?.rigidbody) {
      return;
    }
    const inverse = door.entity.getWorldTransform().clone().invert();
    const rotation = door.entity.getRotation().clone();
    const inverseRotation = rotation.clone().invert();
    const groups = new Map();
    const triangles = new Set();
    const point = new pc.Vec3();
    const outward = source?.position ? door.entity.getPosition().clone().sub(source.position) : door.entity.forward.clone();
    outward.y = 0;
    outward.normalize();
    for (const instance of new Set(door.getSurfaceMeshInstances())) {
      const positions = [], indices = [], uvs = [], colors = [];
      instance.mesh.getPositions(positions);
      instance.mesh.getIndices(indices);
      instance.mesh.getUvs(0, uvs);
      instance.mesh.getColors?.(colors);
      const world = instance.node.getWorldTransform();
      for (let i = 0; i < indices.length; i += 3) {
        const triangle = [];
        for (let j = 0; j < 3; j++) {
          const index = indices[i + j];
          world.transformPoint(point.set(positions[index * 3], positions[index * 3 + 1], positions[index * 3 + 2]), point);
          triangle.push({
            point: point.clone(),
            local: inverse.transformPoint(point),
            uv: new pc.Vec2(uvs[index * 2] ?? 0, uvs[index * 2 + 1] ?? 0),
            color: [colors[index * 4] ?? 1, colors[index * 4 + 1] ?? 1, colors[index * 4 + 2] ?? 1, colors[index * 4 + 3] ?? 1],
          });
        }
        const signature = triangle.map(/**
         * @param {DoorFragmentVertex} vertex
         */
          vertex => vertex.point.toArray().map(/**
           * @param {number} coordinate
           */
            coordinate => Math.round(coordinate * 1e6)).join(",")).sort().join(";");
        if (triangles.has(signature)) {
          continue;
        }
        triangles.add(signature);
        const xs = triangle.map(DoorBreakup.#x), ys = triangle.map(DoorBreakup.#y);
        const firstCol = DoorBreakup.#column(Math.min(...xs), door.clearWidth);
        const lastCol = DoorBreakup.#column(Math.max(...xs), door.clearWidth);
        const firstRow = DoorBreakup.#row(Math.min(...ys), door.clearHeight);
        const lastRow = DoorBreakup.#row(Math.max(...ys), door.clearHeight);
        for (let row = firstRow; row <= lastRow; row++) {
          for (let col = firstCol; col <= lastCol; col++) {
            let polygon = triangle;
            if (col > 0) {
              polygon = DoorBreakup.#clip(polygon, "x", (col / COLUMNS - 0.5) * door.clearWidth, true);
            }
            if (col < COLUMNS - 1) {
              polygon = DoorBreakup.#clip(polygon, "x", ((col + 1) / COLUMNS - 0.5) * door.clearWidth, false);
            }
            if (row > 0) {
              polygon = DoorBreakup.#clip(polygon, "y", row / ROWS * door.clearHeight, true);
            }
            if (row < ROWS - 1) {
              polygon = DoorBreakup.#clip(polygon, "y", (row + 1) / ROWS * door.clearHeight, false);
            }
            if (polygon.length < 3) {
              continue;
            }
            const key = row * COLUMNS + col;
            if (!groups.has(key)) {
              groups.set(key, new Map());
            }
            const group = groups.get(key);
            if (!group.has(instance.material)) {
              group.set(instance.material, {
                positions: [],
                uvs: [],
                colors: [],
              });
            }
            const data = group.get(instance.material);
            for (let j = 1; j < polygon.length - 1; j++) {
              const edgeA = polygon[j].point.clone().sub(polygon[0].point);
              const edgeB = polygon[j + 1].point.clone().sub(polygon[0].point);
              // Clipping exactly along a cell edge can emit repeated vertices
              // or an entire zero-area fan. They cannot become physical shards.
              if (new pc.Vec3().cross(edgeA, edgeB).lengthSq() < 1e-14) {
                continue;
              }
              for (const vertex of [polygon[0], polygon[j], polygon[j + 1]]) {
                data.positions.push(vertex.point.x, vertex.point.y, vertex.point.z);
                data.uvs.push(vertex.uv.x, vertex.uv.y);
                data.colors.push(...vertex.color);
              }
            }
          }
        }
      }
    }
    for (const [key, group] of groups) {
      for (const [material, data] of group) {
        if (!data.positions.length) {
          group.delete(material);
        }
      }
      if (!group.size) {
        continue;
      }
      const low = new pc.Vec3(Infinity, Infinity, Infinity), high = new pc.Vec3(-Infinity, -Infinity, -Infinity);
      for (const data of group.values()) {
        for (let i = 0; i < data.positions.length; i += 3) {
          point.set(data.positions[i], data.positions[i + 1], data.positions[i + 2]);
          inverseRotation.transformVector(point, point);
          low.min(point);
          high.max(point);
        }
      }
      const center = low.clone().add(high).mulScalar(0.5);
      const half = high.clone().sub(low).mulScalar(0.5);
      // Door-oriented bodies leave a physical seam. World-axis boxes overlap
      // adjacent cells whenever the doorway rotates, causing explosive jitter.
      half.x = Math.max(0.001, half.x - 0.002);
      half.y = Math.max(0.001, half.y - 0.002);
      half.z = Math.max(0.001, half.z - 0.002);
      const entity = new pc.Entity("Collapsed door timber", app);
      app.root.addChild(entity);
      entity.setPosition(rotation.transformVector(center));
      entity.setRotation(rotation);
      const instances = [];
      for (const [material, data] of group) {
        for (let i = 0; i < data.positions.length; i += 3) {
          inverseRotation.transformVector(point.set(data.positions[i], data.positions[i + 1], data.positions[i + 2]), point);
          data.positions[i] = point.x - center.x;
          data.positions[i + 1] = point.y - center.y;
          data.positions[i + 2] = point.z - center.z;
        }
        const indices = Array.from({ length: data.positions.length / 3 }, DoorBreakup.#index);
        const mesh = new pc.Mesh(app.graphicsDevice);
        mesh.setPositions(data.positions);
        mesh.setIndices(indices);
        mesh.setUvs(0, data.uvs);
        mesh.setColors(data.colors);
        mesh.setNormals(pc.calculateNormals(data.positions, indices));
        mesh.update();
        this.meshes.push(mesh);
        instances.push(new pc.MeshInstance(mesh, material, entity));
      }
      entity.addComponent("render", { meshInstances: instances });
      entity.addComponent("collision", {
        type: "box",
        halfExtents: half,
      });
      entity.addComponent("rigidbody", {
        type: "dynamic",
        mass: 0.08 + half.x * half.y * half.z * 12,
        friction: 0.8,
        restitution: 0,
        linearDamping: 0.65,
        angularDamping: 0.85,
      });
      entity.rigidbody.linearVelocity = outward.clone().mulScalar(0.12)
        .add(new pc.Vec3((key % COLUMNS - (COLUMNS - 1) / 2) * 0.015, 0, 0));
      entity.rigidbody.angularVelocity = new pc.Vec3(8, (key % 2 ? -1 : 1) * 5, (key % COLUMNS - (COLUMNS - 1) / 2) * 2);
      this.pieces.push(entity);
    }
  }

  /**
   * @param {number} value
   * @param {number} index
   * @returns {number}
   */
  static #index(value, index) {
    return index;
  }

  /**
   * @param {DoorFragmentVertex} vertex
   * @returns {number}
   */
  static #x(vertex) {
    return vertex.local.x;
  }

  /**
   * @param {DoorFragmentVertex} vertex
   * @returns {number}
   */
  static #y(vertex) {
    return vertex.local.y;
  }

  /**
   * @param {number} x
   * @param {number} width
   * @returns {number}
   */
  static #column(x, width) {
    return Math.max(0, Math.min(COLUMNS - 1, Math.floor((x / width + 0.5) * COLUMNS)));
  }

  /**
   * @param {number} y
   * @param {number} height
   * @returns {number}
   */
  static #row(y, height) {
    return Math.max(0, Math.min(ROWS - 1, Math.floor(y / height * ROWS)));
  }

  /**
   * Clip through real geometry so a long source triangle cannot become an
   * oversized flying splinter. UVs and the carved interior shade follow cuts.
   * @param {DoorFragmentVertex[]} polygon
   * @param {"x"|"y"} axis
   * @param {number} limit
   * @param {boolean} greater
   * @returns {DoorFragmentVertex[]}
   */
  static #clip(polygon, axis, limit, greater) {
    const result = [];
    for (let i = 0; i < polygon.length; i++) {
      const a = polygon[i], b = polygon[(i + 1) % polygon.length];
      const insideA = greater ? a.local[axis] >= limit : a.local[axis] <= limit;
      const insideB = greater ? b.local[axis] >= limit : b.local[axis] <= limit;
      if (insideA) {
        result.push(a);
      }
      if (insideA !== insideB) {
        const t = (limit - a.local[axis]) / (b.local[axis] - a.local[axis]);
        result.push({
          point: a.point.clone().lerp(a.point, b.point, t),
          local: a.local.clone().lerp(a.local, b.local, t),
          uv: a.uv.clone().lerp(a.uv, b.uv, t),
          color: a.color.map(/**
           *
           * @param {number} value
           * @param {number} channel
           */
            (value, channel) => value + (b.color[channel] - value) * t),
        });
      }
    }

    return result;
  }

  /**
   * @param {number} dt
   */
  update(dt) {
    this.age += Math.max(0, dt);
    if (this.age >= LIFETIME) {
      this.destroy();

      return;
    }
    if (this.age >= FALL_TIME) {
      for (let index = 0; index < this.pieces.length; index++) {
        const piece = this.pieces[index];
        let start = this.sinking.get(piece);
        if (!start) {
          start = piece.getPosition().clone();
          this.sinking.set(piece, start);
          // Ammo owns the short fall. The following bounded despawn motion is
          // purely visual: disabled bodies cannot push actors or jitter piles.
          piece.rigidbody.enabled = false;
          piece.collision.enabled = false;
        }
        const progress = Math.max(0, Math.min(1, (this.age - FALL_TIME - index % 3 * 0.025) / SINK_TIME));
        const drop = Math.max(0.7, start.y - this.floorY + 0.7);
        piece.setPosition(start.x, start.y - drop * progress * progress, start.z);
      }
    }
  }

  destroy() {
    for (const piece of this.pieces) {
      piece.destroy();
    }
    for (const mesh of this.meshes) {
      mesh.destroy();
    }
    this.pieces = [];
    this.meshes = [];
    this.sinking.clear();
  }
}
