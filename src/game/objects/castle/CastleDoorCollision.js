/**
 * The authored planks own the moving door's collision. Camera queries use the
 * same boxes because the camera is not an Ammo body.
 * @param {typeof import("playcanvas")} pc
 * @param {import("playcanvas").Entity} door
 */
export function createCastleDoorCollision(pc, door) {
  const parts = [];
  for (const render of door.findComponents("render")) {
    if (!render.entity.name.includes("door plank")) continue;
    const positions = [];
    for (const instance of render.meshInstances) instance.mesh.getPositions(positions);
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
    part.setLocalPosition(...max.map(/**
     *
     * @param {number} value
     * @param {number} axis
     */
    (value, axis) => (value + min[axis]) / 2));
    part.addComponent("collision", { type: "box", halfExtents: new pc.Vec3(...half) });
    render.entity.addChild(part);
    part.addComponent("rigidbody", { type: "kinematic", friction: 0, restitution: 0 });
    parts.push({ entity: part, half });
  }
  const point = new pc.Vec3(), inverse = new pc.Mat4(), scale = new pc.Vec3();
  return {
    /**
     * @param {number} x
     * @param {number} y
     * @param {number} z
     * @param {number} radius
     */
    blocksAt(x, y, z, radius) {
      return parts.some(/**
       *
       * @param {{entity: import("playcanvas").Entity, half: number[]}} options
       * @param {import("playcanvas").Entity} options.entity
       * @param {number[]} options.half
       */
      ({ entity, half }) => {
        const transform = entity.getWorldTransform();
        inverse.copy(transform).invert().transformPoint(point.set(x, y, z), point);
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
