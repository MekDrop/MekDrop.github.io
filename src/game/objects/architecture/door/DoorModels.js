import modelUrl from "../../../models/castle/leisure/terrace-door.glb?url";
import frameModelUrl from "../../../models/castle/leisure/terrace-stairhead.glb?url";
import { CASTLE_DOOR_ANIMATION } from "../../../enum/CastleDoorAnimation.js";

/**
 * @type {Partial<import("./DoorTypes.js").DoorOptions>}
 */
export const terraceDoorModel = {
  modelUrl,
  frameModelUrl,
  name: "Terrace stairhead",
  animationName: CASTLE_DOOR_ANIMATION.OPEN,
  automatic: false,
  openSpeed: 3,
  hingeName: "Terrace door hinge",
  handleName: "Terrace door inside ring handle",
  leafBounds: {
    width: 1,
    height: 1.25,
    depth: 0.08,
  },
  materialBindings: [{
    material: "wall",
    names: ["Terrace stairhead frame"],
    prefixes: ["Terrace jamb block"],
  }, {
    material: "wood",
    prefixes: ["Terrace door plank"],
  }],
};
