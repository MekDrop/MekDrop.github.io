const TETRAHEDRA = [[0, 5, 1, 6], [0, 1, 2, 6], [0, 2, 3, 6], [0, 3, 7, 6], [0, 7, 4, 6], [0, 4, 5, 6]];

/**
 * Measure an outward-wound closed triangle mesh, relative to a nearby origin
 * to avoid cancellation when a bridge is far from the world origin.
 * @param {number[]} positions
 * @param {number[]} indices
 * @returns {number}
 */
export function bridgeSlimeImplicitVolume(positions, indices) {
  const origin = positions.slice(0, 3);
  let volume = 0;
  for (let i = 0; i < indices.length; i += 3) {
    const a = indices[i] * 3;
    const b = indices[i + 1] * 3;
    const c = indices[i + 2] * 3;
    const ax = positions[a] - origin[0], ay = positions[a + 1] - origin[1], az = positions[a + 2] - origin[2];
    const bx = positions[b] - origin[0], by = positions[b + 1] - origin[1], bz = positions[b + 2] - origin[2];
    const cx = positions[c] - origin[0], cy = positions[c + 1] - origin[1], cz = positions[c + 2] - origin[2];
    volume += ax * (by * cz - bz * cy) + ay * (bz * cx - bx * cz) + az * (bx * cy - by * cx);
  }

  return Math.abs(volume / 6);
}

/**
 * Extract a summed Gaussian liquid field with shared marching-tetrahedra edges.
 * Isovalue fitting preserves lobe centres; a final small uniform correction
 * removes discretization error. Lobes must overlap to describe one component.
 * Warm starts bound animated updates to a few extractions. Their final uniform
 * correction still conserves volume; callers can inspect correctionScale.
 * Lobe weights default to one; low-weight connectors carry a thin wet neck
 * while higher-weight lobes concentrate the same requested conserved volume.
 * @param {{lobes: Array<{center: number[], radii: number[], weight?:number}>, volume: number, spacing?: number, maxCells?: number, origin?: number[], initialIsovalue?: number, maxFits?: number, smoothPasses?:number}} options
 * @returns {{positions:number[], normals:number[], indices:number[], volume:number, cellCount:number, spacing:number, isovalue:number, fits:number, correctionScale:number}}
 */
