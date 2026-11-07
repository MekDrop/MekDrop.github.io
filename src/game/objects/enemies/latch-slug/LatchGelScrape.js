/**
 * Material-space thickness loss on the existing wet skin. Ammo owns contact;
 * this mask only subtracts the gel contacted by a physical scratch stroke.
 */
export class LatchGelScrape {
  /**
   * @param {number} vertices
   */
  constructor(vertices) {
    // Material thickness weights may exceed one where remaining gel gathers.
    this.remaining = new Float32Array(vertices).fill(1);
    this.changed = false;
  }

  /**
   * @param {Float32Array} positions Local rendered surface vertices.
   * @param {import("playcanvas").Vec3} start
   * @param {import("playcanvas").Vec3} end
   * @param {number} radius
   * @returns {boolean}
   */
  cut(positions, start, end, radius) {
    const dx = end.x - start.x, dy = end.y - start.y;
    const length = dx * dx + dy * dy;
    let changed = false;
    for (let i = 0; i < positions.length; i += 3) {
      const x = positions[i], y = positions[i + 1], z = positions[i + 2];
      const t = length > 1e-10 ? Math.max(0, Math.min(1, ((x - start.x) * dx + (y - start.y) * dy) / length)) : 0;
      if (Math.abs(z - (start.z + (end.z - start.z) * t)) > radius + 0.12) {
        continue;
      }
      const distance = Math.hypot(x - start.x - dx * t, y - start.y - dy * t);
      if (distance >= radius) {
        continue;
      }
      const edge = Math.max(0, Math.min(1, (distance / radius - 0.42) / 0.58));
      const remaining = Math.min(this.remaining[i / 3], edge ** 3 * (edge * (edge * 6 - 15) + 10));
      if (remaining < this.remaining[i / 3]) {
        this.remaining[i / 3] = remaining;
        changed = true;
      }
    }
    this.changed ||= changed;

    return changed;
  }

  /**
   * @param {Float32Array} positions
   * @param {Float32Array} base
   */
  apply(positions, base) {
    for (let i = 2; i < positions.length; i += 3) {
      positions[i] = base[i] + (positions[i] - base[i]) * this.remaining[(i - 2) / 3];
    }
  }

  /**
   * Viscous contour smoothing without an elastic or time-driven oscillation.
   * The caller conserves remaining volume; only transport changes the film.
   * @param {Float32Array} positions
   * @param {Float32Array} base
   * @param {number[]} indices
   */
  relax(positions, base, indices) {
    this.#round(positions, base, indices);
  }

  /**
   * @type {number[][]|null}
   */
  neighbors = null;

