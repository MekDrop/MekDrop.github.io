import { VestibuleBench } from "./castle-props/VestibuleBench.js";
import { VestibuleBanner } from "./castle-props/VestibuleBanner.js";
import { VestibulePainting } from "./castle-props/VestibulePainting.js";
import { VestibuleArmorDisplay } from "./castle-props/VestibuleArmorDisplay.js";
import { VestibuleTravelKit } from "./castle-props/VestibuleTravelKit.js";
import { VestibuleBoots } from "./castle-props/VestibuleBoots.js";
import { VestibuleStickStand } from "./castle-props/VestibuleStickStand.js";
import { VestibuleCloakRail } from "./castle-props/VestibuleCloakRail.js";
import { VestibuleLantern } from "./castle-props/VestibuleLantern.js";
import { VestibuleRug } from "./castle-props/VestibuleRug.js";
import { LibrarySideTable } from "./castle-props/LibrarySideTable.js";
import { LibraryStepStool } from "./castle-props/LibraryStepStool.js";
import { ParchmentBundle } from "./castle-props/ParchmentBundle.js";
import { ClosedReadingBook } from "./castle-props/ClosedReadingBook.js";
import { LibraryBookStack } from "./castle-props/LibraryBookStack.js";
import { WritingDesk } from "./castle-props/WritingDesk.js";
import { OpenReadingBook } from "./castle-props/OpenReadingBook.js";
import { CourtLectern } from "./castle-props/CourtLectern.js";
import { ThroneDais } from "./castle-props/ThroneDais.js";
import { RoyalCrest } from "./castle-props/RoyalCrest.js";
import { WarCouncilShield } from "./castle-props/WarCouncilShield.js";
import { SpearRack } from "./castle-props/SpearRack.js";
import { WarMapTable } from "./castle-props/WarMapTable.js";
import { TerraceSunbed } from "./castle-props/TerraceSunbed.js";
import { TerraceTeaChair } from "./castle-props/TerraceTeaChair.js";
import { TerraceServingTray } from "./castle-props/TerraceServingTray.js";
import { TerraceTeapot } from "./castle-props/TerraceTeapot.js";
import { TerraceTeacup } from "./castle-props/TerraceTeacup.js";
import { TerraceReadingBook } from "./castle-props/TerraceReadingBook.js";
import { TeaTable } from "./castle-props/TeaTable.js";
import { TerracePlanter } from "./castle-props/TerracePlanter.js";
import { BedsideDrawers } from "./castle-props/BedsideDrawers.js";
import { BlueArmchair } from "./castle-props/BlueArmchair.js";
import { BowlGreenVegetables } from "./castle-props/BowlGreenVegetables.js";
import { BowlRedFruit } from "./castle-props/BowlRedFruit.js";
import { DeskGlobe } from "./castle-props/DeskGlobe.js";
import { DeskParchment } from "./castle-props/DeskParchment.js";
import { FireplaceCauldron } from "./castle-props/FireplaceCauldron.js";
import { FloorCandelabrum } from "./castle-props/FloorCandelabrum.js";
import { HangingFryingPan } from "./castle-props/HangingFryingPan.js";
import { KitchenFireplace } from "./castle-props/KitchenFireplace.js";
import { KitchenTable } from "./castle-props/KitchenTable.js";
import { PlateBread } from "./castle-props/PlateBread.js";
import { SingleCandleStand } from "./castle-props/SingleCandleStand.js";
import { StoragePotteryJar } from "./castle-props/StoragePotteryJar.js";
import { TableCandles } from "./castle-props/TableCandles.js";
import { WoodenBarrel } from "./castle-props/WoodenBarrel.js";
import { WoodenCrate } from "./castle-props/WoodenCrate.js";
import { WoodenStorageChest } from "./castle-props/WoodenStorageChest.js";
import { WoodenWaterBucket } from "./castle-props/WoodenWaterBucket.js";
import { WoodenDeskChair } from "./castle-props/WoodenDeskChair.js";
import { WallLantern } from "./castle-props/WallLantern.js";
import { EntranceLantern } from "./castle-props/EntranceLantern.js";
import { TowerBrazier } from "./castle-props/TowerBrazier.js";
import { CliffVine } from "./vegetation/CliffVine.js";
import { WoodenFloor } from "./wooden-floor/WoodenFloor.js";
import { Flag } from "./flag/Flag.js";
import { Painting } from "./painting/Painting.js";
import { Earth } from "./terrain/Earth.js";
import { Window } from "./window/Window.js";
import { Bookshelf } from "./bookshelf/Bookshelf.js";
import { Grass } from "./terrain/Grass.js";
import { SeatedRoyal } from "./castle/SeatedRoyal.js";
import { Castle } from "./castle/Castle.js";
import { MapObjectClassNotFoundError } from "../errors/debug/index.js";
import { GroundCoverItem } from "./ground-cover/GroundCoverItem.js";
import { Hero } from "./hero/Hero.js";
import { King } from "./royal/king/King.js";
import { Princess } from "./royal/princess/Princess.js";
import { Queen } from "./royal/queen/Queen.js";
import { StoneCluster } from "./scenery/StoneCluster.js";
import { SpiralStaircase } from "./spiral-staircase/SpiralStaircase.js";
import { Servant } from "./servant/Servant.js";
import { WoodenSign } from "./wooden-sign/WoodenSign.js";
import { TriggerArea } from "./shared/TriggerArea.js";
import { VoxelVegetation } from "./vegetation/VoxelVegetation.js";
import { MapAnimationActor } from "../debug/MapAnimationActor.js";
import { MapPickupAnimationActors } from "../debug/MapPickupAnimationActors.js";
import { MapVirtualItem } from "../debug/MapVirtualItem.js";

