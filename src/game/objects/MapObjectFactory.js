import { CandleStand } from "./castle-props/candle-stand/CandleStand.js";
import { Book } from "./castle-props/book/Book.js";
import { Fire } from "./fire/Fire.js";
import { WarMapDrawing } from "./castle-props/war-map-drawing/WarMapDrawing.js";
import { Table } from "./castle-props/table/Table.js";
import { StraightStaircase } from "./straight-staircase/StraightStaircase.js";
import { Ladder } from "./ladder/Ladder.js";
import { SignalBell } from "./signal-bell/SignalBell.js";
import { BedsideDrawers } from "./castle-props/bedside-drawers/BedsideDrawers.js";
import { Rug } from "./castle-props/rug/Rug.js";
import { FoldedLinens } from "./castle-props/folded-linens/FoldedLinens.js";
import { Basket } from "./castle-props/basket/Basket.js";
import { ClothRoll } from "./castle-props/cloth-roll/ClothRoll.js";
import { ThreadSpool } from "./castle-props/thread-spool/ThreadSpool.js";
import { Bench } from "./castle-props/bench/Bench.js";
import { Banner } from "./castle-props/banner/Banner.js";
import { StandingArmor } from "./castle-props/standing-armor/StandingArmor.js";
import { TravelKit } from "./castle-props/travel-kit/TravelKit.js";
import { Satchel } from "./castle-props/satchel/Satchel.js";
import { Boots } from "./castle-props/boots/Boots.js";
import { VestibuleStickStand } from "./castle-props/vestibule-stick-stand/VestibuleStickStand.js";
import { VestibuleCloakRail } from "./castle-props/vestibule-cloak-rail/VestibuleCloakRail.js";
import { ChoppingToolsSet } from "./castle-props/chopping-tools-set/ChoppingToolsSet.js";
import { KitchenUtensilRail } from "./castle-props/kitchen-utensil-rail/KitchenUtensilRail.js";
import { WashBasin } from "./castle-props/wash-basin/WashBasin.js";
import { WaterBucket } from "./castle-props/water-bucket/WaterBucket.js";
import { Lectern } from "./castle-props/lectern/Lectern.js";
import { ThroneDais } from "./castle-props/throne-dais/ThroneDais.js";
import { RoyalCrest } from "./castle-props/royal-crest/RoyalCrest.js";
import { WarCouncilShield } from "./castle-props/war-council-shield/WarCouncilShield.js";
import { SpearRack } from "./castle-props/spear-rack/SpearRack.js";
import { StepStool } from "./castle-props/step-stool/StepStool.js";
import { ParchmentBundle } from "./castle-props/parchment-bundle/ParchmentBundle.js";
import { Sunbed } from "./castle-props/sunbed/Sunbed.js";
import { ServingTray } from "./castle-props/serving-tray/ServingTray.js";
import { Teapot } from "./castle-props/teapot/Teapot.js";
import { Teacup } from "./castle-props/teacup/Teacup.js";
import { Planter } from "./castle-props/planter/Planter.js";
import { Throne } from "./castle-props/throne/Throne.js";
import { Bowl } from "./castle-props/bowl/Bowl.js";
import { Apple } from "./castle-props/food/Apple.js";
import { GreenVegetable } from "./castle-props/food/GreenVegetable.js";
import { DeskGlobe } from "./castle-props/desk-globe/DeskGlobe.js";
import { DeskParchment } from "./castle-props/desk-parchment/DeskParchment.js";
import { FireplaceCauldron } from "./castle-props/fireplace-cauldron/FireplaceCauldron.js";
import { HangingFryingPan } from "./castle-props/hanging-frying-pan/HangingFryingPan.js";
import { Fireplace } from "./castle-props/fireplace/Fireplace.js";
import { Bread } from "./castle-props/bread/Bread.js";
import { PotteryJar } from "./castle-props/pottery-jar/PotteryJar.js";
import { Barrel } from "./castle-props/barrel/Barrel.js";
import { Crate } from "./castle-props/crate/Crate.js";
import { Chest } from "./castle-props/chest/Chest.js";
import { FirewoodStack } from "./castle-props/firewood-stack/FirewoodStack.js";
import { SpareTimberBundle } from "./castle-props/spare-timber-bundle/SpareTimberBundle.js";
import { Chair } from "./castle-props/chair/Chair.js";
import { Lantern } from "./castle-props/lantern/Lantern.js";
import { TowerBrazier } from "./castle-props/tower-brazier/TowerBrazier.js";
import { CliffVine } from "./vegetation/CliffVine.js";
import { WoodenFloor } from "./wooden-floor/WoodenFloor.js";
import { Flag } from "./flag/Flag.js";
import { Painting } from "./castle-props/painting/Painting.js";
import { Earth } from "./terrain/Earth.js";
import { Window } from "./window/Window.js";
import { Bookshelf } from "./castle-props/bookshelf/Bookshelf.js";
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
  [WarMapDrawing.name, WarMapDrawing],
  [StraightStaircase.name, StraightStaircase],
  [Gateway.name, Gateway],
  [Rivers.name, Rivers],
  [GroundCover.name, GroundCover],
  [Overpass.name, Overpass],
  [SpawnPoint.name, SpawnPoint],
  [IslandConnector.name, IslandConnector],
  [Rug.name, Rug],
  [FoldedLinens.name, FoldedLinens],
  [Basket.name, Basket],
  [ClothRoll.name, ClothRoll],
  [ThreadSpool.name, ThreadSpool],
  [StandingArmor.name, StandingArmor],
  [TravelKit.name, TravelKit],
  [Boots.name, Boots],
  [VestibuleStickStand.name, VestibuleStickStand],
  [VestibuleCloakRail.name, VestibuleCloakRail],
  [ChoppingToolsSet.name, ChoppingToolsSet],
  [KitchenUtensilRail.name, KitchenUtensilRail],
  [WashBasin.name, WashBasin],
  [WaterBucket.name, WaterBucket],
  [Lectern.name, Lectern],
  [ThroneDais.name, ThroneDais],
  [RoyalCrest.name, RoyalCrest],
  [WarCouncilShield.name, WarCouncilShield],
  [SpearRack.name, SpearRack],
  [StepStool.name, StepStool],
  [ParchmentBundle.name, ParchmentBundle],
  [BedsideDrawers.name, BedsideDrawers],
  [Sunbed.name, Sunbed],
  [Teapot.name, Teapot],
  [Teacup.name, Teacup],
  [Throne.name, Throne],
  [Bowl.name, Bowl],
  [Apple.name, Apple],
  [GreenVegetable.name, GreenVegetable],
  [DeskGlobe.name, DeskGlobe],
  [DeskParchment.name, DeskParchment],
  [FireplaceCauldron.name, FireplaceCauldron],
  [HangingFryingPan.name, HangingFryingPan],
  [Fireplace.name, Fireplace],
  [Bread.name, Bread],
  [PotteryJar.name, PotteryJar],
  [Barrel.name, Barrel],
  [Crate.name, Crate],
  [FirewoodStack.name, FirewoodStack],
  [SpareTimberBundle.name, SpareTimberBundle],
  [Chair.name, Chair],
  [TowerBrazier.name, TowerBrazier],
  [Flag.name, Flag],
  [WoodenFloor.name, WoodenFloor],
  [Bookshelf.name, Bookshelf],
  [Painting.name, Painting],
  [Window.name, Window],
  [Earth.name, Earth],
  [Grass.name, Grass],
  [Castle.name, Castle],
  [Banner.name, Banner],
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
  [ServingTray.name, ServingTray],
  // Attach cliff growth only after terrain population and castle excavation.
  [CliffVine.name, CliffVine],
  [Planter.name, Planter],
  [Bench.name, Bench],
  [Lantern.name, Lantern],
  [CandleStand.name, CandleStand],
  [Satchel.name, Satchel],
  [Chest.name, Chest],
  [Fire.name, Fire],
  // Expand shelf contents after castle preparation publishes its furnishings.
  [Book.name, Book],
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
     */ (definition) => MapObjectFactory.create({
        ...options,
        definition,
        runtime: {
          ...runtime,
          mapData: undefined,
        },
      });

    return new ObjectClass({
      ...options,
      runtime,
    });
  }
  /**
   * @returns {Readonly<Record<string, string>>}
   */
  static get textureUrls() {
    return Object.assign(
      {},
      ...[...new Set(OBJECT_CLASSES.values())].map(
        MapObjectFactory.#mapObjectClass,
      ),
    );
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
          MapObjectFactory.#flatMapObjectClass,
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
        items: objects.filter(MapObjectFactory.#filter),
      });
      objects.push(pickupActors);
      onCreate(pickupActors);
    }
    return objects;
  }

  /**
   * @param {MapObjectConstructor} ObjectClass
   */
  static #mapObjectClass(ObjectClass) {
    return ObjectClass.textureUrls ?? {};
  }

  /**
   *
   * @param {MapObjectConstructor} ObjectClass
   */
  static #flatMapObjectClass(ObjectClass) {
    return (
      ObjectClass.modelUrls ??
            (ObjectClass.modelUrl ? [ObjectClass.modelUrl] : [])
    );
  }

  /**
   *
   * @param {{definition: import("src/game/objects/ObjectTypes.js").MapObjectDefinition}} options
   * @param {import("src/game/objects/ObjectTypes.js").MapObjectDefinition} options.definition
   */
  static #filter({ definition }) {
    return definition;
  }
}
