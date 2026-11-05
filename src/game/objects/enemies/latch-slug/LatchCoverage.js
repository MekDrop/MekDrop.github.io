import { gelVolume } from "./LatchImpactShape.js";

/**
 * Door-plane union of wet footprints, retaining each patch at its impact area.
 * This is a visual surface reconstruction; Ammo retains all collision ownership.
 */
export class LatchCoverage {
  /**
   * @type {((x:number,y:number)=>number)|null}
   */
  #surfaceHeight;
  /**
   * @type {number}
   */
  #step;
  /**
   * @type {number}
   */
  #left;
  /**
   * @type {number}
   */
  #bottom;
  /**
   * @type {number}
   */
  #columns;
  /**
   * @type {number}
   */
  #rows;
  /**
   * @type {Float64Array}
   */
  #front;
  /**
   * @type {Float64Array}
   */
  #back;
  /**
   * @type {number[]}
   */
  positions;
  /**
   * @type {number[]}
   */
  indices;
  /**
   * @type {number[]}
   */
  topIndices;
  /**
   * @type {number[]}
   */
  baseIndices;
  /**
   * @type {number}
   */
  volume = 0;

  /**
   * @type {number}
   */
  connections = 0;

  /**
   * @param {Array<{positions:ArrayLike<number>,indices:ArrayLike<number>,volume:number}>} patches
   * @param {boolean} cohesive Keep previously merged wet film connected.
   * @param {((x:number,y:number)=>number)|null} surfaceHeight Door support under new connecting film.
   */
  constructor(patches, cohesive = false, surfaceHeight = null) {
    this.#surfaceHeight = surfaceHeight;
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const patch of patches) {
      for (let i = 0; i < patch.positions.length; i += 3) {
        minX = Math.min(minX, patch.positions[i]);
        maxX = Math.max(maxX, patch.positions[i]);
        minY = Math.min(minY, patch.positions[i + 1]);
        maxY = Math.max(maxY, patch.positions[i + 1]);
      }
    }
    this.positions = [];
    this.indices = [];
    if (!Number.isFinite(minX)) {
      return;
    }
    this.#step = Math.max(0.025, Math.sqrt((maxX - minX) * (maxY - minY) / 12000));
    this.#left = Math.floor(minX / this.#step) * this.#step - this.#step * 2;
    this.#bottom = Math.floor(minY / this.#step) * this.#step - this.#step * 2;
    this.#columns = Math.ceil((maxX - this.#left) / this.#step) + 3;
    this.#rows = Math.ceil((maxY - this.#bottom) / this.#step) + 3;
    const count = this.#columns * this.#rows;
    this.#front = new Float64Array(count).fill(-Infinity);
    this.#back = new Float64Array(count).fill(Infinity);
    let wanted = 0;
    for (const patch of patches) {
      wanted += patch.volume;
      this.#sample(patch);
    }
    if (cohesive) {
      this.#connect();
    }
    this.#build();
    const volume = Math.abs(gelVolume(this.positions, this.indices));
    const scale = volume > 1e-10 ? wanted / volume : 1;
    for (let i = 0; i < this.topIndices.length; i++) {
      const top = this.topIndices[i] * 3 + 2, base = this.baseIndices[i] * 3 + 2;
      if (top !== base) {
        this.positions[top] = this.positions[base] + (this.positions[top] - this.positions[base]) * scale;
      }
    }
    this.volume = Math.abs(gelVolume(this.positions, this.indices));
  }

  /**
   * Nearest wet boundaries grow a connecting neck after coalescence. This is
   * surface reconstruction, not motion integration; the final volume scaling
   * redistributes existing gel into the neck without creating additional mass.
   */
  #connect() {
    const count = this.#front.length;
    const labels = new Int32Array(count).fill(-1);
    const occupied = new Uint8Array(count);
    const queue = new Int32Array(count);
    let components = 0;
    for (let i = 0; i < count; i++) {
      occupied[i] = this.#front[i] > this.#back[i] ? 1 : 0;
    }
    for (let i = 0; i < count; i++) {
      if (!occupied[i] || labels[i] >= 0) {
        continue;
      }
      let head = 0, tail = 1;
      queue[0] = i;
      labels[i] = components;
      while (head < tail) {
        const current = queue[head++];
        for (const next of this.#neighbors(current)) {
          if (occupied[next] && labels[next] < 0) {
            labels[next] = components;
            queue[tail++] = next;
          }
        }
      }
      components++;
    }
    if (components < 2) {
      return;
    }
    const roots = new Int32Array(components);
    for (let i = 0; i < components; i++) {
      roots[i] = i;
    }
    const source = new Int32Array(count);
    let head = 0, tail = 0;
    for (let i = 0; i < count; i++) {
      if (occupied[i]) {
        source[i] = i;
        queue[tail++] = i;
      }
    }
    while (head < tail && this.connections < components - 1) {
      const current = queue[head++];
      for (const next of this.#neighbors(current)) {
        if (labels[next] < 0) {
          labels[next] = labels[current];
          source[next] = source[current];
          queue[tail++] = next;
          continue;
        }
        const a = LatchCoverage.#root(roots, labels[current]);
        const b = LatchCoverage.#root(roots, labels[next]);
        if (a === b) {
          continue;
        }
        roots[b] = a;
        this.connections++;
        const start = source[current], end = source[next];
        const startX = start % this.#columns, startY = Math.floor(start / this.#columns);
        const dx = end % this.#columns - startX, dy = Math.floor(end / this.#columns) - startY;
        const length = Math.max(Math.abs(dx), Math.abs(dy));
        const depth = Math.max(0.008, Math.min(0.04, (this.#front[start] - this.#back[start] + this.#front[end] - this.#back[end]) * 0.25));
        for (let k = 0; k <= length; k++) {
          const blend = k / Math.max(1, length);
          const index = Math.round(startX + dx * blend) + Math.round(startY + dy * blend) * this.#columns;
          const base = this.#back[start] * (1 - blend) + this.#back[end] * blend;
          for (const cell of [index, ...this.#neighbors(index)]) {
            if (!occupied[cell]) {
              const x = this.#left + cell % this.#columns * this.#step;
              const y = this.#bottom + Math.floor(cell / this.#columns) * this.#step;
              const support = Math.max(base, this.#surfaceHeight?.(x, y) ?? base);
              this.#back[cell] = Math.min(this.#back[cell], support);
              this.#front[cell] = Math.max(this.#front[cell], support + depth);
            }
          }
        }
      }
    }
  }

  /**
   * @param {number} index
   * @returns {number[]}
   */
  #neighbors(index) {
    const x = index % this.#columns, y = Math.floor(index / this.#columns);
    const result = [];
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        if ((dx || dy) && x + dx >= 0 && x + dx < this.#columns && y + dy >= 0 && y + dy < this.#rows) {
          result.push(index + dy * this.#columns + dx);
        }
      }
    }

    return result;
  }

  /**
   * @param {Int32Array} roots
   * @param {number} index
   * @returns {number}
   */
  static #root(roots, index) {
    while (roots[index] !== index) {
      roots[index] = roots[roots[index]];
      index = roots[index];
    }

    return index;
  }

  /**
   * @param {{positions:ArrayLike<number>,indices:ArrayLike<number>}} patch
   */
  #sample(patch) {
    const p = patch.positions;
    for (let triangle = 0; triangle < patch.indices.length; triangle += 3) {
      const a = patch.indices[triangle] * 3, b = patch.indices[triangle + 1] * 3, c = patch.indices[triangle + 2] * 3;
      const denominator = (p[b + 1] - p[c + 1]) * (p[a] - p[c]) + (p[c] - p[b]) * (p[a + 1] - p[c + 1]);
      if (Math.abs(denominator) < 1e-12) {
        continue;
      }
      const left = Math.max(0, Math.floor((Math.min(p[a], p[b], p[c]) - this.#left) / this.#step));
      const right = Math.min(this.#columns - 1, Math.ceil((Math.max(p[a], p[b], p[c]) - this.#left) / this.#step));
      const bottom = Math.max(0, Math.floor((Math.min(p[a + 1], p[b + 1], p[c + 1]) - this.#bottom) / this.#step));
      const top = Math.min(this.#rows - 1, Math.ceil((Math.max(p[a + 1], p[b + 1], p[c + 1]) - this.#bottom) / this.#step));
      for (let row = bottom; row <= top; row++) {
        const y = this.#bottom + row * this.#step;
        for (let column = left; column <= right; column++) {
          const x = this.#left + column * this.#step;
          const u = ((p[b + 1] - p[c + 1]) * (x - p[c]) + (p[c] - p[b]) * (y - p[c + 1])) / denominator;
          const v = ((p[c + 1] - p[a + 1]) * (x - p[c]) + (p[a] - p[c]) * (y - p[c + 1])) / denominator;
          if (u < -1e-6 || v < -1e-6 || u + v > 1.000001) {
            continue;
          }
          const z = u * p[a + 2] + v * p[b + 2] + (1 - u - v) * p[c + 2];
          const index = row * this.#columns + column;
          this.#front[index] = Math.max(this.#front[index], z);
          this.#back[index] = Math.min(this.#back[index], z);
        }
      }
    }
  }

  #build() {
    const thickness = new Float64Array(this.#front.length);
    for (let i = 0; i < thickness.length; i++) {
      thickness[i] = Math.max(0, this.#front[i] - this.#back[i]);
    }
    this.topIndices = [];
    this.baseIndices = [];
    for (let row = 0; row < this.#rows; row++) {
      for (let column = 0; column < this.#columns; column++) {
        const i = row * this.#columns + column;
        let base = 0, height = 0, samples = 0;
        // Round the contact seam locally; never pull either patch's centroid.
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            const x = column + dx, y = row + dy;
            if (x < 0 || x >= this.#columns || y < 0 || y >= this.#rows) {
              continue;
            }
            const neighbor = y * this.#columns + x;
            if (thickness[neighbor] > 0) {
              base += this.#back[neighbor];
              height += thickness[neighbor];
              samples++;
            }
          }
        }
        base = Number.isFinite(this.#back[i]) ? this.#back[i] : samples ? base / samples : 0;
        height = thickness[i] > 0 ? thickness[i] * 0.6 + height / samples * 0.4 : 0;
        const x = this.#left + column * this.#step, y = this.#bottom + row * this.#step;
        this.baseIndices[i] = this.positions.length / 3;
        this.positions.push(x, y, base);
        this.topIndices[i] = this.baseIndices[i];
        if (height > 0) {
          this.topIndices[i] = this.positions.length / 3;
          this.positions.push(x, y, base + height);
        }
      }
    }
    const boundary = new Map();
    const neighbors = new Map();
    for (let row = 0; row < this.#rows - 1; row++) {
      for (let column = 0; column < this.#columns - 1; column++) {
        const a = row * this.#columns + column, b = a + 1, c = a + this.#columns, d = c + 1;
        if (thickness[a] + thickness[b] + thickness[c] + thickness[d] <= 0) {
          continue;
        }
        this.#face(a, b, c, thickness, boundary, neighbors);
        this.#face(b, d, c, thickness, boundary, neighbors);
      }
    }
    this.#smoothBoundary(neighbors);
  }

  /**
   * Clip a grid triangle at its wet edge, sharing zero-thickness boundary points.
   * @param {number} a
   * @param {number} b
   * @param {number} c
   * @param {Float64Array} thickness
   * @param {Map<string,number>} boundary
   * @param {Map<number,Set<number>>} neighbors
   */
  #face(a, b, c, thickness, boundary, neighbors) {
    const nodes = [a, b, c], top = [], back = [];
    const edgePoints = [];
    for (let edge = 0; edge < 3; edge++) {
      const current = nodes[edge], next = nodes[(edge + 1) % 3];
      const inside = thickness[current] > 0;
      if (inside) {
        top.push(this.topIndices[current]);
        back.push(this.baseIndices[current]);
      }
      if (inside === (thickness[next] > 0)) {
        continue;
      }
      const key = `${Math.min(current, next)},${Math.max(current, next)}`;
      let index = boundary.get(key);
      if (index === undefined) {
        index = this.positions.length / 3;
        const start = this.baseIndices[current] * 3, end = this.baseIndices[next] * 3;
        this.positions.push((this.positions[start] + this.positions[end]) / 2,
          (this.positions[start + 1] + this.positions[end + 1]) / 2,
          (this.positions[start + 2] + this.positions[end + 2]) / 2);
        boundary.set(key, index);
      }
      top.push(index);
      back.push(index);
      edgePoints.push(index);
    }
    if (edgePoints.length === 2) {
      const [left, right] = edgePoints;
      if (!neighbors.has(left)) {
        neighbors.set(left, new Set());
      }
      if (!neighbors.has(right)) {
        neighbors.set(right, new Set());
      }
      neighbors.get(left).add(right);
      neighbors.get(right).add(left);
    }
    for (let i = 1; i < top.length - 1; i++) {
      this.indices.push(top[0], top[i], top[i + 1], back[0], back[i + 1], back[i]);
    }
  }

  /**
   * Remove cell-sized serrations without relocating either occupied lobe.
   * @param {Map<number,Set<number>>} neighbors
   */
  #smoothBoundary(neighbors) {
    for (let pass = 0; pass < 3; pass++) {
      const before = this.positions.slice();
      for (const [index, adjacent] of neighbors) {
        if (adjacent.size !== 2) {
          continue;
        }
        const [left, right] = adjacent;
        for (let axis = 0; axis < 3; axis++) {
          this.positions[index * 3 + axis] = before[index * 3 + axis] * 0.5 +
            (before[left * 3 + axis] + before[right * 3 + axis]) * 0.25;
        }
      }
    }
  }
}
