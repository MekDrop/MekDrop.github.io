/**
 * Reuses two native particle emitters for departure and arrival sparks.
 */
export class HeroTeleportEffect {
  /**
   * @type {import("playcanvas").Entity[]}
   */
  #emitters = [];

  /**
   * @param {typeof import("playcanvas")} pc
   * @param {import("playcanvas").Application} app
   */
  constructor(pc, app) {
    this.#addEmitter(pc, app);
    this.#addEmitter(pc, app);
  }

  /**
   * @param {{x: number, y: number, z: number}} from
   * @param {{x: number, y: number, z: number}} to
   */
  play(from, to) {
    [from, to].forEach(this.#forEachPosition.bind(this));
  }

  destroy() {
    for (const emitter of this.#emitters) {
      emitter.destroy();
    }
    this.#emitters = [];
  }

  /**
   * @param {{x: number, y: number, z: number}} position
   * @param {number} index
   */
  #forEachPosition(position, index) {
    const emitter = this.#emitters[index];
    emitter.setPosition(position.x, position.y + 0.45, position.z);
    emitter.particlesystem.reset();
    emitter.particlesystem.play();
  }

  /**
   * @param {typeof import("playcanvas")} pc
   * @param {import("playcanvas").Application} app
   */
  #addEmitter(pc, app) {
    const emitter = new pc.Entity("hero-teleport-sparks");
    emitter.addComponent("particlesystem", {
      autoPlay: false,
      loop: false,
      numParticles: 48,
      lifetime: 0.65,
      rate: 0.002,
      emitterShape: pc.EMITTERSHAPE_SPHERE,
      emitterRadius: 0.45,
      blendType: pc.BLEND_ADDITIVE,
      lighting: false,
      depthWrite: false,
      localVelocityGraph: new pc.CurveSet(
        [0, -0.8, 1, -0.2],
        [0, 1.8, 1, 0.4],
        [0, -0.8, 1, -0.2],
      ),
      localVelocityGraph2: new pc.CurveSet(
        [0, 0.8, 1, 0.2],
        [0, 3, 1, 0.6],
        [0, 0.8, 1, 0.2],
      ),
      colorGraph: new pc.CurveSet(
        [0, 0.35, 1, 0.65],
        [0, 0.8, 1, 0.3],
        [0, 1, 1, 1],
      ),
      scaleGraph: new pc.Curve([0, 0.1, 0.2, 0.16, 1, 0]),
      alphaGraph: new pc.Curve([0, 0, 0.08, 1, 0.6, 0.8, 1, 0]),
    });
    app.root.addChild(emitter);
    this.#emitters.push(emitter);
  }
}
