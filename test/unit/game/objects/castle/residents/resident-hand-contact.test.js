import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { it } from "node:test";
import * as pc from "playcanvas";
import { ResidentHandContact } from "../../../../../../src/game/objects/castle/residents/ResidentHandContact.js";

for (const variant of ["servant", "elder-servant"]) {
  it(`${variant} fits fingers to grip thickness and restores every adjusted joint and socket`, () => {
    const buffer = readFileSync(new URL(`../../../../../../src/game/models/castle/leisure/${variant}.glb`, import.meta.url));
    const gltf = JSON.parse(buffer.subarray(20, 20 + buffer.readUInt32LE(12)));
    const nodes = gltf.nodes.map((definition) => {
      const node = new pc.Entity(definition.name);
      node.setLocalPosition(...(definition.translation ?? [0, 0, 0]));
      node.setLocalRotation(new pc.Quat(...(definition.rotation ?? [0, 0, 0, 1])));
      node.setLocalScale(...(definition.scale ?? [1, 1, 1]));

      return node;
    });
    gltf.nodes.forEach((definition, index) => {
      for (const child of definition.children ?? []) {
        nodes[index].addChild(nodes[child]);
      }
    });
    const model = new pc.Entity();
    for (const index of gltf.scenes[gltf.scene].nodes) {
      model.addChild(nodes[index]);
    }
    const contact = new ResidentHandContact(pc, model);
    const finger = model.findByName("mixamorig:LeftHandMiddle2");
    const socket = model.findByName("Servant left grip");
    const originalRotation = finger.getLocalRotation().clone();
    const originalPosition = socket.getLocalPosition().clone();
    contact.grasp("left", 0.015);
    const tight = finger.getLocalRotation().clone();
    const grasp = socket.getLocalPosition().clone();
    contact.grasp("left", 0.015);
    assert.ok(socket.getLocalPosition().distance(grasp) < 0.000001, "repeated fitting must not drift");
    contact.restore();
    assert.ok(finger.getLocalRotation().equals(originalRotation));
    assert.ok(socket.getLocalPosition().equals(originalPosition));
    contact.grasp("left", 0.07);
    assert.ok(!finger.getLocalRotation().equals(tight), "a thick rail needs a different curl from a thin handle");
    const target = socket.getPosition().clone().add(new pc.Vec3(0, 0.01, 0.01));
    contact.apply("left", target);
    assert.ok(socket.getPosition().distance(target) < 0.0001, "the grasp stays attached while the arm is fitted");
    const shoulder = model.findByName("Royal left arm rig");
    const turnedTarget = socket.getPosition().clone().lerp(socket.getPosition(), shoulder.getPosition(), 0.2);
    contact.apply("left", turnedTarget, pc.Vec3.UP);
    const hinge = model.findByName("mixamorig:LeftHandMiddle1").getRotation().transformVector(pc.Vec3.RIGHT);
    assert.ok(Math.abs(hinge.dot(pc.Vec3.UP)) > 0.9999, "the fingers must enclose the actual vertical rail axis");
    assert.ok(socket.getPosition().distance(turnedTarget) < 0.0001, "rotating the wrist must preserve grip contact");
    contact.restore();
    contact.grasp("left", 0.02);
    const elbow = model.findByName("Servant left elbow");
    const wrist = model.findByName("Royal left hand");
    const clavicle = shoulder.parent;
    const clavicleRotation = clavicle.getLocalRotation().clone();
    const head = model.findByName("Royal head rig").getPosition().clone();
    const upper = shoulder.getPosition().distance(elbow.getPosition());
    const lower = elbow.getPosition().distance(wrist.getPosition());
    const lateral = shoulder.getPosition().clone().sub(clavicle.getPosition()).normalize();
    const forward = new pc.Vec3().cross(lateral, pc.Vec3.UP).normalize();
    const extended = shoulder.getPosition().clone().add(forward.mulScalar(upper + lower + 0.025))
      .add(socket.getPosition().clone().sub(wrist.getPosition()));
    contact.apply("left", extended);
    assert.ok(socket.getPosition().distance(extended) < 0.0001, "the clavicle supplies a reachable grasp beyond the two-segment arm");
    assert.ok(Math.abs(shoulder.getPosition().distance(elbow.getPosition()) - upper) < 0.00001);
    assert.ok(Math.abs(elbow.getPosition().distance(wrist.getPosition()) - lower) < 0.00001);
    assert.ok(model.findByName("Royal head rig").getPosition().distance(head) < 0.00001);
    contact.restore();
    assert.ok(clavicle.getLocalRotation().equals(clavicleRotation));
    assert.ok(socket.getLocalPosition().equals(originalPosition));
    model.destroy();
  });
}
