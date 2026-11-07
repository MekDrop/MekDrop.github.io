const GROOVE_RADIUS = 0.021;
const GROOVE_DEPTH = 0.008;
const MAX_GROOVE_DEPTH = 0.065;
const MAX_STROKES = 32;
const MAX_VERTICES = 60000;
const DETAIL_EDGE = 0.025;

/**
 * Contact-driven removal of the real wooden leaf surface. Ammo owns blocking
 * and swing contacts; its structural plank hull intentionally omits shallow
 * cosmetic cavities. No overlay hides intact wood beneath these grooves.
 */
export class DoorScratchSurface {
  /**
   * @param {import("./Door.js").Door} door
   * @param {typeof import("playcanvas")} pc
   */
  constructor(door, pc) {
    this.door = door;
    this.pc = pc;
    this.records = new Map();
    this.strokeCount = 0;
  }

  /**
   * @returns {{surfaces:number,strokes:number,maximumDepth:number,vertices:number}}
   */
  get metrics() {
    let maximumDepth = 0, vertices = 0;
    for (const record of this.records.values()) {
      maximumDepth = Math.max(maximumDepth, record.maximumDepth ?? 0);
      vertices += record.mesh.vertexBuffer?.numVertices ?? 0;
    }

    return {
      surfaces: this.records.size,
      strokes: this.strokeCount,
      maximumDepth,
      vertices,
    };
  }

  /**
   * @param {import("playcanvas").MeshInstance} instance
   * @returns {boolean}
   */
  static isWood(instance) {
    const material = instance.material?.name ?? "";
    if (/iron|metal|steel|brass|bronze|stone|masonry/i.test(material)) {
      return false;
    }

    return /wood|oak|timber|plank/i.test(`${material} ${instance.node?.name ?? ""}`);
  }

  /**
   * @param {import("playcanvas").Vec3} point
   * @param {import("playcanvas").Vec3} start
   * @param {import("playcanvas").Vec3} end
   * @returns {number}
   */
  static distanceToStroke(point, start, end) {
    const delta = end.clone().sub(start);
    const length = delta.lengthSq();
    const t = length > 1e-12 ? Math.max(0, Math.min(1, point.clone().sub(start).dot(delta) / length)) : 0;

    return point.distance(start.clone().add(delta.mulScalar(t)));
  }

  /**
   * @param {import("playcanvas").MeshInstance} instance
   * @param {import("playcanvas").Vec3} point
   * @param {import("playcanvas").Vec3} origin
   * @param {boolean} authored
   * @param {number} range
   * @returns {{point:import("playcanvas").Vec3,normal:import("playcanvas").Vec3}|null}
   */
  #contact(instance, point, origin, authored = true, range = 0.09) {
    const { pc } = this;
    const direction = point.clone().sub(origin).normalize();
    const start = point.clone().sub(direction.clone().mulScalar(range));
    const ray = new pc.Ray(start, direction);
    const boundsPoint = new pc.Vec3();
    if (instance.aabb && (!instance.aabb.intersectsRay(ray, boundsPoint) || boundsPoint.distance(start) > range * 2)) {
      return null;
    }
    const positions = [], indices = [];
    // Damage accumulates from the authored surface; toe picking explicitly
    // selects the current recessed geometry instead.
    const mesh = authored ? this.records.get(instance)?.source ?? instance.mesh : instance.mesh;
    mesh.getPositions(positions);
    mesh.getIndices(indices);
    const transform = instance.node.getWorldTransform();
    const triangle = new pc.Tri(), hit = new pc.Vec3();
    let nearest = range * 2, result = null;
    for (let i = 0; i < indices.length; i += 3) {
      const a = indices[i] * 3, b = indices[i + 1] * 3, c = indices[i + 2] * 3;
      triangle.set(
        transform.transformPoint(new pc.Vec3(positions[a], positions[a + 1], positions[a + 2])),
        transform.transformPoint(new pc.Vec3(positions[b], positions[b + 1], positions[b + 2])),
        transform.transformPoint(new pc.Vec3(positions[c], positions[c + 1], positions[c + 2])),
      );
      if (triangle.intersectsRay(ray, hit) && hit.distance(start) <= nearest) {
        nearest = hit.distance(start);
        const normal = new pc.Vec3().cross(triangle.v1.clone().sub(triangle.v0), triangle.v2.clone().sub(triangle.v0)).normalize();
        if (normal.dot(direction) > 0) {
          normal.mulScalar(-1);
        }
        result = {
          point: hit.clone(),
          normal,
        };
      }
    }

