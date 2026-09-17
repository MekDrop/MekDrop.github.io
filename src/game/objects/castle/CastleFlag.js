import { AmmoClothPhysics } from "../shared/AmmoClothPhysics.js";

const FLAG_COLUMNS = 6;
const FLAG_ROWS = 5;
const FLAG_TRAILING_EDGE_HEIGHT_RATIO = 0.2;
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
  #activeFlag = null;
  #physics;
  #updateHandle = null;

  constructor({ pc, app }) {
    this.#pc = pc;
    this.#app = app;
    this.#entity = new pc.Entity("Castle flags");
    this.#texture = this.#createTexture();
    this.#flagMaterial = this.#createFlagMaterial();
    this.#poleMaterial = this.#createPoleMaterial();
    this.#physics = new AmmoClothPhysics({ pc });
    this.#updateHandle = app.on("update", (deltaTime) => {
      this.#animate(deltaTime);
    });
  }

  get entity() {
    return this.#entity;
  }

  add({
    x,
    y,
    z,
    yaw = 0,
    width = 1.25,
    height = 0.625,
    poleHeight = 1.25,
    roofCollider = null,
  }) {
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
    pole.setLocalScale(0.035, poleHeight, 0.035);
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
    meshInstance.castShadow = true;
    meshInstance.receiveShadow = true;
    meshInstance.pick = false;
    meshInstance.devWireframeInspectable = true;
    const cloth = new this.#pc.Entity("Tapered castle flag");
    cloth.addComponent("render", {
      meshInstances: [meshInstance],
      castShadows: true,
      receiveShadows: true,
    });
    root.addChild(cloth);

    const seed = Math.abs(Math.sin(x * 0.31 + z * 0.47 + y * 0.19));
    const flag = {
      ...geometry,
      root,
      width,
      height,
      poleHeight,
    };
    flag.cloth = this.#physics.createCloth({
      positions: flag.positions,
      indices: flag.indices,
      pinnedIndices: Array.from({ length: FLAG_ROWS + 1 }, (_, index) => index),
      vertexUv: flag.vertexUv,
      root,
      normalAxis: 2,
      seed,
      roofCollider,
      bendingStiffness: 0.18,
      selfCollision: true,
    });
    this.#flags.push(flag);
  }

  getFlagHit(rayStart, rayEnd) {
    let closest = null;
    for (const flag of this.#flags) {
      const hit = this.#intersectFlagRay(flag, rayStart, rayEnd);
      if (!hit || (closest && hit.distance >= closest.distance)) continue;
      closest = hit;
    }
    return closest;
  }

  beginWindGesture(hit) {
    if (!hit?.flag) {
      return;
    }
    this.#activeFlag = hit.flag;
    this.#physics.beginPointer(this.#activeFlag.cloth, hit.point);
  }

  applyMouseWind(rayStart, rayEnd, deltaTime) {
    if (!this.#activeFlag) {
      return;
    }
    const hit = this.#intersectFlagRay(this.#activeFlag, rayStart, rayEnd);
    if (!hit) {
      return;
    }
    this.#physics.applyPointer(this.#activeFlag.cloth, hit.point, deltaTime);
  }

  endWindGesture() {
    this.#physics.endPointer(this.#activeFlag?.cloth);
    this.#activeFlag = null;
  }

  destroy() {
    this.#updateHandle?.off();
    this.#updateHandle = null;
    this.endWindGesture();
    this.#physics?.destroy();
    this.#physics = null;
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
      name: "Tapered castle flag",
      width: FLAG_TEXTURE_WIDTH,
      height: FLAG_TEXTURE_HEIGHT,
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

  #createFlagMaterial() {
    const material = new this.#pc.StandardMaterial();
    material.name = "Castle flag cloth";
    material.diffuse = new this.#pc.Color(1, 1, 1);
    material.diffuseMap = this.#texture;
    material.cull = this.#pc.CULLFACE_NONE;
    material.twoSidedLighting = true;
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
      const freedom = column / (FLAG_COLUMNS - 1);
      const halfHeight =
        (height / 2) *
        (1 - freedom * (1 - FLAG_TRAILING_EDGE_HEIGHT_RATIO));
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

  #intersectFlagRay(flag, rayStart, rayEnd) {
    if (!flag?.root) {
      return null;
    }
    const inverse = flag.root.getWorldTransform().clone().invert();
    const localStart = inverse.transformPoint(rayStart, new this.#pc.Vec3());
    const localEnd = inverse.transformPoint(rayEnd, new this.#pc.Vec3());
    const direction = [
      localEnd.x - localStart.x,
      localEnd.y - localStart.y,
      localEnd.z - localStart.z,
    ];
    let closest = null;
    for (let index = 0; index < flag.indices.length; index += 3) {
      const hit = this.#intersectTriangle(
        localStart,
        direction,
        flag.positions,
        flag.indices[index],
        flag.indices[index + 1],
        flag.indices[index + 2],
      );
      if (!hit || (closest && hit.distance >= closest.distance)) {
        continue;
      }
      closest = hit;
    }
    if (!closest) {
      return null;
    }
    return {
      distance: closest.distance,
      point: new this.#pc.Vec3(...closest.point),
      flag,
    };
  }

  #intersectTriangle(origin, direction, positions, first, second, third) {
    const firstOffset = first * 3;
    const secondOffset = second * 3;
    const thirdOffset = third * 3;
    const edgeOne = [
      positions[secondOffset] - positions[firstOffset],
      positions[secondOffset + 1] - positions[firstOffset + 1],
      positions[secondOffset + 2] - positions[firstOffset + 2],
    ];
    const edgeTwo = [
      positions[thirdOffset] - positions[firstOffset],
      positions[thirdOffset + 1] - positions[firstOffset + 1],
      positions[thirdOffset + 2] - positions[firstOffset + 2],
    ];
    const cross = [
      direction[1] * edgeTwo[2] - direction[2] * edgeTwo[1],
      direction[2] * edgeTwo[0] - direction[0] * edgeTwo[2],
      direction[0] * edgeTwo[1] - direction[1] * edgeTwo[0],
    ];
    const determinant =
      edgeOne[0] * cross[0] +
      edgeOne[1] * cross[1] +
      edgeOne[2] * cross[2];
    if (Math.abs(determinant) < 0.000001) {
      return null;
    }

    const inverseDeterminant = 1 / determinant;
    const fromFirst = [
      origin.x - positions[firstOffset],
      origin.y - positions[firstOffset + 1],
      origin.z - positions[firstOffset + 2],
    ];
    const firstWeight =
      (fromFirst[0] * cross[0] +
        fromFirst[1] * cross[1] +
        fromFirst[2] * cross[2]) *
      inverseDeterminant;
    if (firstWeight < 0 || firstWeight > 1) {
      return null;
    }

    const perpendicular = [
      fromFirst[1] * edgeOne[2] - fromFirst[2] * edgeOne[1],
      fromFirst[2] * edgeOne[0] - fromFirst[0] * edgeOne[2],
      fromFirst[0] * edgeOne[1] - fromFirst[1] * edgeOne[0],
    ];
    const secondWeight =
      (direction[0] * perpendicular[0] +
        direction[1] * perpendicular[1] +
        direction[2] * perpendicular[2]) *
      inverseDeterminant;
    if (secondWeight < 0 || firstWeight + secondWeight > 1) {
      return null;
    }

    const distance =
      (edgeTwo[0] * perpendicular[0] +
        edgeTwo[1] * perpendicular[1] +
        edgeTwo[2] * perpendicular[2]) *
      inverseDeterminant;
    if (distance < 0 || distance > 1) {
      return null;
    }
    return {
      distance,
      point: [
        origin.x + direction[0] * distance,
        origin.y + direction[1] * distance,
        origin.z + direction[2] * distance,
      ],
    };
  }

  #animate(deltaTime) {
    this.#physics.step(deltaTime);
    for (const flag of this.#flags) {
      this.#physics.writePositions(flag.cloth, flag.positions);
      flag.mesh.setPositions(flag.positions);
      flag.mesh.setNormals(
        this.#pc.calculateNormals(flag.positions, flag.indices),
      );
      // Rebuild the animated mesh bounds so shadow-map culling follows the
      // deformed cloth instead of the flag's original flat silhouette.
      flag.mesh.update(this.#pc.PRIMITIVE_TRIANGLES, true);
    }
  }
}
