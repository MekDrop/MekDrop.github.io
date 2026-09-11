export class HeroLavaDeathEffect {
  #pc;
  #app;
  #entity;
  #flames;
  #flameTexture;

  constructor({ pc, app }) {
    this.#pc = pc;
    this.#app = app;
    this.#entity = new pc.Entity("Hero lava death effect");
    this.#flameTexture = this.#createFlameTexture();
    this.#flames = this.#createFlames();
    this.#entity.addChild(this.#flames);
    this.reset();
  }

  get entity() {
    return this.#entity;
  }

  begin() {
    this.#entity.enabled = true;
    this.#flames.enabled = true;
    this.#flames.particlesystem?.reset();
    this.#flames.particlesystem?.play();
  }

  update(progress) {
    this.#flames.enabled = progress < 0.86;
  }

  complete() {
    this.reset();
  }

  reset() {
    this.#entity.enabled = false;
    this.#flames.enabled = false;
    this.#flames.particlesystem?.stop();
    this.#flames.particlesystem?.reset();
  }

  destroy() {
    this.#entity?.destroy();
    this.#entity = null;
    this.#flameTexture?.destroy();
    this.#flameTexture = null;
    this.#flames = null;
  }

  #createFlames() {
    const flames = new this.#pc.Entity("Hero rising flames");
    flames.addComponent("particlesystem", {
      numParticles: 54,
      lifetime: 0.55,
      rate: 0.01,
      rate2: 0.024,
      loop: true,
      preWarm: true,
      lighting: false,
      intensity: 1.18,
      depthWrite: false,
      noFog: true,
      sort: this.#pc.PARTICLESORT_OLDER_FIRST,
      blendType: this.#pc.BLEND_NORMAL,
      stretch: 0.08,
      alignToMotion: true,
      emitterShape: this.#pc.EMITTERSHAPE_BOX,
      emitterExtents: new this.#pc.Vec3(0.28, 0.48, 0.2),
      initialVelocity: 0,
      localSpace: true,
      colorMap: this.#flameTexture,
      orientation: this.#pc.PARTICLEORIENTATION_SCREEN,
      localVelocityGraph: this.#curveSet(
        [0, -0.22, 1, 0.1],
        [0, 1.5, 0.6, 1.2, 1, 0.6],
        [0, 0.14, 1, -0.12],
      ),
      localVelocityGraph2: this.#curveSet(
        [0, 0.22, 1, -0.1],
        [0, 2.1, 0.6, 1.55, 1, 0.72],
        [0, -0.14, 1, 0.12],
      ),
      scaleGraph: this.#curve([0, 0.16, 0.22, 0.3, 0.75, 0.16, 1, 0.02]),
      scaleGraph2: this.#curve([0, 0.1, 0.2, 0.22, 0.72, 0.12, 1, 0.01]),
      colorGraph: this.#stepCurveSet(
        [0, 1, 0.54, 1, 1, 0.22],
        [0, 0.72, 0.4, 0.16, 1, 0.018],
        [0, 0.08, 0.38, 0.005, 1, 0],
      ),
      alphaGraph: this.#curve([0, 0, 0.06, 0.98, 0.68, 0.78, 1, 0]),
      startAngle: -30,
      startAngle2: 30,
      rotationSpeedGraph: this.#curve([0, -20, 1, 24]),
      rotationSpeedGraph2: this.#curve([0, 22, 1, -26]),
    });
    flames.setLocalPosition(0, 0.55, 0);
    return flames;
  }

  #createFlameTexture() {
    const size = 16;
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const context = canvas.getContext("2d");
    context.imageSmoothingEnabled = false;
    context.fillStyle = "rgba(255,255,255,1)";
    context.beginPath();
    context.moveTo(8, 0);
    context.lineTo(12, 5);
    context.lineTo(13, 10);
    context.lineTo(10, 15);
    context.lineTo(5, 15);
    context.lineTo(2, 10);
    context.lineTo(4, 5);
    context.closePath();
    context.fill();

    const texture = new this.#pc.Texture(this.#app.graphicsDevice, {
      name: "Hero flame particle",
      width: size,
      height: size,
      minFilter: this.#pc.FILTER_LINEAR_MIPMAP_LINEAR,
      magFilter: this.#pc.FILTER_LINEAR,
      addressU: this.#pc.ADDRESS_CLAMP_TO_EDGE,
      addressV: this.#pc.ADDRESS_CLAMP_TO_EDGE,
      mipmaps: true,
    });
    texture.setSource(canvas);
    return texture;
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
}