  /**
   * Weld authored seam duplicates before smoothing, so detached-looking triangle
   * strips relax as one wet skin. The caller rescales thickness to conserve mass.
   * @param {Float32Array} positions
   * @param {Float32Array} base
   * @param {number[]} indices
   */
  #round(positions, base, indices) {
    if (!this.neighbors) {
      const groups = new Map(), ids = [], members = [], links = [];
      for (let i = 0; i < positions.length; i += 3) {
        const key = [positions[i], positions[i + 1], positions[i + 2]].map(/**
         *
         * @param {number} n
         */
          n => Math.round(n * 10000)).join(":");
        let id = groups.get(key);
        if (id === undefined) {
          id = members.length;
          groups.set(key, id);
          members.push([]);
          links.push(new Set());
        }
        ids.push(id);
        members[id].push(i / 3);
      }
      for (let i = 0; i < indices.length; i += 3) {
        const triangle = indices.slice(i, i + 3).map(/**
         *
         * @param {number} v
         */
          v => ids[v]);
        for (const a of triangle) {
          for (const b of triangle) {
            if (a !== b) {
              links[a].add(b);
            }
          }
        }
      }
      this.weldGroups = members;
      this.neighbors = ids.map(/**
       *
       * @param {number} id
       */
        id => [...links[id]].flatMap(/**
       *
       * @param {number} n
       */
          n => members[n]));
    }
    // Recompute from the authored wet pose each frame, never accumulating drift.
    // Broad relaxation rounds both a peeled edge and the long remaining lobes.
    for (let pass = 0; pass < 7; pass++) {
      const source = positions.slice(), oldBase = base.slice();
      for (let v = 0; v < this.neighbors.length; v++) {
        const adjacent = this.neighbors[v];
        if (!adjacent.length) {
          continue;
        }
        const i = v * 3;
        let x = 0, y = 0, thickness = 0;
        for (const n of adjacent) {
          x += source[n * 3];
          y += source[n * 3 + 1];
          thickness += Math.max(0, source[n * 3 + 2] - oldBase[n * 3 + 2]);
        }
        const weight = this.remaining[v], blend = 0.32 + 0.3 * Math.max(0, 1 - Math.min(1, weight));
        const dx = (x / adjacent.length - source[i]) * blend;
        const dy = (y / adjacent.length - source[i + 1]) * blend;
        const limit = Math.min(1, 0.035 / Math.max(0.000001, Math.hypot(dx, dy)));
        positions[i] += dx * limit;
        positions[i + 1] += dy * limit;
        base[i] = positions[i];
        base[i + 1] = positions[i + 1];
        const own = Math.max(0, source[i + 2] - oldBase[i + 2]);
        positions[i + 2] = base[i + 2] + own * 0.48 + thickness / adjacent.length * 0.52;
      }
    }
  }

  /**
   * @type {number[][]|undefined}
   */
  weldGroups;

  /**
   * Smooth shading over the authored split seams after their skin is relaxed.
   * @param {number[]|Float32Array} normals
   */
  smoothNormals(normals) {
    for (const group of this.weldGroups ?? []) {
      let x = 0, y = 0, z = 0;
      for (const index of group) {
        x += normals[index * 3];
        y += normals[index * 3 + 1];
        z += normals[index * 3 + 2];
      }
      const length = Math.hypot(x, y, z) || 1;
      for (const index of group) {
        normals[index * 3] = x / length;
        normals[index * 3 + 1] = y / length;
        normals[index * 3 + 2] = z / length;
      }
    }
  }

  /**
   * Ammo provides contact but has no viscous film solver. This bounded visual
   * transport redistributes existing material weights; the owner keeps the
   * exact volume ledger. It never moves or replaces a rigid body.
   * @param {Float32Array} positions Authored unsigned skin before the mask.
   * @param {Float32Array} base
   * @param {number} dt
   */
  flow(positions, base, dt) {
    if (!this.changed || !this.neighbors || dt <= 0) {
      return;
    }
    const steps = Math.max(1, Math.ceil(Math.min(dt, 0.1) / 0.0125));
    const step = Math.min(dt, 0.1) / steps;
    for (let iteration = 0; iteration < steps; iteration++) {
      const source = this.remaining.slice(), delta = new Float32Array(source.length);
      for (let v = 0; v < source.length; v++) {
        const adjacent = this.neighbors[v];
        if (!adjacent.length) {
          continue;
        }
        const height = Math.max(0, positions[v * 3 + 2] - base[v * 3 + 2]) * source[v];
        for (const n of adjacent) {
          // Equal exchanges conserve the mask sum, even on irregular valence.
          if (n > v) {
            const amount = (source[v] - source[n]) * step * 7 / Math.max(adjacent.length, this.neighbors[n].length);
            delta[v] -= amount;
            delta[n] += amount;
          }
          const drop = positions[v * 3 + 1] - positions[n * 3 + 1];
          if (drop <= 0.001) {
            continue;
          }
          const density = Math.min(4, height / 0.04);
          const amount = source[v] * step * 1.0 * density * density / adjacent.length;
          delta[v] -= amount;
          delta[n] += amount;
        }
      }
      for (let v = 0; v < source.length; v++) {
        this.remaining[v] = Math.max(0, source[v] + delta[v]);
      }
    }
  }

}
