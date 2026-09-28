import { HeroWaterReflection } from './HeroWaterReflection.js';
import { RiverFlowMap } from './RiverFlowMap.js';
import { WaterfallSpray } from './WaterfallSpray.js';

export class RiverRuntimeEffects {
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
    * @type {import("./WaterfallSpray.js").WaterfallSpray}
   */
  #waterfallSpray;
  /**
   *
    * @type {typeof import("playcanvas")}
   */
  #mistTexture;
  /**
   *
    * @type {typeof import("playcanvas")}
   */
  #heroReflection;
  /**
   *
    * @type {typeof import("playcanvas")}
   */
  #flowMap;
  /**
   *
    * @type {number}
   */
  #time = 0;
  /**
   *
    * @type {Float32Array}
   */
  #rockContacts = new Float32Array(18 * 4);
  /**
   *
    * @type {number}
   */
  #rockContactCount = 0;
  /**
   *
    * @type {Float32Array}
   */
  #cascadeImpacts = new Float32Array(32 * 4);
  /**
   *
    * @type {Float32Array}
   */
  #cascadeFlows = new Float32Array(32 * 4);
  /**
   *
    * @type {number}
   */
  #cascadeImpactCount = 0;

  /**
   *
   * @param {{pc: typeof import("playcanvas"), app: import("playcanvas").Application, mapData: import("src/game/objects/ObjectTypes.js").GameMapData, entity: import("playcanvas").Entity, waterEffects: Array<{update: (deltaTime: number) => void, destroy: () => void}>}} options
   * @param {typeof import("playcanvas")} options.pc
   * @param {import("playcanvas").Application} options.app
   * @param {import("src/game/objects/ObjectTypes.js").GameMapData} options.mapData
   * @param {import("playcanvas").Entity} options.entity
   * @param {Array<{update: (deltaTime: number) => void, destroy: () => void}>} options.waterEffects
   */
  constructor({ pc, app, mapData, entity, waterEffects }) {
    this.#pc = pc;
    this.#app = app;
    this.#entity = entity;
    this.#waterfallSpray = waterEffects
      ? new WaterfallSpray(pc, app.graphicsDevice)
      : null;
    if (this.#waterfallSpray) {
      entity.addChild(this.#waterfallSpray.entity);
    }
    this.#mistTexture = this.#createMistTexture();
    this.#heroReflection = waterEffects ? new HeroWaterReflection(pc, app) : null;
    this.#flowMap = waterEffects
      ? new RiverFlowMap(pc, app.graphicsDevice, mapData)
      : null;
  }

  get mistTexture() {
    return this.#mistTexture;
  }

  /**
   *
   * @param {number} deltaTime
   * @param {import("src/game/objects/ObjectTypes.js").HeroLike} hero
   * @param {import("playcanvas").Entity} camera
   */
  update(deltaTime, hero = null, camera = null) {
    this.#time = (this.#time + deltaTime) % 1000;
    this.#heroReflection?.update(hero?.waterPresentation, camera);
  }

  /**
   *
   * @param {import("playcanvas").Material} material
   */
  apply(material) {
    material.setParameter('uRiverTime', this.#time);
    this.#heroReflection?.apply(material);
    this.#flowMap?.apply(material);
  }

  /**
   *
   * @param {import("playcanvas").Material} material
   */
  updateMaterial(material) {
    material.setParameter('uRiverTime', this.#time);
    this.#heroReflection?.apply(material);
  }

  /**
   *
   * @param {import("playcanvas").Material} material
   */
  applyGeometryParameters(material) {
    material.setParameter('uRiverRocks[0]', this.#rockContacts);
    material.setParameter('uRiverRockCount', this.#rockContactCount);
    material.setParameter('uCascadeImpacts[0]', this.#cascadeImpacts);
    material.setParameter('uCascadeFlows[0]', this.#cascadeFlows);
    material.setParameter('uCascadeImpactCount', this.#cascadeImpactCount);
  }

  /**
   *
   * @param {number} x
   * @param {number} elevation
   * @param {number} z
   * @param {number} radius
   * @param {{x: number, y: number, z: number}} direction
   */
  registerRockContact(x, elevation, z, radius, direction) {
    if (this.#rockContactCount >= 18) {
      return;
    }
    this.#rockContacts.set(
      [x, elevation + 0.012, z, radius],
      this.#rockContactCount * 4,
    );
    this.#rockContactCount++;
    this.addRockSpray(x, elevation, z, radius, direction);
  }

  /**
   *
   * @param {import("src/game/objects/ObjectTypes.js").WaterfallDefinition} waterfall
   * @param {number} cols
   * @param {number} rows
   * @param {import("src/game/objects/ObjectTypes.js").RiverTerminal} terminal
   * @param {number} routeDistance
   */
  addWaterfall(waterfall, cols, rows, terminal, routeDistance) {
    this.#waterfallSpray?.add(waterfall, cols, rows, terminal);
    if (terminal || this.#cascadeImpactCount >= 32) {
      return;
    }
    const direction = this.#directionVector(waterfall.direction);
    const drop = waterfall.topElevation - waterfall.bottomElevation;
    const forward = 0.565 + Math.min(0.22, drop * 0.22);
    this.#cascadeImpacts.set([
      waterfall.col - (cols - 1) / 2 + direction.col * forward,
      waterfall.bottomElevation + 0.012,
      waterfall.row - (rows - 1) / 2 + direction.row * forward,
      Math.min(1, 0.45 + drop * 0.2),
    ], this.#cascadeImpactCount * 4);
    this.#cascadeFlows.set([
      direction.col, direction.row, routeDistance, 0,
    ], this.#cascadeImpactCount * 4);
    this.#cascadeImpactCount++;
  }

  /**
   *
   * @param {number} x
   * @param {number} elevation
   * @param {number} z
   * @param {number} radius
   * @param {{x: number, y: number, z: number}} direction
   */
  addRockSpray(x, elevation, z, radius, direction) {
    const flow = this.#directionVector(direction);
    const spray = new this.#pc.Entity('River rock contact spray');
    spray.setLocalPosition(
      x - flow.col * radius * 0.8,
      elevation + 0.045,
      z - flow.row * radius * 0.8,
    );
    spray.addComponent('particlesystem', {
      numParticles: 7, lifetime: 0.65, rate: 0.12, rate2: 0.2,
      loop: true, preWarm: true, lighting: false, depthWrite: false,
      blendType: this.#pc.BLEND_NORMAL, localSpace: true,
      emitterShape: this.#pc.EMITTERSHAPE_BOX,
      emitterExtents: new this.#pc.Vec3(radius * 0.45, 0.015, radius * 0.45),
      colorMap: this.#mistTexture,
      localVelocityGraph: this.#curveSet(
        [0, flow.col * 0.08 - 0.035, 1, flow.col * 0.18],
        [0, 0.34, 0.4, 0.18, 1, -0.06],
        [0, flow.row * 0.08 - 0.035, 1, flow.row * 0.18],
      ),
      localVelocityGraph2: this.#curveSet(
        [0, flow.col * 0.12 + 0.035, 1, flow.col * 0.22],
        [0, 0.5, 0.4, 0.26, 1, -0.1],
        [0, flow.row * 0.12 + 0.035, 1, flow.row * 0.22],
      ),
      scaleGraph: this.#curve([0, 0.012, 0.4, 0.032, 1, 0.05]),
      scaleGraph2: this.#curve([0, 0.018, 0.4, 0.045, 1, 0.065]),
      colorGraph: this.#curveSet([0, 0.69, 1, 0.77], [0, 0.84, 1, 0.86], [0, 0.8, 1, 0.85]),
      alphaGraph: this.#curve([0, 0, 0.16, 0.38, 0.55, 0.16, 1, 0]),
    });
    this.#entity.addChild(spray);
  }

  #createMistTexture() {
    const size = 32;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const context = canvas.getContext('2d');
    const image = context.createImageData(size, size);
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const normalizedX = (x + 0.5 - size / 2) / (size / 2);
        const normalizedY = (y + 0.5 - size / 2) / (size / 2);
        const distance = Math.hypot(normalizedX, normalizedY);
        const angle = Math.atan2(normalizedY, normalizedX);
        const boundary =
          0.82 +
          Math.sin(angle * 5 + 0.7) * 0.08 +
          Math.sin(angle * 9 - 0.4) * 0.045;
        const edge = Math.max(
          0,
          Math.min(1, (boundary - distance) / 0.34),
        );
        const softEdge = edge * edge * (3 - 2 * edge);
        const cloudyNoise =
          0.76 +
          Math.sin(x * 1.73 + y * 0.91) * 0.09 +
          Math.sin(x * 0.41 - y * 1.37) * 0.07;
        const pixel = (y * size + x) * 4;
        image.data[pixel] = 226;
        image.data[pixel + 1] = 247;
        image.data[pixel + 2] = 255;
        image.data[pixel + 3] = Math.round(
          Math.max(0, softEdge * cloudyNoise) * 154,
        );
      }
    }
    context.putImageData(image, 0, 0);

    const texture = new this.#pc.Texture(this.#app.graphicsDevice, {
      name: 'Waterfall mist particle',
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

  /**
   *
   * @param {string} keys
   */
  #curve(keys) {
    const curve = new this.#pc.Curve(keys);
    curve.type = this.#pc.CURVE_SMOOTHSTEP;
    return curve;
  }

  /**
   *
   * @param {...Array<number>} channels
   */
  #curveSet(...channels) {
    const curves = new this.#pc.CurveSet(channels);
    curves.type = this.#pc.CURVE_SMOOTHSTEP;
    return curves;
  }

  destroyBeforeEntity() {
    this.#heroReflection?.destroy();
    this.#flowMap?.destroy();
    this.#waterfallSpray?.destroy();
  }

  destroyAfterEntity() {
    this.#mistTexture?.destroy();
    this.#mistTexture = null;
  }

  /**
   *
   * @param {{x: number, y: number, z: number}} direction
   */
  #directionVector(direction) {
    if (direction === 'NORTH') {
      return { col: 0, row: -1 };
    }
    if (direction === 'EAST') {
      return { col: 1, row: 0 };
    }
    if (direction === 'SOUTH') {
      return { col: 0, row: 1 };
    }
    return { col: -1, row: 0 };
  }
}
