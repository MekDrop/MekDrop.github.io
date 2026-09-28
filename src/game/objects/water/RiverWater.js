import { RIVER_KIND } from '../../enum/RiverKind.js';
import riverWaterFragmentShader from './RiverWater.frag?raw';
import riverWaterNormalShader from './RiverWaterNormal.frag?raw';
import riverWaterOpacityShader from './RiverWaterOpacity.frag?raw';
import riverWaterVertexShader from './RiverWater.vert?raw';
import { RiverMeshBuilder } from './RiverMeshBuilder.js';
import { RiverRuntimeEffects } from './RiverRuntimeEffects.js';
import { RiverSourceProfile } from './RiverSourceProfile.js';
import { RiverStoneField } from './RiverStoneField.js';

export class RiverWater {
  /**
   *
    * @returns {string}
   */
  static get modelUrls() {
    return RiverStoneField.modelUrls;
}
  /**
   *
    * @type {typeof import("playcanvas")}
   */
  #pc;
  /**
   *
    * @type {Map}
   */
  #materials = new Map();
  /**
   *
    * @type {RiverRuntimeEffects}
   */
  #effects;
  /**
   *
    * @type {typeof import("playcanvas")}
   */
  #meshBuilder;
  /**
   *
    * @type {typeof import("playcanvas")}
   */
  #stoneField;

