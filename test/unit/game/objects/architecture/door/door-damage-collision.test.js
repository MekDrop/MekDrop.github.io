import assert from "node:assert/strict";
import test from "node:test";
import * as pc from "playcanvas";
import { createDoorCollision } from "../../../../../../src/game/objects/architecture/door/DoorCollision.js";

class PhysicsEntity extends pc.Entity {
  addComponent(type) {
    this[type] = type === "rigidbody" ? {syncEntityToBody: () => {}} : {};
  }
}

test("breaking authored leaves removes body roots and queries while retaining frame physics", () => {
  const scene = new pc.Entity("Active scene");
  scene._enabledInHierarchy = true;
  const door = new pc.Entity("Entrance");
  scene.addChild(door);
  const hinge = new pc.Entity("Left door plank hinge");
  const plank = new pc.Entity("Left castle door plank 1");
  const handle = new pc.Entity("Ring handle");
  door.addChild(hinge);
  hinge.addChild(plank);
  hinge.addChild(handle);
  const frame = new pc.Entity("Entrance masonry arch pointed");
  door.addChild(frame);
  const mesh = {getPositions: (positions) => positions.push(-.5,0,-.05,.5,2,.05)};
  door.findComponents = () => [plank,frame].map((entity) => ({
    entity,
    meshInstances:[{
      mesh,
      material:{},
    }],
  }));
  let modelReleases = 0;
  class FrameModel {
    destroy() {
      modelReleases++;
    }
  }
  class FrameMesh {
    constructor(mesh, material, node) {
      this.mesh=mesh;
      this.material=material;
      this.node=node;
    }
  }
  const collision = createDoorCollision({
    ...pc,
    Entity:PhysicsEntity,
    Model:FrameModel,
    MeshInstance:FrameMesh,
  },door);
  assert.equal(collision.blocksAt(0,1,0,.1),true);
  assert.notEqual(collision.raycast(new pc.Vec3(0,1,-2),new pc.Vec3(0,1,2)),null);
  assert.equal(frame.children.length,1);
  const frameCollider=frame.children[0];
  collision.breakLeaves();
  assert.equal(hinge.enabled,false);
  assert.equal(handle.enabled,false,"hardware follows the broken moving leaf");
  assert.equal(frame.enabled,true);
  assert.equal(frameCollider.enabled,true);
  assert.equal(door.enabled,true);
  assert.equal(collision.blocksAt(0,1,0,.1),false);
  assert.equal(collision.raycast(new pc.Vec3(0,1,-2),new pc.Vec3(0,1,2)),null);
  collision.syncFrameBodies();
  assert.equal(frameCollider.enabled,true);
  collision.destroy();
  assert.equal(modelReleases,1);
  scene.destroy();
});