const OBJECT_CLASSES = new Map([
  [VestibuleBench.name, VestibuleBench],
  [VestibuleBanner.name, VestibuleBanner],
  [VestibulePainting.name, VestibulePainting],
  [VestibuleArmorDisplay.name, VestibuleArmorDisplay],
  [VestibuleTravelKit.name, VestibuleTravelKit],
  [VestibuleBoots.name, VestibuleBoots],
  [VestibuleStickStand.name, VestibuleStickStand],
  [VestibuleCloakRail.name, VestibuleCloakRail],
  [VestibuleLantern.name, VestibuleLantern],
  [VestibuleRug.name, VestibuleRug],
  [LibrarySideTable.name, LibrarySideTable],
  [LibraryStepStool.name, LibraryStepStool],
  [ParchmentBundle.name, ParchmentBundle],
  [ClosedReadingBook.name, ClosedReadingBook],
  [LibraryBookStack.name, LibraryBookStack],
  [WritingDesk.name, WritingDesk],
  [OpenReadingBook.name, OpenReadingBook],
  [CourtLectern.name, CourtLectern],
  [ThroneDais.name, ThroneDais],
  [RoyalCrest.name, RoyalCrest],
  [WarCouncilShield.name, WarCouncilShield],
  [SpearRack.name, SpearRack],
  [WarMapTable.name, WarMapTable],

  [TerraceSunbed.name, TerraceSunbed],
  [TerraceTeaChair.name, TerraceTeaChair],
  [TerraceServingTray.name, TerraceServingTray],
  [TerraceTeapot.name, TerraceTeapot],
  [TerraceTeacup.name, TerraceTeacup],
  [TerraceReadingBook.name, TerraceReadingBook],
  [TeaTable.name, TeaTable],
  [TerracePlanter.name, TerracePlanter],
  [BedsideDrawers.name, BedsideDrawers],
  [BlueArmchair.name, BlueArmchair],
  [BowlGreenVegetables.name, BowlGreenVegetables],
  [BowlRedFruit.name, BowlRedFruit],
  [DeskGlobe.name, DeskGlobe],
  [DeskParchment.name, DeskParchment],
  [FireplaceCauldron.name, FireplaceCauldron],
  [FloorCandelabrum.name, FloorCandelabrum],
  [HangingFryingPan.name, HangingFryingPan],
  [KitchenFireplace.name, KitchenFireplace],
  [KitchenTable.name, KitchenTable],
  [PlateBread.name, PlateBread],
  [SingleCandleStand.name, SingleCandleStand],
  [StoragePotteryJar.name, StoragePotteryJar],
  [TableCandles.name, TableCandles],
  [WoodenBarrel.name, WoodenBarrel],
  [WoodenCrate.name, WoodenCrate],
  [WoodenStorageChest.name, WoodenStorageChest],
  [WoodenWaterBucket.name, WoodenWaterBucket],
  [WoodenDeskChair.name, WoodenDeskChair],
  [WallLantern.name, WallLantern],
  [EntranceLantern.name, EntranceLantern],
  [TowerBrazier.name, TowerBrazier],
  [Flag.name, Flag],
  [WoodenFloor.name, WoodenFloor],
  [Bookshelf.name, Bookshelf],
  [Painting.name, Painting],
  [Window.name, Window],
  [Earth.name, Earth],
  [Grass.name, Grass],
  [Castle.name, Castle],
  [GroundCoverItem.name, MapVirtualItem],
  [Hero.name, MapAnimationActor],
  [King.name, King],
  [Princess.name, Princess],
  [Queen.name, Queen],
  [StoneCluster.name, StoneCluster],
  [SpiralStaircase.name, SpiralStaircase],
  [TriggerArea.name, TriggerArea],
  ["Vegetation", VoxelVegetation],
  [WoodenSign.name, WoodenSign],
  [SeatedRoyal.name, MapAnimationActor],
  [Servant.name, Servant],
  // Attach cliff growth only after terrain population and castle excavation.
  [CliffVine.name, CliffVine],
]);

/**
 * @typedef {{new (options: {pc: typeof import("playcanvas"), app: import("playcanvas").Application, modelLibrary: import("src/game/models/GameModelLibrary.js").GameModelLibrary, definition: import("./ObjectTypes.js").MapObjectDefinition, runtime: import("./ObjectTypes.js").MapObjectRuntime}): import("./ObjectTypes.js").MapObjectLike, modelUrls?: Array<string>, modelUrl?: string}} MapObjectConstructor
 */

