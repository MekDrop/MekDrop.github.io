import test from "node:test";
import assert from "node:assert/strict";
import { MapTestControls } from "../../../../src/game/debug/MapTestControls.js";
import { SceneObjectRegistry } from "../../../../src/game/rendering/scene/SceneObjectRegistry.js";

test("scripts receive current objects and TriggerArea-compatible context", () => {
  let objects = new SceneObjectRegistry();
  const first = { definition: { id: "castle" }, testStatus: "Closed", presses: 0 };
  objects.add("castle", first);
  const controls = new MapTestControls({ getObjects: () => objects, getMap: () => ({ mapName: "test_buttons" }), setViewport: () => {} });
  const button = { label: "Press", script: "if (active && trigger === button && map.mapName === 'test_buttons') objects.getAll('castle')[0].presses++;" };
  assert.equal(controls.execute(button), true);
  assert.equal(first.presses, 1);
  objects = new SceneObjectRegistry();
  const second = { definition: { id: "castle" }, testStatus: "Open", presses: 0 };
  objects.add("castle", second);
  controls.execute(button);
  assert.equal(second.presses, 1);
  assert.equal(first.presses, 1);
  assert.equal(controls.status("castle"), "Open");
});

test("scripts can set camera presets through the normal viewport API", () => {
  let actual;
  const modes = [];
  const controls = new MapTestControls({ getObjects: () => new SceneObjectRegistry(), getMap: () => ({}), setViewport: (value) => { actual = value; }, setFirstPerson: (value) => modes.push(value) });
  controls.execute({ label: "View", script: "camera.setFirstPerson(false); camera.setViewport({zoom: 3, rotation: 2, panX: 0, panZ: -6}); camera.setFirstPerson(true);" });
  assert.deepEqual(modes, [false, true]);
  assert.deepEqual(actual, { zoom: 3, rotation: 2, panX: 0, panZ: -6, manuallyMoved: true });
});

test("compilation and execution errors reach runtime error reporting", () => {
  const errors = [];
  const controls = new MapTestControls({ getObjects: () => new SceneObjectRegistry(), getMap: () => ({}), setViewport: () => {}, onRuntimeError: (error) => errors.push(error) });
  assert.equal(controls.execute({ label: "Invalid", script: "if (" }), false);
  assert.equal(controls.execute({ label: "Failure", script: "missingFunction();" }), false);
  assert.equal(errors.length, 2);
  assert.ok(errors[0] instanceof SyntaxError);
  assert.ok(errors[1] instanceof ReferenceError);
});
