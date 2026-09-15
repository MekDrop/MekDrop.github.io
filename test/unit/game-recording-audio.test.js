import assert from "node:assert/strict";
import { it } from "node:test";
import { RecordingAudio } from "../../src/game/recording/RecordingAudio.js";

function setup() {
  const destination = { stream: { getTracks: () => [track] } };
  const track = { stopped: false, stop() { this.stopped = true; } };
  const node = () => ({
    targets: new Set(),
    connect(target) { this.targets.add(target); },
    disconnect(target) {
      if (target) {
        assert.ok(this.targets.delete(target), "disconnect only a connected output");
      } else {
        this.targets.clear();
      }
    },
  });
  const silence = { ...node(), offset: { value: 1 }, start() {}, stop() {} };
  const context = {
    createMediaStreamDestination: () => destination,
    createConstantSource: () => silence,
    createGain: node,
    async resume() {},
  };
  const slot = { instances: [] };
  const app = { soundManager: { context }, root: { findComponents: () => [{ slots: { tone: slot } }] } };
  const instance = (external = null) => ({
    nodes: [external, external],
    getExternalNodes() { return this.nodes; },
    setExternalNodes(first, last) { this.nodes = [first, last]; },
    clearExternalNodes() { this.nodes = [null, null]; },
  });
  return { app, slot, instance, node, destination, track };
}

it("records existing and newly playing sounds and restores their output routing", () => {
  const f = setup();
  const existing = f.instance();f.slot.instances.push(existing);
  const recorder = new RecordingAudio(f.app);
  const later = f.instance();f.slot.instances.push(later);recorder.sync();
  assert.ok(existing.nodes[0].targets.has(f.destination));
  assert.ok(later.nodes[0].targets.has(f.destination));
  f.slot.instances.shift();recorder.sync();
  assert.deepEqual(existing.nodes, [null, null]);
  recorder.destroy();
  assert.deepEqual(later.nodes, [null, null]);
  assert.equal(f.track.stopped, true);
});

it("preserves shared existing audio effects when one overlapping sound ends", () => {
  const f = setup();const effect = f.node();const speakers = {};effect.connect(speakers);
  const first = f.instance(effect);const second = f.instance(effect);f.slot.instances.push(first, second);
  const recorder = new RecordingAudio(f.app);
  f.slot.instances.shift();recorder.sync();
  assert.ok(effect.targets.has(f.destination));
  recorder.destroy();
  assert.deepEqual([...effect.targets], [speakers]);
  assert.deepEqual(second.nodes, [effect, effect]);
});

it("provides a live audio track on silent maps without changing global audio volume", () => {
  const f = setup();const recorder = new RecordingAudio(f.app);
  assert.equal(recorder.stream.getTracks()[0], f.track);
  recorder.sync();recorder.destroy();
  assert.equal(f.track.stopped, true);
});
