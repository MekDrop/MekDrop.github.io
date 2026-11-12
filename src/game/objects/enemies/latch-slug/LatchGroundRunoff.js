import { LatchGroundFilm } from "./LatchGroundFilm.js";

/**
 * Renders runoff on floor contacts queried from Ammo. Its conserved volume is
 * separate from the wall film, but remains owned by the originating splat.
 */
export class LatchGroundRunoff {
  /**
   * @param {import("./LatchSurface.js").LatchSurface} surface
   */
  constructor(surface) {
    this.surface = surface;
    const { owner, film, splash } = surface;
    const { pc, app } = owner;
    this.entity = new pc.Entity("Latch Slug ground runoff");
    splash.entity.addChild(this.entity);
    this.mesh = new pc.Mesh(app.graphicsDevice);
    this.material = surface.material.clone();
    this.material.cull = pc.CULLFACE_NONE;
    this.material.update();
    this.instance = new pc.MeshInstance(this.mesh, this.material, this.entity);
    this.instance.castShadow = false;
    this.instance.cull = false;
    this.entity.addComponent("render", { meshInstances: [this.instance] });
    this.film = new LatchGroundFilm({
      minX: film.minX - 0.8,
      maxX: film.minX + (film.nx - 1) * film.dx + 0.8,
      depth: 3,
      columns: 48,
      rows: 40,
      support: this.#support.bind(this),
    });
  }

  /**
   * @param {number} x
   * @param {number} z
   * @returns {number|null}
   */
  #support(x, z) {
    const { surface } = this, { pc, app } = surface.owner;
    const transform = surface.splash.entity.getWorldTransform();
    const start = transform.transformPoint(new pc.Vec3(x, surface.floor + 0.5, z * surface.normalSign));
    const end = transform.transformPoint(new pc.Vec3(x, surface.floor - 1.5, z * surface.normalSign));
    const hits = app.systems.rigidbody.raycastAll(start, end);
    let nearest = null, distance = Infinity;
    for (const hit of hits) {
      if (hit.entity.rigidbody?.type !== "static" || !hit.point || !hit.normal || hit.normal.y < 0.65) {
        continue;
      }
      const current = start.distance(hit.point);
      if (current < distance) {
        distance = current;
        nearest = hit.point;
      }
    }

