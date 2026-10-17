import { createDoorCollision } from "./DoorCollision.js";
import interiorDoorUrl from "../../../models/castle/doors/interior-doors.glb?url";
import castleDoorsModelUrl from "../../../models/castle/doors/castle-doors.glb?url";
import roundedEntranceUrl from "../../../models/castle/doors/entrance-rounded.glb?url";
import pointedEntranceUrl from "../../../models/castle/doors/entrance-pointed.glb?url";
import { CASTLE_DOOR_ANIMATION } from "../../../enum/CastleDoorAnimation.js";
import entranceMasonryShader from "./DoorMasonry.frag?raw";
import entranceMasonryWgsl from "./DoorMasonry.wgsl?raw";

const DOOR_INSET = -0.18;
const DOOR_HEIGHT = 2.3;

export class DoorPlacement {
  /**
   *
   * @returns {string}
   */
  static get modelUrl() {
    return castleDoorsModelUrl;
  }

  /**
   * @returns {string[]}
   */
  static get modelUrls() {
    return [castleDoorsModelUrl, interiorDoorUrl, roundedEntranceUrl, pointedEntranceUrl];
  }

  /**
   *
   * @param {{pc: typeof import("playcanvas"), castlePosition: {x: number, z: number, width: number, depth: number, elevation: number}, door: import("src/game/objects/ObjectTypes.js").CastleDoorDefinition, modelLibrary: import("../../../models/GameModelLibrary.js").GameModelLibrary}} options
   * @param {typeof import("playcanvas")} options.pc
   * @param {{x: number, z: number, width: number, depth: number, elevation: number}} options.castlePosition
   * @param {import("src/game/objects/ObjectTypes.js").CastleDoorDefinition} options.door
   * @param {import("../../../models/GameModelLibrary.js").GameModelLibrary} options.modelLibrary
   * @param {{x: number, y: number, z: number, yaw: number, height: number, arched?: boolean, mirrored?: boolean, frameOffset?:number,openWide?:boolean,frameClearance?:number}|null} options.placement
   * @param {boolean} options.bundledEntrance Use the complete stone-and-timber entrance.
   * @param {Map<string, import("playcanvas").Material>|null} options.masonryMaterials
   * @returns {import("./DoorTypes.js").DoorOptions}
   */
  static create({ pc, castlePosition, door, modelLibrary, placement = null, bundledEntrance = false, masonryMaterials = null }) {
    const exteriorEntrance = bundledEntrance || !placement;

    const width = door.width;
    const framedInterior = Boolean(placement && !placement.arched);
    const height = framedInterior ? placement.height * DOOR_HEIGHT / 2.4 : placement?.height ?? DOOR_HEIGHT;
    const upperFloor = Boolean(placement);
    const elevated = Boolean(placement && placement.y > castlePosition.elevation + 0.24);
    const angle = (placement?.yaw ?? 0) * Math.PI / 180;
    const geometry = placement ? {
      center: {
        x: placement.x,
        y: placement.y,
        z: placement.z,
      },
      inward: {
        x: Math.sin(angle),
        z: Math.cos(angle),
      },
      tangent: {
        x: Math.cos(angle),
        z: -Math.sin(angle),
      },
      baseYaw: placement.yaw,
    } : DoorPlacement.#doorGeometry(castlePosition, door);

    if (placement?.openingInset) {
      geometry.center.x -= geometry.inward.x * placement.openingInset;
      geometry.center.z -= geometry.inward.z * placement.openingInset;
    }
    if (framedInterior) {
      // The frame extends behind the leaf into the quarter-metre wall.
      // Seat the inset leaf and its edge hinge within the wall depth.
      geometry.center.x += geometry.inward.x * (placement.frameOffset ?? 0.155);
      geometry.center.z += geometry.inward.z * (placement.frameOffset ?? 0.155);
    }
    if (bundledEntrance) {
      // Seat the complete reveal in the outer wall; its threshold top is floor zero.
      geometry.center.x -= geometry.inward.x * 0.15;
      geometry.center.z -= geometry.inward.z * 0.15;
    }

    let archMaterial = null;
    const entranceUrl = door.style === "pointed" ? pointedEntranceUrl : roundedEntranceUrl;
    const modelUrl = bundledEntrance ? entranceUrl : placement && !placement.arched ? interiorDoorUrl : castleDoorsModelUrl;
    const entity = modelLibrary.instantiate(modelUrl);
    if (bundledEntrance && masonryMaterials) {
      const stone = masonryMaterials.get("castleStoneMid");
      // Radial stone joints are authored in the arch mesh, rather than wall courses.
      archMaterial = new pc.StandardMaterial();
      archMaterial.diffuse.copy(stone.diffuse);
      archMaterial.diffuseVertexColor = true;
      archMaterial.gloss = stone.gloss;
      archMaterial.useMetalness = true;
      archMaterial.metalness = 0;
      archMaterial.forceUv1 = true;
      archMaterial.shaderChunksVersion = pc.version.split(".").slice(0, 2).join(".");
      archMaterial.getShaderChunks(pc.SHADERLANGUAGE_GLSL).set("diffusePS", entranceMasonryShader);
      archMaterial.getShaderChunks(pc.SHADERLANGUAGE_WGSL).set("diffusePS", entranceMasonryWgsl);
      archMaterial.update();
      for (const render of entity.findComponents("render")) {
        if (!render.entity.name.startsWith("Entrance masonry")) {
          continue;
        }
        const material = render.entity.name.startsWith("Entrance masonry arch") ||
            render.entity.name.startsWith("Entrance masonry course")
          ? archMaterial : stone;
        for (const instance of render.meshInstances) {
          instance.material = material;
          if (material === archMaterial) {
            instance.setParameter("uStoneFaceSize", render.entity.name.startsWith("Entrance masonry arch")
              ? [Math.PI * 0.97 / 11, 0.28] : [0.28, 1.704 / 7]);
          }
        }
      }
    }
    entity.name = `Castle ${door.side.toLowerCase()} doors`;
    // Preserve the oak and iron materials authored with the entrance model.
    entity.setLocalPosition(
      geometry.center.x,
      geometry.center.y + (bundledEntrance || framedInterior ? 0 : 0.025 * height / DOOR_HEIGHT),
      geometry.center.z,
    );
    entity.setLocalEulerAngles(0, geometry.baseYaw + (!bundledEntrance && placement?.arched && placement.swing === "inward" ? 180 : 0), 0);
    if (placement) {
      // The authored frame is 0.5 m deep. At half scale both casing faces
      // coincide with the 0.25 m wall. Give each face physical clearance,
      // including the back casing; moving the frame only fixes one side.
      entity.setLocalScale((placement.mirrored ? -1 : 1) * width / 2, height / DOOR_HEIGHT, framedInterior ? 0.54 : width / 2);
    }
    if (framedInterior) {
      // Wider masonry reveals need wider outer casing, with the inner jamb
      // edges unchanged so the leaf retains its full swing clearance.
      const extension = (placement.frameClearance ?? 0) / width;
      if (extension > 0) {
        for (const name of ["Interior oak hinge jamb", "Interior oak latch jamb"]) {
          const jamb = entity.findByName(name);
          const position = jamb.getLocalPosition().clone();
          position.x += Math.sign(position.x) * extension / 2;
          jamb.setLocalPosition(position);
          jamb.setLocalScale(1 + extension / 0.168, 1, 1);
        }
        const header = entity.findByName("Interior oak header");
        header.setLocalScale(1 + extension / 1.18, 1, 1);
      }
      // Raise only the moving leaf: jambs meet the floor, while the leaf clears
      // the floor finish throughout its swing.
      const hinge = entity.findByName("Right interior door hinge");
      const position = hinge.getLocalPosition().clone();
      position.y += 0.03;
      hinge.setLocalPosition(position);
    }
    return {
      entity,
      modelLibrary,
      modelUrl,
      animationName: placement?.openWide === false ? CASTLE_DOOR_ANIMATION.OPEN : CASTLE_DOOR_ANIMATION.OPEN_WIDE,
      collision: () => createDoorCollision(pc, entity),
      center: geometry.center,
      inward: geometry.inward,
      tangent: geometry.tangent,
      width,
      height,
      upperFloor,
      elevated,
      exteriorEntrance,
      ownedMaterials: archMaterial ? [archMaterial] : [],
    };
  }

