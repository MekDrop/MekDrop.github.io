/**
 * Prop-local contact points, transformed using the prop's actual scale.
 */
export class TerracePropGrip {
  /**
   * @type {WeakMap<import("playcanvas").Mesh, number[][]>}
   */
  static #supportSamples = new WeakMap();
  /**
   * @param {typeof import("playcanvas")} pc
   * @param {import("playcanvas").Entity} stage
   * @param {import("playcanvas").Entity} prop
   * @param {import("./TerraceActor.js").TerraceActor} actor
   * @param {number[][]} grips
   * @param {string|null} side
   * @param {number} radius Prop-local grip thickness.
   * @param {number} pitch Carrying tilt in degrees.
   * @param {number} yaw Cargo orientation relative to the carrier.
   * @param {import("playcanvas").Entity[]} contents Items moving with the prop.
   * @returns {import("playcanvas").Vec3}
   */
  static carryPosition(pc, stage, prop, actor, grips, side = null, radius = 0.035, pitch = 0, yaw = 0, contents = []) {
    actor.prepareGrip?.(radius * prop.getWorldTransform().getScale().x, side);
    const hand = side === "right" ? actor.rightHand : actor.leftHand;
    const midpoint = hand.getPosition().clone();
    if (!side) {
      midpoint.lerp(midpoint, actor.rightHand.getPosition(), 0.5);
    }
    const anchor = new pc.Vec3(...grips[0]);
    if (grips.length > 1) {
      anchor.lerp(anchor, new pc.Vec3(...grips[1]), 0.5);
    }
    const tilt = new pc.Quat().setFromEulerAngles(pitch, yaw, 0);
    const facing = actor.carryRotation ?? actor.entity.getRotation();
    const rotation = facing.clone().mul(tilt);
    const offset = rotation.transformVector(
      anchor.mul(prop.getWorldTransform().getScale()),
    );
    const position = midpoint.sub(offset);
    // Measure the complete cargo, including its legs/back, in the carrier's
    // facing direction. Palm contact alone says nothing about body clearance.
    if (!side && actor.model) {
      const inverse = prop.getWorldTransform().clone().invert();
      const scale = prop.getWorldTransform().getScale();
      const renders = [prop, ...contents].flatMap(/**
       * @param {import("playcanvas").Entity} item
       */ item => item.findComponents("render"));
      let rear = Infinity;
      let halfWidth = 0;
      for (const render of renders) {
        for (const mesh of render.meshInstances) {
          const bounds = new pc.BoundingBox();
          bounds.setFromTransformedAabb(mesh.mesh.aabb,
            new pc.Mat4().mul2(new pc.Mat4().setTRS(pc.Vec3.ZERO, tilt, pc.Vec3.ONE),
              new pc.Mat4().mul2(inverse, mesh.node.getWorldTransform())));
          rear = Math.min(rear, (bounds.center.z - bounds.halfExtents.z) * scale.z);
          halfWidth = Math.max(halfWidth, (Math.abs(bounds.center.x) + bounds.halfExtents.x) * scale.x);
        }
      }
      if (Number.isFinite(rear)) {
        const forward = facing.transformVector(new pc.Vec3(0, 0, 1));
        const height = actor.height * actor.entity.getWorldTransform().getScale().y;
        const distance = position.clone().sub(actor.carryOrigin ?? actor.entity.getPosition()).dot(forward);
        // Keep the load ahead of the torso without pushing its grips out of reach.
        const clearance = height * 0.15;
        position.add(forward.mulScalar(Math.max(0, clearance - rear - distance)));
        actor.carryTurnRadius = halfWidth + 0.06;
        TerracePropGrip.#clearTreads(pc, renders, actor, position, inverse, scale, rotation);
      }
    }

    return stage.getWorldTransform().clone().invert().transformPoint(position);
  }

