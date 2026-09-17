import { AmmoClothPhysics } from "../shared/AmmoClothPhysics.js";

const BANNER_TEXTURE_WIDTH = 64;
const BANNER_TEXTURE_HEIGHT = 96;
const BANNER_COLUMNS = 8;
const BANNER_ROWS = 8;
const BANNER_POINT_START = 0.8;

export class CastleBanner {
  #pc;
  #app;
  #entity;
  #material;
  #railMaterial;
  #texture;
  #banners = [];
  #activeBanner = null;
  #physics;
  #updateHandle = null;

  constructor({ pc, app }) {
    this.#pc = pc;
    this.#app = app;
    this.#entity = new pc.Entity("Castle banners");
    this.#texture = this.#createTexture();
    this.#material = this.#createMaterial();
    this.#railMaterial = this.#createRailMaterial();
    this.#physics = new AmmoClothPhysics({ pc });
    this.#updateHandle = app.on("update", (deltaTime) => {
      this.#animate(deltaTime);
    });
  }

  get entity() {
    return this.#entity;
  }

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

    const rail = new this.#pc.Entity("Castle banner rail");
    rail.addComponent("render", {
      type: "cylinder",
      castShadows: true,
      receiveShadows: true,
    });
    for (const instance of rail.render.meshInstances) {
      instance.material = this.#railMaterial;
      instance.castShadow = true;
      instance.receiveShadow = true;
    }
    rail.setLocalPosition(0, 0.035, 0.012);
    rail.setLocalEulerAngles(0, 0, 90);
    rail.setLocalScale(0.055, (width + 0.18) / 2, 0.055);
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
      pinnedIndices: Array.from(
        { length: BANNER_COLUMNS + 1 },
        (_, index) => index,
      ),
      vertexUv: banner.vertexUv,
      root,
      normalAxis: 2,
      seed,
      wallPlane: 0,
    });
    this.#banners.push(banner);
    return true;
  }

  getBannerHit(rayStart, rayEnd) {
    let closest = null;
    for (const banner of this.#banners) {
      const hit = this.#intersectBannerRay(banner, rayStart, rayEnd, true);
      if (!hit || (closest && hit.distance >= closest.distance)) continue;
      closest = hit;
    }
    return closest;
  }

  beginWindGesture(hit) {
    if (!hit?.banner) {
      return;
    }
    this.#activeBanner = hit.banner;
    this.#physics.beginPointer(this.#activeBanner.cloth, hit.point);
  }

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

  #createMesh(width, height) {
    const positions = [];
    const textureUvs = [];
    const vertexUv = [];
    const indices = [];

    for (let row = 0; row <= BANNER_ROWS; row += 1) {
      const v = row / BANNER_ROWS;
      for (let column = 0; column <= BANNER_COLUMNS; column += 1) {
        const textureU = column / BANNER_COLUMNS;
        const u = textureU * 2 - 1;
        const foldedDepth =
          Math.cos(u * Math.PI * 3) * (0.009 + Math.sin(v * Math.PI) * 0.011);
        positions.push(
          u * (width / 2),
          -v * BANNER_POINT_START * height,
          foldedDepth,
        );
        textureUvs.push(textureU, 1 - v * BANNER_POINT_START);
        vertexUv.push(u, v * BANNER_POINT_START);
      }
    }

    const rowLength = BANNER_COLUMNS + 1;
    for (let row = 0; row < BANNER_ROWS; row += 1) {
      for (let column = 0; column < BANNER_COLUMNS; column += 1) {
        const topLeft = row * rowLength + column;
        const topRight = topLeft + 1;
        const bottomLeft = topLeft + rowLength;
        const bottomRight = bottomLeft + 1;
        indices.push(
          topLeft,
          bottomRight,
          topRight,
          topLeft,
          bottomLeft,
          bottomRight,
        );
      }
    }

    const pointIndex = positions.length / 3;
    positions.push(0, -height, 0);
    textureUvs.push(0.5, 0);
    vertexUv.push(0, 1);
    const bottomRowStart = BANNER_ROWS * rowLength;
    for (let column = 0; column < BANNER_COLUMNS; column += 1) {
      indices.push(
        bottomRowStart + column,
        pointIndex,
        bottomRowStart + column + 1,
      );
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
      positions: animatedPositions,
      vertexUv: Float32Array.from(vertexUv),
      indices: meshIndices,
    };
  }

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