export function bridgeSlimeImplicitSurface({ lobes, volume, spacing = 0.14, maxCells = 50000, origin = lobes[0]?.center ?? [0, 0, 0], initialIsovalue, maxFits = 14, smoothPasses = 0 }) {
  const empty = {
    positions: [],
    normals: [],
    indices: [],
    volume: 0,
    cellCount: 0,
    spacing,
    isovalue: 0,
    fits: 0,
    correctionScale: 1,
  };
  if (!(volume > 0) || !lobes.length) {
    return empty;
  }
  if (!Number.isFinite(volume) || !Number.isFinite(spacing) || spacing <= 0 || !Number.isFinite(maxCells)) {
    throw new RangeError("Liquid volume, grid spacing and cell budget must be finite and positive");
  }
  const low = [Infinity, Infinity, Infinity];
  const high = [-Infinity, -Infinity, -Infinity];
  const padding = spacing * 2;
  for (const lobe of lobes) {
    if (!Number.isFinite(lobe.weight ?? 1) || (lobe.weight ?? 1) < 0) {
      throw new RangeError("Liquid lobe weights must be finite and nonnegative");
    }
    for (let axis = 0; axis < 3; axis++) {
      if (!(lobe.radii[axis] > 0) || !Number.isFinite(lobe.radii[axis]) || !Number.isFinite(lobe.center[axis])) {
        throw new RangeError("Liquid lobes require finite centres and positive radii");
      }
      low[axis] = Math.min(low[axis], lobe.center[axis] - lobe.radii[axis] * 2.5 - padding);
      high[axis] = Math.max(high[axis], lobe.center[axis] + lobe.radii[axis] * 2.5 + padding);
    }
  }
  const counts = () => low.map(/**
   *
   * @param {number} value
   * @param {number} axis
   */
    (value, axis) => Math.max(2, Math.ceil((high[axis] - value) / spacing)));
  let dimensions = counts();
  const budget = Math.max(8, Math.min(50000, Math.floor(maxCells)));
  while (dimensions[0] * dimensions[1] * dimensions[2] > budget) {
    spacing *= 1.05;
    dimensions = counts();
  }
  const [nx, ny, nz] = dimensions;
  const sx = nx + 1, sy = ny + 1;
  const plane = sx * sy;
  const cubeOffsets = [0, 1, sx + 1, sx, plane, plane + 1, plane + sx + 1, plane + sx];
  const fields = new Float64Array(sx * sy * (nz + 1));
  const points = new Float64Array(fields.length * 3);
  // Gaussian factors separate by axis. Splat each lobe only into its bounded
  // support, evaluating exponentials per axis rather than per voxel/lobe pair.
  // Omitted tails are at most exp(-24) per lobe and cannot form visible caps.
  const cutoff = Math.sqrt(12);
  for (const lobe of lobes) {
    const starts = [], ends = [], factors = [];
    for (let axis = 0; axis < 3; axis++) {
      const begin = Math.max(0, Math.ceil((lobe.center[axis] - cutoff * lobe.radii[axis] - low[axis]) / spacing));
      const end = Math.min(dimensions[axis], Math.floor((lobe.center[axis] + cutoff * lobe.radii[axis] - low[axis]) / spacing));
      starts.push(begin);
      ends.push(end);
      const values = new Float64Array(Math.max(0, end - begin + 1));
      for (let index = begin; index <= end; index++) {
        const distance = (low[axis] + index * spacing - lobe.center[axis]) / lobe.radii[axis];
        values[index - begin] = Math.exp(-2 * distance * distance);
      }
      factors.push(values);
    }
    for (let z = starts[2]; z <= ends[2]; z++) {
      const fz = factors[2][z - starts[2]] * (lobe.weight ?? 1);
      for (let y = starts[1]; y <= ends[1]; y++) {
        const fyz = fz * factors[1][y - starts[1]];
        const row = sx * (y + sy * z);
        for (let x = starts[0]; x <= ends[0]; x++) {
          fields[row + x] += fyz * factors[0][x - starts[0]];
        }
      }
    }
  }
  let boundary = 0, peak = 0;
  for (let z = 0; z <= nz; z++) {
    for (let y = 0; y <= ny; y++) {
      for (let x = 0; x <= nx; x++) {
        const id = x + sx * (y + sy * z);
        points[id * 3] = low[0] + x * spacing;
        points[id * 3 + 1] = low[1] + y * spacing;
        points[id * 3 + 2] = low[2] + z * spacing;
        const field = fields[id];
        peak = Math.max(peak, field);
        if (x === 0 || x === nx || y === 0 || y === ny || z === 0 || z === nz) {
          boundary = Math.max(boundary, field);
        }
      }
    }
  }
  /**
   * @param {number} iso
   */
  const extract = (iso) => {
    const positions = [], indices = [], edges = new Map();
    /**
     * @param {number} a
     * @param {number} b
     */
    const edge = (a, b) => {
      const key = a < b ? `${a}:${b}` : `${b}:${a}`;
      if (edges.has(key)) {
        return edges.get(key);
      }
      const t = (iso - fields[a]) / (fields[b] - fields[a]);
      const id = positions.length / 3;
      for (let axis = 0; axis < 3; axis++) {
        positions.push(points[a * 3 + axis] + (points[b * 3 + axis] - points[a * 3 + axis]) * t);
      }
      edges.set(key, id);

      return id;
    };
    /**
     * @param {number} a
     * @param {number} b
     * @param {number} c
     * @param {number} inside
     * @param {number} outside
     */
    const triangle = (a, b, c, inside, outside) => {
      const ax = positions[b * 3] - positions[a * 3], ay = positions[b * 3 + 1] - positions[a * 3 + 1], az = positions[b * 3 + 2] - positions[a * 3 + 2];
      const bx = positions[c * 3] - positions[a * 3], by = positions[c * 3 + 1] - positions[a * 3 + 1], bz = positions[c * 3 + 2] - positions[a * 3 + 2];
      const dot = (ay * bz - az * by) * (points[outside * 3] - points[inside * 3]) + (az * bx - ax * bz) * (points[outside * 3 + 1] - points[inside * 3 + 1]) + (ax * by - ay * bx) * (points[outside * 3 + 2] - points[inside * 3 + 2]);
      indices.push(a, dot > 0 ? b : c, dot > 0 ? c : b);
    };
    const ids = new Array(8);
    for (let z = 0; z < nz; z++) {
      for (let y = 0; y < ny; y++) {
        for (let x = 0; x < nx; x++) {
          const base = x + sx * (y + sy * z);
          let insideCount = 0;
          for (let corner = 0; corner < 8; corner++) {
            const id = base + cubeOffsets[corner];
            ids[corner] = id;
            insideCount += Number(fields[id] > iso);
          }
          if (insideCount === 0 || insideCount === 8) {
            continue;
          }
          for (const tetra of TETRAHEDRA) {
            const inside = [], outside = [];
            for (const corner of tetra) {
              (fields[ids[corner]] > iso ? inside : outside).push(ids[corner]);
            }
            if (!inside.length || !outside.length) {
              continue;
            }
            if (inside.length === 2) {
              const a = edge(inside[0], outside[0]), b = edge(inside[0], outside[1]);
              const c = edge(inside[1], outside[0]), d = edge(inside[1], outside[1]);
              triangle(a, b, c, inside[0], outside[0]);
              triangle(b, d, c, inside[0], outside[0]);
            } else {
              const single = inside.length === 1 ? inside[0] : outside[0];
              const others = inside.length === 1 ? outside : inside;
              triangle(edge(single, others[0]), edge(single, others[1]), edge(single, others[2]), inside[0], outside[0]);
            }
          }
        }
      }
    }

    return {
      positions,
      indices,
      volume: bridgeSlimeImplicitVolume(positions, indices),
    };
  };
  let minimum = Math.max(Number.MIN_VALUE, boundary * 1.01), maximum = peak;
  let mesh, isovalue = 0, fits = 0;
  let candidate = Number.isFinite(initialIsovalue) ? Math.max(minimum, Math.min(maximum * 0.999, initialIsovalue)) : (minimum + maximum) / 2;
  const fitLimit = Number.isFinite(maxFits) ? Math.max(1, Math.min(14, Math.floor(maxFits))) : 14;
  for (let iteration = 0; iteration < fitLimit; iteration++) {
    const iso = candidate;
    isovalue = iso;
    fits++;
    mesh = extract(iso);
    if (Math.abs(mesh.volume - volume) / volume < 0.002) {
      break;
    }
    if (mesh.volume > volume) {
      minimum = iso;
    } else {
      maximum = iso;
    }
    // For Gaussian lobes, volume changes approximately with (-log iso)^1.5.
    // A ratio step follows nearby animation without repeating a full bisection.
    const estimate = iso * Math.exp(Math.log(Math.max(1e-8, mesh.volume / volume)) * 0.6);
    candidate = initialIsovalue !== undefined && estimate > minimum && estimate < maximum ? estimate : (minimum + maximum) / 2;
  }
  if (!(mesh.volume > 0)) {
    return empty;
  }
  const passes = Number.isFinite(smoothPasses) ? Math.max(0, Math.min(2, Math.floor(smoothPasses))) : 0;
  if (passes > 0) {
    const sums = new Float64Array(mesh.positions.length);
    const counts = new Uint32Array(mesh.positions.length / 3);
    for (let pass = 0; pass < passes; pass++) {
      sums.fill(0);
      counts.fill(0);
      // Each neighbour occurs twice in a closed manifold triangle fan. Sum
      // those incidences directly instead of allocating per-vertex sets.
      for (let triangle = 0; triangle < mesh.indices.length; triangle += 3) {
        for (let corner = 0; corner < 3; corner++) {
          const vertex = mesh.indices[triangle + corner];
          const a = mesh.indices[triangle + (corner + 1) % 3] * 3;
          const b = mesh.indices[triangle + (corner + 2) % 3] * 3;
          counts[vertex] += 2;
          for (let axis = 0; axis < 3; axis++) {
            sums[vertex * 3 + axis] += mesh.positions[a + axis] + mesh.positions[b + axis];
          }
        }
      }
      for (let index = 0; index < mesh.positions.length; index++) {
        const count = counts[Math.floor(index / 3)];
        if (count > 0) {
          mesh.positions[index] = mesh.positions[index] * 0.65 + sums[index] / count * 0.35;
        }
      }
    }
  }
  const correction = Math.cbrt(volume / bridgeSlimeImplicitVolume(mesh.positions, mesh.indices));
  const normals = [];
  // Negative field gradients point from dense liquid toward air. Uniform
  // volume correction preserves these directions, so sample before scaling.
  for (let index = 0; index < mesh.positions.length; index += 3) {
    let gx = 0, gy = 0, gz = 0;
    for (const lobe of lobes) {
      const dx = (mesh.positions[index] - lobe.center[0]) / lobe.radii[0];
      const dy = (mesh.positions[index + 1] - lobe.center[1]) / lobe.radii[1];
      const dz = (mesh.positions[index + 2] - lobe.center[2]) / lobe.radii[2];
      const distance = dx * dx + dy * dy + dz * dz;
      if (distance > 12) {
        continue;
      }
      const weight = Math.exp(-2 * distance) * (lobe.weight ?? 1);
      gx += weight * dx / lobe.radii[0];
      gy += weight * dy / lobe.radii[1];
      gz += weight * dz / lobe.radii[2];
    }
    const length = Math.hypot(gx, gy, gz);
    normals.push(length > 0 ? gx / length : 0, length > 0 ? gy / length : 1, length > 0 ? gz / length : 0);
  }
  for (let i = 0; i < mesh.positions.length; i++) {
    mesh.positions[i] = origin[i % 3] + (mesh.positions[i] - origin[i % 3]) * correction;
  }

  return {
    ...mesh,
    normals,
    volume: bridgeSlimeImplicitVolume(mesh.positions, mesh.indices),
    cellCount: nx * ny * nz,
    spacing,
    isovalue,
    fits,
    correctionScale: correction,
  };
}
