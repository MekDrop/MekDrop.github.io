import { TileType } from "../../MapGenerator.js";
import { UnknownArrowMeshError } from "../../errors/path/index.js";
import { colorFromHex } from "../../helpers/colors.js";
import { isArray } from "../../helpers/types.js";

const ARROW_POINTS = [
  [-0.1, -0.32],
  [0.1, -0.32],
  [0.1, 0.04],
  [-0.1, 0.04],
  [-0.34, -0.01],
  [0.34, -0.01],
  [0, 0.43],
];
const ARROW_TRIANGLES = [
  [0, 2, 1],
  [0, 3, 2],
  [4, 6, 5],
];
const ARROW_MIN_Z = -0.32;
const ARROW_MAX_Z = 0.43;
const ARROW_MERGE_DISTANCE = 0.76;
const ARROW_COLOR_SCROLL_SPEED = 0.42;
const ARROW_GLOW_PULSE_SPEED = 4.2;

export class PathArrows {
  #pc;
  #app;
  #colors;
  #entity = null;
  #visible = false;
  #materials = new Map();
  #animatedPalettes = new Map();
  #generatedTextures = [];
  #vertexBuffers = [];
  #arrowMesh;
  #auraMesh;
  #auraTexture;
  #sliceMeshes = new Map();
  #animationTime = 0;
  #updateHandle = null;
  #mapData = null;

