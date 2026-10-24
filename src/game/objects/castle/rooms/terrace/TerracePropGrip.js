/**
 * Prop-local contact points, transformed using the prop's actual scale.
 */
export class TerracePropGrip {
  /**
   * @param {typeof import("playcanvas")} pc
   * @param {import("playcanvas").Entity} stage
   * @param {import("playcanvas").Entity} prop
   * @param {import("./TerraceActor.js").TerraceActor} actor
   * @param {number[][]} grips
   * @param {string|null} side
   * @returns {import("playcanvas").Vec3}
   */
  static carryPosition(pc, stage, prop, actor, grips, side = null) {
    const hand = side === "right" ? actor.rightHand : actor.leftHand;
    const midpoint = hand.getPosition().clone();
    if (!side) {
      midpoint.lerp(midpoint, actor.rightHand.getPosition(), 0.5);
    }
    const anchor = new pc.Vec3(...grips[0]);
    if (grips.length > 1) {
      anchor.lerp(anchor, new pc.Vec3(...grips[1]), 0.5);
    }
    const offset = actor.entity.getRotation().transformVector(
      anchor.mul(prop.getWorldTransform().getScale()),
    );

    return stage.getWorldTransform().clone().invert().transformPoint(midpoint.sub(offset));
  }

  /**
   * @param {typeof import("playcanvas")} pc
   * @param {import("playcanvas").Entity} prop
   * @param {import("./TerraceActor.js").TerraceActor} actor
   * @param {number[][]} grips
   * @param {string|null} side
   * @param {number} weight
   */
  static align(pc, prop, actor, grips, side = null, weight = 1) {
    if (!actor.alignHand || weight <= 0) {
      return;
    }
    const points = grips.map(/**
     *
     * @param {number[]} point
     */
      (point) => prop.getWorldTransform().transformPoint(new pc.Vec3(...point)));
    if (side) {
      const hand = side === "right" ? actor.rightHand : actor.leftHand;
      actor.alignHand(side, hand.getPosition().clone().lerp(hand.getPosition(), points[0], weight));

      return;
    }
    const left = actor.leftHand.getPosition().clone();
    const right = actor.rightHand.getPosition().clone();
    if (left.distance(points[1]) + right.distance(points[0]) < left.distance(points[0]) + right.distance(points[1])) {
      points.reverse();
    }
    actor.alignHand("left", left.clone().lerp(left, points[0], weight));
    actor.alignHand("right", right.clone().lerp(right, points[1], weight));
  }
}
