import { MASK_SHAMAN_ANIMATION } from "./MaskShamanAnimation.js";

/**
 * Test-map-only evidence capture using the production instance and renderer.
 */
export class MaskShamanChecks {
  /**
   * @type {import("./MaskShaman.js").MaskShaman}
   */
  #owner;
  /**
   * @type {boolean}
   */
  #cancelled = false;
  /**
   * @type {Set<{handle: import("playcanvas").EventHandle, resolve: (value: number) => void}>}
   */
  #pending = new Set();

  /**
   * @param {import("./MaskShaman.js").MaskShaman} owner
   */
  constructor(owner) {
    this.#owner = owner;
  }

  placeRoyal() {
    // Standalone royals normally receive their placement from a castle.
    // This fixture stages the actual royal before its render batch is built.
    const royal = this.#owner.resolveRoyalTarget();
    const point = royal?.definition?.position;
    if (point) {
      royal.entity.setLocalPosition(point.x, point.y, point.z);
    }
  }

  /**
   * @param {string} name
   * @param {Blob} blob
   */
  static #download(name, blob) {
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = name;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  async verifyClips() {
    const owner = this.#owner;
    const tracks = owner.modelLibrary.getAnimationTracks(owner.constructor.modelUrl,
      Object.values(MASK_SHAMAN_ANIMATION));
    const names = ["chest", "mask_fan", "arm_L", "arm_R", "staff_hand", "leg_L", "leg_R", "foot_L", "foot_R"];
    const result = [];
    for (const [clip, track] of tracks) {
      if (this.#cancelled) {
        return;
      }
      owner.testClip = clip;
      const samples = [];
      let elapsed = 0;
      while (elapsed < track.duration + 0.2) {
        const dt = await this.#nextFrame();
        if (this.#cancelled) {
          return;
        }
        elapsed += dt;
        const joints = {};
        for (const name of names) {
          const rotation = owner.visual.root.findByName(name).getLocalRotation();
          const position = owner.visual.root.findByName(name).getLocalPosition();
          joints[name] = [rotation.x, rotation.y, rotation.z, rotation.w,
            position.x, position.y, position.z];
        }
        samples.push({
          ...owner.visual.playbackStatus,
          joints,
        });
      }
      result.push({
        clip,
        duration: track.duration,
        samples,
      });
    }
    owner.testClip = "idle";
    MaskShamanChecks.#download("mask-shaman-playback.json", new Blob([JSON.stringify(result)], { type: "application/json" }));
  }

