import riverStoneAngularModelUrl from '../../models/water/river-stone-angular.glb?url';
import riverStoneFlatModelUrl from '../../models/water/river-stone-flat.glb?url';
import riverStoneModelUrl from '../../models/water/river-stone.glb?url';
import { RIVER_KIND } from '../../enum/RiverKind.js';
import { RiverStonePlacementPlan } from './RiverStonePlacementPlan.js';

export class RiverStoneField {
  /**
   *
    * @returns {Array<string>}
   */
  static get modelUrls() {
    return [
      riverStoneModelUrl,
      riverStoneFlatModelUrl,
      riverStoneAngularModelUrl,
    ];
  }

  /**
   *
    * @type {typeof import("playcanvas")}
   */
  #pc;
  /**
   *
    * @type {import("src/game/objects/ObjectTypes.js").GameMapData}
   */
  #mapData;
  /**
   *
    * @type {number}
   */
  #riverKind;
  /**
   *
    * @type {import("playcanvas").Entity}
   */
  #entity;
  /**
   *
    * @type {import("./RiverRuntimeEffects.js").RiverRuntimeEffects}
   */
  #effects;
  /**
   *
    * @type {boolean}
   */
  #hasRockContactEffects;
  /**
   *
    * @type {Array<import("playcanvas").VertexBuffer>}
   */
  #vertexBuffers = [];

  /**
   *
   * @param {{pc: typeof import("playcanvas"), mapData: import("src/game/objects/ObjectTypes.js").GameMapData, riverKind: number, entity: import("playcanvas").Entity, effects: import("./RiverRuntimeEffects.js").RiverRuntimeEffects, hasRockContactEffects: boolean}} options
   * @param {typeof import("playcanvas")} options.pc
   * @param {import("src/game/objects/ObjectTypes.js").GameMapData} options.mapData
   * @param {number} options.riverKind
   * @param {import("playcanvas").Entity} options.entity
   * @param {import("./RiverRuntimeEffects.js").RiverRuntimeEffects} options.effects
   * @param {boolean} options.hasRockContactEffects
   */
  constructor({
    pc,
    mapData,
    riverKind,
    entity,
    effects,
    hasRockContactEffects,
  }) {

    this.#pc = pc;

    this.#mapData = mapData;

    this.#riverKind = riverKind;

    this.#entity = entity;

    this.#effects = effects;

    this.#hasRockContactEffects = hasRockContactEffects;
  }

  /**
   *
   * @param {string} modelLibrary
   */
  build(modelLibrary) {
    const { cols, rows, riverData = [] } = this.#mapData;
    const rivers = riverData.filter(
      /**
       *
       * @param {number} river
       */
      (river) => (river.kind ?? RIVER_KIND.WATER) === this.#riverKind,
    );
    const stoneModels = [
      riverStoneModelUrl,
      riverStoneFlatModelUrl,
      riverStoneAngularModelUrl,
    ];
    const stoneModelHeights = [0.20761, 0.14188, 0.27262];
    const matricesByModel = new Map(
      stoneModels.map(/**
       *
       * @param {string} modelUrl
       */
      (modelUrl) => [modelUrl, []]),
    );
    const placements = new RiverStonePlacementPlan(stoneModelHeights).create(
      rivers,
      cols,
      rows,
    );

    for (const placement of placements) {
      const matrix = new this.#pc.Mat4();
      const rotation = new this.#pc.Quat().setFromEulerAngles(
        0,
        placement.rotationY,
        0,
      );
      matrix.setTRS(
        new this.#pc.Vec3(...placement.position),
        rotation,
        new this.#pc.Vec3(...placement.scale),
      );
      matricesByModel.get(stoneModels[placement.modelIndex]).push(...matrix.data);
      if (this.#hasRockContactEffects && placement.contact) {
        this.#effects.registerRockContact(
          placement.contact.x,
          placement.contact.elevation,
          placement.contact.z,
          placement.contact.radius,
          placement.contact.direction,
        );
      }
    }

    for (const [modelUrl, matrices] of matricesByModel) {
      const batch = modelLibrary.instantiateMergedBatch(modelUrl, matrices, {
        name: 'Partially submerged river stones',
        castShadows: true,
        receiveShadows: true,
      });
      if (!batch) {
        continue;
      }
      this.#vertexBuffers.push(batch.vertexBuffer);
      this.#entity.addChild(batch.entity);
    }
  }

  destroy() {
    for (const vertexBuffer of this.#vertexBuffers) {
      vertexBuffer.destroy();
    }
    this.#vertexBuffers = [];
  }

}
