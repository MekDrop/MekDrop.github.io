import clothModelUrl from "../../models/castle/residential/banner-cloth.glb?url";
import authoredModelUrl from "../../models/castle/residential/metal-pole.glb?url";
import { AmmoClothPhysics } from "../shared/AmmoClothPhysics.js";

const BANNER_TEXTURE_WIDTH = 64;
const BANNER_TEXTURE_HEIGHT = 96;
const BANNER_POINT_START = 0.8;

/**
 * @typedef {{root: import("playcanvas").Entity, width: number, height: number, cloth: ReturnType<AmmoClothPhysics["createCloth"]>, mesh: import("playcanvas").Mesh, positions: Float32Array, vertexUv: Float32Array, indices: Uint16Array}} CastleBannerInstance
 */

export class CastleBanner {
  /**
   * @returns {string[]}
   */
  static get modelUrls() { return [authoredModelUrl, clothModelUrl]; }
  /**
   * @type {import("../../models/GameModelLibrary.js").GameModelLibrary}
   */
  #modelLibrary;
  /**
   *
    * @type {typeof import("playcanvas")}
   */
  #pc;
  /**
   *
    * @type {import("playcanvas").Application}
   */
  #app;
  /**
   *
    * @type {import("playcanvas").Entity}
   */
  #entity;
  /**
   *
    * @type {import("playcanvas").StandardMaterial}
   */
  #material;
  /**
   *
    * @type {import("playcanvas").StandardMaterial}
   */
  #railMaterial;
  /**
   *
    * @type {import("playcanvas").Texture}
   */
  #texture;
  /**
   *
    * @type {Array<CastleBannerInstance>}
   */
  #banners = [];
  /**
   *
    * @type {CastleBannerInstance|null}
   */
  #activeBanner = null;
  /**
   *
    * @type {AmmoClothPhysics}
   */
  #physics;
  /**
   *
    * @type {{off: () => void}|null}
   */
  #updateHandle = null;