    return result;
  }

  /**
   * Read the current wood surface without carving or allocating a render mesh.
   * Metal and handles in front of wood are occluders, not valid claw targets.
   * @param {import("playcanvas").Vec3} aim
   * @param {import("playcanvas").Vec3} origin
   * @returns {import("playcanvas").Vec3|null}
   */
  point(aim, origin) {
    let nearest = Infinity, result = null, wood = false;
    for (const instance of this.door.getSurfaceMeshInstances()) {
      const contact = this.#contact(instance, aim, origin, false, 0.18);
      if (!contact) {
        continue;
      }
      const distance = origin.distance(contact.point);
      if (distance < nearest) {
        nearest = distance;
        result = contact.point;
        wood = DoorScratchSurface.isWood(instance);
      }
    }

    return wood ? result : null;
  }

  /**
   * @param {import("playcanvas").MeshInstance} instance
   * @returns {import("./DoorScratchTypes.js").DoorScratchRecord}
   */
  #record(instance) {
    const existing = this.records.get(instance);
    if (existing) {
      return existing;
    }
    const positions = [], indices = [], uvs = [];
    instance.mesh.getPositions(positions);
    instance.mesh.getIndices(indices);
    instance.mesh.getUvs(0, uvs);
    const mesh = new this.pc.Mesh(instance.mesh.device);
    mesh.clear(true, false);
    const material = instance.material;
    const ownedMaterial = material.clone?.() ?? null;
    if (ownedMaterial) {
      ownedMaterial.diffuseVertexColor = true;
      ownedMaterial.update();
      instance.material = ownedMaterial;
    }
    const record = {
      instance,
      originalInstance: instance,
      render: null,
      source: instance.mesh,
      mesh,
      positions,
      indices,
      uvs,
      material,
      ownedMaterial,
      strokes: [],
    };
    // A damaged leaf owns mutable geometry. Removing only its render membership
    // lets the normal batcher regenerate, keeping the same animated hierarchy.
    const render = instance.node.render;
    if (render) {
      render.batchGroupId = -1;
    }
    instance.node.tags?.add("batch-ignore");
    this.records.set(instance, record);

    return record;
  }

  /**
   * @param {import("playcanvas").Vec3} start
   * @param {import("playcanvas").Vec3} end
   * @param {import("playcanvas").Vec3} origin
   * @param {{width?:number,damageRatio?:number}} options
   * @returns {number} Number of actual wooden surface instances cut.
   */
  scratch(start, end, origin, options = {}) {
    if (!this.pc || start.distance(end) < 0.005 || start.distance(end) > 0.65) {
      return 0;
    }
    const middle = start.clone().lerp(start, end, 0.5);
    const ratio = Math.max(0, Math.min(1, Number.isFinite(options.damageRatio) ? options.damageRatio : 0));
    const explicit = options.width !== undefined || options.damageRatio !== undefined;
    const width = Math.max(0.018, Math.min(0.14, Number.isFinite(options.width) ? options.width : GROOVE_RADIUS * 2));
    let cuts = 0;
    for (const instance of this.door.getSurfaceMeshInstances()) {
      if (!DoorScratchSurface.isWood(instance)) {
        continue;
      }
      const contact = this.#contact(instance, start, origin) ?? this.#contact(instance, middle, origin) ?? this.#contact(instance, end, origin);
      if (!contact) {
        continue;
      }
      const record = this.#record(instance);
      if (record.strokes.length >= MAX_STROKES) {
        continue;
      }
      const inverse = instance.node.getWorldTransform().clone().invert();
      const projectedStart = start.clone().sub(contact.normal.clone().mulScalar(start.clone().sub(contact.point).dot(contact.normal)));
      const projectedEnd = end.clone().sub(contact.normal.clone().mulScalar(end.clone().sub(contact.point).dot(contact.normal)));
      record.strokes.push({
        start: inverse.transformPoint(projectedStart),
        end: inverse.transformPoint(projectedEnd),
        inward: inverse.transformVector(contact.normal.clone().mulScalar(-1)),
        radius: explicit ? width * 0.5 * (1 + ratio * 0.45) : GROOVE_RADIUS,
        depth: explicit ? 0.022 + ratio * 0.038 : GROOVE_DEPTH,
        directional: explicit,
      });
      this.#rebuild(record);
      cuts++;
    }
    if (cuts > 0) {
      this.strokeCount++;
    }

    return cuts;
  }

  /**
   * @param {import("./DoorScratchTypes.js").DoorScratchRecord} record
   */
  #rebuild(record) {
    const { pc } = this;
    const transform = record.instance.node.getWorldTransform();
    const strokes = record.strokes.map(/**
     * @param {import("./DoorScratchTypes.js").DoorScratchStroke} stroke
     */
      stroke => ({
        start: transform.transformPoint(stroke.start),
        end: transform.transformPoint(stroke.end),
        inward: transform.transformVector(stroke.inward).normalize(),
        radius: stroke.radius,
        depth: stroke.depth,
        directional: stroke.directional,
      }));
    const positions = [], uvs = [], indices = [], colors = [];
    record.maximumDepth = 0;
    /**
     * @param {import("./DoorScratchTypes.js").DoorScratchVertex[]} triangle
     * @param {number} depth
     */
    const append = (triangle, depth = 0) => {
      const world = triangle.map(/**
       *
       * @param {import("./DoorScratchTypes.js").DoorScratchVertex} vertex
       */
        vertex => transform.transformPoint(vertex.point));
      const center = world[0].clone().add(world[1]).add(world[2]).mulScalar(1 / 3);
      const radius = Math.max(center.distance(world[0]), center.distance(world[1]), center.distance(world[2]));
      const near = strokes.some(/**
       *
       * @param {import("./DoorScratchTypes.js").DoorScratchStroke} stroke
       */
        stroke => DoorScratchSurface.distanceToStroke(center, stroke.start, stroke.end) <= radius + stroke.radius);
      const lengths = [world[0].distance(world[1]), world[1].distance(world[2]), world[2].distance(world[0])];
      const edge = lengths.indexOf(Math.max(...lengths));
      if (near && lengths[edge] > DETAIL_EDGE && depth < 14 && positions.length / 3 < MAX_VERTICES - 6) {
        const a = triangle[edge], b = triangle[(edge + 1) % 3], c = triangle[(edge + 2) % 3];
        const middle = {
          point: a.point.clone().lerp(a.point, b.point, 0.5),
          uv: a.uv.clone().lerp(a.uv, b.uv, 0.5),
        };
        append([a, middle, c], depth + 1);
        append([middle, b, c], depth + 1);

        return;
      }
      for (const vertex of triangle) {
        const worldPoint = transform.transformPoint(vertex.point);
        const displacement = new pc.Vec3();
        let totalDepth = 0;
        for (let index = 0; index < strokes.length; index++) {
          const stroke = strokes[index];
          const separation = Math.abs(worldPoint.clone().sub(stroke.start).dot(stroke.inward));
          if (separation > 0.025) {
            continue;
          }
          const distance = DoorScratchSurface.distanceToStroke(worldPoint, stroke.start, stroke.end);
          const delta = stroke.end.clone().sub(stroke.start);
          const progress = Math.max(0, Math.min(1, worldPoint.clone().sub(stroke.start).dot(delta) / Math.max(1e-9, delta.lengthSq())));
          // The claw bites progressively: a narrow entry opens into the deeper
          // trailing gouge, preserving the direction of the actual swipe.
          const taper = stroke.directional ? 0.65 + progress * 0.35 : 1;
          const depth = Math.min(MAX_GROOVE_DEPTH - totalDepth, stroke.depth * taper * Math.max(0, 1 - distance / (stroke.radius * taper)) ** 1.2);
          displacement.add(record.strokes[index].inward.clone().mulScalar(depth));
          totalDepth += depth;
        }
        const point = vertex.point.clone().add(displacement);
        record.maximumDepth = Math.max(record.maximumDepth, totalDepth);
        indices.push(positions.length / 3);
        positions.push(point.x, point.y, point.z);
        uvs.push(vertex.uv.x, vertex.uv.y);
        // Exposed recesses absorb light independently of the original timber
        // texture. White intact vertices preserve the authored surface.
        const exposure = Math.min(1, totalDepth / 0.018);
        colors.push(1 - exposure * 0.67, 1 - exposure * 0.72, 1 - exposure * 0.77, 1);
      }
    };
    for (let i = 0; i < record.indices.length; i += 3) {
      const triangle = [];
      for (let j = 0; j < 3; j++) {
        const index = record.indices[i + j];
        triangle.push({
          point: new pc.Vec3(record.positions[index * 3], record.positions[index * 3 + 1], record.positions[index * 3 + 2]),
          uv: new pc.Vec2(record.uvs[index * 2] ?? 0, record.uvs[index * 2 + 1] ?? 0),
        });
      }
      append(triangle);
    }
    record.mesh.setPositions(positions);
    record.mesh.setNormals(pc.calculateNormals(positions, indices));
    record.mesh.setUvs(0, uvs);
    record.mesh.setColors(colors);
    record.mesh.setIndices(indices);
    record.mesh.update();
    if (record.instance === record.originalInstance && record.instance instanceof pc.MeshInstance) {
      const original = record.originalInstance;
      const renders = [original.node.render, ...(this.door.entity?.findComponents("render") ?? [])];
      const render = renders.find(/**
       *
       * @param {import("playcanvas").RenderComponent|undefined} component
       */
        component => component?.meshInstances?.includes(original));
      if (render) {
        const replacement = new pc.MeshInstance(record.mesh, record.ownedMaterial ?? record.material, original.node);
        for (const property of ["visible", "castShadow", "receiveShadow", "cull", "pick", "mask", "drawOrder", "renderStyle", "screenSpace"]) {
          replacement[property] = original[property];
        }
        render.removeFromLayers();
        render.meshInstances.splice(render.meshInstances.indexOf(original), 1, replacement);
        render.addToLayers();
        this.records.delete(original);
        this.records.set(replacement, record);
        record.instance = replacement;
        record.render = render;
        original.material = record.material;
      } else {
        record.instance.mesh = record.mesh;
      }
    } else {
      record.instance.mesh = record.mesh;
    }
  }

  destroy() {
    for (const record of this.records.values()) {
      if (record.render) {
        const replacement = record.instance;
        record.render.removeFromLayers();
        const index = record.render.meshInstances.indexOf(replacement);
        if (index >= 0) {
          record.render.meshInstances.splice(index, 1, record.originalInstance);
        }
        record.render.addToLayers();
        replacement.mesh = null;
        replacement.destroy();
      } else {
        record.instance.mesh = record.source;
        record.instance.material = record.material;
      }
      record.mesh.destroy();
      record.ownedMaterial?.destroy();
    }
    this.records.clear();
  }
}
