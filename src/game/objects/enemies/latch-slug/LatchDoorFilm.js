const DENSITY_KG_PER_CUBIC_METRE = 1200;
const COHESIVE_FLOW_RESISTANCE = 1.5;

/**
 * Fixed-coordinate wet film. Ammo owns impact, obstruction and door contact;
 * its rigid-body solver has no viscous film representation. This bounded
 * surface-only transport conserves cell mass and never moves a rigid body.
 */
export class LatchDoorFilm {
  /**
   * @param {{positions:Float32Array,indices:number[],field:{height:(x:number,y:number)=>number,contains?:(x:number,y:number)=>boolean,support?:(x:number,y:number)=>number|null},floor:number,volume:number}} options
   */
  constructor({ positions, indices, field, floor, volume }) {
    this.field = field;
    this.density = DENSITY_KG_PER_CUBIC_METRE;
    this.flowSpeed = 0.015;
    this.floor = floor;
    this.changed = false;
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    for (let i = 0; i < positions.length; i += 3) {
      minX = Math.min(minX, positions[i]); maxX = Math.max(maxX, positions[i]);
      minY = Math.min(minY, positions[i + 1]); maxY = Math.max(maxY, positions[i + 1]);
    }
    // Leave dry space around the wet footprint. The solver boundary must never
    // become the visible edge as the blob spreads and refills a scraped gap.
    this.minX = minX - 0.6;
    this.minY = Math.max(floor, minY - 0.65);
    const width = maxX - minX + 1.2, height = maxY - this.minY + 0.45;
    this.nx = Math.max(4, Math.min(64, Math.ceil(width / 0.032) + 1));
    this.ny = Math.max(4, Math.min(64, Math.ceil(height / 0.032) + 1));
    this.dx = width / (this.nx - 1); this.dy = height / (this.ny - 1);
    this.count = this.nx * this.ny;
    this.heights = new Float64Array(this.count);
    this.supported = new Uint8Array(this.count);
    this.areas = new Float64Array(this.count);
    this.base = new Float32Array(this.count * 6);
    this.positions = new Float32Array(this.count * 6);
    this.indices = []; this.frontIndices = [];
    for (let y = 0; y < this.ny; y++) {
      for (let x = 0; x < this.nx; x++) {
        const v = y * this.nx + x, px = this.minX + x * this.dx, py = this.minY + y * this.dy;
        const onDoor = field.contains?.(px,py) ?? true;
        const support = onDoor ? field.height(px,py) : field.support?.(px,py);
        this.supported[v] = Number.isFinite(support) ? 1 : 0;
        const z = support ?? field.height(px,py);
        this.areas[v] = this.dx * this.dy * (x === 0 || x === this.nx - 1 ? 0.5 : 1) * (y === 0 || y === this.ny - 1 ? 0.5 : 1);
        this.base.set([px, py, z], v * 3); this.base.set([px, py, z], (v + this.count) * 3);
      }
    }
    // Rasterize the actual visible impact skin, taking only its outward height.
    for (let i = 0; i < indices.length; i += 3) {
      const a = indices[i] * 3, b = indices[i + 1] * 3, c = indices[i + 2] * 3;
      const ax = positions[a], ay = positions[a + 1], bx = positions[b], by = positions[b + 1], cx = positions[c], cy = positions[c + 1];
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
            // Carry deposited thickness around a projecting stone return.
            // Subtracting the arch's forward offset here would erase the goo
            // at exactly the ninety-degree corner despite real support.
            const sourceBase = field.height(px,py);
            this.heights[v] = Math.max(this.heights[v], u * positions[a + 2] + w * positions[b + 2] + (1 - u - w) * positions[c + 2] - sourceBase);
          }
        }
      }
    }
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
    const seeded = this.volume;
    // Impact establishes the deposited width. Subsequent relaxation may refill
    // bites and descend, but must not wet new columns farther sideways.
    this.wetColumns = new Uint8Array(this.nx);
    for (let i=0;i<this.count;i++) {
      if (this.heights[i] > 0.002) {
        this.wetColumns[i%this.nx] = 1;
      }
    }
    if (seeded > 1e-12) {
      for (let i = 0; i < this.count; i++) {
        this.heights[i] *= volume / seeded;
      }
    }
    this.initialVolume = this.volume;
    this.refresh();
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
   */
  update(dt) {
    const steps = Math.ceil(Math.min(Math.max(dt,0),0.1) / 0.008);
    const step = steps ? Math.min(dt,0.1) / steps : 0;
    for (let iteration = 0; iteration < steps; iteration++) {
      const delta = new Float64Array(this.count);
      for (let y = 0; y < this.ny; y++) {
        for (let x = 0; x < this.nx; x++) {
          const a = y * this.nx + x;
          for (const b of [x < this.nx - 1 ? a + 1 : -1, y < this.ny - 1 ? a + this.nx : -1]) {
            if (b < 0 || !this.supported[a] || !this.supported[b]) {
              continue;
            }
            if (b === a+1 && (!this.wetColumns[a%this.nx] || !this.wetColumns[b%this.nx])) {
              continue;
            }
            const h = this.heights[a], k = this.heights[b];
            // A nearly dry contact line must not diffuse across the entire
            // simulation rectangle. Thick gel still redistributes into bites.
            const mobility = Math.min(1, (Math.max(h,k) / 0.035) ** 2);
            let flux = (h - k) * Math.min(this.areas[a],this.areas[b]) * step * 2 * mobility / COHESIVE_FLOW_RESISTANCE;
            if (b === a + this.nx) {
              // Density contributes to weight, while the separate mobility
              // controls the slow, cohesive slump of dessert jelly.
              const backPressure = Math.max(0,1-h/(k+0.015));
              flux -= k * this.areas[b] * Math.min(0.14, step * this.flowSpeed * (this.density/1000) * Math.min(4,(k / 0.05) ** 2) / (this.dy*COHESIVE_FLOW_RESISTANCE)) * backPressure;
              // Positive flux would lift mass from the lower row to the upper
              // row. After impact only sideways wetting and descent remain.
              flux = Math.min(0,flux);
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
      if (this.minY <= this.floor + 0.0001) {
        for (let x = 0; x < this.nx; x++) {
          this.heights[x] *= Math.exp(-step * 5);
        }
      }
    }
    this.refresh();
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
