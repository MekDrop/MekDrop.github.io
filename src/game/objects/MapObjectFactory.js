import { SeatedRoyal } from "./castle/SeatedRoyal.js";
import { Castle } from "./castle/Castle.js";
import { MapObjectClassNotFoundError } from "../errors/debug/index.js";
import { GroundCoverItem } from "./ground-cover/GroundCoverItem.js";
import { Hero } from "./hero/Hero.js";
import { King } from "./royal/king/King.js";
import { Princess } from "./royal/princess/Princess.js";
import { Queen } from "./royal/queen/Queen.js";
import { StoneCluster } from "./scenery/StoneCluster.js";
import { Servant } from "./servant/Servant.js";
import { WoodenSign } from "./scenery/WoodenSign.js";
import { TriggerArea } from "./shared/TriggerArea.js";
import { VoxelVegetation } from "./vegetation/VoxelVegetation.js";
import { MapAnimationActor } from "../debug/MapAnimationActor.js";
import { MapPickupAnimationActors } from "../debug/MapPickupAnimationActors.js";
import { MapVirtualItem } from "../debug/MapVirtualItem.js";

const OBJECT_CLASSES = new Map([
  [Castle.name, Castle],
  [GroundCoverItem.name, MapVirtualItem],
  [Hero.name, MapAnimationActor],
  [King.name, King],
  [Princess.name, Princess],
  [Queen.name, Queen],
  [StoneCluster.name, StoneCluster],
  [TriggerArea.name, TriggerArea],
  ["Vegetation", VoxelVegetation],
  [WoodenSign.name, WoodenSign],
  [SeatedRoyal.name, MapAnimationActor],
  [Servant.name, Servant],
]);

/**
 * Creates map objects through the class registered for each object name.
 */
export class MapObjectFactory {
  static get modelUrls() {
    return [
      ...new Set(
        [...OBJECT_CLASSES.values()].flatMap(
          (ObjectClass) =>
            ObjectClass.modelUrls ??
            (ObjectClass.modelUrl ? [ObjectClass.modelUrl] : []),
        ),
      ),
    ];
  }

  static createAll({
    pc,
    app,
    modelLibrary,
    definitions,
    runtime = {},
    onCreate = () => {},
  }) {
    const objects = [];
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
        items: objects.filter(({ definition }) => definition),
      });
      objects.push(pickupActors);
      onCreate(pickupActors);
    }
    return objects;
  }
}
