/**
 * Signed closed-surface volume, used only to preserve visible gel volume.
 * @param {ArrayLike<number>} positions
 * @param {ArrayLike<number>} indices
 * @returns {number}
 */
export function gelVolume(positions, indices) {
  let result = 0;
  for (let i = 0; i < indices.length; i += 3) {
    const a = indices[i] * 3, b = indices[i + 1] * 3, c = indices[i + 2] * 3;
    result += positions[a] * (positions[b + 1] * positions[c + 2] - positions[b + 2] * positions[c + 1]) +
      positions[a + 1] * (positions[b + 2] * positions[c] - positions[b] * positions[c + 2]) +
      positions[a + 2] * (positions[b] * positions[c + 1] - positions[b + 1] * positions[c]);
  }

  return result / 6;
}

/**
 * Snapshot the actual skinned pose, in the impact frame. The transition starts
 * here, rather than spawning a flattened replacement at the wall.
 * @param {typeof import("playcanvas")} pc
 * @param {import("playcanvas").MeshInstance[]} instances
 * @param {import("playcanvas").Mat4} inverse
 * @returns {number[][]}
 */
export function impactTriangles(pc, instances, inverse) {
  const triangles = [], point = new pc.Vec3(), transformed = new pc.Vec3();
  for (const instance of instances) {
    const positions = [], indices = [], joints = [], weights = [];
    instance.mesh.getPositions(positions);
    instance.mesh.getIndices(indices);
    instance.mesh.getVertexStream(pc.SEMANTIC_BLENDINDICES, joints);
    instance.mesh.getVertexStream(pc.SEMANTIC_BLENDWEIGHT, weights);
    const transform = new pc.Mat4().mul2(inverse, instance.node.getWorldTransform());
    const posed = new Float32Array(positions.length);
    for (let i = 0; i < positions.length / 3; i++) {
      point.set(positions[i * 3], positions[i * 3 + 1], positions[i * 3 + 2]);
      if (instance.skinInstance && weights.length) {
        transformed.set(0, 0, 0);
        for (let j = 0; j < 4; j++) {
          const weight = weights[i * 4 + j];
          if (!weight) {
            continue;
          }
          const m = instance.skinInstance.matrices[joints[i * 4 + j]].data;
          transformed.x += weight * (m[0] * point.x + m[4] * point.y + m[8] * point.z + m[12]);
          transformed.y += weight * (m[1] * point.x + m[5] * point.y + m[9] * point.z + m[13]);
          transformed.z += weight * (m[2] * point.x + m[6] * point.y + m[10] * point.z + m[14]);
        }
        point.copy(transformed);
      }
      transform.transformPoint(point, point);
      posed.set([point.x, point.y, point.z], i * 3);
    }
    for (let i = 0; i < indices.length; i += 3) {
      const triangle = [];
      for (let j = 0; j < 3; j++) {
        const at = indices[i + j] * 3;
        triangle.push(posed[at], posed[at + 1], posed[at + 2]);
      }
      triangles.push(triangle);
    }
  }

  return triangles;
}

/**
 * Ray/triangle distance. Both faces count when resampling a closed translucent
 * body. All coordinates use the same impact frame.
 * @param {number[]} origin
 * @param {number[]} direction
 * @param {number[]} triangle
 * @returns {number}
 */
function intersect(origin, direction, triangle) {
  const ax = triangle[0], ay = triangle[1], az = triangle[2];
  const e1x = triangle[3] - ax, e1y = triangle[4] - ay, e1z = triangle[5] - az;
  const e2x = triangle[6] - ax, e2y = triangle[7] - ay, e2z = triangle[8] - az;
  const px = direction[1] * e2z - direction[2] * e2y;
  const py = direction[2] * e2x - direction[0] * e2z;
  const pz = direction[0] * e2y - direction[1] * e2x;
  const determinant = e1x * px + e1y * py + e1z * pz;
  if (Math.abs(determinant) < 1e-9) {
    return 0;
  }
  const tx = origin[0] - ax, ty = origin[1] - ay, tz = origin[2] - az;
  const u = (tx * px + ty * py + tz * pz) / determinant;
  if (u < 0 || u > 1) {
    return 0;
  }
  const qx = ty * e1z - tz * e1y, qy = tz * e1x - tx * e1z, qz = tx * e1y - ty * e1x;
  const v = (direction[0] * qx + direction[1] * qy + direction[2] * qz) / determinant;
  if (v < 0 || u + v > 1) {
    return 0;
  }
  return Math.max(0, (e2x * qx + e2y * qy + e2z * qz) / determinant);
}