  /**
   * Raise the actual low mesh vertices above the treads ahead of the feet.
   * @param {typeof import("playcanvas")} pc
   * @param {import("playcanvas").RenderComponent[]} renders
   * @param {import("./TerraceActor.js").TerraceActor} actor
   * @param {import("playcanvas").Vec3} position
   * @param {import("playcanvas").Mat4} inverse
   * @param {import("playcanvas").Vec3} scale
   * @param {import("playcanvas").Quat} rotation
   */
  static #clearTreads(pc, renders, actor, position, inverse, scale, rotation) {
    if (!actor.carrySupportHeight) {
      return;
    }
    let lift = 0;
    for (const render of renders) {
      for (const instance of render.meshInstances) {
        const mesh = instance.mesh;
        if (!mesh.getPositions) {
          continue;
        }
        let samples = TerracePropGrip.#supportSamples.get(mesh);
        if (!samples) {
          const vertices = [];
          mesh.getPositions(vertices);
          const cells = new Map();
          for (let index = 0; index < vertices.length; index += 3) {
            const point = vertices.slice(index, index + 3);
            // A tilted load's upper vertices can become its leading/lower edge.
            // Deduplicating vertical columns loses those contact candidates.
            cells.set(point.join(":"), point);
          }
          // Flat caps can cross a tread between their boundary vertices.
          // Cover their actual triangle interiors as well as the silhouette.
          const indices = [];
          mesh.getIndices?.(indices);
          const spacing = 0.02;
          for (let index = 0; index < indices.length; index += 3) {
            const a = vertices.slice(indices[index] * 3, indices[index] * 3 + 3);
            const b = vertices.slice(indices[index + 1] * 3, indices[index + 1] * 3 + 3);
            const c = vertices.slice(indices[index + 2] * 3, indices[index + 2] * 3 + 3);
            if (Math.max(a[1], b[1], c[1]) - Math.min(a[1], b[1], c[1]) > 0.00001) {
              continue;
            }
            const determinant = (b[2] - c[2]) * (a[0] - c[0]) + (c[0] - b[0]) * (a[2] - c[2]);
            if (Math.abs(determinant) < 0.00000001) {
              continue;
            }
            for (let ix = Math.ceil(Math.min(a[0], b[0], c[0]) / spacing); ix <= Math.floor(Math.max(a[0], b[0], c[0]) / spacing); ix++) {
              for (let iz = Math.ceil(Math.min(a[2], b[2], c[2]) / spacing); iz <= Math.floor(Math.max(a[2], b[2], c[2]) / spacing); iz++) {
                const x = ix * spacing;
                const z = iz * spacing;
                const u = ((b[2] - c[2]) * (x - c[0]) + (c[0] - b[0]) * (z - c[2])) / determinant;
                const v = ((c[2] - a[2]) * (x - c[0]) + (a[0] - c[0]) * (z - c[2])) / determinant;
                if (u >= -0.000001 && v >= -0.000001 && u + v <= 1.000001) {
                  const y = a[1] * u + b[1] * v + c[1] * (1 - u - v);
                  cells.set(`${ix}:${iz}:${Math.round(y * 1000000)}`, [x, y, z]);
                }
              }
            }
          }
          samples = [...cells.values()];
          TerracePropGrip.#supportSamples.set(mesh, samples);
        }
        const local = new pc.Mat4().mul2(inverse, instance.node.getWorldTransform());
        for (const sample of samples) {
          const point = local.transformPoint(new pc.Vec3(...sample)).mul(scale);
          rotation.transformVector(point, point).add(position);
          if (point.y >= actor.entity.getPosition().y + 1.5) {
            continue;
          }
          const floor = actor.carrySupportHeight(point);
          if (floor !== null) {
            lift = Math.max(lift, floor + 0.015 - point.y);
          }
        }
      }
    }
    position.y += lift;
  }

  /**
   * @param {typeof import("playcanvas")} pc
   * @param {import("playcanvas").Entity} prop
   * @param {import("./TerraceActor.js").TerraceActor} actor
   * @param {number[][]} grips
   * @param {string|null} side
   * @param {number} weight
   * @param {number[][]|null} axes Prop-local axes enclosed by the fingers.
   */
  static align(pc, prop, actor, grips, side = null, weight = 1, axes = null) {
    if (!actor.alignHand || weight <= 0) {
      return;
    }
    const points = grips.map(/**
     *
     * @param {number[]} point
     */
      (point) => prop.getWorldTransform().transformPoint(new pc.Vec3(...point)));
    const directions = axes?.map(/**
     * @param {number[]} axis
     */ axis => prop.getRotation().transformVector(new pc.Vec3(...axis)).normalize());
    if (side) {
      const hand = side === "right" ? actor.rightHand : actor.leftHand;
      actor.alignHand(side, hand.getPosition().clone().lerp(hand.getPosition(), points[0], weight), directions?.[0]);

      return;
    }
    const left = actor.leftHand.getPosition().clone();
    const right = actor.rightHand.getPosition().clone();
    if (left.distance(points[1]) + right.distance(points[0]) < left.distance(points[0]) + right.distance(points[1])) {
      points.reverse();
      directions?.reverse();
    }
    actor.alignHand("left", left.clone().lerp(left, points[0], weight), directions?.[0]);
    actor.alignHand("right", right.clone().lerp(right, points[1], weight), directions?.[1]);
  }
}
