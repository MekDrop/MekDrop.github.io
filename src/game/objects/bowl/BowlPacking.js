import { Vec3, Quat, Mat4, BoundingBox } from "playcanvas";
import { AmmoPhysicsWorld } from "playcanvas/build/playcanvas/src/framework/physics/ammo/ammo-physics-world.js";
import { UnpackableObjectError } from "../../errors/assets/index.js";

/**
 * Bakes contained objects' poses using Ammo, then releases the entire simulation.
 * The static shell uses its real hollow mesh; each item uses its convex render hull.
 */
export class BowlPacking {
  /**
   * Cook render tessellation into a compact Bullet hull before simulating contacts.
   * Feeding every coplanar voxel vertex directly to GJK makes packing pathological.
   * @param {number[]} positions
   * @returns {number[]}
   */
  static convexPoints(positions) {
    const source = new Ammo.btConvexHullShape();
    const point = new Ammo.btVector3();
    let hull;
    try {
      const seen = new Set();
      for (let index = 0; index < positions.length; index += 3) {
        const key = positions.slice(index, index + 3).join(":");
        if (seen.has(key)) { continue; }
        seen.add(key);
        point.setValue(positions[index], positions[index + 1], positions[index + 2]);
        source.addPoint(point, false);
      }
      source.recalcLocalAabb();
      source.setMargin(0);
      hull = new Ammo.btShapeHull(source);
      if (!hull.buildHull(0)) { return positions; }
      const start = Ammo.getPointer(hull.getVertexPointer()) / 4;
      const result = [];
      for (let index = 0; index < hull.numVertices(); index++) {
        const offset = start + index * 4;
        result.push(Ammo.HEAPF32[offset], Ammo.HEAPF32[offset + 1], Ammo.HEAPF32[offset + 2]);
      }
      return result;
    } finally {
      if (hull) { Ammo.destroy(hull); }
      Ammo.destroy(point);
      Ammo.destroy(source);
    }
  }
  /**
   * Read rendered geometry in a container's local coordinates.
   * @param {import("playcanvas").Entity} entity
   * @param {import("playcanvas").Entity} container
   * @returns {BowlPackingGeometry}
   */
  static geometry(entity, container) {
    const inverse = new Mat4().invert(container.getWorldTransform());
    const positions = [], indices = [];
    for (const render of entity.findComponents("render")) {
      for (const instance of render.meshInstances) {
        const local = new Mat4().mul2(inverse, instance.node.getWorldTransform());
        const vertices = [], triangles = [];
        instance.mesh.getPositions(vertices);
        instance.mesh.getIndices(triangles);
        const base = positions.length / 3;
        for (let index = 0; index < vertices.length; index += 3) {
          const point = local.transformPoint(new Vec3(vertices[index], vertices[index + 1], vertices[index + 2]));
          positions.push(point.x, point.y, point.z);
        }
        indices.push(...triangles.map(
          /**
           * @param {number} index
           */ index => index + base));
      }
    }
    if (!positions.length || positions.some(
      /**
       * @param {number} value
       */ value => !Number.isFinite(value))) {
      throw new UnpackableObjectError({ name: entity.name });
    }
    const bounds = new BoundingBox();
    bounds.compute(positions);
    return { positions, indices, bounds };
  }

  /**
   * Settles one object at a time so later drops do not begin inside earlier ones.
   * Returned poses are fixed data; no physics bodies survive this method.
   * @param {BowlPackingGeometry} shell
   * @param {BowlPackingGeometry[]} items
   * @returns {Array<{position: Vec3, rotation: Quat}>}
   */
  static settle(shell, items) {
    if (!items.length) { return []; }
    const world = new AmmoPhysicsWorld();
    const bodies = [], shapes = [];
    const poses = [];
    world.setGravity(new Vec3(0, -9.81, 0));
    world.nativeWorld.getSolverInfo().set_m_numIterations(30);
    /**
     * @param {BowlPackingGeometry} geometry
     * @param {boolean} dynamic
     * @param {Vec3} position
     * @returns {import("playcanvas").PhysicsBody}
     */
    const add = (geometry, dynamic, position) => {
      const center = dynamic ? geometry.bounds.center : Vec3.ZERO;
      const points = geometry.positions.map(
        /**
         * @param {number} value
         * @param {number} index
         */ (value, index) => value - [center.x, center.y, center.z][index % 3]);
      const shape = world.createShape({ type: "mesh", sources: [{
        id: `bowl-packing-${shapes.length}`, positions: dynamic ? BowlPacking.convexPoints(points) : points, indices: geometry.indices,
        stride: 3, base: 0, count: geometry.indices.length, convexHull: dynamic,
        position: Vec3.ZERO, rotation: Quat.IDENTITY,
      }] });
      shapes.push(shape);
      for (let index = 0; index < shape.getNumChildShapes(); index++) {
        shape.getChildShape(index).setMargin(0.0005);
      }
      const body = world.createBody({ type: dynamic ? "dynamic" : "static", shape,
        mass: dynamic ? 0.01 : 0, position, rotation: Quat.IDENTITY });
      bodies.push(body);
      world.addBody(body, dynamic ? 2 : 1, dynamic ? 1 : 2);
      body.setDamping(0.5, 0.65);
      body.setFriction(0.8);
      body.setRestitution(0);
      body.nativeBody.setSleepingThresholds(0.002, 0.02);
      return body;
    };
    try {
      add(shell, false, Vec3.ZERO);
      let top = shell.bounds.getMax().y;
      for (const [index, geometry] of items.entries()) {
        const angle = index * 2.399963;
        const radius = Math.min(shell.bounds.halfExtents.x, shell.bounds.halfExtents.z) * 0.35;
        const body = add(geometry, true, new Vec3(Math.cos(angle) * radius,
          top + geometry.bounds.halfExtents.y + 0.02, Math.sin(angle) * radius));
        const linear = new Vec3(), angular = new Vec3();
        let still = 0;
        for (let frame = 0; frame < 960 && still < 60; frame++) {
          world.step(1 / 120, 1, 1 / 120);
          body.getLinearVelocity(linear);
          body.getAngularVelocity(angular);
          still = linear.length() < 0.002 && angular.length() < 0.02 ? still + 1 : 0;
        }
        const position = new Vec3(), rotation = new Quat();
        body.getTransform(position, rotation);
        top = Math.max(top, position.y + geometry.bounds.halfExtents.length());
        poses.push({ position: position.clone().sub(rotation.transformVector(geometry.bounds.center)), rotation });
        // A disabled dynamic body still owns nonzero inverse mass and can enter
        // contact solving. Replace it with a static support before the next drop.
        const support = world.createBody({ type: "static", shape: shapes.at(-1), mass: 0,
          position, rotation });
        world.removeBody(body);
        world.destroyBody(body);
        bodies[bodies.indexOf(body)] = support;
        support.setFriction(0.8);
        world.addBody(support, 1, 2);
      }
      return poses;
    } finally {
      for (const body of bodies) { world.removeBody(body); world.destroyBody(body); }
      for (const shape of shapes) { world.destroyShape(shape); }
      world.destroy();
    }
  }
}

/**
 * @typedef {{positions: number[], indices: number[], bounds: BoundingBox}} BowlPackingGeometry
 */
