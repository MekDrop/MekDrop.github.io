import { CastleAudio } from "../../audio/castle/CastleAudio.js";
import { GameObjectAudio } from "../../audio/GameObjectAudio.js";

/**
 * Castle-owned mist and sparks, kept outside the replaced map hierarchy.
 */
export class CastleSwapEffect {
  /**
   * @type {GameObjectAudio|undefined}
   */
  #audio;
  /**
   * @type {import("playcanvas").Entity}
   */
  #root;
  /**
   * @type {import("playcanvas").Texture}
   */
  #texture;
  /**
   * @type {import("playcanvas").EventHandle}
   */
  #updateHandle;
  /**
   * @type {number}
   */
  #elapsed = 0;
  /**
   * @type {number|null}
   */
  #fadeElapsed = null;
  /**
   * @type {number}
   */
  #opacity = 0;
  /**
   * @type {number}
   */
  #fadeStart = 0;
  /**
   * @type {Uint8Array}
   */
  #alphas = new Uint8Array(32 * 32);

  /**
   * @param {typeof import("playcanvas")} pc
   * @param {import("playcanvas").Application} app
   * @param {{x:number,z:number,width:number,depth:number,elevation?:number}} footprint
   * @param {import("playcanvas").Entity|null} castle
   * @param {import("../../audio/GameAudioLibrary.js").GameAudioLibrary} [audioLibrary]
   */
  constructor(pc, app, footprint, castle = null, audioLibrary) {
    let bounds = null;
    for (const render of castle?.findComponents("render") ?? []) {
      for (const mesh of render.meshInstances) {
        if (bounds) {
          bounds.add(mesh.aabb);
        } else {
          bounds = mesh.aabb.clone();
        }
      }
    }
    const volume = {
      width: bounds ? bounds.halfExtents.x * 2 : footprint.width,
      depth: bounds ? bounds.halfExtents.z * 2 : footprint.depth,
      height: bounds ? bounds.halfExtents.y * 2 : 5,
    };
    this.#root = new pc.Entity("Castle transformation");
    app.root.addChild(this.#root);
    if (audioLibrary) {
      this.#audio = new GameObjectAudio(this.#root, app, audioLibrary, {
        mist: CastleAudio.transition,
        reveal: CastleAudio.transitionRelease,
      }, 0.5);
      const mist = this.#root.sound.slot("mist");
      mist.loop = true;
      mist.volume = 0;
      this.#audio.resume();
      this.#audio.play("mist");
    }
    if (bounds) {
      this.#root.setPosition(bounds.center);
    } else {
      this.#root.setPosition(footprint.x + footprint.width / 2,
        (footprint.elevation ?? 3) + 2, footprint.z + footprint.depth / 2);
    }
    this.#texture = new pc.Texture(app.graphicsDevice, {
      name: "Castle soft mist",
      width: 32,
      height: 32,
      format: pc.PIXELFORMAT_R8_G8_B8_A8,
      mipmaps: false,
    });
    const pixels = this.#texture.lock();
    for (let y = 0; y < 32; y += 1) {
      for (let x = 0; x < 32; x += 1) {
        const alpha = Math.max(0, 1 - Math.hypot((x - 15.5) / 16, (y - 15.5) / 16));
        this.#alphas[y * 32 + x] = Math.round(alpha * alpha * 255);
        pixels.set([255, 255, 255, 0], (y * 32 + x) * 4);
      }
    }
    this.#texture.unlock();
    this.#addEmitter(pc, volume, false);
    this.#addEmitter(pc, volume, true);
    this.#updateHandle = app.on("update", this.#update, this);
  }

  /**
   * Stop emitting; existing particles finish as the new castle appears.
   */
  finish() {
    if (this.#fadeElapsed === null) {
      this.#audio?.play("reveal");
      this.#fadeStart = this.#opacity;
      this.#fadeElapsed = 0;
    }
    for (const child of this.#root.children) {
      child.particlesystem.stop();
    }
  }

  destroy() {
    this.#updateHandle.off();
    this.#root.destroy();
    this.#texture.destroy();
  }

  /**
   * Fade the shared soft texture without rebuilding particle shaders or graphs.
   * @param {number} deltaTime
   */
  #update(deltaTime) {
    const step = Math.min(Math.max(deltaTime, 0), 0.1);
    this.#elapsed += step;
    let progress = Math.min(1, this.#elapsed / 1.1);
    if (this.#fadeElapsed !== null) {
      this.#fadeElapsed += step;
      progress = Math.min(1, this.#fadeElapsed / 1.4);
    }
    const logarithmic = Math.log1p(9 * progress) / Math.log(10);
    this.#opacity = this.#fadeElapsed === null ? logarithmic : this.#fadeStart * (1 - logarithmic);
    if (this.#audio) {
      this.#root.sound.slot("mist").volume = 0.38 * this.#opacity;
      if (this.#fadeElapsed !== null && this.#fadeElapsed >= 1.4) {
        this.#root.sound.stop("mist");
      }
    }
    const pixels = this.#texture.lock();
    for (let index = 0; index < this.#alphas.length; index += 1) {
      pixels[index * 4 + 3] = Math.round(this.#alphas[index] * this.#opacity);
    }
    this.#texture.unlock();
  }

  /**
   * @param {typeof import("playcanvas")} pc
   * @param {{width:number,depth:number,height:number}} footprint
   * @param {boolean} sparks
   */
  #addEmitter(pc, footprint, sparks) {
    const emitter = new pc.Entity(sparks ? "Transformation sparks" : "Transformation mist");
    this.#root.addChild(emitter);
    const size = Math.max(footprint.width, footprint.depth);
    emitter.addComponent("particlesystem", {
      autoPlay: true,
      loop: true,
      preWarm: false,
      numParticles: sparks ? 160 : 500,
      lifetime: 1.6,
      rate: sparks ? 0.01 : 0.0032,
      emitterExtents: new pc.Vec3(footprint.width * 1.05, footprint.height, footprint.depth * 1.05),
      colorMap: this.#texture,
      blendType: sparks ? pc.BLEND_ADDITIVE : pc.BLEND_NORMAL,
      lighting: false,
      depthWrite: false,
      localVelocityGraph: new pc.CurveSet([0, -0.4, 1, -0.1], [0, 1.8, 1, 3], [0, -0.4, 1, -0.1]),
      localVelocityGraph2: new pc.CurveSet([0, 0.4, 1, 0.1], [0, 3, 1, 4], [0, 0.4, 1, 0.1]),
      colorGraph: new pc.CurveSet([0, 0.55, 1, 0.85], [0, 0.7, 1, 0.55], [0, 1, 1, 1]),
      scaleGraph: new pc.Curve(sparks ? [0, 0.07, 0.4, 0.12, 1, 0] : [0, size * 0.13, 0.4, size * 0.22, 1, size * 0.3]),
      alphaGraph: new pc.Curve([0, 0, 0.15, sparks ? 1 : 0.85, 0.7, sparks ? 0.8 : 0.8, 1, 0]),
    });
  }
}
