/**
 * A bounded, ground-contact wet film; it stays behind when its owner moves.
 */
export class LatchSlimeTrail {
  /**
   * @param {import("./LatchSlug.js").LatchSlug} owner
   */
  constructor(owner) {
    this.owner = owner;
    this.points = [];
    this.age = 0;
    this.last = null;
    const { pc, app } = owner;
    this.entity = new pc.Entity("Latch Slug ground mucus");
    app.root.addChild(this.entity);
    this.material = new pc.StandardMaterial();
    this.material.diffuse.set(0.49, 0.37, 0.09);
    this.material.specular.set(0.65, 0.58, 0.35);
    this.material.useMetalness = false;
    this.material.gloss = 0.85;
    this.material.opacityVertexColor = true;
    this.material.opacityVertexColorChannel = "a";
    this.material.blendType = pc.BLEND_NORMAL;
    this.material.depthWrite = false;
    this.material.cull = pc.CULLFACE_NONE;
    this.material.update();
    this.mesh = new pc.Mesh(app.graphicsDevice);
    this.mesh.setPositions([0, -30, 0, 0.001, -30, 0, 0, -30, 0.001]);
    this.mesh.setNormals([0, 1, 0, 0, 1, 0, 0, 1, 0]);
    this.mesh.setColors([1, 1, 1, 0, 1, 1, 1, 0, 1, 1, 1, 0]);
    this.mesh.setIndices([0, 2, 1]);
    this.mesh.update(pc.PRIMITIVE_TRIANGLES);
    this.instance = new pc.MeshInstance(this.mesh, this.material, this.entity);
    this.instance.castShadow = false;
    this.instance.cull = false;
    this.entity.addComponent("render", { meshInstances: [this.instance] });
    this.prewarmed = false;
    this.prewarmHandle = app.once("postrender", () => {
      this.prewarmed = true;
    });
    this.handle = app.on("update", this.update, this);
  }

  /**
   * @param {number} dt
   */
  update(dt) {
    if (!Number.isFinite(dt) || dt <= 0) {
      return;
    }
    this.age += dt;
    while (this.points.length && this.age - this.points[0].time > 18) {
      this.points.shift();
    }
    const owner = this.owner;
    const position = owner.position;
    const moving = owner.entity.rigidbody?.linearVelocity;
    const emitting = owner.alive && !owner.carrier && !owner.airborne && !owner.gatewayArrival.active
      && moving && Math.hypot(moving.x, moving.z) > 0.08;
    if (emitting) {
      if (!this.last || this.last.distance(position) > 1.2) {
        this.last = position.clone();
        this.breakNext = true;
      }
      const distance = this.last.distance(position);
      if (distance >= 0.055) {
        const count = Math.ceil(distance / 0.055);
        const direction = position.clone().sub(this.last);
        const length = Math.hypot(direction.x, direction.z) || 1;
        for (let i = 1; i <= count; i++) {
          const point = this.last.clone().lerp(this.last, position, i / count);
          const hit = this.#ground(point);
          if (hit) {
            point.y = hit.point.y + 0.028;
            const previous = this.points.at(-1);
            if (previous && Math.abs(previous.position.y - point.y) > 0.08) {
              this.breakNext = true;
            }
            const width = owner.radius * (0.55 + 0.025 * Math.sin(this.age * 5));
            const row = [];
            for (let j = 0; j < 5; j++) {
              const across = (j - 2) / 2;
              const sample = point.clone();
              sample.x -= direction.z / length * across * width;
              sample.z += direction.x / length * across * width;
              const surface = j === 2 ? hit : this.#ground(sample);
              row.push(surface && Math.abs(surface.point.y - hit.point.y) <= 0.08
                ? surface.point.clone().add(new owner.pc.Vec3(0, 0.028 + (1 - across * across) * 0.004, 0)) : null);
            }
            this.points.push({
              position: point,
              row,
              time: this.age,
              breakBefore: this.breakNext,
            });
            this.breakNext = false;
          } else {
            this.breakNext = true;
          }
        }
        this.last.copy(position);
      }
    } else {
      this.last = null;
    }
    if (this.points.length > 480) {
      this.points.splice(0, this.points.length - 480);
    }
    this.#render();
  }

  /**
   * @param {import("playcanvas").Entity} entity
   * @returns {boolean}
   */
  static #isGround(entity) {
    return entity.rigidbody?.type === "static";
  }

  /**
   * @param {import("playcanvas").Vec3} point
   * @returns {import("playcanvas").RaycastResult|null}
   */
  #ground(point) {
    const start = point.clone(), end = point.clone();
    start.y += 0.22;
    end.y -= 0.24;
    const hit = this.owner.app.systems.rigidbody.raycastFirst(start, end, {
      filterCallback: LatchSlimeTrail.#isGround,
    });

    return hit?.normal.y > 0.65 ? hit : null;
  }

  #render() {
    const { pc } = this.owner;
    const positions = [], normals = [], colors = [], indices = [];
    for (let i = 0; i < this.points.length; i++) {
      const point = this.points[i];
      const fade = Math.min(1, (18 - (this.age - point.time)) / 8);
      const endFade = Math.min(1, i / 3, (this.points.length - 1 - i) / 2);
      for (let j = 0; j < 5; j++) {
        const across = (j - 2) / 2;
        const vertex = point.row[j] ?? point.position;
        positions.push(vertex.x, vertex.y, vertex.z);
        normals.push(0, 1, 0);
        colors.push(1, 1, 1, (1 - across * across) * fade * endFade * 0.55);
      }
      if (i && !point.breakBefore) {
        for (let j = 0; j < 4; j++) {
          if (!point.row[j] || !point.row[j + 1] || !this.points[i - 1].row[j] || !this.points[i - 1].row[j + 1]) {
            continue;
          }
          const heights = [point.row[j].y, point.row[j + 1].y,
            this.points[i - 1].row[j].y, this.points[i - 1].row[j + 1].y];
          if (Math.max(...heights) - Math.min(...heights) > 0.08) {
            continue;
          }
          const a = (i - 1) * 5 + j, b = i * 5 + j;
          indices.push(a, b, a + 1, a + 1, b, b + 1);
        }
      }
    }
    this.entity.enabled = indices.length > 0 || !this.prewarmed;
    if (!indices.length) {
      return;
    }
    this.mesh.setPositions(positions);
    this.mesh.setNormals(normals);
    this.mesh.setColors(colors);
    this.mesh.setIndices(indices);
    this.mesh.update(pc.PRIMITIVE_TRIANGLES);
  }

  destroy() {
    this.prewarmHandle.off();
    this.handle.off();
    this.entity.destroy();
    this.mesh.destroy();
    this.material.destroy();
  }
}