  /**
   * @returns {Promise<number>}
   */
  #nextFrame() {
    return new Promise(/**
     *
     * @param {(value: number) => void} resolve
     */
      (resolve) => {
        const entry = {
          resolve,
          handle: null,
        };
        entry.handle = this.#owner.app.once("update", /**
       *
       * @param {number} dt
       */
          (dt) => {
            this.#pending.delete(entry);
            resolve(dt);
          });
        this.#pending.add(entry);
      });
  }

  destroy() {
    this.#cancelled = true;
    for (const entry of this.#pending) {
      entry.handle.off();
      entry.resolve(0);
    }
    this.#pending.clear();
  }

  /**
   * @param {number} seconds
   */
  async #advance(seconds) {
    let time = 0;
    while (time < seconds && !this.#cancelled) {
      const dt = await this.#nextFrame();
      time += dt;
    }

    return !this.#cancelled;
  }

  async verifyBehavior() {
    const owner = this.#owner;
    const result = [];
    owner.testClip = null;
    if (!(await this.#advance(0.9))) {
      return;
    }
    if (this.#cancelled) {
      return;
    }
    result.push({
      check: "cast activates discipline",
      pass: owner.auraActive,
    });
    owner.onBellRung({ duration: 0.4 });
    result.push({
      check: "bell pauses immediately",
      pass: !owner.auraActive,
    });
    if (!(await this.#advance(0.45))) {
      return;
    }
    result.push({
      check: "recovery still paused",
      pass: !owner.auraActive,
    });
    if (!(await this.#advance(1.6))) {
      return;
    }
    result.push({
      check: "fresh cast restores discipline",
      pass: owner.auraActive,
    });
    owner.receiveDamage(1);
    result.push({
      check: "hit interrupts concentration",
      pass: !owner.auraActive,
    });
    if (!(await this.#advance(2))) {
      return;
    }
    const ally = owner.actors.find(/**
     *
     * @param {import("../shared/Enemy.js").Enemy} actor
     */
      (actor) => actor.definition?.id === "mask-shaman-ally");
    const carried = owner.beginCarry(ally);
    if (!(await this.#advance(0.1))) {
      return;
    }
    result.push({
      check: "unwilling carry pauses aura",
      pass: carried && owner.carrier === ally && !owner.auraActive,
    });
    const launched = owner.launch({
      velocity: {
        x: -0.7,
        y: 4,
        z: 0.4,
      },
    });
    const launchHeight = owner.position.y;
    if (!(await this.#advance(0.25))) {
      return;
    }
    result.push({
      check: "Ammo flight rises and pauses aura",
      pass: launched && owner.airborne && owner.position.y > launchHeight && !owner.auraActive,
    });
    if (!(await this.#advance(2))) {
      return;
    }
    result.push({
      check: "Ammo contact lands",
      pass: !owner.airborne && owner.grounded,
    });
    if (!(await this.#advance(1.6))) {
      return;
    }
    result.push({
      check: "landing recovery restores discipline",
      pass: owner.auraActive,
    });
    result.push({
      check: "actual royal resolved",
      pass: owner.resolveRoyalTarget()?.constructor.name === "King",
    });
    MaskShamanChecks.#download("mask-shaman-behavior.json", new Blob([JSON.stringify(result)], { type: "application/json" }));
  }

  async preview() {
    const owner = this.#owner;
    const pc = owner.pc;
    const app = owner.app;
    owner.testClip = "idle";
    const meshes = owner.visual.root.findComponents("render").flatMap(/**
     *
     * @param {import("playcanvas").RenderComponent} render
     */
      (render) => render.meshInstances);
    let bounds = meshes[0].aabb.clone();
    for (const mesh of meshes.slice(1)) {
      bounds.add(mesh.aabb);
    }
    const radius = bounds.halfExtents.length();
    const cameras = app.root.findComponents("camera");
    const enabled = cameras.map(/**
     *
     * @param {import("playcanvas").CameraComponent} camera
     */
      (camera) => camera.enabled);
    const autoRender = app.autoRender;
    const layer = new pc.Layer({ name: "Mask Shaman transparent capture" });
    app.scene.layers.pushOpaque(layer);
    app.scene.layers.pushTransparent(layer);
    layer.addMeshInstances(meshes);
    for (const light of app.root.findComponents("light")) {
      layer.addLight(light);
    }
    const camera = new pc.Entity("Mask Shaman capture camera");
    camera.addComponent("camera", {
      layers: [layer.id],
      projection: pc.PROJECTION_ORTHOGRAPHIC,
      orthoHeight: radius * 1.1,
      clearColor: new pc.Color(0, 0, 0, 0),
      nearClip: 0.01,
      farClip: 100,
    });
    app.root.addChild(camera);
    const center = bounds.center;
    // Capture the authored front after the model's 180-degree facing correction.
    camera.setPosition(center.x - radius * 3, center.y + radius * 2, center.z - radius * 3);
    camera.lookAt(center);
    const texture = new pc.Texture(app.graphicsDevice, {
      width: 512,
      height: 512,
      format: pc.PIXELFORMAT_RGBA8,
      mipmaps: false,
    });
    const target = new pc.RenderTarget({
      colorBuffer: texture,
      depth: true,
    });
    camera.camera.renderTarget = target;
    try {
      app.autoRender = false;
      for (const current of cameras) {
        current.enabled = false;
      }
      app.render();
      const pixels = await texture.read(0, 0, 512, 512, {
        renderTarget: target,
        immediate: true,
      });
      const canvas = document.createElement("canvas");
      canvas.width = canvas.height = 512;
      const context = canvas.getContext("2d");
      const image = context.createImageData(512, 512);
      for (let y = 0; y < 512; y++) {
        image.data.set(pixels.subarray(y * 2048, (y + 1) * 2048),
          (app.graphicsDevice.isWebGPU ? y : 511 - y) * 2048);
      }
      context.putImageData(image, 0, 0);
      canvas.toBlob(/**
       *
       * @param {Blob} blob
       */
        (blob) => MaskShamanChecks.#download("mask-shaman-preview.png", blob), "image/png");
    } finally {
      cameras.forEach(/**
       *
       * @param {import("playcanvas").CameraComponent} current
       * @param {number} index
       */
        (current, index) => {
          current.enabled = enabled[index];
        });
      app.autoRender = autoRender;
      camera.destroy();
      app.scene.layers.remove(layer);
      target.destroy();
      texture.destroy();
    }
  }
}
