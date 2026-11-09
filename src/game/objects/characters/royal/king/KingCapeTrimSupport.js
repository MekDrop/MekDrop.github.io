/**
 * Index the fixed trim offsets once; duplicated face vertices have the same
 * support contribution and need not be visited on every Bullet substep.
 */
export class KingCapeTrimSupport {
  /**
   * @type {Array<{index: number, edge: import("./KingCapeGeometry.js").KingHemAttachment|null, offsets: import("playcanvas").Vec3[]}>}
   */
  #groups = [];

  /**
   * @param {import("./KingCapeGeometry.js").KingCapeBinding[]} bindings
   */
  constructor(bindings) {
    const groups = new Map();
    for (const binding of bindings) {
      if (!binding.trimOffsets) {
        continue;
      }
      for (let vertex = 0; vertex < binding.mapping.length; vertex++) {
        const index = binding.mapping[vertex];
        if (index < 0) {
          continue;
        }
        const edge = binding.trimEdges?.[vertex] ?? null;
        const key = edge ?? index;
        if (!groups.has(key)) {
          groups.set(key, {
            index,
            edge,
            offsets: [],
            seen: new Set(),
          });
        }
        const group = groups.get(key);
        const offset = binding.trimOffsets[vertex];
        const signature = `${offset.x}:${offset.y}:${offset.z}`;
        if (!group.seen.has(signature)) {
          group.seen.add(signature);
          group.offsets.push(offset);
        }
      }
    }
    this.#groups = [...groups.values()];
  }

  /**
   * Preserve the original extrema and hem correction without per-vertex
   * temporary arrays, repeated frame lookups, or repeated edge sampling.
   * @param {import("./KingCapeGeometry.js").KingCapeFrame[]} frames
   * @param {(edge: import("./KingCapeGeometry.js").KingHemAttachment) => {point: import("playcanvas").Vec3, frame: import("./KingCapeGeometry.js").KingCapeFrame}} sampleHem
   * @param {number} floor
   * @param {number[]} clearances
   */
  update(frames, sampleHem, floor, clearances) {
    clearances.fill(0);
    for (const group of this.#groups) {
      const { index, edge, offsets } = group;
      const sample = edge ? sampleHem(edge) : null;
      const frame = sample?.frame ?? frames[index];
      let minimum = Infinity;
      let clearance = 0;
      for (const offset of offsets) {
        const height = frame.tangent.y * offset.x + frame.bitangent.y * offset.y + frame.normal.y * offset.z;
        clearance = Math.max(clearance, -height);
        if (sample) {
          minimum = Math.min(minimum, sample.point.y + height);
        }
      }
      if (edge) {
        clearances[edge.a] = Math.max(clearances[edge.a], clearance);
        clearances[edge.b] = Math.max(clearances[edge.b], clearance);
        sample.point.y += Math.max(0, floor - minimum);
      } else {
        clearances[index] = Math.max(clearances[index], clearance);
      }
    }
  }
}