    return nearest ? transform.clone().invert().transformPoint(nearest).y + 0.006 : null;
  }

  /**
   * @param {number} dt
   */
  update(dt) {
    const { surface, film } = this;
    let returned = false;
    for (let x = 0; x < surface.film.nx; x++) {
      const amount = surface.film.runoff[x];
      const accepted = film.deposit(surface.film.minX + x * surface.film.dx, amount);
      if (accepted < amount) {
        const source = surface.film.runoffSource[x];
        if (source >= 0) {
          surface.film.heights[source] += (amount - accepted) / surface.film.areas[source];
          returned = true;
        }
      }
    }
    if (returned) {
      surface.film.refresh();
    }
    film.update(dt);
    this.renderTime = (this.renderTime ?? 0) + dt;
    if (this.renderTime < 1 / 15) {
      return;
    }
    this.renderTime = 0;
    const vertices = [], positions = [], indices = [], { columns, rows } = film;
    for (let z = 0; z < rows; z++) {
      for (let x = 0; x < columns; x++) {
        const i = z * columns + x;
        vertices.push(film.minX + x * film.dx, (Number.isFinite(film.support[i]) ? film.support[i] : surface.floor) + film.height[i], z * film.dz * surface.normalSign);
      }
    }
    for (let z = 0; z < rows - 1; z++) {
      for (let x = 0; x < columns - 1; x++) {
        const a = z * columns + x, b = a + 1, c = a + columns, d = c + 1;
        for (const triangle of [[a,b,d], [a,d,c]]) {
          let supported = true, wet = false;
          for (const index of triangle) {
            supported &&= Number.isFinite(film.support[index]);
            wet ||= film.height[index] > 0.002;
          }
          if (supported && wet) {
            const polygon = [];
            for (let edge = 0; edge < 3; edge++) {
              const current = triangle[edge], next = triangle[(edge + 1) % 3];
              const inside = film.height[current] > 0.002, nextInside = film.height[next] > 0.002;
              if (inside) {
                polygon.push(vertices.slice(current * 3, current * 3 + 3));
              }
              if (inside !== nextInside) {
                const t = (0.002 - film.height[current]) / (film.height[next] - film.height[current]);
                const point = [];
                for (let axis = 0; axis < 3; axis++) {
                  point.push(vertices[current * 3 + axis] * (1 - t) + vertices[next * 3 + axis] * t);
                }
                polygon.push(point);
              }
            }
            const first = positions.length / 3;
            for (const point of polygon) {
              positions.push(...point);
            }
            for (let i = 1; i < polygon.length - 1; i++) {
              indices.push(first, first + i, first + i + 1);
            }
          }
        }
      }
    }
    if (indices.length === 0) {
      this.entity.enabled = false;

      return;
    }
    this.entity.enabled = true;
    this.mesh.clear(true, false);
    this.mesh.setPositions(positions);
    this.mesh.setIndices(indices);
    this.mesh.setNormals(surface.owner.pc.calculateNormals(positions, indices));
    this.mesh.update();
  }

  /**
   * @param {import("playcanvas").Vec3} origin
   * @param {number} reach
   * @returns {(import("playcanvas").Vec3 & {gooThickness:number})[]}
   */
  candidates(origin, reach) {
    const { film, surface } = this, transform = surface.splash.entity.getWorldTransform();
    const result = [];
    for (let i = 0; i < film.height.length; i++) {
      if (film.height[i] <= 0.004) {
        continue;
      }
      const point = transform.transformPoint(new surface.owner.pc.Vec3(
        film.minX + i % film.columns * film.dx,
        film.support[i] + film.height[i],
        Math.floor(i / film.columns) * film.dz * surface.normalSign,
      ));
      if (point.distance(origin) <= reach) {
        result.push(Object.assign(point, { gooThickness: film.height[i] }));
      }
    }

    return result;
  }

  /**
   * @param {import("playcanvas").Vec3} start
   * @param {import("playcanvas").Vec3} end
   * @param {number} radius
   * @returns {{volume:number,positions:number[]}}
   */
  cut(start, end, radius) {
    const { film, surface } = this, transform = surface.splash.entity.getWorldTransform();
    const inverse = transform.clone().invert(), from = inverse.transformPoint(start), to = inverse.transformPoint(end);
    const dx = to.x - from.x, dz = to.z - from.z, length = dx * dx + dz * dz;
    const selected = new Uint8Array(film.height.length), previous = film.height.slice();
    let volume = 0;
    for (let i = 0; i < film.height.length; i++) {
      if (film.height[i] <= 0) {
        continue;
      }
      const x = film.minX + i % film.columns * film.dx;
      const z = Math.floor(i / film.columns) * film.dz * surface.normalSign;
      const t = length ? Math.max(0, Math.min(1, ((x - from.x) * dx + (z - from.z) * dz) / length)) : 0;
      const distance = Math.hypot(x - from.x - dx * t, z - from.z - dz * t);
      if (distance >= radius || Math.abs(film.support[i] + film.height[i] - (from.y + (to.y - from.y) * t)) > radius + 0.12) {
        continue;
      }
      const edge = Math.max(0, Math.min(1, (distance / radius - 0.4) / 0.6));
      film.height[i] *= edge * edge * (3 - 2 * edge);
      volume += (previous[i] - film.height[i]) * film.area;
      selected[i] = 1;
    }
    const positions = [], point = new surface.owner.pc.Vec3();
    for (let z = 0; z < film.rows - 1; z++) {
      for (let x = 0; x < film.columns - 1; x++) {
        const a = z * film.columns + x, b = a + 1, c = a + film.columns, d = c + 1;
        for (const triangle of [[a,b,d], [a,d,c]]) {
          if (!selected[triangle[0]] && !selected[triangle[1]] && !selected[triangle[2]]) {
            continue;
          }
          for (const i of triangle) {
            transform.transformPoint(point.set(film.minX + i % film.columns * film.dx,
              (Number.isFinite(film.support[i]) ? film.support[i] : surface.floor) + previous[i],
              Math.floor(i / film.columns) * film.dz * surface.normalSign), point);
            positions.push(point.x, point.y, point.z);
          }
        }
      }
    }

    return {
      volume,
      positions,
    };
  }

  destroy() {
    this.entity.destroy();
    this.mesh.destroy();
    this.material.destroy();
  }
}
