import {
  GameModelAnimationMissingError,
  GameModelLoadError,
  GameModelUnavailableError,
  GameModelLibraryDestroyedError,
} from "../errors/assets/index.js";
import { AuthoredSurfaceStyle } from "../rendering/AuthoredSurfaceStyle.js";
import { GameTextureLibrary } from "../textures/GameTextureLibrary.js";

export class GameModelLibrary {
  /**
   * @type {GameTextureLibrary}
   */
  #textures;
  /**
   * @type {boolean}
   */
  #ownsTextures;
  /**
   *
   * @type {typeof pc}
   */
  #pc;
  /**
   *
   * @type {pc.Application}
   */
  #app;
  /**
   *
   * @type {Map}
   */
  #assets = new Map();
  /**
   *
   * @type {Map}
   */
  #mergedModels = new Map();
  /**
   * @type {Map<string, Promise<void>>}
   */
  #loading = new Map();
  /**
   * @type {ModelLoadJob[]}
   */
  #loadQueue = [];
  /**
   * @type {number}
   */
  #activeLoads = 0;
  /**
   * @type {boolean}
   */
  #destroyed = false;

  /**
   *
   * @param {{pc: typeof pc, app: pc.Application, textureLibrary?: GameTextureLibrary}} options
   * @param {typeof pc} options.pc
   * @param {pc.Application} options.app
   * @param {GameTextureLibrary} options.textureLibrary
   */
  constructor({ pc, app, textureLibrary = null }) {
    this.#ownsTextures = !textureLibrary;
    this.#textures = textureLibrary ?? new GameTextureLibrary({
      pc,
      app,
    });
    /**
     *
     * @type {typeof pc}
     */
    this.#pc = pc;
    /**
     *
     * @type {pc.Application}
     */
    this.#app = app;
  }

  /**
   *
   * @param {string[]} urls
   * @param {(url: string, completed: number, total: number) => void} onProgress
   */
  async load(urls, onProgress = null) {
    const uniqueUrls = [...new Set(urls)];
    const pending = new Set(uniqueUrls);
    await Promise.all(uniqueUrls.map(/**
     *
     * @param {string} url
     */
      async (url) => {
        onProgress?.(url, uniqueUrls.length - pending.size, uniqueUrls.length);
        await this.#mapUrl(url);
        pending.delete(url);
        onProgress?.(pending.values().next().value ?? url, uniqueUrls.length - pending.size, uniqueUrls.length);
      }));
  }

  /**
   *
   * @param {string} url
   */
  instantiate(url) {
    const asset = this.#assets.get(url);
    if (!asset?.resource) {
      throw new GameModelUnavailableError({ url });
    }

    const entity = asset.resource.instantiateRenderEntity({
      castShadows: true,
      receiveShadows: true,
    });
    this.#configureRenderHierarchy(entity);

    return entity;
  }

  /**
   *
   * @param {string} url
   * @param {{material: pc.Material, castShadows: boolean, receiveShadows: boolean}} options
   * @param {pc.Material} options.material
   * @param {boolean} options.linearVertexColors Decode imported material colour before baking it into linear vertex colours.
   * @param {boolean} options.castShadows
   * @param {boolean} options.receiveShadows
   */
  instantiateMerged(
    url,
    {
      material = null,
      linearVertexColors = false,
      castShadows = true,
      receiveShadows = castShadows,
    } = {},
  ) {
    const mergedModel = this.#mergedModelFor(url, linearVertexColors);

    const entity = new this.#pc.Entity("Merged game model");
    const meshInstance = new this.#pc.MeshInstance(
      mergedModel.mesh,
      material ?? mergedModel.material,
      entity,
    );
    meshInstance.castShadow = castShadows;
    meshInstance.receiveShadow = receiveShadows;
    entity.addComponent("render", {
      meshInstances: [meshInstance],
      castShadows,
      receiveShadows,
    });

    return entity;
  }

  /**
   *
   * @param {string} url
   * @param {Array} matrices
   * @param {{name: string, material: pc.Material, castShadows: boolean, receiveShadows: boolean, dynamic: boolean}} options
   * @param {string} options.name
   * @param {pc.Material} options.material
   * @param {boolean} options.linearVertexColors Decode imported material colour before baking it into linear vertex colours.
   * @param {boolean} options.castShadows
   * @param {boolean} options.receiveShadows
   * @param {boolean} options.dynamic
   * @param {pc.VertexFormat|null} options.instanceFormat Optional interleaved float32 instance layout.
   */
  instantiateMergedBatch(
    url,
    matrices,
    {
      name = "Instanced game model",
      material = null,
      linearVertexColors = false,
      castShadows = true,
      receiveShadows = castShadows,
      dynamic = false,
      instanceFormat = null,
    } = {},
  ) {
    const mergedModel = this.#mergedModelFor(url, linearVertexColors);
    if (!matrices.length) {
      return null;
    }

    const vertexBuffer = new this.#pc.VertexBuffer(
      this.#app.graphicsDevice,
      instanceFormat ?? this.#pc.VertexFormat.getDefaultInstancingFormat(
        this.#app.graphicsDevice,
      ),
      matrices.length / (instanceFormat ? instanceFormat.size / Float32Array.BYTES_PER_ELEMENT : 16),
      {
        data: new Float32Array(matrices),
        usage: dynamic ? this.#pc.BUFFER_DYNAMIC : this.#pc.BUFFER_STATIC,
      },
    );
    const entity = new this.#pc.Entity(name);
    const meshInstance = new this.#pc.MeshInstance(
      mergedModel.mesh,
      material ?? mergedModel.material,
      entity,
    );
    meshInstance.setInstancing(vertexBuffer, false);
    meshInstance.castShadow = castShadows;
    meshInstance.receiveShadow = receiveShadows;
    entity.addComponent("render", {
      meshInstances: [meshInstance],
      castShadows,
      receiveShadows,
    });

    return {
      entity,
      vertexBuffer,
    };
  }

  /**
   *
   * @param {string} url
   * @param {Array} requiredNames
   */
  getAnimationTracks(url, requiredNames = []) {
    const asset = this.#assets.get(url);
    if (!asset?.resource) {
      throw new GameModelUnavailableError({ url });
    }

    const tracks = new Map(
      (asset.resource.animations ?? []).map(GameModelLibrary.#map),
    );
    for (const animation of requiredNames) {
      if (!tracks.has(animation)) {
        throw new GameModelAnimationMissingError({
          url,
          animation,
        });
      }
    }

    return tracks;
  }

  destroy() {
    this.#destroyed = true;
    for (const job of this.#loadQueue.splice(0)) {
      this.#loading.delete(job.url);
      job.reject(new GameModelLibraryDestroyedError({ url: job.url }));
    }
    for (const { mesh, material } of this.#mergedModels.values()) {
      mesh.decRefCount();
      if (mesh.refCount < 1) {
        mesh.destroy();
      }
      material.destroy();
    }
    this.#mergedModels.clear();
    for (const asset of this.#assets.values()) {
      this.#unloadModel(asset);
    }
    this.#assets.clear();
    if (this.#ownsTextures && this.#activeLoads === 0) {
      this.#textures.destroy();
    }
  }

  /**
   *
   * @param {string} url
   */
  #loadModel(url) {
    const asset = new this.#pc.Asset("Game model", "container", {
      url,
      filename: url.slice(url.lastIndexOf("/") + 1),
    }, {}, { image: { processAsync: this.#textures.processImage } });
    this.#app.assets.add(asset);

    return new Promise(/**
     *
     * @param {() => void} resolve
     * @param {(reason?: Error) => void} reject
     */
      (resolve, reject) => {
        asset.ready(/**
       *
       * @param {pc.Asset} loadedAsset
       */
          (loadedAsset) => {
            if (this.#destroyed) {
              this.#unloadModel(loadedAsset);
              reject(new GameModelLibraryDestroyedError({ url }));

              return;
            }
            for (const material of loadedAsset.resource.materials) {
              AuthoredSurfaceStyle.configure(
                this.#pc, this.#app.graphicsDevice, material.resource,
              );
            }
            this.#assets.set(url, loadedAsset);
            resolve();
          });
        asset.once("error", /**
       *
       * @param {string|Error} cause
       */
          (cause) => {
            this.#unloadModel(asset);
            reject(new GameModelLoadError({
              url,
              cause,
            }));
          });
        this.#app.assets.load(asset);
      });
  }

  /**
   *
   * @param {string} url
   * @param {boolean} linearVertexColors
   */
  #mergedModelFor(url, linearVertexColors = false) {
    const asset = this.#assets.get(url);
    if (!asset?.resource) {
      throw new GameModelUnavailableError({ url });
    }

    const cacheKey = `${url}:${linearVertexColors}`;
    let mergedModel = this.#mergedModels.get(cacheKey);
    if (!mergedModel) {
      mergedModel = this.#mergeRenderHierarchy(asset.resource, linearVertexColors);
      this.#mergedModels.set(cacheKey, mergedModel);
    }
    return mergedModel;
  }

  /**
   *
   * @param {pc.Entity} root
   */
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

  /**
   *
   * @param {pc.Asset|pc.Texture|pc.Material} resource
   * @param {boolean} linearVertexColors
   */
  #mergeRenderHierarchy(resource, linearVertexColors = false) {
    const pc = this.#pc;
    const sourceRoot = resource.instantiateRenderEntity();
    // A single-node glTF uses its authored node as the entity root. Its
    // transform is part of the asset (for example bottom-anchored masonry),
    // so bake it just like child transforms rather than cancelling it out.
    const positions = [];
    const normals = [];
    const uvs = [];
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
        const sourceUvs = [];
        const sourceIndices = [];
        const vertexCount = sourceMesh.getPositions(sourcePositions);
        sourceMesh.getNormals(sourceNormals);
        sourceMesh.getUvs(0, sourceUvs);
        sourceMesh.getIndices(sourceIndices);

        const modelTransform = meshInstance.node.getWorldTransform();
        const normalTransform = new pc.Mat4()
          .copy(modelTransform)
          .invert()
          .transpose();
        const vertexOffset = positions.length / 3;
        const color = (meshInstance.material?.diffuse ?? pc.Color.WHITE).clone();
        // glTF diffuse is stored as sRGB in StandardMaterial, while vertex
        // colours multiply the linear albedo directly in the engine shader.
        if (linearVertexColors) {
          color.linear();
        }
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
          uvs.push(sourceUvs[vertex * 2] ?? 0, sourceUvs[vertex * 2 + 1] ?? 0);
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
    mesh.setUvs(0, uvs);
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

    return {
      mesh,
      material,
    };
  }

  /**
   *
   * @param {string} url
   */
  #mapUrl(url) {
    if (this.#destroyed) {
      return Promise.reject(new GameModelLibraryDestroyedError({ url }));
    }
    if (this.#assets.has(url)) {
      return Promise.resolve();
    }
    let loading = this.#loading.get(url);
    if (!loading) {
      loading = new Promise(/**
       *
       * @param {() => void} resolve
       * @param {(error: Error) => void} reject
       */
        (resolve, reject) => {
          this.#loadQueue.push({
            url,
            resolve,
            reject,
          });
        });
      this.#loading.set(url, loading);
      this.#drainLoads();
    }

    return loading;
  }

  /**
   * Keep embedded image decoders from allocating every model's pixels at once.
   */
  #drainLoads() {
    while (!this.#destroyed && this.#activeLoads < 4 && this.#loadQueue.length) {
      const job = this.#loadQueue.shift();
      this.#activeLoads += 1;
      this.#runLoad(job);
    }
  }

  /**
   * @param {ModelLoadJob} job
   * @returns {Promise<void>}
   */
  async #runLoad(job) {
    try {
      await this.#loadModel(job.url);
      job.resolve();
    } catch (error) {
      job.reject(error);
    } finally {
      this.#loading.delete(job.url);
      this.#activeLoads -= 1;
      if (this.#ownsTextures && this.#destroyed && this.#activeLoads === 0) {
        this.#textures.destroy();
      }
      this.#drainLoads();
    }
  }

  /**
   * Release decoded pixels immediately instead of waiting for bitmap GC.
   * @param {pc.Asset} asset
   */
  #unloadModel(asset) {
    this.#textures.detachModel(asset);
    for (const texture of asset.resource?.textures ?? []) {
      texture.resource?.releaseImageSources();
    }
    asset.unload();
    this.#app?.assets.remove(asset);
  }

  /**
   *
   * @param {{resource: pc.Asset|pc.Texture|pc.Material}} options
   * @param {pc.Asset|pc.Texture|pc.Material} options.resource
   */
  static #map({ resource }) {
    return [resource.name, resource];
  }
}

/**
 * @typedef {{url:string,resolve:()=>void,reject:(error:Error)=>void}} ModelLoadJob
 */
