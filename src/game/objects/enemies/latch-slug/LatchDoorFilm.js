const DENSITY_KG_PER_CUBIC_METRE = 1200;
const COHESIVE_FLOW_RESISTANCE = 1.5;
const FLOOR_HOLDBACK_SECONDS = 180;
const MAX_SUPPORT_STEP_METRES = 0.08;

/**
 * Fixed-coordinate wet film. Ammo owns impact, obstruction and door contact;
 * its rigid-body solver has no viscous film representation. This bounded
 * surface-only transport conserves cell mass and never moves a rigid body.
 */
export class LatchDoorFilm {
  /**
   * @param {{positions:Float32Array,indices:number[],field:{height:(x:number,y:number)=>number,contains?:(x:number,y:number)=>boolean,support?:(x:number,y:number)=>number|null,canCross?:(x1:number,y:number,z1:number,x2:number,z2:number)=>boolean},floor:number,volume:number}} options
   */
  constructor({ positions, indices, field, floor, volume }) {
    this.field = field;
    this.density = DENSITY_KG_PER_CUBIC_METRE;
    this.flowSpeed = 0.015;
    this.age = 0;
    this.floor = floor;
    this.changed = false;
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    for (let i = 0; i < positions.length; i += 3) {
      minX = Math.min(minX, positions[i]); maxX = Math.max(maxX, positions[i]);
      minY = Math.min(minY, positions[i + 1]); maxY = Math.max(maxY, positions[i + 1]);
    }
    // Leave dry space around the wet footprint. The solver boundary must never
    // become the visible edge as the blob spreads and refills a scraped gap.
    this.minX = minX - 1.2;
    // The bottom of the transport grid is the real sill, not an invisible
    // shelf a fixed distance below the impact. Otherwise high splats pile up
    // against that shelf and settle into the simulation rectangle.
    this.minY = floor;
    const width = maxX - minX + 2.4, height = Math.max(0.45, maxY - this.minY + 0.45);
    this.nx = Math.max(4, Math.min(64, Math.ceil(width / 0.032) + 1));
    this.ny = Math.max(4, Math.min(64, Math.ceil(height / 0.032) + 1));
    this.dx = width / (this.nx - 1); this.dy = height / (this.ny - 1);
    this.count = this.nx * this.ny;
    this.heights = new Float64Array(this.count);
    this.runoff = new Float64Array(this.nx);
    this.runoffSource = new Int32Array(this.nx);
    this.supported = new Uint8Array(this.count);
    this.seamPassable = new Uint8Array(this.count);
    this.areas = new Float64Array(this.count);
    this.base = new Float32Array(this.count * 6);
    this.positions = new Float32Array(this.count * 6);
    this.indices = []; this.frontIndices = [];
    const footprint = new Uint8Array(this.count);
    const doorSamples = new Uint8Array(this.count);
    for (let y = 0; y < this.ny; y++) {
      for (let x = 0; x < this.nx; x++) {
        const v = y * this.nx + x, px = this.minX + x * this.dx, py = this.minY + y * this.dy;
        const onDoor = field.contains?.(px,py) ?? true;
        doorSamples[v] = onDoor ? 1 : 0;
        const support = onDoor ? field.height(px,py) : field.support?.(px,py);
        this.supported[v] = Number.isFinite(support) ? 1 : 0;
        const z = support ?? field.height(px,py);
        this.areas[v] = this.dx * this.dy * (x === 0 || x === this.nx - 1 ? 0.5 : 1) * (y === 0 || y === this.ny - 1 ? 0.5 : 1);
        this.base.set([px, py, z], v * 3); this.base.set([px, py, z], (v + this.count) * 3);
      }
    }
    if (this.dx <= 0.08 && field.canCross) {
      for (let y = 0; y < this.ny; y++) {
        for (let x = 0; x + 2 < this.nx; x++) {
          const a = y * this.nx + x, b = a + 1, c = a + 2;
          if (this.supported[a] && !this.supported[b] && this.supported[c] &&
            Math.abs(this.base[a * 3 + 2] - this.base[c * 3 + 2]) <= MAX_SUPPORT_STEP_METRES &&
            field.canCross(this.base[a * 3], this.base[a * 3 + 1], this.base[a * 3 + 2], this.base[c * 3], this.base[c * 3 + 2])) {
            this.seamPassable[a] = 1;
          }
        }
      }
    }
    // Rasterize the actual visible impact skin, taking only its outward height.
    for (let i = 0; i < indices.length; i += 3) {
      const a = indices[i] * 3, b = indices[i + 1] * 3, c = indices[i + 2] * 3;
      const ax = positions[a], ay = positions[a + 1], bx = positions[b], by = positions[b + 1], cx = positions[c], cy = positions[c + 1];
      const az = positions[a + 2] - field.height(ax, ay);
      const bz = positions[b + 2] - field.height(bx, by);
      const cz = positions[c + 2] - field.height(cx, cy);
      const area = (by - cy) * (ax - cx) + (cx - bx) * (ay - cy);
      if (Math.abs(area) < 1e-10) {
        continue;
      }
      const x0 = Math.max(0, Math.floor((Math.min(ax,bx,cx) - this.minX) / this.dx)), x1 = Math.min(this.nx - 1, Math.ceil((Math.max(ax,bx,cx) - this.minX) / this.dx));
      const y0 = Math.max(0, Math.floor((Math.min(ay,by,cy) - this.minY) / this.dy)), y1 = Math.min(this.ny - 1, Math.ceil((Math.max(ay,by,cy) - this.minY) / this.dy));
      for (let y = y0; y <= y1; y++) {
        for (let x = x0; x <= x1; x++) {
          const v = y * this.nx + x, px = this.base[v * 3], py = this.base[v * 3 + 1];
          const u = ((by - cy) * (px - cx) + (cx - bx) * (py - cy)) / area;
          const w = ((cy - ay) * (px - cx) + (ax - cx) * (py - cy)) / area;
          if (this.supported[v] && u >= -0.00001 && w >= -0.00001 && u + w <= 1.00001) {
            // Transfer thickness above each source vertex's support. Sampling
            // support at the destination instead can put a coarse triangle
            // behind raised door hardware and erase the entire deposit.
            const thickness = u * az + w * bz + (1 - u - w) * cz;
            // The authored skin includes dry, collapsed padding. It is mesh
            // coverage, not deposited gel: conservation must not refill it.
            // Negative depth still admits a body partly behind raised support.
            if (Math.abs(thickness) > 1e-6) {
              footprint[v] = 1;
            }
            this.heights[v] = Math.max(this.heights[v], thickness);
          }
        }
      }
    }
    this.#connectFootprint(footprint, doorSamples);
    for (let y = 0; y < this.ny - 1; y++) {
      for (let x = 0; x < this.nx - 1; x++) {
        const a = y * this.nx + x, b = a + 1, c = a + this.nx, d = c + 1;
        this.frontIndices.push(a,b,d,a,d,c);
        this.indices.push(a,b,d,a,d,c,a+this.count,d+this.count,b+this.count,a+this.count,c+this.count,d+this.count);
      }
    }
    const rim = [];
    for (let x = 0; x < this.nx - 1; x++) {
      rim.push([x+1,x],[(this.ny-1)*this.nx+x,(this.ny-1)*this.nx+x+1]);
    }
    for (let y = 0; y < this.ny - 1; y++) {
      rim.push([y*this.nx,(y+1)*this.nx],[(y+1)*this.nx+this.nx-1,y*this.nx+this.nx-1]);
    }
    for (const [a,b] of rim) {
      this.indices.push(a,b,a+this.count,b,b+this.count,a+this.count);
    }
    this.#conserveDeposit(volume, footprint);
    this.#taperFootprint(volume, footprint);
    // Retain the initial footprint for diagnostics; pressure may later carry
    // gel into adjacent supported columns.
    this.wetColumns = new Uint8Array(this.nx);
    for (let i=0;i<this.count;i++) {
      if (this.heights[i] > 0.002) {
        this.wetColumns[i%this.nx] = 1;
      }
    }
    this.initialVolume = this.volume;
    this.refresh();
  }

