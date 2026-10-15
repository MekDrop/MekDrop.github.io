import { Book } from "./book/Book.js";
import { Fire } from "./fire/Fire.js";
import { Table } from "./table/Table.js";
import { StraightStaircase } from "./straight-staircase/StraightStaircase.js";
import { Ladder } from "./castle/Ladder.js";
import { SignalBell } from "./signal-bell/SignalBell.js";
import { BedsideDrawers } from "./bedside-drawers/BedsideDrawers.js";
import { Rug } from "./rug/Rug.js";
import { FoldedLinens } from "./folded-linens/FoldedLinens.js";
import { SewingBasket } from "./castle-props/SewingBasket.js";
import { VestibuleBench } from "./castle-props/VestibuleBench.js";
import { VestibuleIslandBench } from "./castle-props/VestibuleIslandBench.js";
import { VestibuleBanner } from "./castle-props/VestibuleBanner.js";
import { StandingArmor } from "./standing-armor/StandingArmor.js";
import { TravelKit } from "./travel-kit/TravelKit.js";
import { VestibuleBrownSatchel } from "./castle-props/VestibuleBrownSatchel.js";
import { VestibuleOliveSatchel } from "./castle-props/VestibuleOliveSatchel.js";
import { Boots } from "./boots/Boots.js";
import { VestibuleStickStand } from "./castle-props/VestibuleStickStand.js";
import { VestibuleCloakRail } from "./castle-props/VestibuleCloakRail.js";
import { ChoppingToolsSet } from "./chopping-tools-set/ChoppingToolsSet.js";
import { KitchenUtensilRail } from "./castle-props/KitchenUtensilRail.js";
import { WashBasin } from "./wash-basin/WashBasin.js";
import { WoodenWaterBucket } from "./castle-props/WoodenWaterBucket.js";
import { WritingDesk } from "./castle-props/WritingDesk.js";
import { Lectern } from "./castle-props/Lectern.js";
import { ThroneDais } from "./castle-props/ThroneDais.js";
import { RoyalCrest } from "./castle-props/RoyalCrest.js";
import { WarCouncilShield } from "./war-council-shield/WarCouncilShield.js";
import { SpearRack } from "./castle-props/SpearRack.js";
import { LibraryStepStool } from "./castle-props/LibraryStepStool.js";
import { ParchmentBundle } from "./castle-props/ParchmentBundle.js";
import { LibraryBookStack } from "./castle-props/LibraryBookStack.js";
import { Sunbed } from "./sunbed/Sunbed.js";
import { TerraceTeaChair } from "./castle-props/TerraceTeaChair.js";
import { TerraceServingTray } from "./castle-props/TerraceServingTray.js";
import { Teapot } from "./teapot/Teapot.js";
import { Teacup } from "./teacup/Teacup.js";
import { TerracePlanter } from "./castle-props/TerracePlanter.js";
import { BlueArmchair } from "./castle-props/BlueArmchair.js";
import { Bowl } from "./bowl/Bowl.js";
import { Apple } from "./food/Apple.js";
import { GreenVegetable } from "./food/GreenVegetable.js";
import { DeskGlobe } from "./desk-globe/DeskGlobe.js";
import { DeskParchment } from "./castle-props/DeskParchment.js";
import { FireplaceCauldron } from "./castle-props/FireplaceCauldron.js";
import { FloorCandelabrum } from "./castle-props/FloorCandelabrum.js";
import { HangingFryingPan } from "./castle-props/HangingFryingPan.js";
import { Fireplace } from "./fireplace/Fireplace.js";
import { Bread } from "./bread/Bread.js";
import { SingleCandleStand } from "./castle-props/SingleCandleStand.js";
import { StoragePotteryJar } from "./castle-props/StoragePotteryJar.js";
import { TableCandles } from "./castle-props/TableCandles.js";
import { Barrel } from "./barrel/Barrel.js";
import { WoodenCrate } from "./castle-props/WoodenCrate.js";
import { WoodenStorageChest } from "./castle-props/WoodenStorageChest.js";
import { FirewoodStack } from "./firewood-stack/FirewoodStack.js";
import { SpareTimberBundle } from "./castle-props/SpareTimberBundle.js";
import { WoodenDeskChair } from "./castle-props/WoodenDeskChair.js";
import { Lantern } from "./lantern/Lantern.js";
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
import { Gateway } from "./gateway/Gateway.js";
import { Rivers } from "./water/Rivers.js";
import { GroundCover } from "./ground-cover/GroundCover.js";
import { Overpass } from "./path/Overpass.js";
import { SpawnPoint } from "./shared/SpawnPoint.js";
import { IslandConnector } from "./scenery/IslandConnector.js";
import { MapObjectDefinitions } from "./MapObjectDefinitions.js";

