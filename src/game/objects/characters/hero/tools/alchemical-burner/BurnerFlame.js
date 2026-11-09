import particleUrl from "src/assets/game/effects/castle-fire-particle.png?url";

/**
 * One pooled, nozzle-mounted flame jet; the tool owns its entire lifetime.
 */
export class BurnerFlame {
  /**
   * @type {import("playcanvas").Entity}
   */
  #emitter;
  /**
   * @type {boolean}
   */
  #firing = false;

  /**
   * @type {Record<string,string>}
   */
  static textureUrls = { burnerFlame: particleUrl };

  /**
   * @param {typeof import("playcanvas")} pc
   * @param {import("playcanvas").Application} app
   * @param {import("playcanvas").Entity} nozzle
   */
  constructor(pc, app, nozzle) {
    this.#emitter = new pc.Entity("Alchemical green flame jet", app);
    nozzle.addChild(this.#emitter);
    this.#emitter.addComponent("particlesystem", {
      numParticles: 48,
      lifetime: 0.19,
      rate: 0.004,
      rate2: 0.005,
      loop: true,
      autoPlay: false,
      preWarm: false,
      lighting: false,
      depthWrite: false,
      noFog: true,
      localSpace: false,
      blendType: pc.BLEND_ADDITIVE,
      emitterExtents: new pc.Vec3(0.015, 0.015, 0.015),
      colorMap: app.assets.find("burnerFlame", "texture").resource,
      localVelocityGraph: new pc.CurveSet([[0, -0.15, 1, -0.3], [0, 0, 1, 0.3], [0, 3.7, 1, 2.5]]),
      localVelocityGraph2: new pc.CurveSet([[0, 0.15, 1, 0.3], [0, 0.05, 1, 0.6], [0, 4.2, 1, 3]]),
      scaleGraph: new pc.Curve([0, 0.045, 0.18, 0.10, 0.65, 0.15, 1, 0]),
      colorGraph: new pc.CurveSet([[0, 0.9, 0.25, 0.35, 1, 0.06], [0, 1, 0.7, 0.85, 1, 0.25], [0, 0.4, 0.3, 0.03, 1, 0]]),
      alphaGraph: new pc.Curve([0, 0, 0.08, 0.9, 0.7, 0.7, 1, 0]),
    });
    this.#emitter.particlesystem.stop();
  }

  /**
   * @param {boolean} value
   */
  set firing(value) {
    if (value === this.#firing) {
      return;
    }
    this.#firing = value;
    if (value) {
      this.#emitter.particlesystem.reset();
      this.#emitter.particlesystem.play();
    } else {
      this.#emitter.particlesystem.stop();
    }
  }
}