  /**
   * Native support rays can also find a separate wall across the jamb gap.
   * Deposit only on wet support connected to the impacted leaf; a ray hit on
   * another island must not create a detached ribbon of gel there.
   * @param {Uint8Array} footprint
   * @param {Uint8Array} doorSamples
   */
  #connectFootprint(footprint, doorSamples) {
    const connected = new Uint8Array(this.count), queue = new Int32Array(this.count);
    let head = 0, tail = 0, nearest = -1, distance = Infinity;
    let nearestDoor = -1, doorDistance = Infinity;
    for (let i = 0; i < this.count; i++) {
      if (!footprint[i]) {
        continue;
      }
      const d = this.base[i * 3] ** 2 + this.base[i * 3 + 1] ** 2;
      if (d < distance) {
        nearest = i;
        distance = d;
      }
      if (doorSamples[i] && d < doorDistance) {
        nearestDoor = i;
        doorDistance = d;
      }
    }
    const seed = nearestDoor >= 0 ? nearestDoor : nearest;
    if (seed >= 0) {
      connected[seed] = 1;
      queue[tail++] = seed;
    }
    while (head < tail) {
      const i = queue[head++], x = i % this.nx;
      for (const next of [x > 0 ? i - 1 : -1, x < this.nx - 1 ? i + 1 : -1, i - this.nx, i + this.nx]) {
        if (next >= 0 && next < this.count && footprint[next] && !connected[next] &&
          Math.abs(this.base[i * 3 + 2] - this.base[next * 3 + 2]) <= MAX_SUPPORT_STEP_METRES) {
          connected[next] = 1;
          queue[tail++] = next;
        }
      }
    }
    for (let i = 0; i < this.count; i++) {
      if (!connected[i]) {
        footprint[i] = 0;
        this.heights[i] = 0;
      }
    }
  }

  /**
   * Spread rasterization loss across the supported impact footprint. Multiplying
   * a nearly empty raster by volume / seeded creates metre-long gel spikes.
   * @param {number} volume
   * @param {Uint8Array} footprint
   */
  #conserveDeposit(volume, footprint) {
    let area = 0;
    for (let i = 0; i < this.count; i++) {
      area += footprint[i] * this.areas[i];
    }
    if (area <= 0) {
      return;
    }
    const ceiling = Math.max(0.12, volume / area * 1.5);
    let capacity = 0;
    for (let i = 0; i < this.count; i++) {
      this.heights[i] = Math.min(this.heights[i], ceiling);
      capacity += footprint[i] * (ceiling - this.heights[i]) * this.areas[i];
    }
    const seeded = this.volume;
    for (let i = 0; i < this.count; i++) {
      if (seeded >= volume && seeded > 0) {
        this.heights[i] *= volume / seeded;
      } else if (capacity > 0 && footprint[i]) {
        this.heights[i] += (ceiling - this.heights[i]) * (volume - seeded) / capacity;
      }
    }
  }

  /**
   * Fade the deposited thickness into its contact line before redistributing
   * the same volume. A uniform refill turns a clipped impact into a slab with
   * a vertical fin at the edge of a door or wall.
   * @param {number} volume
   * @param {Uint8Array} footprint
   */
  #taperFootprint(volume, footprint) {
    const distance = new Int32Array(this.count), queue = new Int32Array(this.count);
    let head = 0, tail = 0;
    for (let i = 0; i < this.count; i++) {
      if (!footprint[i]) {
        continue;
      }
      const x = i % this.nx, y = Math.floor(i / this.nx);
      if (x === 0 || x === this.nx - 1 || y === 0 || y === this.ny - 1 ||
        !footprint[i - 1] || !footprint[i + 1] || !footprint[i - this.nx] || !footprint[i + this.nx] ||
        Math.abs(this.base[i * 3 + 2] - this.base[(i - 1) * 3 + 2]) > MAX_SUPPORT_STEP_METRES ||
        Math.abs(this.base[i * 3 + 2] - this.base[(i + 1) * 3 + 2]) > MAX_SUPPORT_STEP_METRES ||
        Math.abs(this.base[i * 3 + 2] - this.base[(i - this.nx) * 3 + 2]) > MAX_SUPPORT_STEP_METRES ||
        Math.abs(this.base[i * 3 + 2] - this.base[(i + this.nx) * 3 + 2]) > MAX_SUPPORT_STEP_METRES) {
        distance[i] = 1;
        queue[tail++] = i;
      }
    }
    while (head < tail) {
      const i = queue[head++], x = i % this.nx;
      for (const next of [x > 0 ? i - 1 : -1, x + 1 < this.nx ? i + 1 : -1, i - this.nx, i + this.nx]) {
        if (next >= 0 && next < this.count && footprint[next] && !distance[next]) {
          distance[next] = distance[i] + 1;
          queue[tail++] = next;
        }
      }
    }
    const envelope = new Float64Array(this.count);
    let area = 0;
    for (let i = 0; i < this.count; i++) {
      const t = Math.min(1, distance[i] / 4);
      envelope[i] = t * t * (3 - 2 * t);
      area += envelope[i] * this.areas[i];
    }
    if (area <= 0) {
      return;
    }
    const cap = Math.max(0.12, volume / area * 1.2);
    let capacity = 0;
    for (let i = 0; i < this.count; i++) {
      this.heights[i] = Math.min(this.heights[i] * envelope[i], cap * envelope[i]);
      capacity += (cap * envelope[i] - this.heights[i]) * this.areas[i];
    }
    const seeded = this.volume;
    for (let i = 0; i < this.count; i++) {
      if (seeded >= volume && seeded > 0) {
        this.heights[i] *= volume / seeded;
      } else if (capacity > 0) {
        this.heights[i] += (cap * envelope[i] - this.heights[i]) * (volume - seeded) / capacity;
      }
    }
  }

  /**
   * @returns {number}
   */
  get volume() {
    let sum = 0;
    for (let i = 0; i < this.count; i++) {
      sum += this.heights[i] * this.areas[i];
    }

    return sum;
  }

  /**
   * Remaining dessert-jelly mass in kilograms; geometry uses metres.
   * @returns {number}
   */
  get mass() {
    return this.volume*this.density;
  }
  /**
   * @returns {boolean}
   */
  get drained() {
    return this.volume <= Math.max(1e-7, this.initialVolume * 0.002);
  }

  /**
   * @param {number} dt
   * @param {number} pressureScale Combined mass of touching deposits relative to this deposit.
   */
  update(dt, pressureScale = 1) {
    this.runoff.fill(0);
    this.runoffSource.fill(-1);
    const elapsed = Math.min(Math.max(dt, 0), 0.1);
    this.age += elapsed;
    const runoffTime = Math.min(elapsed, Math.max(0, this.age - FLOOR_HOLDBACK_SECONDS));
    const steps = Math.ceil(elapsed / 0.008);
    const step = steps ? elapsed / steps : 0;
    this.#openWetSeams();
    const columnDepth = new Float64Array(this.nx);
    for (let i = 0; i < this.count; i++) {
      columnDepth[i % this.nx] = Math.max(columnDepth[i % this.nx], this.heights[i]);
    }
    for (let iteration = 0; iteration < steps; iteration++) {
      const delta = new Float64Array(this.count);
      for (let y = 0; y < this.ny; y++) {
        for (let x = 0; x < this.nx; x++) {
          const a = y * this.nx + x;
          for (const b of [x < this.nx - 1 ? a + 1 : -1, y < this.ny - 1 ? a + this.nx : -1]) {
            if (b < 0 || !this.supported[a] || !this.supported[b]) {
              continue;
            }
            if (Math.abs(this.base[a * 3 + 2] - this.base[b * 3 + 2]) > MAX_SUPPORT_STEP_METRES) {
              continue;
            }
            const h = this.heights[a], k = this.heights[b];
            // A nearly dry contact line must not diffuse across the entire
            // simulation rectangle. Thick gel still redistributes into bites.
            const mobility = Math.min(1, (Math.max(h,k) / 0.035) ** 2);
            // Preserve the contour at ordinary depths; relieve pressure when
            // gel piles up, as well as when it flows back into a cut gap.
            const pressureH = Math.max(0, h * pressureScale - 0.1) / pressureScale;
            const pressureK = Math.max(0, k * pressureScale - 0.1) / pressureScale;
            let flux = (this.changed ? h - k : pressureH - pressureK) *
              Math.min(this.areas[a],this.areas[b]) * step * 2 * mobility / COHESIVE_FLOW_RESISTANCE;
            if (b === a + this.nx) {
              // Advect cohesive columns downward, but slow the flow into an
              // already thick cell so a blocked sill cannot create a fin.
              const depth = columnDepth[x];
              const space = Math.max(0, 1 - h / 0.18);
              flux = -k * this.areas[b] * Math.min(0.14, step * this.flowSpeed * (this.density/1000) * Math.min(4,(depth / 0.05) ** 2) / (this.dy*COHESIVE_FLOW_RESISTANCE)) * space;
            }
            const donor = flux > 0 ? a : b;
            const amount = Math.min(Math.abs(flux), this.heights[donor] * this.areas[donor] * 0.18);
            flux = Math.sign(flux) * amount;
            delta[a] -= flux; delta[b] += flux;
          }
        }
      }
      for (let i = 0; i < this.count; i++) {
        this.heights[i] = Math.max(0, this.heights[i] + delta[i] / this.areas[i]);
      }
    }
    this.#settleSideEdges(elapsed);
    if (runoffTime > 0 && this.minY <= this.floor + 0.0001) {
      for (let x = 0; x < this.nx; x++) {
        const before = this.heights[x];
        this.heights[x] *= Math.exp(-runoffTime * 5);
        this.runoff[x] = (before - this.heights[x]) * this.areas[x];
        if (this.runoff[x] > 0) {
          this.runoffSource[x] = x;
        }
      }
    }
    // Door meshes can stop just above the ground or leave a narrow seam at
    // the sill. Hand off the lowest supported cell to the separately sampled
    // floor; the receiver returns the volume if there is no floor contact.
    for (let x = 0; runoffTime > 0 && x < this.nx; x++) {
      if (this.runoffSource[x] >= 0) {
        continue;
      }
      for (let y = 1; y < this.ny && y * this.dy <= 0.22; y++) {
        const index = y * this.nx + x;
        if (!this.supported[index]) {
          continue;
        }
        const before = this.heights[index];
        this.heights[index] *= Math.exp(-runoffTime * 0.8);
        this.runoff[x] = (before - this.heights[index]) * this.areas[index];
        this.runoffSource[x] = index;
        break;
      }
    }
    this.refresh();
  }

  /**
   * Form a continuous small gel neck over a seam only after Ammo confirms
   * that its two supported faces are unobstructed. The neck takes volume
   * from the wet side; it never teleports gel to the far side.
   */
  #openWetSeams() {
    for (let a = 0; a < this.count; a++) {
      if (!this.seamPassable[a] || this.supported[a + 1]) {
        continue;
      }
      const b = a + 1, c = a + 2, donor = this.heights[a] >= this.heights[c] ? a : c;
      if (this.heights[donor] <= 0.004) {
        continue;
      }
      this.supported[b] = 1;
      const depth = (this.base[a * 3 + 2] + this.base[c * 3 + 2]) / 2;
      this.base[b * 3 + 2] = depth;
      this.base[(b + this.count) * 3 + 2] = depth;
      const volume = Math.min(this.heights[donor] * 0.25, 0.02) * this.areas[donor];
      this.heights[donor] -= volume / this.areas[donor];
      this.heights[b] += volume / this.areas[b];
    }
  }

  /**
   * Move a thick rim back into its connected surface when a solid corner
   * blocks sideways flow. This keeps the contact line tapered as gel settles,
   * without removing mass or blocking an unobstructed seam transfer.
   * @param {number} dt
   */
  #settleSideEdges(dt) {
    const delta = new Float64Array(this.count), fraction = 1 - Math.exp(-dt * 4);
    for (let y = 0; y < this.ny; y++) {
      for (let x = 1; x < this.nx - 1; x++) {
        const i = y * this.nx + x;
        if (!this.supported[i] || this.heights[i] <= 0) {
          continue;
        }
        for (const direction of [-1, 1]) {
          const outside = i + direction, inside = i - direction;
          const blocked = !this.supported[outside] ||
            Math.abs(this.base[i * 3 + 2] - this.base[outside * 3 + 2]) > MAX_SUPPORT_STEP_METRES;
          const seam = direction > 0 ? this.seamPassable[i] : x >= 2 && this.seamPassable[i - 2];
          if (!blocked || seam || !this.supported[inside] ||
            Math.abs(this.base[i * 3 + 2] - this.base[inside * 3 + 2]) > MAX_SUPPORT_STEP_METRES) {
            continue;
          }
          const excess = Math.max(0, this.heights[i] - this.heights[inside] * 0.4);
          const capacity = Math.max(0, 0.18 - this.heights[inside]);
          const volume = Math.min(excess * this.areas[i] * fraction, capacity * this.areas[inside]);
          delta[i] -= volume;
          delta[inside] += volume;
        }
      }
    }
    for (let i = 0; i < this.count; i++) {
      this.heights[i] = Math.max(0, this.heights[i] + delta[i] / this.areas[i]);
    }
  }

  /**
   * @param {{x:number,y:number,z:number}} start
   * @param {{x:number,y:number,z:number}} end
   * @param {number} radius
   * @returns {number}
   */
  cut(start,end,radius) {
    const before = this.volume, dx = end.x-start.x, dy = end.y-start.y, length = dx*dx+dy*dy;
    this.lastRemoved = new Float64Array(this.count);
    for (let i = 0; i < this.count; i++) {
      const x = this.base[i*3], y = this.base[i*3+1];
      const t = length ? Math.max(0,Math.min(1,((x-start.x)*dx+(y-start.y)*dy)/length)) : 0;
      const distance = Math.hypot(x-start.x-dx*t,y-start.y-dy*t);
      if (distance >= radius || Math.abs(this.positions[i*3+2] - start.z-(end.z-start.z)*t) > radius+0.12) {
        continue;
      }
      const edge = Math.max(0,Math.min(1,(distance/radius-0.4)/0.6));
      const factor = edge*edge*(3-2*edge);
      this.lastRemoved[i] = this.heights[i]*(1-factor);
      this.heights[i] *= factor;
    }
    this.changed ||= before > this.volume;
    this.refresh();

    return Math.max(0,before-this.volume);
  }

  refresh() {
    this.positions.set(this.base);
    for (let i = 0; i < this.count; i++) {
      this.positions[i*3+2] += this.heights[i];
    }
    this.renderIndices = [];
    this.renderPositions = this.positions.slice();
    const contactLine = new Map();
    for (let i = 0; i < this.indices.length; i += 3) {
      const a = this.indices[i], b = this.indices[i+1], c = this.indices[i+2];
      if (a >= this.count && b >= this.count && c >= this.count) {
        continue;
      }
      if (!this.supported[a % this.count] || !this.supported[b % this.count] || !this.supported[c % this.count]) {
        continue;
      }
      const za = this.base[(a % this.count) * 3 + 2];
      const zb = this.base[(b % this.count) * 3 + 2];
      const zc = this.base[(c % this.count) * 3 + 2];
      if (Math.max(za, zb, zc) - Math.min(za, zb, zc) > MAX_SUPPORT_STEP_METRES) {
        continue;
      }
      // Trace the wet footprint, not the rectangular solver domain. Sub-mm
      // residue stays in the mass accounting without painting the door yellow.
      if (Math.max(this.heights[a%this.count],this.heights[b%this.count],this.heights[c%this.count]) > 0.004) {
        this.renderIndices.push(a,b,c);
        // Interpolate dry vertices onto the wet contour instead of exposing
        // whole grid squares at the edge of the blob.
        if (a < this.count && b < this.count && c < this.count) {
          for (const dry of [a,b,c]) {
            if (this.heights[dry] > 0.004) {
              continue;
            }
            for (const wet of [a,b,c]) {
              if (this.heights[wet] <= 0.004) {
                continue;
              }
              const t = (0.004-this.heights[dry])/(this.heights[wet]-this.heights[dry]);
              const sum = contactLine.get(dry) ?? [0,0,0,0];
              for (let axis=0;axis<3;axis++) {
                sum[axis] += this.positions[dry*3+axis]*(1-t)+this.positions[wet*3+axis]*t;
              }
              sum[3]++;
              contactLine.set(dry,sum);
            }
          }
        }
      }
    }
    for (const [vertex,sum] of contactLine) {
      for (let axis=0;axis<3;axis++) {
        this.renderPositions[vertex*3+axis] = sum[axis]/sum[3];
      }
    }
  }
}
