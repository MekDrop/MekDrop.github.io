import { latchSplashProfiles } from "./LatchSplashProfiles.js";
import { LatchSplashVariations } from "./LatchSplashVariations.js";
import { LatchSurface } from "./LatchSurface.js";

const variations = new LatchSplashVariations();

/**
 * One prepared, single-use wet impact per slug. Native particles own the spray.
 */
export class LatchSplash {
  /**
   * @returns {string}
   */
  static get modelUrl() {
    return new URL("../../../models/enemies/latch-slug/latch-slug-splat.glb", import.meta.url).href;
  }

  /**
   * @param {import("./LatchSlug.js").LatchSlug} owner
   */
  constructor(owner) {
    const { pc, app } = owner;
    this.entity = new pc.Entity("Latch Slug wet impact");
    app.root.addChild(this.entity);
    this.model = owner.modelLibrary.instantiate(LatchSplash.modelUrl);
    this.entity.addChild(this.model);
    this.model.addComponent("anim", { activate: true });
    const tracks = owner.modelLibrary.getAnimationTracks(LatchSplash.modelUrl, latchSplashProfiles.map(/**
     *
     * @param {(typeof latchSplashProfiles)[number]} profile
     */
      (profile) => profile.clip));
    for (const profile of latchSplashProfiles) {
      this.model.anim.addAnimationState(profile.clip, tracks.get(profile.clip), 1, false);
    }
    this.model.anim.baseLayer.play(latchSplashProfiles[0].clip);
    this.texture = new pc.Texture(app.graphicsDevice, {
      name: "Slug gel droplet",
      width: 32,
      height: 32,
      format: pc.PIXELFORMAT_RGBA8,
      mipmaps: false,
    });
    const pixels = this.texture.lock();
    for (let y = 0; y < 32; y++) {
      for (let x = 0; x < 32; x++) {
        const radius = Math.hypot((x - 15.5) / 15, (y - 15.5) / 15);
        const index = (y * 32 + x) * 4;
        const shine = Math.exp(-((x - 11) ** 2 + (y - 10) ** 2) / 11);
        const shade = 0.6 + 0.22 * Math.sqrt(Math.max(0, 1 - radius * radius)) + 0.18 * shine;
        pixels[index] = pixels[index + 1] = pixels[index + 2] = Math.round(255 * shade);
        pixels[index + 3] = Math.round(255 * Math.max(0, Math.min(1, (1 - radius) * 7)));
      }
    }
    this.texture.unlock();
    this.spray = new pc.Entity("Latch Slug impact droplets");
    this.entity.addChild(this.spray);
    // Adapted from the installed-version Engine particles-spark example:
    // one curve per velocity channel, and a separate world gravity curve.
    this.spray.addComponent("particlesystem", {
      autoPlay: true,
      loop: false,
      numParticles: 10,
      lifetime: 0.6,
      rate: 0.001,
      emitterExtents: new pc.Vec3(0.1, 0.08, 0.03),
      colorMap: this.texture,
      blendType: pc.BLEND_NORMAL,
      lighting: false,
      depthWrite: false,
      alignToMotion: true,
      stretch: 0.06,
      localVelocityGraph: new pc.CurveSet([0, -0.7, 1, -0.15], [0, -0.2, 1, -0.1], [0, 0.15, 1, 0.05]),
      localVelocityGraph2: new pc.CurveSet([0, 0.7, 1, 0.15], [0, 0.9, 1, 0.1], [0, 0.5, 1, 0.1]),
      worldVelocityGraph: new pc.CurveSet([0, 0], [0, 0, 1, -2.8], [0, 0]),
      colorGraph: new pc.CurveSet([0, 1, 1, 0.9], [0, 0.78, 1, 0.57], [0, 0.15, 1, 0.04]),
      scaleGraph: new pc.Curve([0, 0.018, 0.12, 0.028, 0.7, 0.015, 1, 0]),
      scaleGraph2: new pc.Curve([0, 0.03, 0.12, 0.045, 0.7, 0.02, 1, 0]),
      alphaGraph: new pc.Curve([0, 0.85, 0.5, 0.72, 1, 0]),
    });
    this.age = 0;
    this.started = false;
    this.surface = new LatchSurface(this, owner);
    // Prepare both variants behind the opaque floor during scene loading.
    this.entity.setPosition(owner.position.clone().sub(new pc.Vec3(0, 2, 0)));
    for (const render of this.model.findComponents("render")) {
      for (const mesh of render.meshInstances) {
        mesh.castShadow = false;
        mesh.cull = false;
      }
    }
    this.spray.particlesystem.emitter.meshInstance.cull = false;
    this.prewarm = app.once("postrender", () => {
      if (!this.started) {
        this.clear();
      }
    });
  }

  /**
   * @param {number} side Positive when the slug approaches the frame's forward side.
   * @param {number} height Contact height above the door's floor.
   * @param {import("../../architecture/door/Door.js").Door} door
   */
  play(side, height, door) {
    this.started = true;
    this.age = 0;
    this.entity.enabled = true;
    this.variation = variations.next(height);
    const choice = this.variation;
    for (const profile of latchSplashProfiles) {
      this.model.findByName(profile.node).enabled = profile.id === choice.profile.id;
    }
    this.model.setLocalEulerAngles(0, side > 0 ? 180 : 0, 0);
    this.model.setLocalScale(choice.width, choice.height, choice.thickness);
    this.model.anim.speed = choice.speed;
    this.model.anim.baseLayer.transition(choice.profile.clip, 0);
    this.surface.bind(door, side);
    this.spray.setLocalEulerAngles(0, side > 0 ? 180 : 0, 0);
    this.spray.particlesystem.reset();
    this.spray.particlesystem.play();
  }

  /**
   * @param {number} dt
   */
  update(dt) {
    this.age += dt;
    this.surface.update(dt);
    // The authored clip continues down past the threshold. The surface clips
    // runoff at floor contact; only fully drained patches release their jam.
  }

  clear() {
    this.surface.clear();
    this.spray.particlesystem.stop();
    this.entity.enabled = false;
  }

  destroy() {
    this.prewarm.off();
    this.surface.destroy();
    this.entity.destroy();
    this.texture.destroy();
  }
}
