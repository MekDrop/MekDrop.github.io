// Match the live-slime scoop: pull at 0.45s, taste at 0.92s.
const MOUTH_TIME = 0.47;
const FINISH_TIME = MOUTH_TIME+0.2;

/**
 * The removed skin stays on the claw, folds into a soft morsel and is swallowed.
 * This is contact-driven gel presentation, not a replacement physics solver.
 */
export class BellBugGooMeal {
  /**
   * @param {import("./BellBug.js").BellBug} owner
   * @param {{positions:number[],material:import("playcanvas").StandardMaterial,volume:number}} sample
   * @param {number} side
   * @param {import("playcanvas").Vec3} contact
   */
  constructor(owner, sample, side, contact) {
    this.owner = owner;
    this.side = side;
    this.contact = contact.clone();
    this.volume = sample.volume;
    this.age = 0;
    this.active = true;
    const { pc, app } = owner;
    this.entity = new pc.Entity("Collected goo on claw", app);
    owner.entity.addChild(this.entity);
    this.entity.setPosition(contact);
    this.entity.setRotation(pc.Quat.IDENTITY);
    this.positions = new Float32Array(sample.positions);
    for (let i = 0; i < this.positions.length; i += 3) {
      this.positions[i] -= contact.x;
      this.positions[i + 1] -= contact.y;
      this.positions[i + 2] -= contact.z;
    }
    this.indices = Array.from({ length: this.positions.length / 3 }, BellBugGooMeal.#index);
    this.mesh = new pc.Mesh(app.graphicsDevice);
    this.material = new pc.StandardMaterial();
    this.material.diffuse.copy(sample.material.diffuse);
    this.material.opacity = 0.86;
    this.material.blendType = pc.BLEND_NORMAL;
    this.material.gloss = 0.78;
    this.material.clearCoat = 0.4;
    this.material.cull = pc.CULLFACE_NONE;
    this.material.update();
    this.#deform();
    const instance = new pc.MeshInstance(this.mesh, this.material, this.entity);
    instance.castShadow = false;
    this.entity.addComponent("render", { meshInstances: [instance] });
    owner.playGooSound?.("gooPull", 1.06 + side * 0.04);
    this.handle = app.on("update", this.#update, this);
  }

  /**
   * @param {number} value
   * @param {number} index
   * @returns {number}
   */
  static #index(value, index) {
    return index;
  }

  /**
   * @returns {import("playcanvas").Vec3}
   */
  get mouth() {
    const b = this.owner;
    const head = b.animationPlayback?.model.findByName("head");

    return (head?.getPosition().clone() ?? b.position.clone().add(new b.pc.Vec3(0, 0.45, 0)))
      .add(b.entity.forward.clone().mulScalar(0.08));
  }

  /**
   * @returns {import("playcanvas").Vec3}
   */
  get goal() {
    const t = Math.min(1, this.age / MOUTH_TIME);
    const goal = this.contact.clone().lerp(this.contact, this.mouth, t * t * (3 - 2 * t));
    goal.y += Math.sin(t * Math.PI) * 0.035;

    return goal;
  }

  /**
   * @param {number} dt
   */
  #update(dt) {
    this.age += Math.max(0, dt);
    if (this.age >= MOUTH_TIME && !this.swallowing) {
      this.swallowing = true;
      this.owner.playGooSound?.("gooSwallow", 1.12 + this.side * 0.04);
    }
    if (this.age >= FINISH_TIME || !this.owner.alive) {
      if (this.owner.alive) {
        this.owner.doorScratch.swallowedVolume += this.volume;
      }
      this.destroy();
    }
  }

  #deform() {
    const { pc } = this.owner;
    const positions = new Float32Array(this.positions);
    const fold = Math.min(1, this.age / 0.2);
    const swallow = Math.max(0, Math.min(1, (this.age - MOUTH_TIME) / 0.2));
    const size = 1 - swallow * swallow;
    for (let i = 0; i < positions.length; i += 3) {
      const x = this.positions[i], y = this.positions[i + 1], z = this.positions[i + 2];
      const distance = Math.hypot(x, y, z);
      // Fold the actual sampled patch into a rounded bite without substituting
      // a stock sphere. Different collected patches retain different contours.
      const round = distance > 0.001 ? Math.min(1, 0.065 / distance) : 1;
      const factor = (1 - fold * 0.8 + fold * 0.8 * round) * size;
      positions[i] = x * factor * (1 + Math.sin(this.age * 27 + y * 15) * 0.09);
      positions[i + 1] = y * factor * (1 - Math.sin(this.age * 27 + x * 15) * 0.09);
      positions[i + 2] = z * factor;
    }
    this.mesh.setPositions(positions);
    this.mesh.setIndices(this.indices);
    this.mesh.setNormals(pc.calculateNormals(positions, this.indices));
    this.mesh.update();
  }

  pose() {
    if (!this.active) {
      return;
    }
    this.entity.setPosition(this.goal);
    this.entity.setRotation(this.owner.pc.Quat.IDENTITY);
    this.#deform();
  }

  destroy() {
    if (!this.active) {
      return;
    }
    this.active = false;
    this.handle?.off();
    this.entity.destroy();
    this.mesh.destroy();
    this.material.destroy();
  }
}