const OBJECT_CLASSES = new Map([
  [Table.name, Table],
  [StraightStaircase.name, StraightStaircase],
  [Gateway.name, Gateway],
  [Rivers.name, Rivers],
  [GroundCover.name, GroundCover],
  [Overpass.name, Overpass],
  [SpawnPoint.name, SpawnPoint],
  [IslandConnector.name, IslandConnector],
  [Rug.name, Rug],
  [FoldedLinens.name, FoldedLinens],
  [SewingBasket.name, SewingBasket],
  [VestibuleBench.name, VestibuleBench],
  [VestibuleIslandBench.name, VestibuleIslandBench],
  ["VestibuleMapTable", Table],
  [VestibuleBanner.name, VestibuleBanner],
  [StandingArmor.name, StandingArmor],
  [TravelKit.name, TravelKit],
  [VestibuleBrownSatchel.name, VestibuleBrownSatchel],
  [VestibuleOliveSatchel.name, VestibuleOliveSatchel],
  [Boots.name, Boots],
  [VestibuleStickStand.name, VestibuleStickStand],
  [VestibuleCloakRail.name, VestibuleCloakRail],
  [ChoppingToolsSet.name, ChoppingToolsSet],
  [KitchenUtensilRail.name, KitchenUtensilRail],
  [WashBasin.name, WashBasin],
  [WoodenWaterBucket.name, WoodenWaterBucket],
  [WritingDesk.name, WritingDesk],
  [Lectern.name, Lectern],
  [ThroneDais.name, ThroneDais],
  [RoyalCrest.name, RoyalCrest],
  [WarCouncilShield.name, WarCouncilShield],
  [SpearRack.name, SpearRack],
  ["WarMapTable", Table],
  ["LibrarySideTable", Table],
  [LibraryStepStool.name, LibraryStepStool],
  [ParchmentBundle.name, ParchmentBundle],
  [LibraryBookStack.name, LibraryBookStack],
  [BedsideDrawers.name, BedsideDrawers],
  [Sunbed.name, Sunbed],
  [TerraceTeaChair.name, TerraceTeaChair],
  [TerraceServingTray.name, TerraceServingTray],
  [Teapot.name, Teapot],
  [Teacup.name, Teacup],
  ["TeaTable", Table],
  [TerracePlanter.name, TerracePlanter],
  [BlueArmchair.name, BlueArmchair],
  [Bowl.name, Bowl],
  [Apple.name, Apple],
  [GreenVegetable.name, GreenVegetable],
  [DeskGlobe.name, DeskGlobe],
  [DeskParchment.name, DeskParchment],
  [FireplaceCauldron.name, FireplaceCauldron],
  [FloorCandelabrum.name, FloorCandelabrum],
  [HangingFryingPan.name, HangingFryingPan],
  [Fireplace.name, Fireplace],
  ["KitchenTable", Table],
  [Bread.name, Bread],
  [SingleCandleStand.name, SingleCandleStand],
  [StoragePotteryJar.name, StoragePotteryJar],
  [TableCandles.name, TableCandles],
  [Barrel.name, Barrel],
  [WoodenCrate.name, WoodenCrate],
  [WoodenStorageChest.name, WoodenStorageChest],
  [FirewoodStack.name, FirewoodStack],
  [SpareTimberBundle.name, SpareTimberBundle],
  [WoodenDeskChair.name, WoodenDeskChair],
  [TowerBrazier.name, TowerBrazier],
  [Flag.name, Flag],
  [WoodenFloor.name, WoodenFloor],
  [Bookshelf.name, Bookshelf],
  [Painting.name, Painting],
  [Window.name, Window],
  [Earth.name, Earth],
  [Grass.name, Grass],
  [Castle.name, Castle],
  [Ladder.name, Ladder],
  [SignalBell.name, SignalBell],
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
  // Normalize legacy lantern names after castle preparation publishes its props.
  [Lantern.name, Lantern],
  [Fire.name, Fire],
  // Expand shelf contents after castle preparation publishes its furnishings.
  [Book.name, Book],
  ["ClosedReadingBook", Book],
  ["OpenReadingBook", Book],
  ["TerraceReadingBook", Book],
]);

/**
 * @typedef {{new (options: {pc: typeof import("playcanvas"), app: import("playcanvas").Application, modelLibrary: import("src/game/models/GameModelLibrary.js").GameModelLibrary, definition: import("./ObjectTypes.js").MapObjectDefinition, runtime: import("./ObjectTypes.js").MapObjectRuntime}): import("./ObjectTypes.js").MapObjectLike, modelUrls?: Array<string>, modelUrl?: string}} MapObjectConstructor
 */

/**
 * Creates map objects through the class registered for each object name.
 */
export class MapObjectFactory {
  /**
   * Creates a registered object, including objects owned by another map object.
   * @param {import("./ObjectTypes.js").MapObjectOptions} options
   * @returns {import("./ObjectTypes.js").MapObjectLike}
   */
  static create(options) {
    const ObjectClass = OBJECT_CLASSES.get(options.definition.object);
    if (!ObjectClass) {
      throw new MapObjectClassNotFoundError({ object: options.definition.object });
    }
    // Terrain and ground-cover constructors publish shared resources into this
    // runtime. Cloning it per object rebuilds the whole canopy for every tile.
    const runtime = options.runtime ?? {};
    runtime.createObject ??= /**
     * @param {import("./ObjectTypes.js").MapObjectDefinition} definition
     */ (definition) => MapObjectFactory.create({ ...options, definition,
      runtime: { ...runtime, mapData: undefined } });
    return new ObjectClass({ ...options, runtime });
  }
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
    MapObjectDefinitions.prepare(mapData);
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
      const object = MapObjectFactory.create({
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
