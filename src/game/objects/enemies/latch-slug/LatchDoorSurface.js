/**
 * A bounded visual surface query, not a fluid/rigid-body integrator. Ammo has no
 * viscous free-surface solver. Native authored flow is reparameterized by the
 * distance along the real door mesh, including its raised hardware.
 */
export class LatchDoorSurface {
  /**
   * @param {number} size Metres covered around the impact.
   * @param {number} resolution Samples on each axis.
   */
  constructor(size = 4, resolution = 192) {
    this.size = size;
    this.resolution = resolution;
    this.step = size / (resolution - 1);
    this.depth = new Float32Array(resolution * resolution).fill(-Infinity);
    this.arc = new Float32Array(resolution * resolution);
    this.triangles = 0;
  }

  /**
   * Rasterize a triangle projected into the door plane. Z points outwards.
   * @param {number[]} a
   * @param {number[]} b
   * @param {number[]} c
   */
  addTriangle(a, b, c) {
    const n = this.resolution, half = this.size / 2, step = this.step;
    const area = (b[1] - c[1]) * (a[0] - c[0]) + (c[0] - b[0]) * (a[1] - c[1]);
    if (Math.abs(area) < 1e-8) {
      return;
    }
    const x0 = Math.max(0, Math.ceil((Math.min(a[0], b[0], c[0]) + half) / step));
    const x1 = Math.min(n - 1, Math.floor((Math.max(a[0], b[0], c[0]) + half) / step));
    const y0 = Math.max(0, Math.ceil((Math.min(a[1], b[1], c[1]) + half) / step));
    const y1 = Math.min(n - 1, Math.floor((Math.max(a[1], b[1], c[1]) + half) / step));
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const px = x * step - half, py = y * step - half;
        const u = ((b[1] - c[1]) * (px - c[0]) + (c[0] - b[0]) * (py - c[1])) / area;
        const v = ((c[1] - a[1]) * (px - c[0]) + (a[0] - c[0]) * (py - c[1])) / area;
        if (u >= -1e-5 && v >= -1e-5 && u + v <= 1.00001) {
          const index = y * n + x;
          this.depth[index] = Math.max(this.depth[index], u * a[2] + v * b[2] + (1 - u - v) * c[2]);
        }
      }
    }
    this.triangles++;
  }

  finish() {
    const n = this.resolution;
    // Gaps between planks remain shallow recesses; nothing crosses to the back
    // of the leaf. A small spatial filter rounds sharp metal edges for wetting.
    for (let i = 0; i < this.depth.length; i++) {
      if (!Number.isFinite(this.depth[i])) {
        this.depth[i] = -0.015;
      }
    }
    const raw = this.depth.slice();
    for (let y = 1; y < n - 1; y++) {
      for (let x = 1; x < n - 1; x++) {
        const i = y * n + x;
        this.depth[i] = (raw[i] * 4 + raw[i - 1] + raw[i + 1] + raw[i - n] + raw[i + n]) / 8;
      }
    }
    for (let x = 0; x < n; x++) {
      for (let y = 1; y < n; y++) {
        const i = y * n + x;
        this.arc[i] = this.arc[i - n] + Math.hypot(this.step, this.depth[i] - this.depth[i - n]);
      }
    }
    this.baseline = this.sample(this.depth, 0, 0);
  }

  /**
   * @param {Float32Array} field
   * @param {number} x
   * @param {number} y
   * @returns {number}
   */
  sample(field, x, y) {
    const n = this.resolution;
    const px = Math.max(0, Math.min(n - 1.000001, (x + this.size / 2) / this.step));
    const py = Math.max(0, Math.min(n - 1.000001, (y + this.size / 2) / this.step));
    const ix = Math.floor(px), iy = Math.floor(py), fx = px - ix, fy = py - iy;
    const i = iy * n + ix;

    return (field[i] * (1 - fx) + field[i + 1] * fx) * (1 - fy) +
      (field[i + n] * (1 - fx) + field[i + n + 1] * fx) * fy;
  }

  /**
   * The same authored travel takes longer to pass over a projecting brace.
   * The resulting compression above its lip is compensated by film thickness.
   * @param {number} x
   * @param {number} from
   * @param {number} to
   * @returns {number}
   */
  flow(x, from, to) {
    if (to >= from) {
      return to;
    }
    const target = this.sample(this.arc, x, from) + to - from;
    let low = to, high = from;
    for (let iteration = 0; iteration < 10; iteration++) {
      const middle = (low + high) / 2;
      if (this.sample(this.arc, x, middle) < target) {
        low = middle;
      } else {
        high = middle;
      }
    }

    return (low + high) / 2;
  }

  /**
   * @param {number} x
   * @param {number} y
   * @returns {number}
   */
  height(x, y) {
    return this.sample(this.depth, x, y) - this.baseline;
  }
}