/**
 * Resample the real posed body onto the continuous splat topology. This keeps
 * the body silhouette and world position while allowing one connected mesh to
 * flatten and spread; it is not a sphere/primitive substituted on impact.
 * @param {ArrayLike<number>} target Positions in outward-facing impact space.
 * @param {number[][]} triangles Posed body triangles in the same space.
 * @returns {Float32Array}
 */
export function bodyToGel(target, triangles) {
  const result = new Float32Array(target.length);
  if (!triangles.length) {
    return result;
  }
  const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
  for (const triangle of triangles) {
    for (let i = 0; i < 9; i++) {
      min[i % 3] = Math.min(min[i % 3], triangle[i]);
      max[i % 3] = Math.max(max[i % 3], triangle[i]);
    }
  }
  const center = [], half = [];
  for (let i = 0; i < 3; i++) {
    center[i] = (min[i] + max[i]) / 2;
    half[i] = Math.max(0.025, (max[i] - min[i]) / 2);
  }
  let width = 0, height = 0;
  for (let i = 0; i < target.length; i += 3) {
    width = Math.max(width, Math.abs(target[i]));
    height = Math.max(height, Math.abs(target[i + 1]));
  }
  const frontCount = target.length / 6;
  const cache = new Map();
  for (let i = 0; i < target.length; i += 3) {
    const x = target[i] / Math.max(0.01, width), y = target[i + 1] / Math.max(0.01, height);
    const radius = Math.hypot(x, y), radial = Math.min(1, radius);
    const angle = Math.atan2(y, x);
    const side = i / 3 < frontCount ? 1 : -1;
    const phi = Math.acos(side * Math.sqrt(Math.max(0, 1 - radial * radial)));
    const azimuth = (angle / (2 * Math.PI) + 1) % 1 * 32;
    const latitude = phi / Math.PI * 20;
    const ax = Math.floor(azimuth), ay = Math.min(19, Math.floor(latitude));
    const fx = azimuth - ax, fy = latitude - ay;
    let factor = 0;
    // Resample a small smooth radial field instead of raycasting every
    // authored vertex. The posed body remains the source, at a bounded cost.
    for (let row = 0; row < 2; row++) {
      for (let column = 0; column < 2; column++) {
        const u = (ax + column) % 32, v = ay + row, key = v * 32 + u;
        let distance = cache.get(key);
        if (distance === undefined) {
          const theta = u / 32 * Math.PI * 2, latitudeAngle = v / 20 * Math.PI;
          const direction = [Math.cos(theta) * Math.sin(latitudeAngle) * half[0], Math.sin(theta) * Math.sin(latitudeAngle) * half[1], Math.cos(latitudeAngle) * half[2]];
          const length = Math.hypot(...direction) || 1;
          for (let axis = 0; axis < 3; axis++) {
            direction[axis] /= length;
          }
          distance = 0;
          for (const triangle of triangles) {
            distance = Math.max(distance, intersect(center, direction, triangle));
          }
          distance = (distance || 0.03) / length;
          cache.set(key, distance);
        }
        factor += distance * (column ? fx : 1 - fx) * (row ? fy : 1 - fy);
      }
    }
    result[i] = center[0] + Math.cos(angle) * radial * half[0] * factor;
    result[i + 1] = center[1] + Math.sin(angle) * radial * half[1] * factor;
    result[i + 2] = center[2] + side * Math.sqrt(Math.max(0, 1 - radial * radial)) * half[2] * factor;
  }

  return result;
}
