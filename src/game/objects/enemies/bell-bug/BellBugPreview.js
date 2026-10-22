/**
 * Captures this enemy's actual production meshes/materials into RGBA, omitting
 * scenery, HUD and other shadow casters. Invoked only by its saved test map.
 */
export class BellBugPreview {
  /**
   * @param {import("./BellBug.js").BellBug} owner
   */
  constructor(owner) {
    this.owner = owner;
  }

  /**
   * @returns {Promise<{visiblePixels: number, transparentPixels: number, margin: number}>}
   */
  async capture() {
    const { pc, app, entity } = this.owner;
    const meshes = entity.findComponents("render").flatMap(BellBugPreview.#meshes);
    if (!meshes.length) {
      return null;
    }
    const bounds = meshes[0].aabb.clone();
    for (const mesh of meshes.slice(1)) {
      bounds.add(mesh.aabb);
    }
    const radius = bounds.halfExtents.length();
    const layer = new pc.Layer({ name: "Bell Bug capture" });
    app.scene.layers.pushOpaque(layer);
    app.scene.layers.pushTransparent(layer);
    layer.addMeshInstances(meshes);
    for (const light of app.root.findComponents("light")) {
      layer.addLight(light);
    }
    const camera = new pc.Entity("Bell Bug capture camera");
    camera.addComponent("camera", {
      layers: [layer.id],
      projection: pc.PROJECTION_ORTHOGRAPHIC,
      orthoHeight: radius * 1.18,
      clearColor: new pc.Color(0, 0, 0, 0),
      nearClip: 0.01,
      farClip: 100,
    });
    app.root.addChild(camera);
    const center = bounds.center;
    camera.setPosition(center.x + radius * 2.5, center.y + radius * 1.8, center.z - radius * 3);
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
      const context = canvas.getContext("2d");
      const image = context.createImageData(512, 512);
      let visiblePixels = 0, transparentPixels = 0, margin = 512;
      for (let y = 0; y < 512; y++) {
        const row = app.graphicsDevice.isWebGPU ? y : 511 - y;
        image.data.set(pixels.subarray(y * 2048, (y + 1) * 2048), row * 2048);
        for (let x = 0; x < 512; x++) {
          if (pixels[(y * 512 + x) * 4 + 3] > 0) {
            visiblePixels++;
            margin = Math.min(margin, x, y, 511 - x, 511 - y);
          } else {
            transparentPixels++;
          }
        }
      }
      context.putImageData(image, 0, 0);
      const link = document.createElement("a");
      link.download = "bell-bug-preview.png";
      link.href = canvas.toDataURL("image/png");
      link.click();

      return {
        visiblePixels,
        transparentPixels,
        margin,
      };
    } finally {
      camera.destroy();
      app.scene.layers.remove(layer);
      target.destroy();
      texture.destroy();
    }
  }

  /**
   * @param {import("playcanvas").RenderComponent} render
   * @returns {import("playcanvas").MeshInstance[]}
   */
  static #meshes(render) {
    return render.enabled && render.entity.enabled ? render.meshInstances : [];
  }
}
