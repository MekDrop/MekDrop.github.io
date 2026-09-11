import { colorFromHex } from "../../helpers/colors.js";

export class CastleFire {
  #pc;
  #app;
  #entity;
  #brazierMaterial;
  #particleTexture;
  #lights = [];
  #elapsed = 0;
  #updateHandle = null;

  constructor({ pc, app, particleTexture }) {
    this.#pc = pc;
    this.#app = app;
    this.#entity = new pc.Entity("Castle fires");
    this.#brazierMaterial = this.#createBrazierMaterial();
    this.#particleTexture = particleTexture;

    this.#updateHandle = app.on("update", (deltaTime) => {
      this.#elapsed += deltaTime;
      this.#animateLights();
    });
  }

  get entity() {
    return this.#entity;
  }

  add({ x, y, z, scale = 0.25, brazier = true, intensity = 1 }) {
    const root = new this.#pc.Entity("Castle fire");
    root.setPosition(x, y, z);
    this.#entity.addChild(root);

    if (brazier) this.#createBrazier(root, scale);
    this.#createFlameEmitter(root, scale);
    this.#createSparkEmitter(root, scale);

    const light = new this.#pc.Entity("Fire glow");
    light.addComponent("light", {
      type: "omni",
      color: new this.#pc.Color(1, 0.27, 0.035),
      intensity: 0.9 * intensity,
      range: scale * 12,
      castShadows: false,
    });
    light.setLocalPosition(0, scale * 2, 0);
    root.addChild(light);

    this.#lights.push({
      entity: light,
      phase: this.#lights.length * 1.713 + x * 0.37 + z * 0.53,
      intensity,
    });
  }

  destroy() {
    this.#updateHandle?.off();
    this.#updateHandle = null;
    this.#entity?.destroy();
    this.#entity = null;
    this.#lights = [];
    this.#brazierMaterial?.destroy();
    this.#brazierMaterial = null;
    this.#particleTexture = null;
  }

  #createBrazier(parent, scale) {
    const brazier = new this.#pc.Entity("Fire brazier");
    brazier.addComponent("render", {
      type: "cylinder",
      castShadows: true,
      receiveShadows: true,
    });
    for (const meshInstance of brazier.render.meshInstances) {
      meshInstance.material = this.#brazierMaterial;
      meshInstance.castShadow = true;
      meshInstance.receiveShadow = true;
    }
    brazier.setLocalPosition(0, scale * 0.12, 0);
    brazier.setLocalScale(scale * 1.5, scale * 0.24, scale * 1.5);
    parent.addChild(brazier);
  }

  #createFlameEmitter(parent, scale) {
    const emitter = new this.#pc.Entity("Rising fire particles");
    emitter.addComponent("particlesystem", {
      numParticles: 36,
      lifetime: 0.62,
      rate: 0.018,
      rate2: 0.04,
      loop: true,
      preWarm: true,
      lighting: false,
      intensity: 1.08,
      depthWrite: false,
      noFog: true,
      sort: this.#pc.PARTICLESORT_OLDER_FIRST,
      blendType: this.#pc.BLEND_NORMAL,
      stretch: scale * 0.22,
      alignToMotion: true,
      emitterShape: this.#pc.EMITTERSHAPE_BOX,
      emitterExtents: new this.#pc.Vec3(
        scale * 0.42,
        scale * 0.04,
        scale * 0.42,
      ),
      initialVelocity: 0,
      localSpace: true,
      colorMap: this.#particleTexture,
      orientation: this.#pc.PARTICLEORIENTATION_SCREEN,
      localVelocityGraph: this.#curveSet(
        [0, -scale * 0.32, 1, scale * 0.18],
        [0, scale * 3.6, 0.55, scale * 3.1, 1, scale * 2],
        [0, scale * 0.24, 1, -scale * 0.2],
      ),
      localVelocityGraph2: this.#curveSet(
        [0, scale * 0.32, 1, -scale * 0.18],
        [0, scale * 4.5, 0.55, scale * 3.5, 1, scale * 2.2],
        [0, -scale * 0.24, 1, scale * 0.2],
      ),
      scaleGraph: this.#curve([
        0,
        scale * 0.62,
        0.18,
        scale * 0.92,
        0.7,
        scale * 0.54,
        1,
        scale * 0.08,
      ]),
      scaleGraph2: this.#curve([
        0,
        scale * 0.42,
        0.2,
        scale * 0.72,
        0.72,
        scale * 0.4,
        1,
        scale * 0.04,
      ]),
      colorGraph: this.#stepCurveSet(
        [0, 1, 0.55, 1, 1, 0.74],
        [0, 0.56, 0.42, 0.24, 1, 0.025],
        [0, 0.08, 0.35, 0.012, 1, 0],
      ),
      alphaGraph: this.#curve([0, 0, 0.07, 0.95, 0.58, 0.82, 0.86, 0.34, 1, 0]),
      startAngle: -28,
      startAngle2: 28,
      rotationSpeedGraph: this.#curve([0, -16, 1, 22]),
      rotationSpeedGraph2: this.#curve([0, 18, 1, -24]),
    });
    // Screen-facing particles are centered on their origin. Keep that origin
    // high enough for the brazier rim to occlude every visible flame base.
    emitter.setLocalPosition(0, scale * 0.62, 0);
    parent.addChild(emitter);
  }

  #createSparkEmitter(parent, scale) {
    const emitter = new this.#pc.Entity("Fire sparks");
    emitter.addComponent("particlesystem", {
      numParticles: 7,
      lifetime: 0.72,
      rate: 0.09,
      rate2: 0.2,
      loop: true,
      preWarm: true,
      lighting: false,
      intensity: 1.18,
      depthWrite: false,
      noFog: true,
      sort: this.#pc.PARTICLESORT_OLDER_FIRST,
      blendType: this.#pc.BLEND_NORMAL,
      stretch: scale * 0.12,
      alignToMotion: true,
      emitterShape: this.#pc.EMITTERSHAPE_BOX,
      emitterExtents: new this.#pc.Vec3(
        scale * 0.28,
        scale * 0.04,
        scale * 0.28,
      ),
      initialVelocity: 0,
      localSpace: true,
      colorMap: this.#particleTexture,
      orientation: this.#pc.PARTICLEORIENTATION_SCREEN,
      localVelocityGraph: this.#curveSet(
        [0, -scale * 0.7, 1, scale * 0.45],
        [0, scale * 4.8, 1, scale * 2.8],
        [0, scale * 0.55, 1, -scale * 0.35],
      ),
      localVelocityGraph2: this.#curveSet(
        [0, scale * 0.7, 1, -scale * 0.45],
        [0, scale * 6.2, 1, scale * 3.2],
        [0, -scale * 0.55, 1, scale * 0.35],
      ),
      scaleGraph: this.#curve([0, scale * 0.09, 0.5, scale * 0.06, 1, 0]),
      scaleGraph2: this.#curve([0, scale * 0.06, 0.55, scale * 0.04, 1, 0]),
      colorGraph: this.#stepCurveSet(
        [0, 1, 1, 1],
        [0, 0.8, 1, 0.16],
        [0, 0.18, 1, 0.01],
      ),
      alphaGraph: this.#curve([0, 0, 0.08, 1, 0.72, 0.68, 1, 0]),
    });
    emitter.setLocalPosition(0, scale * 0.38, 0);
    parent.addChild(emitter);
  }

  #curve(keys) {
    const curve = new this.#pc.Curve(keys);
    curve.type = this.#pc.CURVE_SMOOTHSTEP;
    return curve;
  }

  #curveSet(...channels) {
    const curves = new this.#pc.CurveSet(channels);
    curves.type = this.#pc.CURVE_SMOOTHSTEP;
    return curves;
  }

  #stepCurveSet(...channels) {
    const curves = new this.#pc.CurveSet(channels);
    curves.type = this.#pc.CURVE_STEP;
    return curves;
  }

  #createBrazierMaterial() {
    const material = new this.#pc.StandardMaterial();
    material.name = "Castle fire brazier";
    material.diffuse = colorFromHex(this.#pc, 0x202528);
    material.gloss = 0.14;
    material.update();
    return material;
  }

  #animateLights() {
    for (const { entity, phase, intensity } of this.#lights) {
      const fast = this.#elapsed * 11.1 + phase;
      const slow = this.#elapsed * 4.7 + phase * 1.31;
      entity.light.intensity =
        (0.78 + Math.sin(fast) * 0.18 + Math.sin(slow) * 0.1) * intensity;
    }
  }

}