  /**
   *
   * @param {{pc: typeof import("playcanvas"), app: import("playcanvas").Application}} options
   * @param {typeof import("playcanvas")} options.pc
   * @param {import("../../models/GameModelLibrary.js").GameModelLibrary} options.modelLibrary
   * @param {import("playcanvas").Application} options.app
   */
  constructor({ pc, app, modelLibrary }) {
    this.#modelLibrary = modelLibrary;
    this.#pc = pc;
    this.#app = app;
    this.#entity = new pc.Entity("Castle banners");
    this.#texture = this.#createTexture();
    this.#material = this.#createMaterial();
    this.#railMaterial = this.#createRailMaterial();
    this.#physics = new AmmoClothPhysics({ pc });
    this.#updateHandle = app.on("update", /**
     *
     * @param {number} deltaTime
     */
    (deltaTime) => {
      this.#animate(deltaTime);
    });
  }

  get entity() {
    return this.#entity;
  }

  /**
   *
   * @param {{x: number, y: number, z: number, yaw: number, width: number, height: number}} options
   * @param {number} options.x
   * @param {number} options.y
   * @param {number} options.z
   * @param {number} options.yaw
   * @param {number} options.width
   * @param {number} options.height
   */
  add({ x, y, z, yaw = 0, width = 1, height = 1.5 }) {
    const root = new this.#pc.Entity("Hanging castle banner");
    root.setPosition(x, y, z);
    root.setEulerAngles(0, yaw, 0);
    this.#entity.addChild(root);

    const geometry = this.#createMesh(width, height);
    const meshInstance = new this.#pc.MeshInstance(
      geometry.mesh,
      this.#material,
    );
    meshInstance.castShadow = true;
    meshInstance.receiveShadow = true;
    meshInstance.pick = false;
    const cloth = new this.#pc.Entity("Castle banner cloth");
    cloth.addComponent("render", {
      meshInstances: [meshInstance],
      castShadows: true,
      receiveShadows: true,
    });
    root.addChild(cloth);

    const rail = this.#modelLibrary.instantiate(authoredModelUrl);
    rail.name = "Castle banner rail";
    for (const instance of rail.findComponents("render").flatMap(/**
     * @param {import("playcanvas").RenderComponent} render
     */ (render) => render.meshInstances)) {
      instance.material = this.#railMaterial;
      instance.castShadow = true;
      instance.receiveShadow = true;
    }
    rail.setLocalPosition(0, 0.035, 0.012);
    rail.setLocalEulerAngles(0, 0, 90);
    rail.setLocalScale(0.055, width + 0.18, 0.055);
    root.addChild(rail);

    const seed = Math.abs(
      Math.sin((this.#banners.length + 1) * 1.91 + x * 0.23 + z * 0.31),
    );
    const banner = {
      ...geometry,
      root,
      width,
      height,
    };
    banner.cloth = this.#physics.createCloth({
      positions: banner.positions,
      indices: banner.indices,
      pinnedIndices: geometry.pinnedIndices,
      vertexUv: banner.vertexUv,
      root,
      normalAxis: 2,
      seed,
      wallPlane: 0,
    });
    this.#banners.push(banner);
    return true;
  }

  /**
   *
   * @param {number} rayStart
   * @param {number} rayEnd
   */
  getBannerHit(rayStart, rayEnd) {
    let closest = null;
    for (const banner of this.#banners) {
      const hit = this.#intersectBannerRay(banner, rayStart, rayEnd, true);
      if (!hit || (closest && hit.distance >= closest.distance)) continue;
      closest = hit;
    }
    return closest;
  }

  /**
   *
   * @param {{banner: CastleBannerInstance, point: import("playcanvas").Vec3}} hit
   */
  beginWindGesture(hit) {
    if (!hit?.banner) {
      return;
    }
    this.#activeBanner = hit.banner;
    this.#physics.beginPointer(this.#activeBanner.cloth, hit.point);
  }

  /**
   *
   * @param {number} rayStart
   * @param {number} rayEnd
   * @param {number} deltaTime
   */
  applyMouseWind(rayStart, rayEnd, deltaTime) {
    if (!this.#activeBanner) {
      return;
    }
    const hit = this.#intersectBannerRay(
      this.#activeBanner,
      rayStart,
      rayEnd,
      false,
    );
    if (!hit) {
      return;
    }
    this.#physics.applyPointer(this.#activeBanner.cloth, hit.point, deltaTime);
  }

  endWindGesture() {
    this.#physics.endPointer(this.#activeBanner?.cloth);
    this.#activeBanner = null;
  }

  destroy() {
    this.#updateHandle?.off();
    this.#updateHandle = null;
    this.endWindGesture();
    this.#physics?.destroy();
    this.#physics = null;
    this.#entity?.destroy();
    this.#entity = null;
    for (const { mesh } of this.#banners) {
      mesh.decRefCount();
      if (mesh.refCount < 1) mesh.destroy();
    }
    this.#banners = [];
    this.#material?.destroy();
    this.#material = null;
    this.#railMaterial?.destroy();
    this.#railMaterial = null;
    this.#texture?.destroy();
    this.#texture = null;
  }

  #createTexture() {
    const canvas = document.createElement("canvas");
    canvas.width = BANNER_TEXTURE_WIDTH;
    canvas.height = BANNER_TEXTURE_HEIGHT;
    const context = canvas.getContext("2d");
    context.imageSmoothingEnabled = false;

    context.fillStyle = "#173f88";
    context.fillRect(0, 0, BANNER_TEXTURE_WIDTH, BANNER_TEXTURE_HEIGHT);
    context.fillStyle = "#245bb7";
    context.fillRect(7, 0, BANNER_TEXTURE_WIDTH - 14, BANNER_TEXTURE_HEIGHT);
    context.fillStyle = "#3470d2";
    context.fillRect(10, 0, 6, BANNER_TEXTURE_HEIGHT);
    context.fillStyle = "#0f2d69";
    context.fillRect(BANNER_TEXTURE_WIDTH - 15, 0, 6, BANNER_TEXTURE_HEIGHT);

    context.fillStyle = "#f1dfad";
    context.fillRect(21, 31, 22, 24);
    context.fillRect(18, 27, 8, 10);
    context.fillRect(28, 24, 8, 13);
    context.fillRect(38, 27, 8, 10);
    context.fillRect(18, 49, 28, 7);
    context.fillRect(27, 54, 10, 10);
    context.fillStyle = "#245bb7";
    context.fillRect(27, 43, 10, 12);

    const texture = new this.#pc.Texture(this.#app.graphicsDevice, {
      name: "Castle banner cloth",
      width: BANNER_TEXTURE_WIDTH,
      height: BANNER_TEXTURE_HEIGHT,
      addressU: this.#pc.ADDRESS_CLAMP_TO_EDGE,
      addressV: this.#pc.ADDRESS_CLAMP_TO_EDGE,
      minFilter: this.#pc.FILTER_LINEAR_MIPMAP_LINEAR,
      magFilter: this.#pc.FILTER_LINEAR,
      anisotropy: 4,
      mipmaps: true,
    });
    texture.setSource(canvas);
    return texture;
  }

  #createMaterial() {
    const material = new this.#pc.StandardMaterial();
    material.name = "Castle banner material";
    material.diffuse = new this.#pc.Color(1, 1, 1);
    material.diffuseMap = this.#texture;
    material.cull = this.#pc.CULLFACE_NONE;
    material.gloss = 0.02;
    material.metalness = 0;
    material.useMetalness = true;
    material.update();
    return material;
  }

  #createRailMaterial() {
    const material = new this.#pc.StandardMaterial();
    material.name = "Castle banner rail";
    material.diffuse = new this.#pc.Color(0.78, 0.58, 0.18);
    material.gloss = 0.16;
    material.update();
    return material;
  }

  /**
   *
   * @param {number} width
   * @param {number} height
   */
  #createMesh(width, height) {
    const authored = this.#modelLibrary.instantiate(clothModelUrl);
    const sourceMesh = authored.findComponents("render")[0].meshInstances[0].mesh;
    const positions = [];
    const textureUvs = [];
    const indices = [];
    sourceMesh.getPositions(positions);
    sourceMesh.getUvs(0, textureUvs);
    sourceMesh.getIndices(indices);
    const vertexUv = [];
    const pinnedIndices = [];
    for (let index = 0; index < positions.length; index += 3) {
      const u = positions[index] * 2;
      const v = -positions[index + 1];
      positions[index] *= width;
      positions[index + 1] *= height;
      vertexUv.push(u, v);
      if (v < 0.001) { pinnedIndices.push(index / 3); }
    }
    authored.destroy();
    const animatedPositions = Float32Array.from(positions);
    const meshIndices = Uint16Array.from(indices);
    const mesh = new this.#pc.Mesh(this.#app.graphicsDevice);
    mesh.clear(true, false, animatedPositions.length / 3, meshIndices.length);
    mesh.setPositions(animatedPositions);
    mesh.setNormals(this.#pc.calculateNormals(animatedPositions, meshIndices));
    mesh.setUvs(0, textureUvs);
    mesh.setIndices(meshIndices);
    mesh.update();
    mesh.incRefCount();

    return {
      mesh,
      pinnedIndices,
      positions: animatedPositions,
      vertexUv: Float32Array.from(vertexUv),
      indices: meshIndices,
    };
  }

  /**
   *
   * @param {{root: import("playcanvas").Entity, width: number, height: number}} banner
   * @param {number} rayStart
   * @param {number} rayEnd
   * @param {boolean} bounded
   */
  #intersectBannerRay(banner, rayStart, rayEnd, bounded) {
    if (!banner?.root) {
      return null;
    }
    const inverse = banner.root.getWorldTransform().clone().invert();
    const localStart = inverse.transformPoint(rayStart, new this.#pc.Vec3());
    const localEnd = inverse.transformPoint(rayEnd, new this.#pc.Vec3());
    const directionZ = localEnd.z - localStart.z;
    if (Math.abs(directionZ) < 0.000001) {
      return null;
    }

    const distance = -localStart.z / directionZ;
    if (distance < 0 || distance > 1) {
      return null;
    }
    const localX = localStart.x + (localEnd.x - localStart.x) * distance;
    const localY = localStart.y + (localEnd.y - localStart.y) * distance;
    if (
      bounded &&
      (localY > 0.05 ||
        localY < -banner.height - 0.08 ||
        Math.abs(localX) > banner.width / 2 + 0.05)
    ) {
      return null;
    }

    return {
      distance,
      point: new this.#pc.Vec3(localX, localY, 0),
      banner,
    };
  }

  /**
   *
   * @param {number} deltaTime
   */
  #animate(deltaTime) {
    this.#physics.step(deltaTime);
    for (const banner of this.#banners) {
      this.#physics.writePositions(banner.cloth, banner.positions);
      banner.mesh.setPositions(banner.positions);
      banner.mesh.setNormals(
        this.#pc.calculateNormals(banner.positions, banner.indices),
      );
      banner.mesh.update(this.#pc.PRIMITIVE_TRIANGLES, false);
    }
  }
}