  constructor({ pc, app, colors }) {
    this.#pc = pc;
    this.#app = app;
    this.#colors = [...colors];
    this.#arrowMesh = this.#createArrowSliceMesh(0, 1);
    this.#auraMesh = this.#createAuraMesh();
    this.#auraTexture = this.#createAuraTexture();
    this.#createMaterials();
    this.#updateHandle = app.on("update", (deltaTime) => {
      this.#updateAnimation(deltaTime);
    });
  }

  get entity() {
    return this.#entity;
  }

  get visible() {
    return this.#visible;
  }

  set visible(visible) {
    this.#visible = visible;
    if (this.#entity) this.#entity.enabled = visible;
  }

  setColor(index, color) {
    const paletteIndex = index % this.#colors.length;
    this.#colors[paletteIndex] = color;
    this.#setMaterialColor(paletteIndex, color);
    this.#refreshAnimatedTextures();
  }

  setColors(colors) {
    if (!isArray(colors) || colors.length === 0) {
      return;
    }
    this.#colors = [...colors];
    for (let index = 0; index < colors.length; index += 1) {
      const color = colors[index % colors.length];
      this.#setMaterialColor(index, color);
    }
    this.#refreshAnimatedTextures();
  }

  render(mapData) {
    this.clear();
    this.#mapData = mapData;
    this.#entity = new this.#pc.Entity("Path arrows");
    this.#entity.enabled = this.#visible;
    const batches = new Map();
    this.#buildMatrices(batches);
    this.#createInstancedBatches(batches);
    return this.#entity;
  }

  clear() {
    this.#entity?.destroy();
    this.#entity = null;
    this.#mapData = null;
    for (const buffer of this.#vertexBuffers) buffer.destroy();
    this.#vertexBuffers = [];
  }

  destroy() {
    this.clear();
    this.#updateHandle?.off();
    this.#updateHandle = null;
    for (const material of this.#materials.values()) material.destroy();
    this.#materials.clear();
    for (const texture of this.#generatedTextures) texture.destroy();
    this.#generatedTextures = [];
    this.#auraTexture?.destroy();
    this.#auraTexture = null;
    this.#destroyMesh(this.#arrowMesh);
    this.#arrowMesh = null;
    this.#destroyMesh(this.#auraMesh);
    this.#auraMesh = null;
    for (const mesh of this.#sliceMeshes.values()) this.#destroyMesh(mesh);
    this.#sliceMeshes.clear();
    this.#animatedPalettes.clear();
  }

  #createMaterials() {
    this.#colors.forEach((color, index) => {
      this.#materials.set(
        `arrow-${index}`,
        this.#createCoreMaterial(`arrow-${index}`, color),
      );
      this.#materials.set(
        `arrow-aura-${index}`,
        this.#createAuraMaterial(`arrow-aura-${index}`, color),
      );
    });
  }

  #createCoreMaterial(name, color) {
    return this.#createMaterial(name, {
      color,
      emissive: color,
      emissiveIntensity: 1.45,
      gloss: 0.08,
    });
  }

  #createAuraMaterial(name, color) {
    const material = this.#createMaterial(name, {
      color,
      emissive: color,
      emissiveIntensity: 1.2,
      gloss: 0,
    });
    material.diffuseMap = this.#auraTexture;
    material.emissiveMap = this.#auraTexture;
    material.opacityMap = this.#auraTexture;
    material.opacityMapChannel = "a";
    material.opacity = 0.12;
    material.blendType = this.#pc.BLEND_ADDITIVE;
    material.depthWrite = false;
    material.cull = this.#pc.CULLFACE_NONE;
    material.update();
    return material;
  }

  #createMaterial(name, definition) {
    const material = new this.#pc.StandardMaterial();
    material.name = name;
    material.diffuse = colorFromHex(this.#pc, definition.color);
    material.emissive = colorFromHex(this.#pc, definition.emissive);
    material.emissiveIntensity = definition.emissiveIntensity;
    material.gloss = definition.gloss;
    material.metalness = 0;
    material.useMetalness = true;
    material.useLighting = false;
    material.update();
    return material;
  }

  #setMaterialColor(index, color) {
    for (const name of [`arrow-${index}`, `arrow-aura-${index}`]) {
      const material = this.#materials.get(name);
      if (!material) continue;
      this.#applyMaterialColor(material, colorFromHex(this.#pc, color));
    }
  }

  #applyMaterialColor(material, color) {
    material.diffuse = color.clone();
    material.emissive = color.clone();
    material.update();
  }

  #getAnimatedMaterials(colorIndexes) {
    const key = colorIndexes.join("-");
    const existing = this.#animatedPalettes.get(key);
    if (existing) {
      return existing;
    }

    const color = this.#averageColor(colorIndexes);
    const coreName = `arrow-scroll-${key}`;
    const auraName = `arrow-scroll-aura-${key}`;
    const canvas = document.createElement("canvas");
    canvas.width = 16;
    canvas.height = 128;
    const texture = new this.#pc.Texture(this.#app.graphicsDevice, {
      name: `Arrow colors ${key}`,
      width: canvas.width,
      height: canvas.height,
      minFilter: this.#pc.FILTER_LINEAR_MIPMAP_LINEAR,
      magFilter: this.#pc.FILTER_LINEAR,
      addressU: this.#pc.ADDRESS_CLAMP_TO_EDGE,
      addressV: this.#pc.ADDRESS_REPEAT,
      mipmaps: true,
    });
    this.#paintScrollTexture(canvas, colorIndexes);
    texture.setSource(canvas);
    this.#generatedTextures.push(texture);

    const core = this.#createCoreMaterial(coreName, 0xffffff);
    core.diffuseMap = texture;
    core.emissiveMap = texture;
    core.diffuseMapTiling = new this.#pc.Vec2(1, 1.35);
    core.emissiveMapTiling = new this.#pc.Vec2(1, 1.35);
    core.diffuseMapOffset = new this.#pc.Vec2(0, 0);
    core.emissiveMapOffset = new this.#pc.Vec2(0, 0);
    core.update();
    const aura = this.#createAuraMaterial(auraName, color);
    this.#materials.set(coreName, core);
    this.#materials.set(auraName, aura);
    const palette = {
      colorIndexes: [...colorIndexes],
      coreName,
      auraName,
      canvas,
      texture,
    };
    this.#animatedPalettes.set(key, palette);
    return palette;
  }

  #paintScrollTexture(canvas, colorIndexes) {
    const context = canvas.getContext("2d");
    const gradient = context.createLinearGradient(0, 0, 0, canvas.height);
    const count = colorIndexes.length;
    for (let index = 0; index < count; index += 1) {
      const start = index / count;
      const end = (index + 1) / count;
      const holdEnd = start + (end - start) * 0.72;
      const color = this.#colors[colorIndexes[index]];
      const nextColor = this.#colors[colorIndexes[(index + 1) % count]];
      gradient.addColorStop(start, this.#colorToCss(color));
      gradient.addColorStop(holdEnd, this.#colorToCss(color));
      gradient.addColorStop(end, this.#colorToCss(nextColor));
    }
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.fillStyle = gradient;
    context.fillRect(0, 0, canvas.width, canvas.height);
  }

  #colorToCss(color) {
    return `#${(color >>> 0).toString(16).padStart(6, "0").slice(-6)}`;
  }

  #averageColor(colorIndexes) {
    const channels = colorIndexes.reduce(
      (sum, index) => {
        const color = this.#colors[index];
        sum.r += (color >> 16) & 0xff;
        sum.g += (color >> 8) & 0xff;
        sum.b += color & 0xff;
        return sum;
      },
      { r: 0, g: 0, b: 0 },
    );
    const count = colorIndexes.length;
    return (
      (Math.round(channels.r / count) << 16) |
      (Math.round(channels.g / count) << 8) |
      Math.round(channels.b / count)
    );
  }

  #refreshAnimatedTextures() {
    for (const palette of this.#animatedPalettes.values()) {
      this.#paintScrollTexture(palette.canvas, palette.colorIndexes);
      palette.texture.upload();
      const aura = this.#materials.get(palette.auraName);
      if (aura) {
        this.#applyMaterialColor(
          aura,
          colorFromHex(
            this.#pc,
            this.#averageColor(palette.colorIndexes),
          ),
        );
      }
    }
  }

  #updateAnimation(deltaTime) {
    this.#animationTime += deltaTime;
    const pulse =
      (Math.sin(this.#animationTime * ARROW_GLOW_PULSE_SPEED) + 1) / 2;

    for (let index = 0; index < this.#colors.length; index += 1) {
      const core = this.#materials.get(`arrow-${index}`);
      if (core) {
        core.emissiveIntensity = 1.3 + pulse * 0.45;
        core.update();
      }
    }

    for (const palette of this.#animatedPalettes.values()) {
      const core = this.#materials.get(palette.coreName);
      if (!core) continue;
      core.emissiveIntensity = 1.35 + pulse * 0.55;
      const scrollOffset = (this.#animationTime * ARROW_COLOR_SCROLL_SPEED) % 1;
      core.diffuseMapOffset.y = scrollOffset;
      core.emissiveMapOffset.y = scrollOffset;
      core.update();
    }
  }

  #buildMatrices(batches) {
    const { arrowData, cols, rows } = this.#mapData;
    if (!arrowData) {
      return;
    }

    for (const group of this.#groupNearby(arrowData)) {
      const col =
        group.reduce((sum, marker) => sum + marker.col, 0) / group.length;
      const row =
        group.reduce((sum, marker) => sum + marker.row, 0) / group.length;
      const baseX = col - (cols - 1) / 2;
      const baseZ = row - (rows - 1) / 2;
      const top = Math.max(
        ...group.map((marker) =>
          Number.isFinite(marker.elevation)
            ? marker.elevation
            : this.#height(marker.col, marker.row),
        ),
      );
      const arrows = group.flatMap((marker) => marker.arrows);
      const directions = arrows
        .map((arrow) => {
          const length = Math.hypot(arrow.dc, arrow.dr);
          return length
            ? { dx: arrow.dc / length, dz: arrow.dr / length }
            : null;
        })
        .filter(Boolean);
      if (!directions.length) continue;

      let dx = directions.reduce((sum, direction) => sum + direction.dx, 0);
      let dz = directions.reduce((sum, direction) => sum + direction.dz, 0);
      const combinedLength = Math.hypot(dx, dz);
      if (combinedLength < 0.001) {
        ({ dx, dz } = directions[0]);
      } else {
        dx /= combinedLength;
        dz /= combinedLength;
      }
      const colorIndexes = [
        ...new Set(arrows.map((arrow) => arrow.pathIdx % this.#colors.length)),
      ];
      const yaw = (Math.atan2(dx, dz) * 180) / Math.PI;
      const surfacePitch =
        arrows.reduce(
          (sum, arrow) => sum + (arrow.surfacePitch ?? 0),
          0,
        ) / arrows.length;
      const materialNames =
        colorIndexes.length === 1
          ? {
              coreName: `arrow-${colorIndexes[0]}`,
              auraName: `arrow-aura-${colorIndexes[0]}`,
            }
          : this.#getAnimatedMaterials(colorIndexes);
      this.#addMatrix(
        batches,
        materialNames.auraName,
        "aura",
        baseX,
        top + 0.018,
        baseZ,
        yaw,
        surfacePitch,
        0.86 * 1.2,
        0.9 * 1.08,
      );
      this.#addMatrix(
        batches,
        materialNames.coreName,
        "full",
        baseX,
        top + 0.034,
        baseZ,
        yaw,
        surfacePitch,
        0.86,
        0.9,
      );
    }
  }

  #groupNearby(arrowData) {
    const markers = [...arrowData.entries()].map(([key, arrows]) => {
      const [col, row, elevation] = key.split(",").map(Number);
      return { col, row, elevation, arrows };
    });
    const remaining = new Set(markers.map((_, index) => index));
    const groups = [];

    while (remaining.size) {
      const firstIndex = remaining.values().next().value;
      remaining.delete(firstIndex);
      const group = [markers[firstIndex]];
      const queue = [markers[firstIndex]];

      while (queue.length) {
        const current = queue.shift();
        for (const candidateIndex of [...remaining]) {
          const candidate = markers[candidateIndex];
          if (
            Math.hypot(
              candidate.col - current.col,
              candidate.row - current.row,
            ) > ARROW_MERGE_DISTANCE ||
            (Number.isFinite(candidate.elevation) &&
              Number.isFinite(current.elevation) &&
              Math.abs(candidate.elevation - current.elevation) > 0.1)
          ) {
            continue;
          }
          remaining.delete(candidateIndex);
          group.push(candidate);
          queue.push(candidate);
        }
      }
      groups.push(group);
    }

    return groups;
  }

  #addMatrix(
    batches,
    material,
    meshKey,
    x,
    y,
    z,
    yaw,
    surfacePitch,
    scaleX,
    scaleZ,
  ) {
    const matrix = new this.#pc.Mat4();
    const rotation = new this.#pc.Quat();
    rotation.setFromEulerAngles(-surfacePitch, yaw, 0);
    matrix.setTRS(
      new this.#pc.Vec3(x, y, z),
      rotation,
      new this.#pc.Vec3(scaleX, 1, scaleZ),
    );
    const batchKey = `${material}|${meshKey}`;
    const data = batches.get(batchKey) ?? [];
    for (const value of matrix.data) data.push(value);
    batches.set(batchKey, data);
  }

  #height(col, row) {
    const { cols, rows, grid } = this.#mapData;
    const candidateCols = [...new Set([Math.floor(col), Math.ceil(col)])];
    const candidateRows = [...new Set([Math.floor(row), Math.ceil(row)])];
    const pathHeights = [];

    for (const candidateRow of candidateRows) {
      for (const candidateCol of candidateCols) {
        if (
          candidateCol < 0 ||
          candidateCol >= cols ||
          candidateRow < 0 ||
          candidateRow >= rows
        ) {
          continue;
        }
        const type = grid[candidateRow][candidateCol];
        if (type !== TileType.PATH && type !== TileType.ENTRY) continue;
        pathHeights.push(this.#tileHeight(candidateCol, candidateRow));
      }
    }

    if (pathHeights.length) {
      return Math.max(...pathHeights);
    }
    const nearestCol = Math.max(0, Math.min(cols - 1, Math.round(col)));
    const nearestRow = Math.max(0, Math.min(rows - 1, Math.round(row)));
    return this.#tileHeight(nearestCol, nearestRow);
  }

  #tileHeight(col, row) {
    return this.#mapData.grid[row][col] === TileType.WATER
      ? 0
      : this.#mapData.heightmap[row][col];
  }

  #createInstancedBatches(batches) {
    for (const [batchKey, matrices] of batches.entries()) {
      if (matrices.length === 0) continue;
      const [materialName, meshKey] = batchKey.split("|");
      const vertexBuffer = new this.#pc.VertexBuffer(
        this.#app.graphicsDevice,
        this.#pc.VertexFormat.getDefaultInstancingFormat(
          this.#app.graphicsDevice,
        ),
        matrices.length / 16,
        { data: new Float32Array(matrices) },
      );
      this.#vertexBuffers.push(vertexBuffer);

      const meshInstance = new this.#pc.MeshInstance(
        this.#getMesh(meshKey),
        this.#materials.get(materialName),
      );
      meshInstance.setInstancing(vertexBuffer, false);
      meshInstance.castShadow = false;
      meshInstance.receiveShadow = false;

      const entity = new this.#pc.Entity(`Path arrows ${materialName}`);
      entity.addComponent("render", {
        meshInstances: [meshInstance],
        castShadows: false,
        receiveShadows: false,
      });
      this.#entity.addChild(entity);
    }
  }

  #getMesh(meshKey) {
    if (meshKey === "full") {
      return this.#arrowMesh;
    }
    if (meshKey === "aura") {
      return this.#auraMesh;
    }
    const cached = this.#sliceMeshes.get(meshKey);
    if (cached) {
      return cached;
    }
    const match = /^slice-(\d+)-(\d+)$/.exec(meshKey);
    if (!match) throw new UnknownArrowMeshError(meshKey);
    const mesh = this.#createArrowSliceMesh(Number(match[2]), Number(match[1]));
    this.#sliceMeshes.set(meshKey, mesh);
    return mesh;
  }

  #createAuraMesh() {
    const geometry = new this.#pc.Geometry();
    geometry.positions = [
      -0.5, 0, -0.5, 0.5, 0, -0.5, 0.5, 0, 0.5, -0.5, 0, 0.5,
    ];
    geometry.normals = [0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0];
    geometry.uvs = [0, 0, 1, 0, 1, 1, 0, 1];
    geometry.indices = [0, 2, 1, 0, 3, 2];
    const mesh = this.#pc.Mesh.fromGeometry(this.#app.graphicsDevice, geometry);
    mesh.incRefCount();
    return mesh;
  }

  #createAuraTexture() {
    const size = 64;
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const context = canvas.getContext("2d");
    const center = size / 2;
    const gradient = context.createRadialGradient(
      center,
      center,
      2,
      center,
      center,
      center,
    );
    gradient.addColorStop(0, "rgba(255,255,255,0.58)");
    gradient.addColorStop(0.3, "rgba(255,255,255,0.28)");
    gradient.addColorStop(0.72, "rgba(72,72,72,0.08)");
    gradient.addColorStop(1, "rgba(0,0,0,0)");
    context.fillStyle = gradient;
    context.fillRect(0, 0, size, size);

    const texture = new this.#pc.Texture(this.#app.graphicsDevice, {
      name: "Arrow aura",
      width: size,
      height: size,
      minFilter: this.#pc.FILTER_LINEAR_MIPMAP_LINEAR,
      magFilter: this.#pc.FILTER_LINEAR,
      addressU: this.#pc.ADDRESS_CLAMP_TO_EDGE,
      addressV: this.#pc.ADDRESS_CLAMP_TO_EDGE,
      mipmaps: true,
    });
    texture.setSource(canvas);
    return texture;
  }

  #createArrowSliceMesh(sliceIndex, sliceCount) {
    const sliceWidth = (ARROW_MAX_Z - ARROW_MIN_Z) / sliceCount;
    const sliceMin = ARROW_MIN_Z + sliceWidth * sliceIndex;
    const sliceMax = sliceMin + sliceWidth;
    const positions = [];
    const normals = [];
    const uvs = [];
    const indices = [];
    const minX = Math.min(...ARROW_POINTS.map((point) => point[0]));
    const maxX = Math.max(...ARROW_POINTS.map((point) => point[0]));
    const minZ = Math.min(...ARROW_POINTS.map((point) => point[1]));
    const maxZ = Math.max(...ARROW_POINTS.map((point) => point[1]));

    for (const triangle of ARROW_TRIANGLES) {
      let polygon = triangle.map((index) => ARROW_POINTS[index]);
      polygon = this.#clipPolygon(polygon, 1, sliceMin, true);
      polygon = this.#clipPolygon(polygon, 1, sliceMax, false);
      if (polygon.length < 3) continue;
      const start = positions.length / 3;
      for (const [x, z] of polygon) {
        positions.push(x, 0, z);
        normals.push(0, 1, 0);
        uvs.push(
          (x - minX) / Math.max(0.001, maxX - minX),
          (z - minZ) / Math.max(0.001, maxZ - minZ),
        );
      }
      for (let index = 1; index < polygon.length - 1; index += 1) {
        indices.push(start, start + index, start + index + 1);
      }
    }

    const geometry = new this.#pc.Geometry();
    geometry.positions = positions;
    geometry.normals = normals;
    geometry.uvs = uvs;
    geometry.indices = indices;
    const mesh = this.#pc.Mesh.fromGeometry(this.#app.graphicsDevice, geometry);
    mesh.incRefCount();
    return mesh;
  }

  #clipPolygon(polygon, axis, boundary, keepAbove) {
    const clipped = [];
    for (let index = 0; index < polygon.length; index += 1) {
      const current = polygon[index];
      const previous = polygon[(index + polygon.length - 1) % polygon.length];
      const currentInside = keepAbove
        ? current[axis] >= boundary
        : current[axis] <= boundary;
      const previousInside = keepAbove
        ? previous[axis] >= boundary
        : previous[axis] <= boundary;

      if (currentInside !== previousInside) {
        const ratio =
          (boundary - previous[axis]) / (current[axis] - previous[axis]);
        const intersection = [
          previous[0] + (current[0] - previous[0]) * ratio,
          previous[1] + (current[1] - previous[1]) * ratio,
        ];
        intersection[axis] = boundary;
        clipped.push(intersection);
      }
      if (currentInside) clipped.push(current);
    }
    return clipped;
  }

  #destroyMesh(mesh) {
    if (!mesh) {
      return;
    }
    mesh.decRefCount();
    if (mesh.refCount < 1) mesh.destroy();
  }
}
