import {
  GameModelAnimationMissingError,
  GameModelLoadError,
  GameModelUnavailableError,
} from "../errors/assets/index.js";

export class GameModelLibrary {
  #pc;
  #app;
  #assets = new Map();
  #mergedModels = new Map();

  constructor({ pc, app }) {
    this.#pc = pc;
    this.#app = app;
  }

  async load(urls) {
    await Promise.all(
      [...new Set(urls)].map((url) => this.#loadModel(url)),
    );
  }

  instantiate(url) {
    const asset = this.#assets.get(url);
    if (!asset?.resource) throw new GameModelUnavailableError({ url });

    const entity = asset.resource.instantiateRenderEntity({
      castShadows: true,
      receiveShadows: true,
    });
    this.#configureRenderHierarchy(entity);
    return entity;
  }

  instantiateMerged(url) {
    const asset = this.#assets.get(url);
    if (!asset?.resource) throw new GameModelUnavailableError({ url });

    let mergedModel = this.#mergedModels.get(url);
    if (!mergedModel) {
      mergedModel = this.#mergeRenderHierarchy(asset.resource);
      this.#mergedModels.set(url, mergedModel);
    }

    const entity = new this.#pc.Entity("Merged game model");
    const meshInstance = new this.#pc.MeshInstance(
      mergedModel.mesh,
      mergedModel.material,
      entity,
    );
    meshInstance.castShadow = true;
    meshInstance.receiveShadow = true;
    entity.addComponent("render", { meshInstances: [meshInstance] });
    return entity;
  }

  getAnimationTracks(url, requiredNames = []) {
    const asset = this.#assets.get(url);
    if (!asset?.resource) throw new GameModelUnavailableError({ url });

    const tracks = new Map(
      (asset.resource.animations ?? []).map(({ resource }) => [
        resource.name,
        resource,
      ]),
    );
    for (const animation of requiredNames) {
      if (!tracks.has(animation)) {
        throw new GameModelAnimationMissingError({ url, animation });
      }
    }
    return tracks;
  }

  destroy() {
    for (const { mesh, material } of this.#mergedModels.values()) {
      mesh.decRefCount();
      if (mesh.refCount < 1) mesh.destroy();
      material.destroy();
    }
    this.#mergedModels.clear();
    for (const asset of this.#assets.values()) {
      asset.unload();
      this.#app?.assets.remove(asset);
    }
    this.#assets.clear();
  }

  #loadModel(url) {
    const asset = new this.#pc.Asset("Game model", "container", {
      url,
      filename: url.slice(url.lastIndexOf("/") + 1),
    });
    this.#app.assets.add(asset);

    return new Promise((resolve, reject) => {
      asset.ready((loadedAsset) => {
        this.#assets.set(url, loadedAsset);
        resolve();
      });
      asset.once("error", (cause) => {
        this.#app.assets.remove(asset);
        reject(new GameModelLoadError({ url, cause }));
      });
      this.#app.assets.load(asset);
    });
  }

  #configureRenderHierarchy(root) {
    const pending = [root];
    while (pending.length) {
      const entity = pending.pop();
      for (const meshInstance of entity.render?.meshInstances ?? []) {
        meshInstance.castShadow = true;
        meshInstance.receiveShadow = true;
      }
      pending.push(...entity.children);
    }
  }

  #mergeRenderHierarchy(resource) {
    const pc = this.#pc;
    const sourceRoot = resource.instantiateRenderEntity();
    const rootInverse = new pc.Mat4().copy(
      sourceRoot.getWorldTransform(),
    );
    rootInverse.invert();
    const positions = [];
    const normals = [];
    const colors = [];
    const indices = [];
    const pending = [sourceRoot];
    const sourcePosition = new pc.Vec3();
    const mergedPosition = new pc.Vec3();
    const sourceNormal = new pc.Vec3();
    const mergedNormal = new pc.Vec3();

    while (pending.length) {
      const entity = pending.pop();
      for (const meshInstance of entity.render?.meshInstances ?? []) {
        const sourceMesh = meshInstance.mesh;
        const sourcePositions = [];
        const sourceNormals = [];
        const sourceIndices = [];
        const vertexCount = sourceMesh.getPositions(sourcePositions);
        sourceMesh.getNormals(sourceNormals);
        sourceMesh.getIndices(sourceIndices);

        const modelTransform = new pc.Mat4().mul2(
          rootInverse,
          meshInstance.node.getWorldTransform(),
        );
        const normalTransform = new pc.Mat4()
          .copy(modelTransform)
          .invert()
          .transpose();
        const vertexOffset = positions.length / 3;
        const color = meshInstance.material?.diffuse ?? pc.Color.WHITE;
        const alpha = meshInstance.material?.opacity ?? 1;

        for (let vertex = 0; vertex < vertexCount; vertex += 1) {
          const offset = vertex * 3;
          sourcePosition.set(
            sourcePositions[offset],
            sourcePositions[offset + 1],
            sourcePositions[offset + 2],
          );
          modelTransform.transformPoint(sourcePosition, mergedPosition);
          positions.push(mergedPosition.x, mergedPosition.y, mergedPosition.z);

          sourceNormal.set(
            sourceNormals[offset],
            sourceNormals[offset + 1],
            sourceNormals[offset + 2],
          );
          normalTransform.transformVector(sourceNormal, mergedNormal).normalize();
          normals.push(mergedNormal.x, mergedNormal.y, mergedNormal.z);
          colors.push(
            Math.round(pc.math.clamp(color.r, 0, 1) * 255),
            Math.round(pc.math.clamp(color.g, 0, 1) * 255),
            Math.round(pc.math.clamp(color.b, 0, 1) * 255),
            Math.round(pc.math.clamp(alpha, 0, 1) * 255),
          );
        }

        const primitive = sourceMesh.primitive[0];
        if (primitive.indexed) {
          const baseVertex = primitive.baseVertex ?? 0;
          for (
            let index = primitive.base;
            index < primitive.base + primitive.count;
            index += 1
          ) {
            indices.push(
              vertexOffset + sourceIndices[index] + baseVertex,
            );
          }
        } else {
          for (
            let index = primitive.base;
            index < primitive.base + primitive.count;
            index += 1
          ) {
            indices.push(vertexOffset + index);
          }
        }
      }
      pending.push(...entity.children);
    }

    sourceRoot.destroy();

    const mesh = new pc.Mesh(this.#app.graphicsDevice);
    mesh.setPositions(positions);
    mesh.setNormals(normals);
    mesh.setColors32(colors);
    mesh.setIndices(indices);
    mesh.update();
    mesh.incRefCount();

    const material = new pc.StandardMaterial();
    material.name = "Merged game model material";
    material.diffuse = new pc.Color(1, 1, 1);
    material.diffuseVertexColor = true;
    material.gloss = 0.08;
    material.metalness = 0;
    material.useMetalness = true;
    material.update();

    return { mesh, material };
  }
}
