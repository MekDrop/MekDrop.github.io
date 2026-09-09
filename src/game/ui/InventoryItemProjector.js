const TEXTURE_SIZE = 384;
const CAMERA_DIRECTION = Object.freeze({ x: 1, y: 1, z: 1 });

export class InventoryItemProjector {
  #pc;
  #app;
  #modelLibrary;
  #projections = new Map();

  constructor({ pc, app, modelLibrary }) {
    this.#pc = pc;
    this.#app = app;
    this.#modelLibrary = modelLibrary;
  }

  textureFor(modelUrl) {
    if (!modelUrl) {
      return null;
    }
    let projection = this.#projections.get(modelUrl);
    if (!projection) {
      projection = this.#createProjection(modelUrl);
      this.#projections.set(modelUrl, projection);
    }
    return projection.texture;
  }

  destroy() {
    for (const projection of this.#projections.values()) {
      projection.renderHandle?.off();
      projection.camera.enabled = false;
      this.#app?.scene.layers.remove(projection.layer);
      projection.root.destroy();
      for (const material of projection.materials) {
        material.destroy();
      }
      projection.renderTarget.destroy();
      projection.texture.destroy();
    }
    this.#projections.clear();
    this.#modelLibrary = null;
    this.#app = null;
    this.#pc = null;
  }

  #createProjection(modelUrl) {
    const pc = this.#pc;
    const layer = new pc.Layer({ name: "Inventory item projection" });
    this.#app.scene.layers.push(layer);

    const texture = new pc.Texture(this.#app.graphicsDevice, {
      name: "Inventory item projection texture",
      width: TEXTURE_SIZE,
      height: TEXTURE_SIZE,
      format: pc.PIXELFORMAT_RGBA8,
      mipmaps: true,
      minFilter: pc.FILTER_LINEAR_MIPMAP_LINEAR,
      magFilter: pc.FILTER_LINEAR,
      addressU: pc.ADDRESS_CLAMP_TO_EDGE,
      addressV: pc.ADDRESS_CLAMP_TO_EDGE,
    });
    const renderTarget = new pc.RenderTarget({
      colorBuffer: texture,
      depth: true,
      samples: 4,
    });
    const root = new pc.Entity("Inventory projection scene");
    const model = this.#modelLibrary.instantiate(modelUrl);
    model.name = "Projected inventory model";
    model.setLocalEulerAngles(0, 20, 0);
    const spriteMaterials = new Map();
    for (const render of model.findComponents("render")) {
      render.layers = [layer.id];
      for (const meshInstance of render.meshInstances) {
        let spriteMaterial = spriteMaterials.get(meshInstance.material);
        if (!spriteMaterial) {
          spriteMaterial = this.#createSpriteMaterial(
            meshInstance.material,
          );
          spriteMaterials.set(meshInstance.material, spriteMaterial);
        }
        meshInstance.material = spriteMaterial;
        meshInstance.castShadow = false;
        meshInstance.receiveShadow = false;
      }
    }
    root.addChild(model);
    this.#app.root.addChild(root);

    const bounds = this.#modelBounds(model);
    const center = bounds.center;
    const radius = Math.max(0.05, bounds.halfExtents.length());
    const direction = new pc.Vec3(
      CAMERA_DIRECTION.x,
      CAMERA_DIRECTION.y,
      CAMERA_DIRECTION.z,
    ).normalize();
    const right = new pc.Vec3().cross(pc.Vec3.UP, direction).normalize();
    const up = new pc.Vec3().cross(direction, right).normalize();
    const { projectedHalfWidth, projectedHalfHeight } =
      this.#projectedHalfExtents(model, center, right, up);
    const camera = new pc.Entity("Inventory projection camera");
    camera.addComponent("camera", {
      clearColor: new pc.Color(0, 0, 0, 0),
      clearColorBuffer: true,
      clearDepthBuffer: true,
      projection: pc.PROJECTION_ORTHOGRAPHIC,
      orthoHeight:
        Math.max(projectedHalfWidth, projectedHalfHeight) * 1.12,
      nearClip: 0.01,
      farClip: radius * 10 + 1,
      priority: -100,
    });
    camera.camera.layers = [layer.id];
    camera.camera.renderTarget = renderTarget;
    camera.setPosition(
      center.x + direction.x * radius * 4,
      center.y + direction.y * radius * 4,
      center.z + direction.z * radius * 4,
    );
    camera.lookAt(center);
    root.addChild(camera);

    const projection = {
      camera,
      layer,
      materials: [...spriteMaterials.values()],
      model,
      root,
      renderHandle: null,
      renderTarget,
      texture,
    };
    projection.renderHandle = this.#app.once("postrender", () => {
      projection.camera.enabled = false;
      projection.model.enabled = false;
      projection.renderHandle = null;
    });
    return projection;
  }

  #createSpriteMaterial(sourceMaterial) {
    const material = sourceMaterial.clone();
    const sourceColor = sourceMaterial.diffuse?.clone();
    material.useLighting = false;
    material.useFog = false;
    material.useSkybox = false;
    material.gloss = 0;
    material.metalness = 0;
    if (sourceColor && material.diffuse && material.emissive) {
      material.diffuse.set(0, 0, 0);
      material.ambient.set(0, 0, 0);
      material.emissive.copy(sourceColor);
      material.emissiveIntensity = 1;
    }
    if (sourceMaterial.diffuseMap) {
      material.emissiveMap = sourceMaterial.diffuseMap;
      material.emissiveMapUv = sourceMaterial.diffuseMapUv;
      material.emissiveMapTiling.copy(sourceMaterial.diffuseMapTiling);
      material.emissiveMapOffset.copy(sourceMaterial.diffuseMapOffset);
      material.diffuseMap = null;
    }
    material.update();
    return material;
  }

  #modelBounds(model) {
    const meshInstances = model
      .findComponents("render")
      .flatMap(({ meshInstances }) => meshInstances);
    const bounds = meshInstances[0].aabb.clone();
    for (const meshInstance of meshInstances.slice(1)) {
      bounds.add(meshInstance.aabb);
    }
    return bounds;
  }

  #projectedHalfExtents(model, center, right, up) {
    let projectedHalfWidth = 0;
    let projectedHalfHeight = 0;
    for (const render of model.findComponents("render")) {
      for (const meshInstance of render.meshInstances) {
        const bounds = meshInstance.aabb;
        const offset = bounds.center.clone().sub(center);
        const halfExtents = bounds.halfExtents;
        const halfWidth =
          Math.abs(right.x) * halfExtents.x +
          Math.abs(right.y) * halfExtents.y +
          Math.abs(right.z) * halfExtents.z;
        const halfHeight =
          Math.abs(up.x) * halfExtents.x +
          Math.abs(up.y) * halfExtents.y +
          Math.abs(up.z) * halfExtents.z;
        projectedHalfWidth = Math.max(
          projectedHalfWidth,
          Math.abs(offset.dot(right)) + halfWidth,
        );
        projectedHalfHeight = Math.max(
          projectedHalfHeight,
          Math.abs(offset.dot(up)) + halfHeight,
        );
      }
    }
    return { projectedHalfWidth, projectedHalfHeight };
  }
}
