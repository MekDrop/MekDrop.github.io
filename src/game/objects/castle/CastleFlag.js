import { BannerWind } from "../shared/BannerWind.js";

const FLAG_COLUMNS = 6;
const FLAG_ROWS = 5;
const FLAG_TEXTURE_WIDTH = 64;
const FLAG_TEXTURE_HEIGHT = 40;

export class CastleFlag {
  #pc;
  #app;
  #entity;
  #flagMaterial;
  #poleMaterial;
  #texture;
  #flags = [];
  #updateHandle = null;

  constructor({ pc, app }) {
    this.#pc = pc;
    this.#app = app;
    this.#entity = new pc.Entity("Castle flags");
    this.#texture = this.#createTexture();
    this.#flagMaterial = this.#createFlagMaterial();
    this.#poleMaterial = this.#createPoleMaterial();
    this.#updateHandle = app.on("update", (deltaTime) => {
      this.#animate(deltaTime);
    });
  }

  get entity() {
    return this.#entity;
  }

  add({ x, y, z, yaw = 0, width = 1.25, height = 0.625, poleHeight = 1.25 }) {
    const root = new this.#pc.Entity("Castle roof flag");
    root.setPosition(x, y, z);
    root.setEulerAngles(0, yaw, 0);
    this.#entity.addChild(root);

    const pole = new this.#pc.Entity("Castle flag pole");
    pole.addComponent("render", {
      type: "cylinder",
      castShadows: true,
      receiveShadows: true,
    });
    for (const instance of pole.render.meshInstances) {
      instance.material = this.#poleMaterial;
    }
    pole.setLocalPosition(0, poleHeight / 2, 0);
    pole.setLocalScale(0.035, poleHeight / 2, 0.035);
    root.addChild(pole);

    const finial = new this.#pc.Entity("Castle flag finial");
    finial.addComponent("render", {
      type: "sphere",
      castShadows: true,
      receiveShadows: true,
    });
    for (const instance of finial.render.meshInstances) {
      instance.material = this.#poleMaterial;
    }
    finial.setLocalPosition(0, poleHeight + 0.035, 0);
    finial.setLocalScale(0.11, 0.11, 0.11);
    root.addChild(finial);

    const geometry = this.#createMesh(width, height, poleHeight);
    const meshInstance = new this.#pc.MeshInstance(
      geometry.mesh,
      this.#flagMaterial,
    );
    meshInstance.castShadow = false;
    meshInstance.receiveShadow = true;
    meshInstance.pick = false;
    const cloth = new this.#pc.Entity("Triangular castle flag");
    cloth.addComponent("render", {
      meshInstances: [meshInstance],
      castShadows: false,
      receiveShadows: true,
    });
    root.addChild(cloth);

    const seed = Math.abs(Math.sin(x * 0.31 + z * 0.47 + y * 0.19));
    this.#flags.push({
      ...geometry,
      wind: new BannerWind(seed),
    });
  }

  destroy() {
    this.#updateHandle?.off();
    this.#updateHandle = null;
    this.#entity?.destroy();
    this.#entity = null;
    for (const { mesh } of this.#flags) {
      mesh.decRefCount();
      if (mesh.refCount < 1) mesh.destroy();
    }
    this.#flags = [];
    this.#flagMaterial?.destroy();
    this.#flagMaterial = null;
    this.#poleMaterial?.destroy();
    this.#poleMaterial = null;
    this.#texture?.destroy();
    this.#texture = null;
  }

  #createTexture() {
    const canvas = document.createElement("canvas");
    canvas.width = FLAG_TEXTURE_WIDTH;
    canvas.height = FLAG_TEXTURE_HEIGHT;
    const context = canvas.getContext("2d");
    context.imageSmoothingEnabled = false;
    context.fillStyle = "#153c84";
    context.fillRect(0, 0, FLAG_TEXTURE_WIDTH, FLAG_TEXTURE_HEIGHT);
    context.fillStyle = "#245bb7";
    context.fillRect(4, 3, FLAG_TEXTURE_WIDTH - 8, FLAG_TEXTURE_HEIGHT - 6);
    context.fillStyle = "#3470d2";
    context.fillRect(8, 3, 5, FLAG_TEXTURE_HEIGHT - 6);
    context.fillStyle = "#0f2c66";
    context.fillRect(49, 3, 7, FLAG_TEXTURE_HEIGHT - 6);

    context.fillStyle = "#f1dfad";
    context.fillRect(23, 13, 15, 13);
    context.fillRect(20, 10, 6, 7);
    context.fillRect(28, 8, 6, 9);
    context.fillRect(36, 10, 6, 7);
    context.fillStyle = "#245bb7";
    context.fillRect(28, 18, 6, 8);

    const texture = new this.#pc.Texture(this.#app.graphicsDevice, {
      name: "Triangular castle flag",
      width: FLAG_TEXTURE_WIDTH,
      height: FLAG_TEXTURE_HEIGHT,
      addressU: this.#pc.ADDRESS_CLAMP_TO_EDGE,
      addressV: this.#pc.ADDRESS_CLAMP_TO_EDGE,
      minFilter: this.#pc.FILTER_NEAREST,
      magFilter: this.#pc.FILTER_NEAREST,
      mipmaps: false,
    });
    texture.setSource(canvas);
    return texture;
  }

  #createFlagMaterial() {
    const material = new this.#pc.StandardMaterial();
    material.name = "Castle flag cloth";
    material.diffuse = new this.#pc.Color(1, 1, 1);
    material.diffuseMap = this.#texture;
    material.cull = this.#pc.CULLFACE_NONE;
    material.gloss = 0.02;
    material.update();
    return material;
  }

  #createPoleMaterial() {
    const material = new this.#pc.StandardMaterial();
    material.name = "Castle flag pole";
    material.diffuse = new this.#pc.Color(0.76, 0.55, 0.16);
    material.gloss = 0.18;
    material.update();
    return material;
  }

  #createMesh(width, height, poleHeight) {
    const positions = [];
    const textureUvs = [];
    const vertexUv = [];
    const indices = [];
    const centerY = poleHeight - height / 2 - 0.12;

    for (let column = 0; column < FLAG_COLUMNS; column += 1) {
      const freedom = column / FLAG_COLUMNS;
      const halfHeight = (height / 2) * (1 - freedom);
      for (let row = 0; row <= FLAG_ROWS; row += 1) {
        const rowRatio = row / FLAG_ROWS;
        const vertical = 1 - rowRatio * 2;
        positions.push(width * freedom, centerY + vertical * halfHeight, 0);
        textureUvs.push(freedom, rowRatio);
        vertexUv.push(vertical, freedom);
      }
    }

    const rowLength = FLAG_ROWS + 1;
    for (let column = 0; column < FLAG_COLUMNS - 1; column += 1) {
      for (let row = 0; row < FLAG_ROWS; row += 1) {
        const topLeft = column * rowLength + row;
        const bottomLeft = topLeft + 1;
        const topRight = topLeft + rowLength;
        const bottomRight = topRight + 1;
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

    const tipIndex = positions.length / 3;
    positions.push(width, centerY, 0);
    textureUvs.push(1, 0.5);
    vertexUv.push(0, 1);
    const finalColumn = (FLAG_COLUMNS - 1) * rowLength;
    for (let row = 0; row < FLAG_ROWS; row += 1) {
      indices.push(finalColumn + row, finalColumn + row + 1, tipIndex);
    }

    const basePositions = Float32Array.from(positions);
    const animatedPositions = new Float32Array(basePositions);
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
      basePositions,
      positions: animatedPositions,
      vertexUv: Float32Array.from(vertexUv),
      indices: meshIndices,
    };
  }

  #animate(deltaTime) {
    for (const flag of this.#flags) {
      flag.wind.advance(deltaTime);
      flag.wind.deform({
        basePositions: flag.basePositions,
        positions: flag.positions,
        vertexUv: flag.vertexUv,
        normalAxis: 2,
        verticalAxis: 1,
        horizontalAxis: 0,
      });
      flag.mesh.setPositions(flag.positions);
      flag.mesh.setNormals(
        this.#pc.calculateNormals(flag.positions, flag.indices),
      );
      flag.mesh.update(this.#pc.PRIMITIVE_TRIANGLES, false);
    }
  }
}
