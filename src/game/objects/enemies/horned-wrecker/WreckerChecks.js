/**
 * Evidence controls restricted to the saved enemy test map.
 */
export class WreckerChecks {
  /**
   * @param {import("./HornedWrecker.js").HornedWrecker} owner
   */
  constructor(owner) {
    this.owner = owner;
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
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  async verifyClips() {
    const owner = this.owner;
    if (!owner.alive) {
      return;
    }
    owner.inspectClip(1);
    const results = [];
    for (const [name, track] of owner.playback.tracks) {
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
        });
      }
      results.push({
        name,
        duration: track.duration,
        samples,
      });
    }
    owner.playClip("idle_snort");
    this.download("horned-wrecker-playback.json", new Blob([JSON.stringify(results)], { type: "application/json" }));
  }

  async preview() {
    const owner = this.owner;
    if (!owner.alive) {
      return;
    }
    owner.inspectClip(1);
    owner.playClip("idle_snort");
    const pc = owner.pc;
    const app = owner.app;
    const meshes = owner.modelRoot.findComponents("render").flatMap(/**
     *
     * @param {import("playcanvas").RenderComponent} render
     */
      (render) => render.meshInstances);
    const bounds = meshes[0].aabb.clone();
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
    const center = bounds.center;
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
        (blob) => this.download("horned-wrecker-preview.png", blob), "image/png");
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
}
