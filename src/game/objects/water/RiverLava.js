import lavaWaterFragmentShader from './LavaWater.frag?raw';
import lavaWaterOpacityShader from './LavaWaterOpacity.frag?raw';
import lavaWaterVertexShader from './LavaWater.vert?raw';
import riverWaterNormalShader from './RiverWaterNormal.frag?raw';
import { RIVER_KIND } from '../../enum/RiverKind.js';
import { LavafallGeometry } from './LavafallGeometry.js';
import { RiverWater } from './RiverWater.js';

export class RiverLava extends RiverWater {
  /**
   *
    * @returns {string|number}
   */
  get riverKind() {
    return RIVER_KIND.LAVA;
  }

  /**
   *
    * @returns {boolean}
   */
  get hasRockContactEffects() {
    return false;
  }

  /**
   *
    * @returns {boolean}
   */
  get hasWaterEffects() {
    return false;
  }

  /**
   *
    * @returns {boolean}
   */
  get hasWaterEffects() {
    return false;
  }

  createSourceProfile() {
    return null;
  }

  /**
   *
   * @param {number} cellIndex
   */
  isSpringSource(cellIndex) {
    return cellIndex === 0;
  }

  surfaceCorners() {
    return null;
  }

  /**
   *
   * @param {boolean} translucent
   */
  createMaterial(translucent = false) {
    const key = translucent ? 'translucent' : 'opaque';
    return this.materialFor(key, () => {
      const material = new this.pc.StandardMaterial();
      material.name = `Molten river ${key}`;
      material.diffuse = new this.pc.Color(1, 0.2, 0.015);
      material.emissive = new this.pc.Color(0.72, 0.12, 0.006);
      material.emissiveIntensity = 0.9;
      material.forceUv1 = true;
      material.diffuseVertexColor = true;
      material.useLighting = false;
      material.blendType = translucent
        ? this.pc.BLEND_NORMAL
        : this.pc.BLEND_NONE;
      material.depthWrite = true;
      material.useDynamicRefraction = false;
      material.refraction = 0;
      material.cull = this.pc.CULLFACE_NONE;
      material.shaderChunks.glsl.set('transformVS', lavaWaterVertexShader);
      material.shaderChunks.glsl.set('diffusePS', lavaWaterFragmentShader);
      material.shaderChunks.glsl.set('normalMapPS', riverWaterNormalShader);
      if (translucent) {
        material.opacityVertexColor = true;
        material.opacityVertexColorChannel = 'a';
        material.shaderChunks.glsl.set('opacityPS', lavaWaterOpacityShader);
      }
      material.setParameter('uRiverLava', 1);
      return material;
    });
  }

  /**
   *
   * @param {{group: import("src/game/objects/ObjectTypes.js").RiverGeometryGroup, cascade: number, cols: number, rows: number, routeDistance: number}} options
   * @param {import("src/game/objects/ObjectTypes.js").RiverGeometryGroup} options.group
   * @param {number} options.cascade
   * @param {number} options.cols
   * @param {number} options.rows
   * @param {number} options.routeDistance
   */
  appendCascade({ group, cascade, cols, rows, routeDistance }) {
    const geometry = new LavafallGeometry();
    geometry.append(
      group,
      {
        col: cascade.from.col,
        row: cascade.from.row,
        direction: cascade.direction,
        topElevation: cascade.topElevation,
        bottomElevation: cascade.bottomElevation,
      },
      cols,
      rows,
      false,
      routeDistance,
    );
    geometry.appendCascadeImpact(group, cascade, cols, rows);
    this.#addWaterfallMist(cascade, cols, rows, false);
  }

  /**
   *
   * @param {{terminalGroup: {x: number, y: number, z: number}, waterfall: import("src/game/objects/ObjectTypes.js").WaterfallDefinition, cols: number, rows: number, routeDistance: number}} options
   * @param {{x: number, y: number, z: number}} options.terminalGroup
   * @param {import("src/game/objects/ObjectTypes.js").WaterfallDefinition} options.waterfall
   * @param {number} options.cols
   * @param {number} options.rows
   * @param {number} options.routeDistance
   */
  appendTerminal({ terminalGroup, waterfall, cols, rows, routeDistance }) {
    new LavafallGeometry().append(
      terminalGroup,
      waterfall,
      cols,
      rows,
      true,
      routeDistance,
    );
    this.#addWaterfallMist(waterfall, cols, rows, true);
  }

  /**
   *
   * @param {import("src/game/objects/ObjectTypes.js").WaterfallDefinition} waterfall
   * @param {number} cols
   * @param {number} rows
   * @param {import("src/game/objects/ObjectTypes.js").RiverTerminal} terminal
   */
  #addWaterfallMist(waterfall, cols, rows, terminal) {
    const direction = this.#directionVector(waterfall.direction);
    const cross = { col: -direction.row, row: direction.col };
    const col = waterfall.col ?? waterfall.from.col;
    const row = waterfall.row ?? waterfall.from.row;
    const centerX = col - (cols - 1) / 2;
    const centerZ = row - (rows - 1) / 2;
    const scale = terminal ? 1 : 0.82;
    const mistElevation = terminal
      ? waterfall.bottomElevation +
        (waterfall.topElevation - waterfall.bottomElevation) * 0.17
      : waterfall.bottomElevation + 0.12;
    const root = new this.pc.Entity('Lavafall impact smoke');
    root.setLocalPosition(
      centerX + direction.col * 0.57,
      mistElevation,
      centerZ + direction.row * 0.57,
    );
    this.entity.addChild(root);

