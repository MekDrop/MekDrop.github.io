import { HeraldryTexture } from "../../../textures/heraldry/HeraldryTexture.js";
import { ClothWindExposure } from "../../shared/ClothWindExposure.js";
import vestibuleModelUrl from "../../../models/castle/props/vestibule-banner.glb?url";
import clothModelUrl from "../../../models/castle/residential/banner-cloth.glb?url";
import authoredModelUrl from "../../../models/castle/residential/metal-pole.glb?url";
import { AmmoClothPhysics } from "../../shared/AmmoClothPhysics.js";


/**
 * @typedef {{root: import("playcanvas").Entity, width: number, height: number, cloth: ReturnType<AmmoClothPhysics["createCloth"]>, mesh: import("playcanvas").Mesh, positions: Float32Array, vertexUv: Float32Array, indices: Uint16Array}} BannerClothInstance
 */

export class BannerCloth {
  /**
   * @returns {string[]}
   */
  static get modelUrls() {
    return [authoredModelUrl, clothModelUrl, vestibuleModelUrl];
  }
  /**
   * @type {import("../../../models/GameModelLibrary.js").GameModelLibrary}
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
   * @type {HeraldryTexture|null}
   */
  #artwork;
  /**
   *
   * @type {Array<BannerClothInstance>}
   */
  #banners = [];
  /**
   *
   * @type {BannerClothInstance|null}
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
   * @param {import("../../../models/GameModelLibrary.js").GameModelLibrary} options.modelLibrary
   * @param {import("playcanvas").Application} options.app
   */
  constructor({ pc, app, modelLibrary }) {
    this.#modelLibrary = modelLibrary;
    this.#pc = pc;
    this.#app = app;
    this.#entity = new pc.Entity("Castle banners");
    this.#artwork = HeraldryTexture.banner(pc, app.graphicsDevice);
    this.#texture = this.#artwork.texture;
    this.#material = this.#createMaterial();
    this.#railMaterial = this.#createRailMaterial();
    this.#physics = new AmmoClothPhysics({ pc });
    this.#updateHandle = app.on("update", this.#on.bind(this));
  }

  get entity() {
    return this.#entity;
  }

  /**
   *
   * @param {{x: number, y: number, z: number, yaw: number, width: number, height: number, variant?: string}} options
   * @param {number} options.x
   * @param {number} options.y
   * @param {number} options.z
   * @param {number} options.yaw
   * @param {number} options.width
   * @param {string} [options.variant]
   * @param {number} options.height
   */
  add({ x, y, z, yaw = 0, width, height, variant }) {
    const vestibule = variant !== "cloth";
    width ??= vestibule ? 0.8 : 1;
    height ??= vestibule ? 0.95 : 1.5;
    const authored = vestibule ? this.#modelLibrary.instantiate(vestibuleModelUrl) : null;
    let fabricMaterial = this.#material;
    if (authored) {
      for (const render of authored.findComponents("render")) {
        fabricMaterial =
          render.meshInstances.find(BannerCloth.#findInstance)?.material ??
          fabricMaterial;
        for (const instance of render.meshInstances) {
          if (instance.material.name === "Textured navy and gold woven cloth") {
            instance.visible = false;
            instance.castShadow = false;
            instance.pick = false;
          }
        }
      }
    }
    const root = new this.#pc.Entity("Hanging castle banner");
    root.setPosition(x, y, z);
    root.setEulerAngles(0, yaw, 0);
    this.#entity.addChild(root);

    const geometry = this.#createMesh(width, height, vestibule);
    const meshInstance = new this.#pc.MeshInstance(
      geometry.mesh,
      fabricMaterial,
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
    if (vestibule) {
      cloth.setLocalPosition(0, -0.035, 0.04);
    }
    root.addChild(cloth);

    const rail = authored ?? this.#modelLibrary.instantiate(authoredModelUrl);
    rail.name = "Castle banner rail";
    if (vestibule) {
      rail.setLocalScale(width / 0.8, height / 0.95, 1);
    } else {
      for (const instance of rail.findComponents("render").flatMap(BannerCloth.#flatMapRender)) {
        instance.material = this.#railMaterial;
        instance.castShadow = true;
        instance.receiveShadow = true;
      }
      rail.setLocalPosition(0, 0.035, 0.012);
      rail.setLocalEulerAngles(0, 0, 90);
      rail.setLocalScale(0.055, width + 0.18, 0.055);
    }
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
      windExposure: new ClothWindExposure({
        pc: this.#pc,
        app: this.#app,
        root,
        width,
        height,
      }).sample,
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
      if (!hit || (closest && hit.distance >= closest.distance)) {
        continue;
      }
      closest = hit;
    }

    return closest;
  }

  /**
   *
   * @param {{banner: BannerClothInstance, point: import("playcanvas").Vec3}} hit
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
      if (mesh.refCount < 1) {
        mesh.destroy();
      }
    }
    this.#banners = [];
    this.#material?.destroy();
    this.#material = null;
    this.#railMaterial?.destroy();
    this.#railMaterial = null;
    this.#artwork?.destroy();
    this.#artwork = null;
    this.#texture = null;
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
   * @param {boolean} [rectangular]
   */
  #createMesh(width, height, rectangular = false) {
    const positions = [];
    const textureUvs = [];
    const indices = [];
    if (rectangular) {
      // Preserve the complete rectangular embroidered border of indoor artwork.
      const columns = 8, rows = 12;
      for (let row = 0; row <= rows; row++) {
        for (let column = 0; column <= columns; column++) {
          const u = column / columns, v = row / rows;
          positions.push(u - 0.5, -v, 0);
          textureUvs.push(u, v);
          if (row < rows && column < columns) {
            const first = row * (columns + 1) + column;
            indices.push(first, first + columns + 1, first + 1,
              first + 1, first + columns + 1, first + columns + 2);
          }
        }
      }
    } else {
      const authored = this.#modelLibrary.instantiate(clothModelUrl);
      const sourceMesh = authored.findComponents("render")[0].meshInstances[0].mesh;
      sourceMesh.getPositions(positions);
      sourceMesh.getUvs(0, textureUvs);
      sourceMesh.getIndices(indices);
      authored.destroy();
    }
    const vertexUv = [];
    const pinnedIndices = [];
    for (let index = 0; index < positions.length; index += 3) {
      const u = positions[index] * 2;
      const v = -positions[index + 1];
      positions[index] *= width;
      positions[index + 1] *= height;
      vertexUv.push(u, v);
      if (v < 0.001) {
        pinnedIndices.push(index / 3);
      }
    }
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
      banner.mesh.update(this.#pc.PRIMITIVE_TRIANGLES);
    }
  }

  /**
   *
   * @param {number} deltaTime
   */
  #on(deltaTime) {
    this.#animate(deltaTime);
  }

  /**
   * @param {import("playcanvas").MeshInstance} instance
   */
  static #findInstance(instance) {
    return instance.material.name === "Textured navy and gold woven cloth";
  }

  /**
   * @param {import("playcanvas").RenderComponent} render
   */
  static #flatMapRender(render) {
    return render.meshInstances;
  }
}
