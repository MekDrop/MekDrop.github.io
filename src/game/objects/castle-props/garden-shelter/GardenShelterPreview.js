/**
 * Captures the shelter's production meshes/materials into RGBA, omitting
 * scenery, HUD and other shadow casters. Invoked only by its saved test map.
 */
export class GardenShelterPreview {
  /**
   * @type {import("./GardenShelter.js").GardenShelter}
   */
  owner;
  /**
   * @param {import("./GardenShelter.js").GardenShelter} owner
   */
  constructor(owner) {
    this.owner = owner;
  }

  /**
   * @param {number} [yaw]
   * @param {number} [elevation]
   * @param {boolean} [detail]
   * @param {import("playcanvas").Vec3} [focus]
   * @param {number} [detailRadius]
   * @returns {Promise<{visiblePixels: number, transparentPixels: number, margin: number}>}
   */
  async capture(yaw = 140, elevation = 25, detail = false, focus = null, detailRadius = 0.9) {
    const { pc, modelLibrary } = this.owner.previewOptions;
    const app = pc.Application.getApplication();
    const entity = modelLibrary.instantiate(this.owner.modelUrl);
    const support = this.owner.visualRoots[0].children[0];
    app.root.addChild(entity);
    entity.setPosition(support.getPosition());
    entity.setRotation(support.getRotation());
    entity.setLocalScale(support.getWorldTransform().getScale());
    const meshes = [entity, ...this.owner.vineRoots].flatMap(GardenShelterPreview.#rootMeshes);
    if (!meshes.length) {
      return null;
    }
    const bounds = meshes[0].aabb.clone();
    for (const mesh of meshes.slice(1)) {
      bounds.add(mesh.aabb);
    }
    const radius = detail ? detailRadius * support.getWorldTransform().getScale().y : bounds.halfExtents.length();
    const layer = new pc.Layer({ name: "Garden shelter capture" });
    app.scene.layers.pushOpaque(layer);
    app.scene.layers.pushTransparent(layer);
    layer.addMeshInstances(meshes);
    for (const light of app.root.findComponents("light")) {
      layer.addLight(light);
    }
    const camera = new pc.Entity("Garden shelter capture camera");
    camera.addComponent("camera", {
      layers: [layer.id],
      projection: pc.PROJECTION_ORTHOGRAPHIC,
      orthoHeight: radius * 1.18,
      clearColor: new pc.Color(0, 0, 0, 0),
      nearClip: 0.01,
      farClip: 100,
    });
    app.root.addChild(camera);
    const center = detail
      ? support.getWorldTransform().transformPoint(focus ?? new pc.Vec3(-1.85, 1.25, -1.5))
      : bounds.center;
    const azimuth = yaw * Math.PI / 180;
    const pitch = elevation * Math.PI / 180;
    camera.setPosition(center.x + radius * 4 * Math.sin(azimuth) * Math.cos(pitch),
      center.y + radius * 4 * Math.sin(pitch),
      center.z + radius * 4 * Math.cos(azimuth) * Math.cos(pitch));
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
      link.download = detail ? "garden-shelter-detail.png"
        : yaw === 140 && elevation === 25 ? "garden-shelter-preview.png"
          : `garden-shelter-${yaw}-${elevation}.png`;
      link.href = canvas.toDataURL("image/png");
      link.click();

      return {
        visiblePixels,
        transparentPixels,
        margin,
      };
    } finally {
      entity.destroy();
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

  /**
   * @param {import("playcanvas").Entity} root
   * @returns {import("playcanvas").MeshInstance[]}
   */
  static #rootMeshes(root) {
    return root.findComponents("render").flatMap(GardenShelterPreview.#meshes);
  }
}
