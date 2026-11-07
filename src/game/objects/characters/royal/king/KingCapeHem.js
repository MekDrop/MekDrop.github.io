/**
 * @typedef {{a:number,b:number,amount:number,sign:number,lift:number}} HemAttachment
 * @typedef {{tangent:import("playcanvas").Vec3,bitangent:import("playcanvas").Vec3,normal:import("playcanvas").Vec3}} HemFrame
 */

/**
 * @param {typeof import("playcanvas")} pc
 * @param {Array<*>} bindings
 * @param {function(HemAttachment):{point:import("playcanvas").Vec3,frame:HemFrame}} sampleHem
 * @returns {number}
 */
export function measureKingHemExterior(pc, bindings, sampleHem) {
  let minimum = Infinity;
  for (const binding of bindings) {
    if (!binding.trimEdges) {
      continue;
    }
    for (let vertex = 0; vertex < binding.trimEdges.length; vertex++) {
      const edge = binding.trimEdges[vertex];
      if (edge) {
        const sample = sampleHem(edge);
        const actual = binding.instance.node.getWorldTransform().transformPoint(
          new pc.Vec3(...binding.positions.slice(vertex * 3, vertex * 3 + 3)));
        minimum = Math.min(minimum, actual.sub(sample.point).dot(sample.frame.normal));
      }
    }
  }

  return minimum;
}

/**
 * The thick fur seam resists folding more than the fabric above it.
 * These are Bullet distance constraints using the authored rest geometry.
 * @param {import("sync-ammo/dist/ammo").btSoftBody} body
 * @param {number[]} triangles
 * @param {import("playcanvas").Vec3[]} points
 */
export function reinforceKingHem(body, triangles, points) {
  const heights = points.map(/**
   *
   * @param {import("playcanvas").Vec3} point
   */
    point => point.y);
  const bottom = Math.min(...heights);
  const limit = bottom + (Math.max(...heights) - bottom) * 0.2;
  const neighbors = points.map(() => new Set());
  for (let face = 0; face < triangles.length; face += 3) {
    for (const a of triangles.slice(face, face + 3)) {
      for (const b of triangles.slice(face, face + 3)) {
        if (a !== b) {
          neighbors[a].add(b);
        }
      }
    }
  }
  const material = body.appendMaterial();
  material.set_m_kLST(0.85);
  material.set_m_kAST(0.85);
  const added = new Set();
  for (let a = 0; a < points.length; a++) {
    if (heights[a] > limit) {
      continue;
    }
    for (const middle of neighbors[a]) {
      for (const b of neighbors[middle]) {
        const key = `${Math.min(a, b)}:${Math.max(a, b)}`;
        if (a !== b && heights[b] <= limit && !neighbors[a].has(b) && !added.has(key)) {
          body.appendLink(a, b, material, true);
          added.add(key);
        }
      }
    }
  }
}

/**
 * @param {number[]} triangles
 * @param {number[]} heights
 * @returns {Array<[number,number]>}
 */
export function findKingHemEdges(triangles, heights) {
  const counts = new Map(), result = [];
  for (let face = 0; face < triangles.length; face += 3) {
    for (let side = 0; side < 3; side++) {
      const a = triangles[face + side], b = triangles[face + (side + 1) % 3];
      const key = a < b ? `${a}:${b}` : `${b}:${a}`;
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
  }
  const limit = Math.min(...heights) + (Math.max(...heights) - Math.min(...heights)) * 0.025;
  for (const [key, count] of counts) {
    const [a, b] = key.split(":").map(Number);
    if (count === 1 && Math.max(heights[a], heights[b]) < limit) {
      result.push([a, b]);
    }
  }

  return result;
}

/**
 * Sample the live lower edge with an outward-facing frame.
 * @param {{pc:typeof import("playcanvas"),edge:HemAttachment,points:import("playcanvas").Vec3[],frames:HemFrame[],root:import("playcanvas").Vec3,upright?:boolean,bodyCenter?:import("playcanvas").Vec3}} options
 * @returns {{point:import("playcanvas").Vec3,frame:HemFrame}}
 */
export function sampleKingHemAttachment({ pc, edge, points, frames, root, upright = false, bodyCenter = root }) {
  const first = edge.a;
  const second = edge.b;
  const a = points[first], b = points[second];
  const point = new pc.Vec3().lerp(a, b, edge.amount);
  const tangent = b.clone().sub(a).normalize();
  const normal = new pc.Vec3().lerp(frames[first].normal,
    frames[second].normal, edge.amount).mulScalar(edge.sign);
  const outward = point.clone().sub(bodyCenter);
  outward.y = 0;
  if (upright && outward.lengthSq() > 0.000001) {
    normal.cross(new pc.Vec3(0, 1, 0), tangent);
    if (normal.lengthSq() < 0.000001) {
      normal.copy(outward);
    }
    normal.normalize();
  }
  normal.addScaled(tangent, -normal.dot(tangent)).normalize();
  if (normal.dot(outward) < -0.0001) {
    normal.mulScalar(-1);
  }
  const bitangent = new pc.Vec3().cross(normal, tangent).normalize();

  return {
    point,
    frame: {
      tangent,
      bitangent,
      normal,
    },
  };
}

/**
 * Project a trim component onto the lower boundary rather than an interior node.
 * @param {{pc:typeof import("playcanvas"),center:import("playcanvas").Vec3,scale:number,points:import("playcanvas").Vec3[],edges:Array<[number,number]>,frames:HemFrame[],root:import("playcanvas").Vec3}} options
 * @returns {HemAttachment|null}
 */
export function findKingHemAttachment({ center, scale, points, edges, frames, root }) {
  let best = null, distance = 0.1 * scale;
  for (const [first, second] of edges) {
    const a = points[first].clone();
    const delta = points[second].clone().sub(a);
    const amount = Math.max(0, Math.min(1, center.clone().sub(a).dot(delta) / Math.max(0.000001, delta.lengthSq())));
    const point = a.addScaled(delta, amount);
    const separation = center.distance(point);
    if (separation < distance) {
      const normal = frames[first].normal.clone().add(frames[second].normal);
      const outward = point.clone().sub(root);
      outward.y = 0;
      best = {
        a: first,
        b: second,
        amount,
        sign: normal.dot(outward) < 0 ? -1 : 1,
        lift: 0,
      };
      distance = separation;
    }
  }

  return best;
}
