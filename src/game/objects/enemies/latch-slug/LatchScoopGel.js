import { impactTriangles } from "./LatchImpactShape.js";

/**
 * A surface sample of the posed skin, never a replacement sphere. Ammo owns
 * actor contact; its rigid capsule cannot represent a viscous free surface.
 * This bounded visual peel follows that contact without integrating forces.
 */
export class LatchScoopGel {
  /**
   * @param {import("./LatchSlug.js").LatchSlug} owner
   * @param {import("../bell-bug/BellBug.js").BellBug} bug
   * @param {number} side
   */
  constructor(owner, bug, side) {
    this.owner = owner;
    this.bug = bug;
    this.side = side;
    this.active = false;
    this.body = null;
    this.piece = null;
    const { pc } = owner;
    const source = owner.getImpactMeshes().find(LatchScoopGel.#isBody);
    if (!source) {
      return;
    }
    this.source = source;
    this.wasVisible = source.visible;
    const inverse = owner.entity.getWorldTransform().clone().invert();
    const triangles = impactTriangles(pc, [source], inverse);
    const origin = bug.position.clone().add(bug.entity.right.clone().mulScalar(side ? -0.16 : 0.16));
    origin.y += 0.24;
    const aim = source.aabb.center.clone();
    aim.y = Math.max(source.aabb.center.y - source.aabb.halfExtents.y * 0.35, origin.y);
    const ray = new pc.Ray(inverse.transformPoint(origin), inverse.transformVector(aim.sub(origin)).normalize());
    const triangle = new pc.Tri();
    const point = new pc.Vec3();
    let nearest = Infinity;
    for (const vertices of triangles) {
      triangle.set(new pc.Vec3(...vertices.slice(0, 3)), new pc.Vec3(...vertices.slice(3, 6)), new pc.Vec3(...vertices.slice(6, 9)));
      if (triangle.intersectsRay(ray, point) && point.distance(ray.origin) < nearest) {
        nearest = point.distance(ray.origin);
        this.contact = point.clone();
        this.normal = new pc.Vec3().cross(triangle.v1.clone().sub(triangle.v0), triangle.v2.clone().sub(triangle.v0)).normalize();
        if (this.normal.dot(ray.direction) > 0) {
          this.normal.mulScalar(-1);
        }
      }
    }
    if (!this.contact) {
      return;
    }
    this.positions = new Float32Array(triangles.flat());
    this.indices = Array.from({ length: this.positions.length / 3 }, LatchScoopGel.#index);
    this.patch = LatchScoopGel.extractPatch(pc, this.positions, this.contact, this.normal);
    this.active = this.patch.positions.length > 0;
  }

  /**
   * @param {import("playcanvas").MeshInstance} instance
   * @returns {boolean}
   */
  static #isBody(instance) {
    return !/eye|tip/i.test(instance.material.name);
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
   * Cut an irregular, closed sliver from the contacted skin triangles.
   * @param {typeof import("playcanvas")} pc
   * @param {Float32Array} positions
   * @param {import("playcanvas").Vec3} contact
   * @param {import("playcanvas").Vec3} normal
   * @returns {{positions: Float32Array, indices: number[]}}
   */
  static extractPatch(pc, positions, contact, normal) {
    const vertices = [], indices = [], lookup = new Map(), edges = new Map();
    const point = new pc.Vec3(), center = new pc.Vec3();
    for (let at = 0; at < positions.length; at += 9) {
      center.set(0, 0, 0);
      for (let j = 0; j < 3; j++) {
        center.add(point.set(positions[at + j * 3], positions[at + j * 3 + 1], positions[at + j * 3 + 2]));
      }
      if (center.mulScalar(1 / 3).distance(contact) > 0.13) {
        continue;
      }
      const face = [];
      for (let j = 0; j < 3; j++) {
        point.set(positions[at + j * 3], positions[at + j * 3 + 1], positions[at + j * 3 + 2]);
        const key = `${point.x.toFixed(5)},${point.y.toFixed(5)},${point.z.toFixed(5)}`;
        if (!lookup.has(key)) {
          lookup.set(key, vertices.length / 3);
          vertices.push(point.x, point.y, point.z);
        }
        face.push(lookup.get(key));
      }
      indices.push(...face);
      for (let j = 0; j < 3; j++) {
        const a = face[j], b = face[(j + 1) % 3];
        const key = `${Math.min(a, b)},${Math.max(a, b)}`;
        if (edges.has(key)) {
          edges.delete(key);
        } else {
          edges.set(key, [a, b]);
        }
      }
    }
    const count = vertices.length / 3;
    for (let i = 0; i < count; i++) {
      point.set(vertices[i * 3], vertices[i * 3 + 1], vertices[i * 3 + 2]);
      point.lerp(point, contact, 0.15).sub(normal.clone().mulScalar(0.045));
      vertices.push(point.x, point.y, point.z);
    }
    const topCount = indices.length;
    for (let i = 0; i < topCount; i += 3) {
      indices.push(indices[i + 2] + count, indices[i + 1] + count, indices[i] + count);
    }
    for (const [a, b] of edges.values()) {
      indices.push(a, a + count, b, b, a + count, b + count);
    }

    return {
      positions: new Float32Array(vertices),
      indices,
    };
  }

  /**
   * @returns {import("playcanvas").Vec3}
   */
  get point() {
    const depth = LatchScoopGel.pressDepth(this.bug.scoop?.time ?? 0);
    const point = this.contact.clone().sub(this.normal.clone().mulScalar(depth));

    return this.owner.entity.getWorldTransform().transformPoint(point);
  }

  /**
   * @param {number} time
   * @returns {number}
   */
  static pressDepth(time) {
    return Math.sin(Math.min(1, Math.max(0, (time - 0.32) / 0.3)) * Math.PI) * 0.035;
  }

  /**
   * @param {Float32Array} positions
   * @param {number[]} indices
   * @returns {{entity: import("playcanvas").Entity, mesh: import("playcanvas").Mesh, instance: import("playcanvas").MeshInstance}}
   */
  #createMesh(positions, indices) {
    const { pc, app } = this.owner;
    const entity = new pc.Entity("Contact-driven slug gel", app);
    this.owner.entity.addChild(entity);
    const mesh = new pc.Mesh(app.graphicsDevice);
    mesh.setPositions(positions);
    mesh.setIndices(indices);
    mesh.setNormals(pc.calculateNormals(positions, indices));
    mesh.update();
    const instance = new pc.MeshInstance(mesh, this.source.material, entity);
    instance.cull = false;
    entity.addComponent("render", { meshInstances: [instance] });

    return {
      entity,
      mesh,
      instance,
    };
  }

  /**
   * A small indentation becomes an attached neck, then recoils after separation.
   * @param {number} time
   * @param {import("playcanvas").Vec3} foot World-space contact/tasting point.
   */
  pose(time, foot) {
    if (!this.active) {
      return;
    }
    this.body ??= this.#createMesh(this.positions, this.indices);
    if (time >= 0.78) {
      this.piece ??= this.#createMesh(this.patch.positions, this.patch.indices);
    }
    this.source.visible = false;
    const { pc } = this.owner;
    const inverse = this.owner.entity.getWorldTransform().clone().invert();
    const pull = time >= 0.45 ? inverse.transformPoint(foot).sub(this.contact) : new pc.Vec3();
    const press = time < 0.45 ? LatchScoopGel.pressDepth(time) : 0;
    const attached = time < 0.78 ? 1 : Math.exp(-(time - 0.78) * 18) * Math.cos((time - 0.78) * 24);
    const positions = new Float32Array(this.positions);
    const point = new pc.Vec3();
    for (let i = 0; i < positions.length; i += 3) {
      point.set(this.positions[i], this.positions[i + 1], this.positions[i + 2]);
      const weight = Math.exp(-((Math.max(0, point.distance(this.contact) - 0.16) / 0.1) ** 2) * 2);
      point.add(pull.clone().mulScalar(weight * attached)).sub(this.normal.clone().mulScalar(weight * press));
      positions.set([point.x, point.y, point.z], i);
    }
    this.body.mesh.setPositions(positions);
    this.body.mesh.setNormals(pc.calculateNormals(positions, this.indices));
    this.body.mesh.update();
    const piece = new Float32Array(this.patch.positions);
    const consume = Math.max(0.01, 1 - Math.max(0, time - 0.92) / 0.25);
    const stretch = 1 + Math.sin(Math.max(0, time - 0.45) * 13) * 0.2 * Math.exp(-Math.max(0, time - 0.45) * 2);
    for (let i = 0; i < piece.length; i += 3) {
      point.set(piece[i], piece[i + 1], piece[i + 2]).sub(this.contact);
      point.x *= consume / Math.sqrt(stretch);
      point.z *= consume / Math.sqrt(stretch);
      point.y *= consume * stretch;
      point.add(this.contact).add(pull);
      piece.set([point.x, point.y, point.z], i);
    }
    if (this.piece) {
      this.piece.entity.enabled = time >= 0.78 && time < 1.17;
      this.piece.mesh.setPositions(piece);
      this.piece.mesh.setNormals(pc.calculateNormals(piece, this.patch.indices));
      this.piece.mesh.update();
    }
    for (const target of [this.body.instance, this.piece?.instance].filter(Boolean)) {
      for (const [name, parameter] of Object.entries(this.source.parameters)) {
        target.setParameter(name, parameter.data);
      }
    }
  }

  destroy() {
    if (!this.active && !this.body && !this.piece) {
      return;
    }
    this.active = false;
    if (this.source) {
      this.source.visible = this.wasVisible;
    }
    for (const render of [this.body, this.piece]) {
      render?.entity.destroy();
      render?.mesh.destroy();
    }
    this.body = null;
    this.piece = null;
  }
}
