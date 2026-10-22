/**
 * Captures only the owning object's production mesh instances and scene lighting.
 */
export class RiftcapPreview {
  /**
   * @param {import("./Riftcap.js").Riftcap} owner
   * @param {{download?:boolean}} options
   * @returns {Promise<{visible:number,transparent:number,dataUrl:string}>}
   */
  static async capture(owner, { download = true } = {}) {
    const { pc, app } = owner;
    const meshes = owner.entity.findComponents("render").flatMap(RiftcapPreview.#meshes);
    const bounds = meshes[0].aabb.clone();
    for (const mesh of meshes.slice(1)) {
      bounds.add(mesh.aabb);
    }
    const radius = bounds.halfExtents.length();
    const layer = new pc.Layer({ name: "Riftcap transparent capture" });
    app.scene.layers.pushOpaque(layer);
    app.scene.layers.pushTransparent(layer);
    layer.addMeshInstances(meshes);
    for (const light of app.root.findComponents("light")) {
      layer.addLight(light);
    }
    const cameras = app.root.findComponents("camera").map(RiftcapPreview.#cameraState);
    for (const saved of cameras) {
      saved.camera.enabled = false;
    }
    const camera = new pc.Entity("Riftcap capture camera");
    camera.addComponent("camera", {
      layers: [layer.id],
      projection: pc.PROJECTION_ORTHOGRAPHIC,
      orthoHeight: radius * 1.12,
      clearColor: new pc.Color(0, 0, 0, 0),
      nearClip: 0.01,
      farClip: 1000,
    });
    app.root.addChild(camera);
    const center = bounds.center;
    const offset = owner.entity.getRotation().transformVector(new pc.Vec3(radius * 2, radius * 1.7, -radius * 3));
    camera.setPosition(center.x + offset.x, center.y + offset.y, center.z + offset.z);
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
      app.render();
      const pixels = await texture.read(0, 0, 512, 512, {
        renderTarget: target,
        immediate: true,
      });
      const canvas = document.createElement("canvas");
      canvas.width = canvas.height = 512;
      const ctx = canvas.getContext("2d");
      const data = ctx.createImageData(512, 512);
      let visible = 0;
      let transparent = 0;
      for (let y = 0; y < 512; y++) {
        for (let x = 0; x < 512; x++) {
          const source = (y * 512 + x) * 4;
          const row = app.graphicsDevice.isWebGPU ? y : 511 - y;
          const destination = (row * 512 + x) * 4;
          const alpha = pixels[source + 3];
          if (alpha > 0) {
            visible++;
          } else {
            transparent++;
          }
          for (let channel = 0; channel < 3; channel++) {
            data.data[destination + channel] = alpha ? Math.min(255, pixels[source + channel] * 255 / alpha) : 0;
          }
          data.data[destination + 3] = alpha;
        }
      }
      ctx.putImageData(data, 0, 0);
      const dataUrl = canvas.toDataURL("image/png");
      if (download) {
        const link = document.createElement("a");
        link.download = "riftcap-preview.png";
        link.href = dataUrl;
        link.click();
      }

      return {
        visible,
        transparent,
        dataUrl,
      };
    } finally {
      camera.destroy();
      app.scene.layers.remove(layer);
      target.destroy();
      texture.destroy();
      for (const saved of cameras) {
        saved.camera.enabled = saved.enabled;
      }
    }
  }

  /**
   * @param {import("playcanvas").RenderComponent} render
   * @returns {import("playcanvas").MeshInstance[]}
   */
  static #meshes(render) {
    return render.meshInstances;
  }

  /**
   * @param {import("playcanvas").CameraComponent} camera
   * @returns {{camera:import("playcanvas").CameraComponent,enabled:boolean}}
   */
  static #cameraState(camera) {
    return {
      camera,
      enabled: camera.enabled,
    };
  }
}

