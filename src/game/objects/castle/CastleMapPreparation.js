import { CastleBedMapObjects } from "../castle-props/bed/CastleBedMapObjects.js";
import { CastleStraightStairMapObjects } from "./CastleStraightStairMapObjects.js";
import { CastleLadderMapObjects } from "./CastleLadderMapObjects.js";
import { CastleLanternMapObjects } from "./CastleLanternMapObjects.js";
import { CastleSignalTowerMapObjects } from "./CastleSignalTowerMapObjects.js";
import { DecorationPlacementRules } from "../../generator/map/DecorationPlacementRules.js";
import { LibraryRoomMapObjects } from "./rooms/library/LibraryRoomMapObjects.js";
import { RoyalBedroomRoomMapObjects } from "./rooms/royal-bedroom/RoyalBedroomRoomMapObjects.js";
import { LeisureRoomMapObjects } from "./rooms/leisure/LeisureRoomMapObjects.js";
import { KitchenRoomMapObjects } from "./rooms/kitchen/KitchenRoomMapObjects.js";
import { ThroneRoomMapObjects } from "./rooms/throne/ThroneRoomMapObjects.js";
import { StairwellRoomMapObjects } from "./rooms/stairwell/StairwellRoomMapObjects.js";
import { TowerRoomMapObjects } from "./rooms/tower/TowerRoomMapObjects.js";
import { VestibuleRoomMapObjects } from "./rooms/vestibule/VestibuleRoomMapObjects.js";
import { GRASS_SURFACE_LIFT } from "../../config/terrain.js";
import { CastleGroundWeathering } from "./CastleGroundWeathering.js";
import { createCastleStairFlight } from "./CastleStairFlight.js";
import { createCastleGroundCuts, clipCastleTerrainRecord } from "./CastleGroundCuts.js";
import { CastleResidentialLayout, createCastleButtressFootings } from "./CastleResidentialLayout.js";

/**
 * Shared, renderer-independent excavation used by gameplay and saved-map checks.
 */
