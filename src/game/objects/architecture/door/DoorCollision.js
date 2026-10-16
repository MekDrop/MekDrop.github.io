import { DoorSwingPhysics } from "./DoorSwingPhysics.js";
/**
 * The authored planks own the moving door's collision. Camera queries use the
 * same boxes because the camera is not an Ammo body.
 * @param {typeof import("playcanvas")} pc
 * @param {import("playcanvas").Entity} door
 */
export function createDoorCollision(pc, door) {
  const parts = [];
  const frameBodies = [];
  const configuredShapes = new Set();
  /**
   * Mesh assets may create their native shape after the door is constructed.
   * @param {import("playcanvas").Entity} entity
   * @param {boolean} hull
   */
  const configureMargin = (entity, hull = false) => {
    const shape = entity.collision?.shape;
    if (!shape?.getNumChildShapes) {
      return;
    }
    const key = globalThis.Ammo?.getPointer?.(shape) ?? shape;
    if (configuredShapes.has(key)) {
      return;
    }
    for (let index = 0; index < shape.getNumChildShapes(); index++) {
      const child = shape.getChildShape(index);
      child.setMargin(0.001);
      if (hull && globalThis.Ammo?.castObject) {
        globalThis.Ammo.castObject(child, globalThis.Ammo.btConvexHullShape).recalcLocalAabb();
      }
    }
    configuredShapes.add(key);
  };
  const renders = door.findComponents("render");
  const authoredLeaves = renders.some(/**
   * @param {import("playcanvas").RenderComponent} render
   */ (render) => render.entity.name.startsWith("Entrance oak plank") && render.asset);
  for (const render of renders) {
    if (render.entity.name.startsWith("Entrance masonry interior")) {
      // Use the authored masonry surface, rather than a box that fills the arch.
      // The ordinary door swing probe then sees its own frame like any nearby wall.
      const node = new pc.GraphNode("Castle entrance frame physics mesh");
      const model = new pc.Model();
      model.graph = node;
      model.meshInstances = render.meshInstances.map(/**
       * @param {import("playcanvas").MeshInstance} instance
       */ (instance) =>
          new pc.MeshInstance(instance.mesh, instance.material, node));
      const collider = new pc.Entity("Castle entrance frame collider");
      render.entity.addChild(collider);
      collider.addComponent("collision", {
        type: "mesh",
        model,
      });
      collider.addComponent("rigidbody", {
        type: "static",
        friction: 0,
        restitution: 0,
      });
      // Bullet's default mesh margin is wider than the authored door/frame clearance.
      configureMargin(collider);
      frameBodies.push({
        collider,
        model,
      });
    }
    if (render.entity.name.startsWith("Entrance collision door plank")) {
      // Authored curved-leaf columns supply collision without visible helper cubes.
      render.enabled = false;
      if (authoredLeaves) {
        continue;
      }
    }
    const curvedLeaf = authoredLeaves && render.entity.name.startsWith("Entrance oak plank");
    if (!render.entity.name.includes("door plank") && !curvedLeaf) {
      continue;
    }
    const positions = [];
    for (const instance of render.meshInstances) {
      instance.mesh.getPositions(positions);
    }
    const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
    for (let index = 0; index < positions.length; index++) {
      const axis = index % 3;
      min[axis] = Math.min(min[axis], positions[index]);
      max[axis] = Math.max(max[axis], positions[index]);
    }
    const part = new pc.Entity("Castle moving door plank collider");
    const half = max.map(/**
     *
     * @param {number} value
     * @param {number} axis
     */
      (value, axis) => (value - min[axis]) / 2);
    const center = max.map(/**
     *
     * @param {number} value
     * @param {number} axis
     */
      (value, axis) => (value + min[axis]) / 2);
    if (!curvedLeaf) {
      part.setLocalPosition(...center);
    }
    render.entity.addChild(part);
    // PlayCanvas box half-extents are physics-world dimensions; entity scale
    // affects the mesh and picking transform but does not scale the Ammo box.
    const worldScale = part.getWorldTransform().getScale();
    part.addComponent("collision", curvedLeaf ? {
      type: "mesh",
      renderAsset: render.asset,
      convexHull: true,
    } : {
      type: "box",
      halfExtents: new pc.Vec3(
        half[0] * Math.abs(worldScale.x),
        half[1] * Math.abs(worldScale.y),
        half[2] * Math.abs(worldScale.z),
      ),
    });
    part.addComponent("rigidbody", {
      type: "kinematic",
      friction: 0,
      restitution: 0,
    });
    if (curvedLeaf) {
      configureMargin(part, true);
    }
    parts.push({
      entity: part,
      half,
      center: curvedLeaf ? center : [0, 0, 0],
    });
  }
  const point = new pc.Vec3(), inverse = new pc.Mat4(), scale = new pc.Vec3();
  const swing = new DoorSwingPhysics(parts);

  return {
    swing,
    syncFrameBodies: () => {
      // The castle attaches this door after construction; use its final world pose.
      for (const { collider } of frameBodies) {
        configureMargin(collider);
        collider.rigidbody?.syncEntityToBody?.();
      }
      if (authoredLeaves) {
        for (const { entity } of parts) {
          configureMargin(entity, true);
        }
      }
    },
    destroy: () => {
      swing.destroy();
      for (const { collider, model } of frameBodies) {
        collider.destroy();
        model.destroy();
      }
    },
    /**
     * Picks the actual moving leaves, including when folded back along a wall.
     * @param {import("playcanvas").Vec3} start
     * @param {import("playcanvas").Vec3} end
     * @returns {number|null}
     */
    raycast: (start, end) => {
      let closest = null;
      const localStart = new pc.Vec3(), localEnd = new pc.Vec3();
      for (const { entity, half, center } of parts) {
        inverse.copy(entity.getWorldTransform()).invert();
        inverse.transformPoint(start, localStart);
        inverse.transformPoint(end, localEnd);
        localStart.sub(point.set(...center));
        localEnd.sub(point);
        const origin = [localStart.x, localStart.y, localStart.z];
        const destination = [localEnd.x, localEnd.y, localEnd.z];
        let near = 0, far = 1;
        for (let axis = 0; axis < 3; axis++) {
          const direction = destination[axis] - origin[axis];
          if (Math.abs(direction) < .000001) {
            if (Math.abs(origin[axis]) > half[axis]) {
              far = -1; break;
            }
            continue;
          }
          const first = (-half[axis] - origin[axis]) / direction;
          const second = (half[axis] - origin[axis]) / direction;
          near = Math.max(near, Math.min(first, second));
          far = Math.min(far, Math.max(first, second));
          if (near > far) {
            break;
          }
        }
        if (near <= far && (closest === null || near < closest)) {
          closest = near;
        }
      }

      return closest;
    },
    /**
     * @param {number} x
     * @param {number} y
     * @param {number} z
     * @param {number} radius
     */
    blocksAt: (x, y, z, radius) => {
      return parts.some(/**
       *
       * @param {{entity: import("playcanvas").Entity, half: number[], center: number[]}} options
       * @param {import("playcanvas").Entity} options.entity
       * @param {number[]} options.half
       * @param {number[]} options.center
       */
        ({ entity, half, center }) => {
          const transform = entity.getWorldTransform();
          inverse.copy(transform).invert().transformPoint(point.set(x, y, z), point);
          point.x -= center[0]; point.y -= center[1]; point.z -= center[2];
          transform.getScale(scale);
          const distance = Math.hypot(
            Math.max(Math.abs(point.x) - half[0], 0) * scale.x,
            Math.max(Math.abs(point.y) - half[1], 0) * scale.y,
            Math.max(Math.abs(point.z) - half[2], 0) * scale.z,
          );

          return distance <= radius;
        });
    },
  };
}