    const mist = new this.pc.Entity('Lavafall smoke');
    mist.addComponent('particlesystem', {
      numParticles: terminal ? 32 : 12,
      lifetime: 1.7,
      rate: terminal ? 0.04 : 0.07,
      rate2: terminal ? 0.065 : 0.11,
      loop: true,
      preWarm: true,
      lighting: false,
      intensity: 1,
      depthWrite: false,
      noFog: true,
      sort: this.pc.PARTICLESORT_OLDER_FIRST,
      blendType: this.pc.BLEND_NORMAL,
      emitterShape: this.pc.EMITTERSHAPE_BOX,
      emitterExtents: new this.pc.Vec3(
        (Math.abs(cross.col) * 0.46 + Math.abs(direction.col) * 0.1) * scale,
        0.025,
        (Math.abs(cross.row) * 0.46 + Math.abs(direction.row) * 0.1) * scale,
      ),
      initialVelocity: 0,
      localSpace: true,
      colorMap: this.mistTexture,
      orientation: this.pc.PARTICLEORIENTATION_SCREEN,
      localVelocityGraph: this.#curveSet(
        [
          0,
          (direction.col * 0.08 - cross.col * 0.24) * scale,
          1,
          (direction.col * 0.22 - cross.col * 0.42) * scale,
        ],
        [0, 0.06 * scale, 0.45, 0.36 * scale, 1, 0.18 * scale],
        [
          0,
          (direction.row * 0.08 - cross.row * 0.24) * scale,
          1,
          (direction.row * 0.22 - cross.row * 0.42) * scale,
        ],
      ),
      localVelocityGraph2: this.#curveSet(
        [
          0,
          (direction.col * 0.14 + cross.col * 0.24) * scale,
          1,
          (direction.col * 0.28 + cross.col * 0.42) * scale,
        ],
        [0, 0.12 * scale, 0.45, 0.5 * scale, 1, 0.22 * scale],
        [
          0,
          (direction.row * 0.14 + cross.row * 0.24) * scale,
          1,
          (direction.row * 0.28 + cross.row * 0.42) * scale,
        ],
      ),
      scaleGraph: this.#curve([
        0, 0.14 * scale, 0.22, 0.36 * scale, 0.72, 0.58 * scale, 1,
        0.72 * scale,
      ]),
      scaleGraph2: this.#curve([
        0, 0.11 * scale, 0.25, 0.3 * scale, 0.75, 0.5 * scale, 1,
        0.66 * scale,
      ]),
      colorGraph: this.#curveSet(
        [0, 0.35, 0.45, 0.18, 1, 0.08],
        [0, 0.08, 0.45, 0.055, 1, 0.045],
        [0, 0.015, 0.45, 0.02, 1, 0.025],
      ),
      alphaGraph: this.#curve([0, 0, 0.1, 0.52, 0.5, 0.34, 1, 0]),
      startAngle: -35,
      startAngle2: 35,
      rotationSpeedGraph: this.#curve([0, -12, 1, 16]),
      rotationSpeedGraph2: this.#curve([0, 15, 1, -18]),
    });
    root.addChild(mist);

    const spray = new this.pc.Entity('Lavafall sparks');
    spray.addComponent('particlesystem', {
      numParticles: terminal ? 14 : 8,
      lifetime: 0.52,
      rate: terminal ? 0.035 : 0.06,
      rate2: terminal ? 0.07 : 0.1,
      loop: true,
      preWarm: true,
      lighting: false,
      intensity: 1.08,
      depthWrite: false,
      noFog: true,
      sort: this.pc.PARTICLESORT_OLDER_FIRST,
      blendType: this.pc.BLEND_NORMAL,
      stretch: 0.13 * scale,
      alignToMotion: true,
      emitterShape: this.pc.EMITTERSHAPE_BOX,
      emitterExtents: new this.pc.Vec3(
        Math.abs(cross.col) * 0.34 * scale + 0.03,
        0.02,
        Math.abs(cross.row) * 0.34 * scale + 0.03,
      ),
      initialVelocity: 0,
      localSpace: true,
      colorMap: this.mistTexture,
      orientation: this.pc.PARTICLEORIENTATION_SCREEN,
      localVelocityGraph: this.#curveSet(
        [0, -cross.col * 0.7 * scale, 1, direction.col * 0.16],
        [0, 0.85 * scale, 1, -0.28 * scale],
        [0, -cross.row * 0.7 * scale, 1, direction.row * 0.16],
      ),
      localVelocityGraph2: this.#curveSet(
        [0, cross.col * 0.7 * scale, 1, direction.col * 0.28],
        [0, 1.2 * scale, 1, -0.4 * scale],
        [0, cross.row * 0.7 * scale, 1, direction.row * 0.28],
      ),
      scaleGraph: this.#curve([0, 0.035 * scale, 0.6, 0.025, 1, 0]),
      scaleGraph2: this.#curve([0, 0.055 * scale, 0.6, 0.04, 1, 0]),
      colorGraph: this.#curveSet(
        [0, 1, 0.5, 1, 1, 0.52],
        [0, 0.58, 0.5, 0.16, 1, 0.025],
        [0, 0.04, 0.5, 0.005, 1, 0],
      ),
      alphaGraph: this.#curve([0, 0, 0.08, 0.85, 0.7, 0.55, 1, 0]),
    });
    root.addChild(spray);
  }

  /**
   *
   * @param {string} keys
   */
  #curve(keys) {
    const curve = new this.pc.Curve(keys);
    curve.type = this.pc.CURVE_SMOOTHSTEP;
    return curve;
  }

  /**
   *
   * @param {...Array<number>} channels
   */
  #curveSet(...channels) {
    const curves = new this.pc.CurveSet(channels);
    curves.type = this.pc.CURVE_SMOOTHSTEP;
    return curves;
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
