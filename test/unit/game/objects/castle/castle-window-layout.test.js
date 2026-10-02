import assert from 'node:assert/strict';
import { it } from 'node:test';
import { CastleGenerator } from '../../../../../src/game/generator/castle/CastleGenerator.js';
import { CastleResidentialLayout } from '../../../../../src/game/objects/castle/CastleResidentialLayout.js';
import { CastleWindowLayout } from '../../../../../src/game/objects/castle/CastleWindowLayout.js';

it('cuts genuine apertures for every castle orientation without editing the source plan', async () => {
  for (const style of ['twin-tower', 'right-angle', 'single-tower', 'left-angle']) {
    for (const side of ['NORTH', 'SOUTH', 'WEST', 'EAST']) {
      const plan = await CastleGenerator.generate({ position: { x: -6, z: -5, width: 12, depth: 11, elevation: 3 }, doors: [{ side, offset: 5, width: 2 }], style });
      const original = JSON.stringify(plan);
      const layout = new CastleWindowLayout(plan);
      const boxes = layout.cutBoxes(plan.geometry.boxes);
      const rooms = new CastleResidentialLayout(plan);
      const front = layout.windows.filter(w => w.role === "room" && w.yaw === rooms.yaw + 180 && w.floorY === rooms.rooms.work.floorY);
      assert.ok(front.length > 0, `${style}/${side} front windows`);
      assert.ok(front.every(w => Math.abs(w.position.y - rooms.rooms.work.floorY - 1) < 1e-8));
      assert.ok(front.every(w => w.width === .5 && w.height === .75));
      assert.ok(layout.windows.some(w => w.role === 'hall'), `${style}/${side} hall`);
      assert.ok(layout.windows.some(w => w.role === 'slit'), `${style}/${side} slit`);
      for (const window of layout.windows) {
        assert.ok(window.position.y - window.floorY >= 0.9 - 1e-8);
        assert.ok(window.position.y - window.floorY <= 1.1 + 1e-8);
        assert.ok(window.position.y >= plan.layout.baseY + 0.9);
        if (window.role === "hall") assert.ok(window.height <= .75, `${style}/${side} defensive ground-floor casement`);
        assert.ok(!boxes.some(box => CastleWindowLayout.intersects(CastleWindowLayout.bounds(box), window.cut)), `${style}/${side} blocked aperture`);
      }
      assert.equal(JSON.stringify(plan), original);
      assert.ok(boxes.every(box => box.sx > 0 && box.sy > 0 && box.sz > 0));
    }
  }
});

it('preserves masonry volume outside an aperture, including partial voxel intersections', () => {
  const layout = new CastleWindowLayout({ layout: { empty: true } });
  layout.windows.push({ cut: { minX: -.2, maxX: .2, minY: -.3, maxY: .3, minZ: -.6, maxZ: .6 } });
  const box = { x: 0, y: 0, z: 0, sx: 1, sy: 1, sz: 1, yaw: 0, material: 'castleStoneMid' };
  const pieces = layout.cutBoxes([box]);
  assert.ok(Math.abs(pieces.reduce((sum, b) => sum + b.sx * b.sy * b.sz, 0) - .76) < 1e-8);
  assert.ok(pieces.every(b => !CastleWindowLayout.intersects(CastleWindowLayout.bounds(b), layout.windows[0].cut)));
});

it('uses smaller sparse rear casements with generous masonry between openings', async () => {
  const plan = await CastleGenerator.generate({ position: { x: 0, z: 0, width: 12, depth: 11, elevation: 2 }, doors: [{ side: 'NORTH', offset: 5, width: 2 }], style: 'twin-tower' });
  const rear = new CastleWindowLayout(plan).windows.filter(w => w.role === 'hall' && w.yaw === 0);
  const floor = Math.min(...rear.map(w => w.floorY));
  const windows = rear.filter(w => w.floorY === floor).sort((a, b) => a.position.x - b.position.x);
  assert.ok(windows.length >= 1 && windows.length <= 3);
  assert.ok(windows.every(w => w.height <= .75));
  assert.ok(windows[0].position.x - windows[0].width / 2 >= .75);
  assert.ok(12 - windows.at(-1).position.x - windows.at(-1).width / 2 >= .75);
  for (let i = 1; i < windows.length; i++) {
    assert.ok(windows[i].position.x - windows[i-1].position.x - windows[i].width >= 1.5 - 1e-8);
  }
});

it("exports amber glazing with alpha blending and editable matching sources", async () => {
  const { readFileSync, statSync } = await import("node:fs");
  for (const kind of ["hall", "room", "slit"]) {
    const path = new URL(`../../../../../src/game/models/castle/windows/${kind}-window`, import.meta.url);
    const data = readFileSync(new URL(`${path.href}.glb`));
    const gltf = JSON.parse(data.subarray(20, 20 + data.readUInt32LE(12)).toString());
    const glass = gltf.materials.find((material) => material.name.includes("amber glazing"));
    assert.equal(glass.alphaMode, "BLEND");
    assert.ok(glass.pbrMetallicRoughness.baseColorFactor[3] > 0 && glass.pbrMetallicRoughness.baseColorFactor[3] < 1);
    assert.ok(glass.emissiveFactor[0] > glass.emissiveFactor[2]);
    assert.equal(gltf.scenes[0].extras.sourceBlendSizeBytes, statSync(new URL(`${path.href}.blend`)).size);
    assert.equal(gltf.scenes[0].extras.zUpAuthored, true);
  }
});
