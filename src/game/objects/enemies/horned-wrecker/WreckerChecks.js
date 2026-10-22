import { WreckerBehaviorCheck } from "./WreckerBehaviorCheck.js";

/**
 * Evidence controls restricted to the saved enemy test map.
 */
export class WreckerChecks {
  /**
   * @param {import("./HornedWrecker.js").HornedWrecker} owner
   */
  constructor(owner) {
    this.owner = owner;
    if (owner.definition.verificationControls) {
      window.addEventListener("keydown", this.#key, true);
    }
  }

  /**
   * @type {(event:KeyboardEvent) => void}
   */
  #key = (event) => {
    if (!event.shiftKey || !["KeyV", "KeyP", "ArrowLeft", "ArrowRight"].includes(event.code)) {
      return;
    }
    event.preventDefault();
    event.stopImmediatePropagation();
    if (event.code === "KeyV") {
      this.verifyClips();
    } else if (event.code === "KeyP") {
      this.preview();
    } else {
      this.owner.inspectClip(event.code === "ArrowRight" ? 1 : -1);
    }
  };

  destroy() {
    window.removeEventListener("keydown", this.#key, true);
  }

  verifyBehavior() {
    return new WreckerBehaviorCheck(this.owner).run();
  }

  verifyPursuit() {
    return new WreckerBehaviorCheck(this.owner).run(true);
  }

  /**
   * Move the test-map observer into the vestibule for a real interior view.
   */
  observeInterior() {
    const hero = this.owner.actors.find(/**
     * @param {import("../shared/Enemy.js").EnemyActor} actor
     */ (actor) => actor.isDefender && typeof actor.teleport === "function");
    const castle = this.owner.actors.find(/**
     * @param {import("../shared/Enemy.js").EnemyActor} actor
     */ (actor) => actor.residence?.layout);
    if (hero && castle) {
      hero.teleport(castle.residence.layout.toWorld(-0.75, 2.75, 0.014));
    }
  }

  /**
   * @param {string} name
   * @param {Blob} blob
   */
  download(name, blob) {
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = name;
    link.id = `wrecker-${name}`;
    link.hidden = true;
    document.getElementById(link.id)?.remove();
    document.body.appendChild(link);
    const reader = new FileReader();
    reader.addEventListener("load", () => {
      link.href = String(reader.result);
    });
    reader.readAsDataURL(blob);
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  async verifyClips() {
    const owner = this.owner;
    if (!owner.alive || this.verifying) {
      return;
    }
    this.verifying = true;
    owner.inspectClip(1);
    const results = [];
    const previousScale = owner.app.timeScale;
    try {
      for (const scale of [1, 0.5]) {
        owner.app.timeScale = scale;
        for (const [name, track] of owner.playback.tracks) {
          this.progress = `${name} at ${scale}x`;
          owner.playClip(name);
          const samples = [];
          let elapsed = 0;
          while (elapsed < track.duration + 0.25) {
            const dt = await new Promise(/**
         *
         * @param {(dt:number) => void} resolve
         */
              (resolve) => owner.app.once("update", resolve));
            elapsed += dt;
            const joints = ["Head", "Spine2", "LeftUpLeg", "RightArm"].map(/**
         *
         * @param {string} joint
         */
              (joint) => {
                const bone = owner.modelRoot.findByName(`mixamorig:${joint}`);
                const rotation = bone.getLocalRotation();

                return [rotation.x, rotation.y, rotation.z, rotation.w];
              });
            samples.push({
              elapsed,
              joints,
              time: owner.playback.animation.baseLayer.activeStateCurrentTime,
              speed: owner.playback.animation.speed,
            });
          }
          results.push({
            name,
            scale,
            duration: track.duration,
            samples,
          });
        }
      }
    } finally {
      owner.app.timeScale = previousScale;
      this.verifying = false;
    }
    this.progress = "Playback capture complete";
    owner.playClip("idle_snort");
    this.download("horned-wrecker-playback.json", new Blob([JSON.stringify(results)], { type: "application/json" }));
  }

  /**
   * @param {import("playcanvas").Entity} root
   * @param {{radius?:number,center?:import("playcanvas").Vec3,position?:import("playcanvas").Vec3,name?:string}} view
   */
  async preview(root = this.owner.modelRoot, view = {}) {
    const owner = this.owner;
    if (!owner.alive) {
      return;
    }
    if (root === owner.modelRoot) {
      owner.inspectClip(1);
      owner.playClip("idle_snort");
    }
    const pc = owner.pc;
    const app = owner.app;
    const meshes = root.findComponents("render").filter(/**
     * @param {import("playcanvas").RenderComponent} render
     */ (render) => render.enabled && render.entity.enabled).flatMap(/**
     *
     * @param {import("playcanvas").RenderComponent} render
     */
      (render) => render.meshInstances);
    const bounds = meshes[0].aabb.clone();
    for (const mesh of meshes.slice(1)) {
      bounds.add(mesh.aabb);
    }
    const radius = view.radius ?? bounds.halfExtents.length();
    const cameras = app.root.findComponents("camera");
    const enabled = cameras.map(/**
     *
     * @param {import("playcanvas").CameraComponent} camera
     */
      (camera) => camera.enabled);
    const layer = new pc.Layer({ name: "Wrecker transparent capture" });
    app.scene.layers.pushOpaque(layer);
    app.scene.layers.pushTransparent(layer);
    layer.addMeshInstances(meshes);
    for (const light of app.root.findComponents("light")) {
      layer.addLight(light);
    }
    const camera = new pc.Entity("Wrecker capture camera");
    camera.addComponent("camera", {
      layers: [layer.id],
      projection: pc.PROJECTION_ORTHOGRAPHIC,
      orthoHeight: radius * 1.1,
      clearColor: new pc.Color(0, 0, 0, 0),
      nearClip: 0.01,
      farClip: 100,
    });
    app.root.addChild(camera);
    const center = view.center ?? bounds.center;
    camera.setPosition(view.position ?? new pc.Vec3(center.x - radius * 3, center.y + radius * 2, center.z - radius * 3));
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
        (blob) => this.download(view.name ?? "horned-wrecker-preview.png", blob), "image/png");
    } finally {
      cameras.forEach(/**
       *
       * @param {import("playcanvas").CameraComponent} current
       * @param {number} index
       */
        (current, index) => {
          current.enabled = enabled[index];
        });
      camera.destroy();
      app.scene.layers.remove(layer);
      target.destroy();
      texture.destroy();
    }
  }

  async captureBreach() {
    const castle = this.owner.actors.find(/**
     * @param {import("../shared/Enemy.js").EnemyActor} actor
     */ (actor) => actor.destructibleDoors?.some(/**
      * @param {import("../../architecture/door/Door.js").Door} door
      */ (door) => door.broken && !door.exteriorEntrance));
    const door = castle?.destructibleDoors.find(/**
     * @param {import("../../architecture/door/Door.js").Door} door
     */ (door) => door.broken && !door.exteriorEntrance);
    if (!door) {
      return;
    }
    const center = door.entity.getPosition().clone().add(new this.owner.pc.Vec3(0, 1.15, 0));

    return this.preview(this.owner.app.root, {
      center,
      radius: 2.1,
      position: center.clone().add(new this.owner.pc.Vec3(-3, 1, 0.5)),
      name: "horned-wrecker-breach.png",
    });
  }
}