  /**
   *
   * @param {{pc: typeof import("playcanvas"), app: import("playcanvas").Application, mapData: import("src/game/objects/ObjectTypes.js").GameMapData}} options
   * @param {typeof import("playcanvas")} options.pc
   * @param {import("playcanvas").Application} options.app
   * @param {import("src/game/objects/ObjectTypes.js").GameMapData} options.mapData
   */
  constructor({ pc, app, mapData }) {
    this.#pc = pc;
    this.entity = new pc.Entity(`River ${this.riverKind.toLowerCase()}`);
    this.#effects = new RiverRuntimeEffects({
      pc,
      app,
      mapData,
      entity: this.entity,
      waterEffects: this.hasWaterEffects,
    });
    this.#meshBuilder = new RiverMeshBuilder({
      pc,
      device: app.graphicsDevice,
      mapData,
      riverKind: this.riverKind,
      entity: this.entity,
    });
    this.#stoneField = new RiverStoneField({
      pc,
      mapData,
      riverKind: this.riverKind,
      entity: this.entity,
      effects: this.#effects,
      hasRockContactEffects: this.hasRockContactEffects,
    });
  }

  /**
   *
   * @param {string} modelLibrary
   */
  build(modelLibrary) {
    this.#meshBuilder.build({
      /**
       *
       * @param {number} cells
       */
      createSourceProfile: (cells) => this.createSourceProfile(cells),
      /**
       *
       * @param {number} cellIndex
       * @param {number} cascadeLanding
       */
      isSpringSource: (cellIndex, cascadeLanding) =>
        this.isSpringSource(cellIndex, cascadeLanding),
      /**
       *
       * @param {Array<number>} surfaceHeights
       * @param {number} cell
       */
      surfaceCorners: (surfaceHeights, cell) =>
        this.surfaceCorners(surfaceHeights, cell),
      /**
       *
       * @param {{group: import("src/game/objects/ObjectTypes.js").RiverGeometryGroup, waterfall: import("src/game/objects/ObjectTypes.js").WaterfallDefinition, cols: number, rows: number, routeDistance: number, join?: import("src/game/objects/ObjectTypes.js").WaterfallJoin|null}} options
       */
      appendCascade: (options) => this.appendCascade(options),
      /**
       *
       * @param {{group: import("src/game/objects/ObjectTypes.js").RiverGeometryGroup, waterfall: import("src/game/objects/ObjectTypes.js").WaterfallDefinition, cols: number, rows: number, routeDistance: number, join?: import("src/game/objects/ObjectTypes.js").WaterfallJoin|null}} options
       */
      appendTerminal: (options) => this.appendTerminal(options),
      /**
       *
       * @param {boolean} translucent
       */
      createMaterial: (translucent) => this.createMaterial(translucent),
    });
    this.#stoneField.build(modelLibrary);
    for (const material of this.#materials.values()) {
      this.#effects.applyGeometryParameters(material);
    }
  }

  /**
   *
    * @returns {string|number}
   */
  get riverKind() {
    return RIVER_KIND.WATER;
  }

  get pc() {
    return this.#pc;
  }

  /**
   *
    * @returns {import("playcanvas").Texture}
   */
  get mistTexture() {
    return this.#effects.mistTexture;
  }

  /**
   *
    * @returns {boolean}
   */
  get hasRockContactEffects() {
    return true;
  }

  /**
   *
    * @returns {boolean}
   */
  get hasWaterEffects() {
    return true;
  }

  /**
   *
   * @param {number} cells
   */
  createSourceProfile(cells) {
    return new RiverSourceProfile(cells);
  }

  /**
   *
   * @param {number} cellIndex
   * @param {number} cascadeLanding
   */
  isSpringSource(cellIndex, cascadeLanding) {
    return cellIndex < 2 && !cascadeLanding;
  }

  /**
   *
   * @param {Array<number>} surfaceHeights
   * @param {number} cell
   */
  surfaceCorners(surfaceHeights, cell) {
    return surfaceHeights.cornersFor(cell);
  }

  /**
   *
   * @param {{group: import("src/game/objects/ObjectTypes.js").RiverGeometryGroup, cascade: number, cols: number, rows: number, routeDistance: number, join: import("src/game/objects/ObjectTypes.js").WaterfallJoin|null}} options
   * @param {import("src/game/objects/ObjectTypes.js").RiverGeometryGroup} options.group
   * @param {number} options.cascade
   * @param {number} options.cols
   * @param {number} options.rows
   * @param {number} options.routeDistance
   * @param {import("src/game/objects/ObjectTypes.js").WaterfallJoin|null} options.join
   */
  appendCascade({ group, cascade, cols, rows, routeDistance, join }) {
    const waterfall = {
      col: cascade.from.col,
      row: cascade.from.row,
      direction: cascade.direction,
      topElevation: cascade.topElevation,
      bottomElevation: cascade.bottomElevation,
    };
    this.#meshBuilder.addCurvedWaterfall(
      group,
      waterfall,
      cols,
      rows,
      false,
      routeDistance,
      'all',
      join,
    );
    this.#effects.addWaterfall(waterfall, cols, rows, false, routeDistance);
  }

  /**
   *
   * @param {{riverGroup: number, terminalGroup: {x: number, y: number, z: number}, waterfall: import("src/game/objects/ObjectTypes.js").WaterfallDefinition, cols: number, rows: number, routeDistance: number, join: import("src/game/objects/ObjectTypes.js").WaterfallJoin|null}} options
   * @param {number} options.riverGroup
   * @param {{x: number, y: number, z: number}} options.terminalGroup
   * @param {import("src/game/objects/ObjectTypes.js").WaterfallDefinition} options.waterfall
   * @param {number} options.cols
   * @param {number} options.rows
   * @param {number} options.routeDistance
   * @param {import("src/game/objects/ObjectTypes.js").WaterfallJoin|null} options.join
   */
  appendTerminal({
    riverGroup,
    terminalGroup,
    waterfall,
    cols,
    rows,
    routeDistance,
    join,
  }) {
    this.#meshBuilder.addCurvedWaterfall(
      riverGroup,
      waterfall,
      cols,
      rows,
      true,
      routeDistance,
      'body',
      join,
    );
    this.#effects.addWaterfall(waterfall, cols, rows, true, routeDistance);
    this.#meshBuilder.addCurvedWaterfall(
      terminalGroup,
      waterfall,
      cols,
      rows,
      true,
      routeDistance,
      'tail',
      join,
    );
  }

  /**
   *
   * @param {number} deltaTime
   * @param {import("src/game/objects/ObjectTypes.js").HeroLike} hero
   * @param {import("playcanvas").Entity} camera
   */
  update(deltaTime, hero = null, camera = null) {
    this.#effects.update(deltaTime, hero, camera);
    for (const material of this.#materials.values()) {
      this.#effects.updateMaterial(material);
    }
  }

  destroy() {
    this.#effects.destroyBeforeEntity();
    this.entity.destroy();
    this.#meshBuilder.destroy();
    for (const material of this.#materials.values()) {
      material.destroy();
    }
    this.#materials.clear();
    this.#effects.destroyAfterEntity();
    this.#stoneField.destroy();
  }

  /**
   *
   * @param {boolean} translucent
   */
  createMaterial(translucent = false) {
    const key = translucent ? 'translucent' : 'opaque';
    return this.materialFor(key, () => {
      const material = new this.#pc.StandardMaterial();
      material.name = `Painted river ${key}`;
      material.diffuse = new this.#pc.Color(0.08, 0.62, 0.84);
      material.ambient = new this.#pc.Color(0, 0, 0);
      material.emissive = new this.#pc.Color(1, 1, 1);
      material.shaderChunks.glsl.set(
        'emissivePS',
        'void getEmission() { dEmission = dAlbedo; }',
      );
      material.diffuseMap = this.#effects.mistTexture;
      material.forceUv1 = true;
      material.setAttribute('vertex_riverSource', this.#pc.SEMANTIC_TEXCOORD2);
      material.diffuseVertexColor = true;
      material.useLighting = false;
      material.blendType = translucent
        ? this.#pc.BLEND_NORMAL
        : this.#pc.BLEND_NONE;
      material.depthWrite = true;
      material.useDynamicRefraction = false;
      material.refraction = 0;
      material.cull = this.#pc.CULLFACE_NONE;
      material.shaderChunks.glsl.set('transformVS', riverWaterVertexShader);
      material.shaderChunks.glsl.set('diffusePS', riverWaterFragmentShader);
      material.shaderChunks.glsl.set('normalMapPS', riverWaterNormalShader);
      if (translucent) {
        material.opacityVertexColor = true;
        material.opacityVertexColorChannel = 'a';
        material.shaderChunks.glsl.set('opacityPS', riverWaterOpacityShader);
      }
      material.setParameter('uRiverLava', 0);
      return material;
    });
  }

  /**
   *
   * @param {string} key
   * @param {number} create
   */
  materialFor(key, create) {
    if (this.#materials.has(key)) {
      return this.#materials.get(key);
    }
    const material = create();
    this.#effects.apply(material);
    material.update();
    this.#materials.set(key, material);
    return material;
  }
}
