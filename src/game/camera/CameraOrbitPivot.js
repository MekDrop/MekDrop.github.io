/** Finds a stable orbit focus on the scene beneath the viewport center. */
export class CameraOrbitPivot {
  #pc;

  constructor(pc) {
    this.#pc = pc;
  }

  find(camera, root, mapData, width, height) {
    const pc = this.#pc;
    const start = camera.screenToWorld(width / 2, height / 2, camera.nearClip);
    const end = camera.screenToWorld(width / 2, height / 2, camera.farClip);
    const direction = end.clone().sub(start).normalize();
    const ray = new pc.Ray(start, direction);
    let distance = Infinity;
    const hit = new pc.Vec3();

    for (const render of root.findComponents("render")) {
      if (!render.enabled || !render.entity.enabled) {
        continue;
      }
      for (const instance of render.meshInstances) {
        if (
          !instance.visible || instance.pick === false || instance.instancingData ||
          instance.material.blendType !== pc.BLEND_NONE ||
          !instance.aabb.intersectsRay(ray, hit)
        ) {
          continue;
        }
        if (instance.skinInstance) {
          distance = Math.min(distance, hit.distance(start));
          continue;
        }
        const positions = [];
        const indices = [];
        instance.mesh.getPositions(positions);
        instance.mesh.getIndices(indices);
        const inverse = instance.node.getWorldTransform().clone().invert();
        const localStart = inverse.transformPoint(start);
        // Keep the transformed direction unnormalized: t stays in world units.
        const localDirection = inverse.transformVector(direction);
        const a = new pc.Vec3();
        const b = new pc.Vec3();
        const c = new pc.Vec3();
        for (let i = 0; i < indices.length; i += 3) {
          for (const [vertex, index] of [[a, indices[i]], [b, indices[i + 1]], [c, indices[i + 2]]]) {
            vertex.set(positions[index * 3], positions[index * 3 + 1], positions[index * 3 + 2]);
          }
          distance = Math.min(distance, this.#triangleDistance(localStart, localDirection, a, b, c));
        }
      }
    }

    // Terrain is instanced, so test its occupied tile volumes separately.
    const { heightmap, cols, rows } = mapData;
    const inverseRoot = root.getWorldTransform().clone().invert();
    const localRay = new pc.Ray(inverseRoot.transformPoint(start), inverseRoot.transformVector(direction));
    const box = new pc.BoundingBox();
    for (let row = 0; row < rows; row += 1) {
      for (let col = 0; col < cols; col += 1) {
        const elevation = heightmap[row][col];
        if (elevation <= 0) {
          continue;
        }
        box.center.set(col - (cols - 1) / 2, elevation / 2, row - (rows - 1) / 2);
        box.halfExtents.set(0.5, elevation / 2, 0.5);
        if (box.intersectsRay(localRay, hit)) {
          root.getWorldTransform().transformPoint(hit, hit);
          distance = Math.min(distance, hit.distance(start));
        }
      }
    }
    if (!Number.isFinite(distance)) {
      return null;
    }
    return inverseRoot.transformPoint(start.add(direction.mulScalar(distance)));
  }

  #triangleDistance(origin, direction, a, b, c) {
    const edge1 = b.clone().sub(a);
    const edge2 = c.clone().sub(a);
    const cross = new this.#pc.Vec3().cross(direction, edge2);
    const determinant = edge1.dot(cross);
    if (Math.abs(determinant) < 0.0000001) {
      return Infinity;
    }
    const offset = origin.clone().sub(a);
    const u = offset.dot(cross) / determinant;
    if (u < 0 || u > 1) {
      return Infinity;
    }
    const q = new this.#pc.Vec3().cross(offset, edge1);
    const v = direction.dot(q) / determinant;
    if (v < 0 || u + v > 1) {
      return Infinity;
    }
    const distance = edge2.dot(q) / determinant;
    return distance > 0 ? distance : Infinity;
  }
}
