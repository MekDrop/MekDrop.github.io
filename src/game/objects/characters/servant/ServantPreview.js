/**
 * Production-scene capture, invoked only by this servant's saved test-map control.
 */
export class ServantPreview {
  /**
   * Capture the production canvas without depending on the development server's
   * optional MP4 encoder bundle. Used only by the saved review map.
   * @param {import("playcanvas").Application} app
   * @param {number} duration
   * @returns {Promise<void>}
   */
  static async record(app, duration = 35) {
    const controls = app.root.findByName("Map test controls");
    if (controls) {
      controls.enabled = false;
    }
    const stream = app.graphicsDevice.canvas.captureStream(30);
    const mimeType = MediaRecorder.isTypeSupported("video/webm;codecs=vp9")
      ? "video/webm;codecs=vp9" : "video/webm";
    const recorder = new MediaRecorder(stream, {
      mimeType,
      videoBitsPerSecond: 12000000,
    });
    const chunks = [];
    recorder.ondataavailable =
      /**
       * @param {BlobEvent} event
       */
      (event) => chunks.push(event.data);
    try {
      await new Promise(/**
       *
       * @param {(event: Event) => void} resolve
       * @param {(event: Event) => void} reject
       */
        (resolve, reject) => {
          recorder.onstop = resolve;
          recorder.onerror = reject;
          recorder.start();
          window.setTimeout(() => recorder.stop(), duration * 1000);
        });
      const url = URL.createObjectURL(new Blob(chunks, { type: mimeType }));
      const link = document.createElement("a");
      link.download = `servants-review-${Date.now()}.webm`;
      link.href = url;
      link.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 60000);
    } finally {
      if (controls) {
        controls.enabled = true;
      }
      for (const track of stream.getTracks()) {
        track.stop();
      }
    }
  }

  /**
   * @param {typeof import("playcanvas")} pc
   * @param {import("playcanvas").Application} app
   * @param {import("playcanvas").Entity} model
   */
  static async capture(pc, app, model) {
    const meshes = model.findComponents("render").flatMap(ServantPreview.#meshes);
    const bounds = meshes[0].aabb.clone();
    for (const mesh of meshes.slice(1)) {
      bounds.add(mesh.aabb);
    }
    const radius = bounds.halfExtents.length();
    const layer = new pc.Layer({ name: "Servant preview" });
    app.scene.layers.pushOpaque(layer);
    app.scene.layers.pushTransparent(layer);
    layer.addMeshInstances(meshes);
    for (const light of app.root.findComponents("light")) {
      layer.addLight(light);
    }
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
    const camera = new pc.Entity("Servant preview camera");
    camera.addComponent("camera", {
      layers: [layer.id],
      projection: pc.PROJECTION_ORTHOGRAPHIC,
      orthoHeight: radius * 1.15,
      clearColor: new pc.Color(0, 0, 0, 0),
      nearClip: 0.01,
      farClip: 1000,
    });
    app.root.addChild(camera);
    camera.setPosition(bounds.center.x + radius * 3, bounds.center.y + radius * 2,
      bounds.center.z + radius * 3);
    camera.lookAt(bounds.center);
    camera.camera.renderTarget = target;
    try {
      app.render();
      const pixels = await texture.read(0, 0, 512, 512, {
        renderTarget: target,
        immediate: true,
      });
      const canvas = document.createElement("canvas");
      canvas.width = canvas.height = 512;
      const context = canvas.getContext("2d");
      const data = context.createImageData(512, 512);
      for (let y = 0; y < 512; y++) {
        const destination = app.graphicsDevice.isWebGPU ? y : 511 - y;
        data.data.set(pixels.subarray(y * 2048, (y + 1) * 2048), destination * 2048);
      }
      context.putImageData(data, 0, 0);
      const link = document.createElement("a");
      link.download = "servant-preview.png";
      link.href = canvas.toDataURL("image/png");
      link.click();
    } finally {
      camera.destroy();
      app.scene.layers.remove(layer);
      target.destroy();
      texture.destroy();
    }
  }

  /**
   * @param {import("playcanvas").RenderComponent} component
   */
  static #meshes(component) {
    return component.meshInstances;
  }
}
