const CONTACT_FILM_DEPTH = 0.003;
// Ground contact is short-lived: most of the runoff soaks in within seconds.
const ABSORPTION_RATE = 1.2;

/**
 * Surface-only runoff on a sampled floor. Ammo supplies support; its rigid
 * solver cannot represent a viscous film, so this grid transports volume only.
 */
export class LatchGroundFilm {
  /**
   * @param {{minX:number,maxX:number,depth:number,columns:number,rows:number,support:(x:number,z:number)=>number|null}} options
   */
  constructor({ minX, maxX, depth, columns, rows, support }) {
    this.minX = minX;
    this.dx = (maxX - minX) / (columns - 1);
    this.dz = depth / (rows - 1);
    this.columns = columns;
    this.rows = rows;
    this.sampleSupport = support;
    this.area = this.dx * this.dz;
    this.height = new Float64Array(columns * rows);
    this.absorbedVolume = 0;
    this.drying = false;
    this.support = new Float64Array(columns * rows).fill(NaN);
    for (let z = 0; z < rows; z++) {
      for (let x = 0; x < columns; x++) {
        this.support[z * columns + x] = support(minX + x * this.dx, z * this.dz) ?? NaN;
      }
    }
  }

  /**
   * @param {number} x
   * @param {number} volume
   * @returns {number} Volume accepted by real floor support.
   */
  deposit(x, volume) {
    if (!(volume > 0)) {
      return 0;
    }
    const column = Math.max(0, Math.min(this.columns - 1, Math.round((x - this.minX) / this.dx)));
    for (let row = 0; row < Math.min(4, this.rows); row++) {
      const index = row * this.columns + column;
      if (Number.isFinite(this.support[index])) {
        this.height[index] += volume / this.area;
        this.drying = false;

        return volume;
      }
    }

    return 0;
  }

  /**
   * @returns {number}
   */
  get volume() {
    let volume = 0;
    for (const height of this.height) {
      volume += height * this.area;
    }

    return volume;
  }

  /**
   * @param {number} dt
   */
  update(dt) {
    this.#expand();
    const steps = Math.ceil(Math.min(Math.max(dt, 0), 0.1) / 0.04);
    const step = steps ? Math.min(dt, 0.1) / steps : 0;
    for (let iteration = 0; iteration < steps; iteration++) {
      const delta = new Float64Array(this.height.length);
      for (let z = 0; z < this.rows; z++) {
        for (let x = 0; x < this.columns; x++) {
          const a = z * this.columns + x;
          for (const b of [x + 1 < this.columns ? a + 1 : -1, z + 1 < this.rows ? a + this.columns : -1]) {
            if (b < 0 || !Number.isFinite(this.support[a]) || !Number.isFinite(this.support[b])) {
              continue;
            }
            const levelA = this.support[a] + this.height[a], levelB = this.support[b] + this.height[b];
            // Thin residue is cohesive, so a slight floor slope cannot pull
            // it into a long, narrow streak ahead of the main puddle.
            const mobility = Math.min(1, (Math.max(this.height[a], this.height[b]) / 0.035) ** 2);
            const raw = (levelA - levelB) * step * 2 * mobility;
            const donor = raw > 0 ? a : b;
            const mobile = Math.max(0, this.height[donor] - CONTACT_FILM_DEPTH);
            const flux = Math.sign(raw) * Math.min(Math.abs(raw), mobile * 0.2);
            delta[a] -= flux;
            delta[b] += flux;
          }
        }
      }
      for (let i = 0; i < this.height.length; i++) {
        this.height[i] = Math.max(0, this.height[i] + delta[i]);
      }
    }
    let peak = 0;
    for (const height of this.height) {
      peak = Math.max(peak, height);
    }
    this.drying ||= peak <= CONTACT_FILM_DEPTH + 0.0001;
    const fade = Math.exp(-Math.min(Math.max(dt, 0), 0.1) * ABSORPTION_RATE);
    for (let i = 0; i < this.height.length; i++) {
      const before = this.height[i];
      this.height[i] = this.drying ? before * fade : Math.min(before, CONTACT_FILM_DEPTH) + Math.max(0, before - CONTACT_FILM_DEPTH) * fade;
      this.absorbedVolume += (before - this.height[i]) * this.area;
    }
  }

  /**
   * Extend the sampled floor before a wet edge reaches the grid boundary.
   * Existing cells retain their positions and volume, and new cells still
   * require native support before they can receive gel.
   */
  #expand() {
    let left = false, right = false, front = false;
    for (let z = 0; z < this.rows; z++) {
      left ||= this.height[z * this.columns] > 0.002;
      right ||= this.height[z * this.columns + this.columns - 1] > 0.002;
    }
    for (let x = 0; x < this.columns; x++) {
      front ||= this.height[(this.rows - 1) * this.columns + x] > 0.002;
    }
    if (!left && !right && !front) {
      return;
    }
    const extraLeft = left ? 8 : 0, extraRight = right ? 8 : 0, extraFront = front ? 8 : 0;
    const columns = this.columns + extraLeft + extraRight, rows = this.rows + extraFront;
    const height = new Float64Array(columns * rows), support = new Float64Array(columns * rows).fill(NaN);
    const minX = this.minX - extraLeft * this.dx;
    for (let z = 0; z < rows; z++) {
      for (let x = 0; x < columns; x++) {
        const index = z * columns + x, oldX = x - extraLeft;
        if (oldX >= 0 && oldX < this.columns && z < this.rows) {
          const old = z * this.columns + oldX;
          height[index] = this.height[old];
          support[index] = this.support[old];
        } else {
          support[index] = this.sampleSupport(minX + x * this.dx, z * this.dz) ?? NaN;
        }
      }
    }
    this.minX = minX;
    this.columns = columns;
    this.rows = rows;
    this.height = height;
    this.support = support;
  }
}