  /**
   *
   * @param {{x: number, z: number, width: number, depth: number, elevation: number}} castlePosition
   * @param {import("src/game/objects/ObjectTypes.js").CastleDoorDefinition} door
   */
  static #doorGeometry(castlePosition, door) {
    const geometryBySide = {
      WEST: {
        center: {
          x: castlePosition.x + DOOR_INSET,
          y: castlePosition.elevation,
          z: castlePosition.z + door.offset + door.width / 2,
        },
        inward: {
          x: 1,
          z: 0,
        },
        tangent: {
          x: 0,
          z: 1,
        },
        baseYaw: 90,
      },
      EAST: {
        center: {
          x: castlePosition.x + castlePosition.width - DOOR_INSET,
          y: castlePosition.elevation,
          z: castlePosition.z + door.offset + door.width / 2,
        },
        inward: {
          x: -1,
          z: 0,
        },
        tangent: {
          x: 0,
          z: 1,
        },
        baseYaw: -90,
      },
      NORTH: {
        center: {
          x: castlePosition.x + door.offset + door.width / 2,
          y: castlePosition.elevation,
          z: castlePosition.z + DOOR_INSET,
        },
        inward: {
          x: 0,
          z: 1,
        },
        tangent: {
          x: 1,
          z: 0,
        },
        baseYaw: 0,
      },
      SOUTH: {
        center: {
          x: castlePosition.x + door.offset + door.width / 2,
          y: castlePosition.elevation,
          z: castlePosition.z + castlePosition.depth - DOOR_INSET,
        },
        inward: {
          x: 0,
          z: -1,
        },
        tangent: {
          x: 1,
          z: 0,
        },
        baseYaw: 180,
      },
    };

    return geometryBySide[door.side];
  }

}