/**
 * Creates map objects through the class registered for each object name.
 */
export class MapObjectFactory {
  /**
   * @returns {Readonly<Record<string, string>>}
   */
  static get textureUrls() {
    return Object.assign({}, ...[...new Set(OBJECT_CLASSES.values())].map(
      /**
       * @param {MapObjectConstructor} ObjectClass
       */
      (ObjectClass) => ObjectClass.textureUrls ?? {}));
  }
  /**
   * @param {number} type
   */
  static surfaceLiftForTile(type) {
    return Math.max(0, ...[...new Set(OBJECT_CLASSES.values())].map(
      /**
       * @param {MapObjectConstructor} ObjectClass
       */
      (ObjectClass) => ObjectClass.surfaceLiftForTile?.(type) ?? 0));
  }
  /**
   * @param {Array} args
   */
  static registerMaterials(...args) {
    for (const ObjectClass of new Set(OBJECT_CLASSES.values())) ObjectClass.registerMaterials?.(...args);
  }
  /**
   * @param {Array} args
   */
  static configureTexture(...args) {
    for (const ObjectClass of new Set(OBJECT_CLASSES.values())) ObjectClass.configureTexture?.(...args);
  }
  /**
   * @param {import("src/game/GameContracts.js").GameMapData} mapData
   */
  static prepareMap(mapData) {
    for (const ObjectClass of new Set(OBJECT_CLASSES.values())) {
      if (Object.hasOwn(ObjectClass, "prepareMap")) {
        ObjectClass.prepareMap(mapData);
      }
    }
  }

  /**
   *
    * @returns {Array<string>}
   */
  static get modelUrls() {
    return [
      ...new Set(
        [...OBJECT_CLASSES.values()].flatMap(
          /**
           *
           * @param {MapObjectConstructor} ObjectClass
           */
          (ObjectClass) =>
            ObjectClass.modelUrls ??
            (ObjectClass.modelUrl ? [ObjectClass.modelUrl] : []),
        ),
      ),
    ];
  }

  /**
   *
   * @param {{pc: typeof import("playcanvas"), app: import("playcanvas").Application, modelLibrary: import("src/game/models/GameModelLibrary.js").GameModelLibrary, definitions: Array<{id: string, object: string, position?: {x: number, y: number, z: number}}>, runtime: import("src/game/objects/ObjectTypes.js").MapObjectRuntime, onCreate: (mapObject: import("src/game/objects/ObjectTypes.js").MapObjectLike) => void}} options
   * @param {typeof import("playcanvas")} options.pc
   * @param {import("playcanvas").Application} options.app
   * @param {import("src/game/models/GameModelLibrary.js").GameModelLibrary} options.modelLibrary
   * @param {Array<{id: string, object: string, position?: {x: number, y: number, z: number}}>} options.definitions
   * @param {import("src/game/objects/ObjectTypes.js").MapObjectRuntime} options.runtime
   * @param {(mapObject: import("src/game/objects/ObjectTypes.js").MapObjectLike) => void} options.onCreate
   */
  static createAll({
    pc,
    app,
    modelLibrary,
    definitions,
    runtime = {},
    onCreate = () => {},
  }) {
    const objects = [];
    for (const ObjectClass of new Set(OBJECT_CLASSES.values())) {
      if (Object.hasOwn(ObjectClass, "prepareRuntime")) {
        ObjectClass.prepareRuntime(runtime);
      }
    }
    const pickupDefinitions = [];
    const vegetationDefinitions = [];
    for (const definition of definitions) {
      if (definition.object === "Vegetation") {
        vegetationDefinitions.push(definition);
        continue;
      }
      if (definition.sequence?.type === "pickup") {
        pickupDefinitions.push(definition);
        continue;
      }
      const MapObjectClass = OBJECT_CLASSES.get(definition.object);
      if (!MapObjectClass) {
        throw new MapObjectClassNotFoundError({ object: definition.object });
      }
      const object = new MapObjectClass({
        pc,
        app,
        modelLibrary,
        definition,
        runtime,
      });
      objects.push(object);
      onCreate(object);
    }
    if (vegetationDefinitions.length) {
      const vegetation = new VoxelVegetation({
        pc,
        app,
        modelLibrary,
        definitions: vegetationDefinitions,
        runtime,
      });
      objects.push(vegetation);
      onCreate(vegetation);
    }
    if (pickupDefinitions.length) {
      const pickupActors = new MapPickupAnimationActors({
        pc,
        app,
        modelLibrary,
        definitions: pickupDefinitions,
        items: objects.filter(/**
         *
         * @param {{definition: import("src/game/objects/ObjectTypes.js").MapObjectDefinition}} options
         * @param {import("src/game/objects/ObjectTypes.js").MapObjectDefinition} options.definition
         */
        ({ definition }) => definition),
      });
      objects.push(pickupActors);
      onCreate(pickupActors);
    }
    return objects;
  }
}