export class CastleMapPreparation {
  /**
   * Excavate underground rooms and raised exterior stair flights from generated terrain.
   * Keep tile ownership and the authored two-lane approach unchanged.
   * @param {import("../../GameContracts.js").GameMapData} mapData
   */
  static prepareMap(mapData) {
    CastleStraightStairMapObjects.prepareMap(mapData);
    CastleBedMapObjects.prepareMap(mapData);
    RoyalBedroomRoomMapObjects.prepareMap(mapData);
    LibraryRoomMapObjects.prepareMap(mapData);
    LeisureRoomMapObjects.prepareMap(mapData);
    KitchenRoomMapObjects.prepareMap(mapData);
    ThroneRoomMapObjects.prepareMap(mapData);
    StairwellRoomMapObjects.prepareMap(mapData);
    TowerRoomMapObjects.prepareMap(mapData);
    CastleLadderMapObjects.prepareMap(mapData);
    CastleSignalTowerMapObjects.prepareMap(mapData);
    VestibuleRoomMapObjects.prepareMap(mapData);
    CastleLanternMapObjects.prepareMap(mapData);
    const castles = (mapData.objects ?? []).filter(
      CastleMapPreparation.#filterDefinition,
    );
    const flights = castles.flatMap(/**
     *
     * @param {import("../ObjectTypes.js").MapObjectDefinition} definition
     */
      (definition) => CastleMapPreparation.#exteriorStairFlights(definition.buildPlan, mapData));
    CastleMapPreparation.#buryBasements(mapData, castles, flights);
    const layouts = castles.map(CastleMapPreparation.#mapDefinition);
    mapData.objects = (mapData.objects ?? []).filter(
      /**
       * @param {import("../ObjectTypes.js").MapObjectDefinition} definition
       */
      (definition) => {
        if (!definition.generated || !["Earth", "Grass"].includes(definition.object) || !definition.position) {
          return true;
        }
        const { x, y, z } = definition.position;
        const args = definition.geometry?.args;
        const halfX = definition.geometry?.method === "addBoxMatrix" ? args[6] / 2 : 0.5;
        const halfY = definition.geometry?.method === "addBoxMatrix" ? args[7] / 2 : 0.5;
        const halfZ = definition.geometry?.method === "addBoxMatrix" ? args[8] / 2 : 0.5;
        const flight = flights.find(/**
         *
         * @param {{minX:number,maxX:number,minZ:number,maxZ:number,floorY:number}} area
         */
          (area) => x + halfX > area.minX && x - halfX < area.maxX &&
          z + halfZ > area.minZ && z - halfZ < area.maxZ && y + halfY > area.floorY + 0.000001);
        if (flight) {
          const col = definition.tile?.col ?? Math.round(x + (mapData.cols - 1) / 2);
          const row = definition.tile?.row ?? Math.round(z + (mapData.rows - 1) / 2);
          // Retain grass-cell ownership while exposing the excavated earth below
          // the authored flight. Navigation and canopy read this same new level.
          if (mapData.grid?.[row]?.[col] === 1 && mapData.heightmap?.[row]?.[col] > flight.floorY) {
            mapData.heightmap[row][col] = flight.floorY;
            if (mapData.tileMeta?.[row]) {
              mapData.tileMeta[row][col] = {
                ...mapData.tileMeta[row][col],
                baseHeight: flight.floorY,
                surfaceType: "EARTH",
                shape: "FLAT",
                slope: undefined,
              };
            }
          }
          return false;
        }
        if (definition.object !== "Earth" || definition.tile) return true;
        return !layouts.some(
          /**
           * @param {CastleResidentialLayout} layout
           */
          (layout) => {
            const { x, y, z } = definition.position;
            const point = layout.toLocal(x, z);
            const { servantBedroom, storage } = layout.rooms;

            return y + halfY > servantBedroom.floorY + 0.000001 && y - halfY < layout.origin.y - 0.25 - 0.000001 && point.x + halfX > servantBedroom.minX + 0.000001 && point.x - halfX < storage.maxX - 0.000001 && point.z + halfZ > storage.minZ + 0.000001 && point.z - halfZ < storage.maxZ - 0.000001;
          },
        );
      },
    );
    const groundCuts = castles.flatMap(/**
     *
     * @param {import("../ObjectTypes.js").MapObjectDefinition} definition
     * @param {number} index
     */
      (definition, index) => createCastleGroundCuts(definition.buildPlan, layouts[index]));
    const cutsByTile = new Map();
    for (const cut of groundCuts) {
      for (let row = Math.max(0, Math.floor(cut.minZ + (mapData.rows - 1) / 2 - 1)); row <= Math.min(mapData.rows - 1, Math.ceil(cut.maxZ + (mapData.rows - 1) / 2 + 1)); row += 1) {
        for (let col = Math.max(0, Math.floor(cut.minX + (mapData.cols - 1) / 2 - 1)); col <= Math.min(mapData.cols - 1, Math.ceil(cut.maxX + (mapData.cols - 1) / 2 + 1)); col += 1) {
          const x = col - (mapData.cols - 1) / 2;
          const z = row - (mapData.rows - 1) / 2;
          if (x + 1 <= cut.minX || x - 1 >= cut.maxX || z + 1 <= cut.minZ || z - 1 >= cut.maxZ) continue;
          const key = `${col},${row}`;
          const list = cutsByTile.get(key) ?? [];
          list.push(cut);
          cutsByTile.set(key, list);
        }
      }
    }
    mapData.objects = mapData.objects.flatMap(/**
     *
     * @param {import("../ObjectTypes.js").MapObjectDefinition} definition
     */
      (definition) => {
        const tile = definition.tile;

        return clipCastleTerrainRecord(definition, tile ? cutsByTile.get(`${tile.col},${tile.row}`) ?? [] : groundCuts);
      });
    const turfTiles = new Set(
      mapData.objects
        .filter(CastleMapPreparation.#filterDefinition2)
        .map(CastleMapPreparation.#mapDefinition2),
    );
    // Foundation ownership can extend beyond the castle walls. Publish every
    // surviving turf tile, including lawn untouched by excavation, to the canopy.
    for (const key of new Set([...cutsByTile.keys(), ...turfTiles])) {
      const terrainCutouts = cutsByTile.get(key) ?? [];
      const [col, row] = key.split(",").map(Number);
      if (!mapData.tileMeta?.[row]) continue;
      const metadata = mapData.tileMeta[row][col] ?? {};
      const turf = turfTiles.has(key);
      const x = col - (mapData.cols - 1) / 2, z = row - (mapData.rows - 1) / 2;
      const intersectsTerrain = terrainCutouts.some(/**
       *
       * @param {{minX:number,maxX:number,minZ:number,maxZ:number}} cut
       */
        (cut) => x + 0.5 > cut.minX && x - 0.5 < cut.maxX && z + 0.5 > cut.minZ && z - 0.5 < cut.maxZ);
      mapData.tileMeta[row][col] = {
        ...metadata,
        terrainCutouts,
        exposedTerrain: turf,
        surfaceType: intersectsTerrain && !turf && [1, 3, 4].includes(mapData.grid[row][col]) ? "STONE" : metadata.surfaceType,
      };
    }
    CastleGroundWeathering.apply(mapData, castles, groundCuts);
    // Decoration was seeded before the authored footprint was excavated. Keep
    // plants and rocks out of the actual occupied volumes, including basements
    // and mirrored wings extending past the original tile reservation.
    mapData.objects = mapData.objects.filter(
      /**
       * @param {import("../ObjectTypes.js").MapObjectDefinition} definition
       */
      (definition) => {
        if (!["Vegetation", "StoneCluster"].includes(definition.object) || !definition.position) {
          return true;
        }
        const { x, y, z } = definition.position;
        const height = definition.object === "Vegetation" ? 2 : 1;

        return !groundCuts.some(
          /**
           * @param {import("./CastleGroundCuts.js").GroundCut} cut
           */
          (cut) => x + 0.75 > cut.minX && x - 0.75 < cut.maxX &&
            z + 0.75 > cut.minZ && z - 0.75 < cut.maxZ &&
            y + height > cut.minY && y < cut.maxY,
        );
      },
    );
    if (mapData.groundCoverData) {
      mapData.groundCoverData = mapData.groundCoverData.filter(
        /**
         * @param {{col:number,row:number}} decoration
         */
        (decoration) => DecorationPlacementRules.isGroundCoverCandidate(
          mapData.grid, mapData.heightmap, mapData.tileMeta, decoration.col, decoration.row,
        ),
      );
    }
    for (const definition of castles) {
      const residential = definition.buildPlan.metadata.runtime.residential;
      if (residential) {
        residential.buttressFootings = createCastleButtressFootings(definition.buildPlan, mapData);
      }
    }
  }
  /**
   * Restore supporting soil up to the castle base before carving underground rooms.
   * Roads retain their approach elevation; only the actual servant flight exposes the basement.
   * @param {import("../../GameContracts.js").GameMapData} mapData
   * @param {Array<import("../ObjectTypes.js").MapObjectDefinition>} castles
   * @param {Array<{minX:number,maxX:number,minZ:number,maxZ:number}>} flights
   */
  static #buryBasements(mapData, castles, flights) {
    const terrain = new Map();
    for (const record of mapData.objects ?? []) {
      if (!record.generated || !record.tile || !["Earth", "Grass"].includes(record.object)) continue;
      const key = `${record.tile.col},${record.tile.row}`;
      const records = terrain.get(key) ?? [];
      records.push(record);
      terrain.set(key, records);
    }
    for (const castle of castles) {
      const basement = castle.buildPlan.metadata.runtime.residential?.basement;
      const position = castle.buildPlan.input.position;
      const supportCuts = createCastleGroundCuts(castle.buildPlan, new CastleResidentialLayout(castle.buildPlan));
      const foundationHeight = Math.ceil(Math.max(basement?.ceilingY ?? 0, position.elevation ?? 0) - 0.000001);
      for (let row = 0; row < mapData.rows; row += 1) {
        for (let col = 0; col < mapData.cols; col += 1) {
          if (![0, 1, 3, 4].includes(mapData.grid?.[row]?.[col])) continue;
          if (mapData.tileMeta?.[row]?.[col]?.castleWeathered) continue;
          const x = col - (mapData.cols - 1) / 2;
          const z = row - (mapData.rows - 1) / 2;
          const inReservation = x + 0.5 > position.x - 1 && x - 0.5 < position.x + position.width + 1 &&
            z + 0.5 > position.z - 1 && z - 0.5 < position.z + position.depth + 1;
          const edgeWave = Math.sin((x - position.x) * 0.8 + 0.4) + Math.cos((z - position.z) * 0.7);
          const apronWidth = edgeWave > 0.3 ? 2 : 1;
          /**
           * @param {import("./CastleGroundCuts.js").GroundCut} cut
           */
          const overlapsSupportApron = (cut) => x + 0.5 > cut.minX - apronWidth && x - 0.5 < cut.maxX + apronWidth &&
            z + 0.5 > cut.minZ - apronWidth && z - 0.5 < cut.maxZ + apronWidth;
          if (!inReservation && !supportCuts.some(overlapsSupportApron)) continue;
          /**
           * @param {{cells:Array<{col:number,row:number}>}} river
           */
          const containsRiverCell = (river) => river.cells.some(/**
           * @param {{col:number,row:number}} cell
           */
            (cell) => cell.col === col && cell.row === row);
          if (mapData.riverData?.some(containsRiverCell)) continue;
          /**
           *
           * @param {{minX:number,maxX:number,minZ:number,maxZ:number}} flight
           */
          const overlapsStairFlight = (flight) => x + 0.5 > flight.minX && x - 0.5 < flight.maxX &&
            z + 0.5 > flight.minZ && z - 0.5 < flight.maxZ;
          if (flights.some(overlapsStairFlight)) continue;
          const nearWall = supportCuts.some(/**
           * @param {import("./CastleGroundCuts.js").GroundCut} cut
           */
            (cut) => x + 0.5 > cut.minX - 0.4 && x - 0.5 < cut.maxX + 0.4 &&
            z + 0.5 > cut.minZ - 0.4 && z - 0.5 < cut.maxZ + 0.4);
          const target = Math.max(1, foundationHeight - (nearWall || inReservation || edgeWave > 0.7 ? 0 : 1));
          if (!(mapData.heightmap?.[row]?.[col] < target)) continue;
          const records = terrain.get(`${col},${row}`) ?? [];
          const previous = records.reduce(
            CastleMapPreparation.#reduceHeight,
            0,
          );
          for (const record of records) {
            if (record.object !== "Grass") continue;
            record.object = "Earth";
            record.geometry.args[0] = "earth";
            record.geometry.args[1] = `earthSide:${col}:${row}:${Math.floor(record.position.y)}`;
          }
          const firstLevel = mapData.grid[row][col] === 0 ? -2 - Math.round((edgeWave + 2) / 2) : Math.ceil(previous);
          for (let level = firstLevel; level < target; level += 1) {
            const turf = level === target - 1;
            mapData.objects.push({
              id: `castle-soil-${col}-${row}-${level}`,
              generated: true,
              object: turf ? "Grass" : "Earth",
              tile: {
                col,
                row,
              },
              position: {
                x,
                y: level + 0.5,
                z,
              },
              geometry: {
                method: "addCubeMatrix",
                args: [turf ? `grass:${col}:${row}:${level}` : "earth", `${turf ? "turfSide" : "earthSide"}:${col}:${row}:${level}`, x, level + 0.5, z, "full", "earth", turf ? GRASS_SURFACE_LIFT : 0],
              },
            });
          }
          mapData.grid[row][col] = mapData.grid[row][col] === 0 ? 1 : mapData.grid[row][col];
          mapData.heightmap[row][col] = target;
          if (mapData.tileMeta?.[row]) mapData.tileMeta[row][col] = {
            ...mapData.tileMeta[row][col],
            baseHeight: target,
            surfaceType: "GRASS",
            shape: "FLAT",
            slope: undefined,
          };
        }
      }
    }
  }
  /**
   * Matches CastleStairs' two-block tread run and each actual entry's elevation.
   * @param {import("../../generator/castle/CastleBuildPlanWriter.js").CastleBuildPlan} plan
   * @param {import("../../GameContracts.js").GameMapData} mapData
   */
  static #exteriorStairFlights(plan, mapData) {
    const position = plan.input.position;
    const entries = [...(plan.input.doors ?? [])];
    const serviceEntry = plan.metadata.runtime.residential?.serviceEntry;
    if (serviceEntry) entries.push(serviceEntry);
    return entries.map(/**
     * @param {import("../ObjectTypes.js").CastleDoorDefinition} door
     */ (door) => {
        const flight = createCastleStairFlight(position, door, 0.25, mapData);
        if (flight) {
          door.stairOffset = flight.offset;
          door.stairWidth = flight.width;
        }
        return flight;
      }).filter(Boolean);
  }

  /**
   * @param {import("../ObjectTypes.js").MapObjectDefinition} definition
   */
  static #filterDefinition(definition) {
    return (
      definition.object === "Castle" && definition.buildPlan?.input?.position
    );
  }

  /**
   * @param {import("../ObjectTypes.js").MapObjectDefinition} definition
   */
  static #mapDefinition(definition) {
    return new CastleResidentialLayout(definition.buildPlan);
  }

  /**
   *
   * @param {import("../ObjectTypes.js").MapObjectDefinition} definition
   */
  static #filterDefinition2(definition) {
    return (
      definition.generated && definition.object === "Grass" && definition.tile
    );
  }

  /**
   *
   * @param {import("../ObjectTypes.js").MapObjectDefinition} definition
   */
  static #mapDefinition2(definition) {
    return `${definition.tile.col},${definition.tile.row}`;
  }

  /**
   *
   * @param {number} height
   * @param {import("../ObjectTypes.js").MapObjectDefinition} record
   */
  static #reduceHeight(height, record) {
    return Math.max(height,
      record.position.y + (record.geometry?.method === "addBoxMatrix" ? record.geometry.args[7] / 2 : 0.5));
  }
}
