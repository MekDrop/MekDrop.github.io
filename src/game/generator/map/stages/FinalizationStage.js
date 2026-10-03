import { WalkingPaths } from "../../../navigation/WalkingPaths.js";
import { TerrainBlockDefinitions } from "../../../objects/terrain/TerrainBlockDefinitions.js";
import { AbstractMapGenerationStage } from "../AbstractMapGenerationStage.js";

/**
 * Assembles the stable public map contract and generated object records.
 */
export class FinalizationStage extends AbstractMapGenerationStage {
  /**
   *
   * @type {Array}
   */
  #operations;

  /**
   *
   * @param {Array<() => void>} operations
   */
  constructor(operations) {
    super();
    /**
     *
     * @type {Array}
     */
    this.#operations = operations;
  }

  /**
   *
   * @param {GenerationContext} context
   */
  async run(context) {
    const { grid, heightmap, tileMeta } = context.world;
    const { layout, mergeZones, trunkStart } =
      context.routing;
    const {
      riverData,
      vegetationPlacements,
      stonePlacements,
      groundCoverData,
      cliffVineData,
    } = context.features;
    const { castle, castleBuildPlan } = context.output;
    const { cols, rows } = this.#operations.mapDimensions;
    const royalSeed = this.#operations.randomUint32();
    const royalType = ["King", "Queen", "Princess"][royalSeed % 3];
    const residentPosition = {
      x: castle.position.col + castle.position.width / 2 - cols / 2,
      y: castle.position.elevation,
      z: castle.position.row + castle.position.depth / 2 - rows / 2,
    };
    const objects = [
      {
        id: "castle-0",
        object: "Castle",
        seed: castleBuildPlan?.input?.seed,
        basePlanId: castleBuildPlan?.layout?.basePlanId,
        buildPlan: castleBuildPlan,
      },
      {
        id: `castle-${royalType.toLowerCase()}`,
        object: royalType,
        castleIndex: 0,
        seed: royalSeed,
        position: residentPosition,
      },
      {
        id: "castle-servant",
        object: "Servant",
        castleIndex: 0,
        position: residentPosition,
      },
      ...vegetationPlacements.map(/**
       *
       * @param {import("src/game/GameContracts.js").GameObjectDefinition} vegetation
       * @param {number} index
       */
      (vegetation, index) => ({
        id: `vegetation-${index}`,
        object: "Vegetation",
        variant: vegetation.variant,
        kind: vegetation.kind,
        rotation: vegetation.rotation ?? 0,
        tile: { col: vegetation.col, row: vegetation.row },
        position: {
          x: vegetation.col - (cols - 1) / 2,
          y:
            heightmap[vegetation.row][vegetation.col] +
            this.#operations.grassSurfaceLift,
          z: vegetation.row - (rows - 1) / 2,
        },
      })),
      ...stonePlacements.map(/**
       *
       * @param {number} stone
       * @param {number} index
       */
      (stone, index) => ({
        id: `stone-cluster-${index}`,
        object: "StoneCluster",
        tile: { col: stone.col, row: stone.row },
        position: {
          x: stone.col - (cols - 1) / 2,
          y:
            heightmap[stone.row][stone.col] +
            this.#operations.grassSurfaceLift,
          z: stone.row - (rows - 1) / 2,
        },
        parts: stone.parts,
      })),
    ];
    const mapData = {
      grid,
      heightmap,
      tileMeta,
      cols,
      rows,
      entries: layout.entries.map(/**
       *
       * @param {import("src/game/GameContracts.js").GameCanvasPluginEntry} entry
       * @param {number} index
       */
      (entry, index) => ({
        col: entry.gateCol,
        row: entry.gateRows[0],
        rows: [...entry.gateRows],
        side: entry.side,
        color:
          this.#operations.gatewayColors[
            index % this.#operations.gatewayColors.length
          ],
      })),
      castlePos: { col: layout.castleLeft, row: layout.pathRows[0] },
      castle,
      numPaths: layout.entries.length,
      objects,
      groundCoverData,
      cliffVineData,
      riverData,
      pipeData: new Map(),
      overpassData: layout.overpassPlan,
      pathDipData: layout.pathDipPlans,
      ...(context.features.islandConnectorData
        ? { islandConnectorData: context.features.islandConnectorData }
        : {}),
      mergeZones,
      trunkStart,
      layoutSignature: layout.signature,
      mapName: context.input.mapName,
    };
    WalkingPaths.rebuild(mapData);
    TerrainBlockDefinitions.populate(mapData);
    context.output.mapData = mapData;
  }
}
