import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { Mat4, Quat, Vec3 } from "playcanvas";
import { SLIME_BRIDGE_GROWTH_SECONDS, slimeBridgeTransferProgress } from "../../../../../src/game/objects/path/BridgeSlimeTiming.js";
import { bridgeSlimeLiquidEnvelope } from "../../../../../src/game/objects/path/BridgeSlimeLiquidEnvelope.js";

const source = (await readFile(new URL("../../../../../src/game/objects/path/BridgeSlimeArtwork.js", import.meta.url), "utf8"))
  .replace(/^import .*;$/gm, "")
  .replaceAll("bridgeSlimeLiquidEnvelope", `(${bridgeSlimeLiquidEnvelope.toString()})`)
  .replaceAll("SLIME_BRIDGE_GROWTH_SECONDS", String(SLIME_BRIDGE_GROWTH_SECONDS))
  .replaceAll("slimeBridgeTransferProgress", `(${slimeBridgeTransferProgress.toString().replaceAll("SLIME_BRIDGE_GROWTH_SECONDS", String(SLIME_BRIDGE_GROWTH_SECONDS))})`)
  .replace("return [firstModelUrl, secondModelUrl, thirdModelUrl];", 'return ["one", "two", "three"];');
const skinUrl = new URL("../../../../../src/game/objects/path/BridgeSlimeFluidSkin.js", import.meta.url).href;
const { BridgeSlimeArtwork } = await import(`data:text/javascript,${encodeURIComponent(`import { BridgeSlimeFluidSkin } from ${JSON.stringify(skinUrl)};\n${source}`)}`);

class Entity {
  constructor(name = "") {
    this.name = name;
    this.enabled = true;
    this.position = new Vec3();
    this.scale = new Vec3(1, 1, 1);
  }
  destroy() {}
  addChild(child) {
    this.child ??= child;
  }
  getWorldTransform() {
    return new Mat4().setTranslate(this.position.x, this.position.y, this.position.z);
  }
  setLocalPosition(x, y, z) {
    this.position = x instanceof Vec3 ? x.clone() : new Vec3(x, y, z);
  }
  setLocalScale(x, y, z) {
    this.scale = x instanceof Vec3 ? x.clone() : new Vec3(x, y, z);
  }
  getLocalPosition() {
    return this.position;
  }
  getLocalScale() {
    return this.scale;
  }
  setLocalEulerAngles(x, y, z) {
    this.angles = new Vec3(x, y, z);
  }
  addComponent(type, options) {
    if (type === "render") {
      for (const instance of options.meshInstances) {
        instance.mesh.owner = this;
      }
    }
    this.anim = {
      addAnimationState: () => {},
      baseLayer: { play: () => {} },
    };
  }
}

function fixture(withRails = false, stationOptions = {}) {
  const meshes = [];
  const materials = [];
  const plank = new Entity("Gel plank 0");
  plank.setLocalPosition(0.5, -0.065, 0);
  const rail = new Entity("Gel handrail");
  rail.setLocalPosition(1, 0.44, 0);
  const lowerRail = new Entity("Gel lower rail");
  const post = new Entity("Gel railing post");
  post.setLocalPosition(1, 0.23, 0.36);
  const eye = new Entity("Watchful eye");
  eye.setLocalPosition(1.047, -0.055, 0);
  const web = new Entity("Continuous transparent underside web");
  const stringer = new Entity("Gel longitudinal stringer");
  const parts = withRails ? [plank, rail, lowerRail, post, eye, web, stringer] : [plank];
  const model = new Entity();
  model.findComponents = () => parts.map((entity) => ({ entity }));
  const root = new Entity();
  root.setLocalPosition(3, 2, 5);
  const artwork = new BridgeSlimeArtwork({
    pc: {
      Entity,
      Vec3,
      Mat4,
      StandardMaterial: class {
        constructor() {
          materials.push(this);
        }
        update() {}
        destroy() {}
        clone() {
          return Object.assign(new this.constructor(), this);
        }
      },
      Color: class {
        constructor(r, g, b) {
          this.r = r; this.g = g; this.b = b;
        }
      },
      Mesh: class {
        constructor() {
          meshes.push(this);
        }
        destroy() {
          this.destroyed = true;
        }
        setPositions(positions) {
          this.positions = [...positions];
        }
        setColors32(colors) {
          this.colors = [...colors];
        }
        setNormals() {}
        setIndices(indices) {
          this.indices = [...indices];
        }
        update() {}
      },
      MeshInstance: class {
        constructor(mesh) {
          this.mesh = mesh;
          mesh.hadColorsAtConstruction = Boolean(mesh.colors?.length);
        }
      },
      Application: { getApplication: () => ({ graphicsDevice: {} }) },
      calculateNormals: () => [],
    },
    root,
    modelLibrary: {
      instantiate: () => model,
      getAnimationTracks: () => new Map([["Alive", {}]]),
    },
  });
  artwork.addStation({
    definition: {
      span: {
        start: 0,
        horizontal: false,
      },
    },
    station: 0,
    position: new Vec3(),
    ...stationOptions,
  });

  return {
    artwork,
    meshes,
    materials,
    plank,
    rail,
    lowerRail,
    eye,
    web,
    stringer,
    post,
    wrapper: root.child,
  };
}

test("idle updates preserve a fresh authored plank animation pose", () => {
  const { artwork, plank } = fixture();
  plank.setLocalPosition(0.5, -0.052, 0);
  artwork.update(0.016);
  assert.equal(plank.getLocalPosition().y, -0.052);
});

test("load deformation adds to animation and releases without freezing idle", () => {
  const { artwork, plank } = fixture();
  artwork.setLoads(new Map([[0, {
    compression: 0.7,
    bounce: 0,
    across: 0.5,
    along: 0,
  }]]));
  artwork.update(0.016);
  assert.ok(plank.getLocalPosition().y < -0.065);
  plank.setLocalPosition(0.5, -0.052, 0);
  artwork.update(0.016);
  assert.ok(Math.abs(plank.getLocalPosition().y - (-0.052 - 0.7 * 0.095)) < 1e-9);
  artwork.setLoads(new Map());
  artwork.update(0.016);
  assert.equal(plank.getLocalPosition().y, -0.052);
  plank.setLocalPosition(0.5, -0.058, 0);
  artwork.update(0.016);
  assert.equal(plank.getLocalPosition().y, -0.058);
});



test("live supported mass follows the physical sag in root-local coordinates", () => {
  const { artwork, wrapper } = fixture();
  artwork.setSpanPoses(new Map([[0, {
    position: new Vec3(3, 0.4, 5),
    start: new Vec3(3, 0.7, 4.6),
    end: new Vec3(3, 0.1, 5.4),
    connected: false,
    thickness: 1.4,
    width: 0.8,
  }]]));
  artwork.update(0.016);
  assert.ok(wrapper.position.equalsApprox(new Vec3(0, -1.6, 0)));
  assert.ok(wrapper.scale.equalsApprox(new Vec3(0.8, 1.4, 1)));
  assert.ok(Math.abs(wrapper.angles.x - 36.86989765) < 0.00001);
});

test("the existing mass reshapes when the far bank becomes connected", () => {
  const { artwork, wrapper } = fixture();
  const poses = new Map([[0, {
    position: new Vec3(3, 0.4, 5),
    start: new Vec3(3, 0.4, 4.5),
    end: new Vec3(3, 0.4, 5.5),
    connected: false,
    thickness: 1.4,
    width: 0.8,
  }]]);
  artwork.setSpanPoses(poses);
  artwork.update(0.016);
  poses.set(0, {
    position: new Vec3(3, 2, 5),
    start: new Vec3(3, 2, 4.5),
    end: new Vec3(3, 2, 5.5),
    connected: true,
    thickness: 1,
    width: 1,
  });
  artwork.update(0.016);
  assert.ok(wrapper.position.equalsApprox(new Vec3()));
  assert.ok(wrapper.scale.equalsApprox(new Vec3(1, 1, 1)));
});


test("connected gel rails become suspension cables and restore after detachment", () => {
  const { artwork, rail, lowerRail, post } = fixture(true);
  const pose = {
    position: new Vec3(3, 2, 5),
    start: new Vec3(3, 2, 4.5),
    end: new Vec3(3, 2, 5.5),
    connected: true,
  };
  artwork.setSpanPoses(new Map([[0, pose]]));
  artwork.update(0.016);
  assert.equal(lowerRail.enabled, false);
  assert.ok(rail.position.y > 0.44);
  assert.ok(Math.abs(rail.scale.z - 1 / 1.04) < 1e-8);
  assert.equal(post.scale.x, 0.55);
  pose.connected = false;
  artwork.update(0.016);
  assert.equal(lowerRail.enabled, false);
  assert.ok(rail.position.equals(new Vec3(1, 0.28, 0)));
  assert.ok(post.scale.equals(new Vec3(1, 0.7, 1)));
});


test("growing donors retain the worker source and follow their moving free-edge destination", () => {
  const { artwork, wrapper } = fixture(false, {
    growing: true,
    station: 1,
    sourcePosition: new Vec3(3, -3, 5),
  });
  assert.ok(wrapper.position.equals(new Vec3(0, -5, 0)));
  const neighbor = {
    position: new Vec3(3, 0, 5),
    start: new Vec3(3, 0, 4.5),
    end: new Vec3(3, 0, 5.5),
    connected: false,
  };
  artwork.setSpanPoses(new Map([[0, neighbor]]));
  artwork.update(SLIME_BRIDGE_GROWTH_SECONDS * 0.9);
  assert.ok(Math.abs(wrapper.position.y + 2) < 1e-8);
  assert.ok(Math.abs(wrapper.position.z - 1) < 1e-8);
  neighbor.position.y -= 0.7;
  neighbor.start.y -= 0.7;
  neighbor.end.y -= 0.7;
  artwork.update(0);
  assert.ok(Math.abs(wrapper.position.y + 2.7) < 1e-8);
});


test("destination starts without a second donor body and shares the full transfer interval", () => {
  const { artwork, wrapper } = fixture(false, { growing: true });
  assert.equal(wrapper.scale.x, 0);
  assert.equal(wrapper.scale.y, 0);
  assert.equal(slimeBridgeTransferProgress(0), 0);
  assert.equal(slimeBridgeTransferProgress(SLIME_BRIDGE_GROWTH_SECONDS / 2), 0.5);
  artwork.update(SLIME_BRIDGE_GROWTH_SECONDS / 2);
  assert.equal(wrapper.scale.x, 0);
  assert.equal(wrapper.scale.y, 0);
  assert.ok(slimeBridgeTransferProgress(SLIME_BRIDGE_GROWTH_SECONDS * 0.9) < 1);
  assert.equal(slimeBridgeTransferProgress(SLIME_BRIDGE_GROWTH_SECONDS), 1);
});


test("preparation follows native shape without cosmetic rail bulges or moving eyes", () => {
  const { artwork, rail, plank, wrapper, eye } = fixture(true);
  const pose = {
    position: new Vec3(3, 2, 5),
    start: new Vec3(3, 2, 4.5),
    end: new Vec3(3, 2, 5.5),
    connected: false,
    thickness: 1.35,
    width: 0.8,
    redistribution: {
      progress: 0.2,
      index: 0,
      count: 2,
      direction: 1,
    },
  };
  artwork.setSpanPoses(new Map([[0, pose]]));
  artwork.update(0.016);
  assert.equal(rail.scale.x, 1);
  assert.ok(Math.abs(eye.position.x * wrapper.scale.x - (0.94 * wrapper.scale.x + 0.018)) < 1e-8);
  assert.ok(Math.abs(eye.scale.y * wrapper.scale.y - 1) < 1e-8);
  assert.equal(rail.scale.z, 1);
  assert.ok(plank.position.equals(new Vec3(0.5, -0.065, 0)));
  assert.ok(wrapper.scale.equals(new Vec3(0.8, 1.35, 1)));
  const bankSwell = rail.scale.x;
  pose.redistribution.progress = 0.65;
  artwork.update(0.016);
  assert.equal(rail.scale.x, bankSwell);
  pose.redistribution.index = 1;
  artwork.update(0.016);
  assert.equal(rail.scale.x, bankSwell);
  pose.redistribution = null;
  artwork.update(0.016);
  assert.ok(rail.scale.equals(new Vec3(1, 1 / 1.35, 1)));
  assert.ok(rail.position.equals(new Vec3(1, 0.28 / 1.35, 0)));
});



test("joined living belly follows both physical sections and retains transferred mass", () => {
  const { artwork, meshes, plank } = fixture(true);
  const transfer = {
    progress: 0.45,
    index: 0,
    count: 2,
    direction: 1,
  };
  const first = {
    position: new Vec3(3, 2, 5),
    start: new Vec3(3, 2, 4.5),
    end: new Vec3(3, 2, 5.5),
    connected: false,
    width: 0.8,
    thickness: 1.4,
    volume: 0.75,
    redistribution: transfer,
  };
  const second = {
    position: new Vec3(3, 1.7, 6),
    start: new Vec3(3, 2, 5.5),
    end: new Vec3(3, 1.4, 6.5),
    connected: false,
    linkedPrevious: true,
    width: 1.1,
    thickness: 1.6,
    volume: 1.25,
    redistribution: {
      ...transfer,
      index: 1,
    },
  };
  artwork.setSpanPoses(new Map([[0, first], [1, second]]));
  artwork.update(0.016);
  assert.equal(meshes.length, 1);
  for (const mesh of meshes) {
    assert.equal(mesh.positions.length, 50 * 12 * 3);
    assert.ok(mesh.positions.every(Number.isFinite));
    assert.ok(Math.abs(mesh.positions[2] + 0.5) < 1e-8);
    const endpoint = (49 * 12 + 3) * 3;
    assert.ok(new Vec3(...mesh.positions.slice(endpoint, endpoint + 3)).distance(new Vec3(0, -0.6, 1.5)) < 0.03);
    assert.ok(Math.min(...mesh.positions.filter((_, index) => index % 3 === 1)) < -0.7);
  }
  first.redistribution = null;
  second.redistribution = null;
  artwork.update(0.016);
  assert.ok(meshes.every((mesh) => !mesh.destroyed));
  artwork.setSpanPoses(new Map());
  artwork.update(0.016);
  assert.ok(meshes.every((mesh) => mesh.destroyed));
});


test("redistribution streams never bridge separated or opposing construction fronts", () => {
  const { artwork, meshes } = fixture(true);
  const pose = (station, direction) => ({
    position: new Vec3(3, 2, station + 5),
    start: new Vec3(3, 2, station + 4.5),
    end: new Vec3(3, 2, station + 5.5),
    connected: false,
    redistribution: {
      progress: 0.4,
      index: 0,
      count: 1,
      direction,
    },
  });
  artwork.setSpanPoses(new Map([[0, pose(0, 1)], [4, pose(4, -1)], [5, pose(5, 1)]]));
  artwork.update(0.016);
  assert.equal(meshes.length, 3);
  for (const mesh of meshes) {
    const longitudinal = mesh.positions.filter((_, index) => index % 3 === 2);
    assert.ok(Math.max(...longitudinal) - Math.min(...longitudinal) <= 1.00001);
  }
});


test("near adjacent tissue without an admitted native link keeps separate flow skins", () => {
  const { artwork, meshes } = fixture(true);
  const first = {
    position: new Vec3(3, 2, 5),
    start: new Vec3(3, 2, 4.5),
    end: new Vec3(3, 2, 5.5),
    connected: false,
    redistribution: {
      progress: 0.4,
      index: 0,
      count: 2,
      direction: 1,
    },
  };
  const second = {
    position: new Vec3(3, 2, 6.2),
    start: new Vec3(3, 2, 5.7),
    end: new Vec3(3, 2, 6.7),
    connected: false,
    linkedPrevious: false,
    redistribution: {
      progress: 0.4,
      index: 1,
      count: 2,
      direction: 1,
    },
  };
  artwork.setSpanPoses(new Map([[0, first], [1, second]]));
  artwork.update(0.016);
  assert.equal(meshes.length, 2);
  for (const mesh of meshes) {
    const longitudinal = mesh.positions.filter((_, index) => index % 3 === 2);
    assert.ok(Math.max(...longitudinal) - Math.min(...longitudinal) <= 1.00001);
  }
});

test("visible deck skin exposes volume transfer above the framework with plank seams", () => {
  const { artwork, meshes, plank } = fixture(true);
  const transfer = {
    progress: 0.5,
    index: 0,
    count: 2,
    direction: 1,
  };
  const first = {
    position: new Vec3(3, 2, 5),
    start: new Vec3(3, 2, 4.5),
    end: new Vec3(3, 2, 5.5),
    connected: false,
    width: 0.6,
    thickness: 1.5,
    volume: 0.88,
    redistribution: transfer,
  };
  const second = {
    position: new Vec3(3, 2, 6),
    start: new Vec3(3, 2, 5.5),
    end: new Vec3(3, 2, 6.5),
    connected: false,
    linkedPrevious: true,
    width: 0.7,
    thickness: 1.7,
    volume: 1.12,
    redistribution: {
      ...transfer,
      index: 1,
    },
  };
  artwork.setSpanPoses(new Map([[0, first], [1, second]]));
  artwork.update(0.016);
  const skin = meshes[0];
  assert.equal(plank.enabled, false);
  const yAt = (ring) => skin.positions[(ring * 12 + 3) * 3 + 1];
  assert.ok(yAt(3) > 0.002 && yAt(3) <= 0.0030001);
  assert.ok(yAt(6) < yAt(3));
  const greenAt = (ring) => skin.colors[(ring * 12 + 3) * 4 + 1];
  assert.ok(greenAt(36) > greenAt(12));
});


test("gel color exists before shader creation and uses a golden translucent finish", () => {
  const { artwork, meshes, materials } = fixture(true);
  artwork.setSpanPoses(new Map([[0, {
    position: new Vec3(3, 2, 5),
    start: new Vec3(3, 2, 4.5),
    end: new Vec3(3, 2, 5.5),
    connected: false,
    volume: 1,
  }]]));
  artwork.update(0.016);
  assert.ok(meshes.every((mesh) => mesh.hadColorsAtConstruction));
  const gel = materials.find((material) => material.name === "Continuous living gel body");
  assert.ok(gel.diffuse.r > gel.diffuse.g && gel.diffuse.g > gel.diffuse.b);
  assert.equal(gel.opacity, 1);
  assert.equal(gel.opacityVertexColor, true);
  assert.ok(gel.clearCoat < 0.5);
});


test("anchored skin keeps its broad native bank and narrows monotonically toward the free edge", () => {
  const { artwork, meshes } = fixture(true);
  const first = {
    position: new Vec3(3, 2, 5),
    start: new Vec3(3, 2, 4.5),
    end: new Vec3(3, 2, 5.5),
    connected: false,
    width: 1.5,
    thickness: 1.2,
    volume: 1.7,
  };
  const second = {
    position: new Vec3(3, 2, 6),
    start: new Vec3(3, 2, 5.5),
    end: new Vec3(3, 2, 6.5),
    connected: false,
    width: 0.45,
    thickness: 0.7,
    volume: 0.3,
    linkedPrevious: true,
  };
  artwork.setSpanPoses(new Map([[0, first], [1, second]]));
  artwork.update(0.016);
  const widthAt = (ring) => Math.abs(meshes[0].positions[ring * 12 * 3]);
  assert.ok(Math.abs(widthAt(0) - 1.5 * 0.94) < 1e-8);
  for (let ring = 1; ring < 49; ring += 1) {
    assert.ok(widthAt(ring) <= widthAt(ring - 1) + 1e-8);
  }
  assert.ok(Math.abs(widthAt(48) - 0.45 * 0.94) < 1e-8);
});

test("temporary gel truss renders actual native brace endpoints and releases reclaimed members", () => {
  const { artwork, meshes } = fixture(true);
  const pose = {
    position: new Vec3(3, 2, 5),
    start: new Vec3(3, 2, 4.5),
    end: new Vec3(3, 2, 5.5),
    connected: false,
    braces: [{
      id: "bay-diagonal",
      start: new Vec3(3, 2, 5),
      end: new Vec3(3, 1, 6),
      radius: 0.12,
    }],
  };
  artwork.setSpanPoses(new Map([[0, pose]]));
  artwork.update(0.016);
  assert.equal(meshes.length, 2);
  const member = meshes[1];
  const centerAt = (ring) => {
    const center = new Vec3();
    for (let vertex = 0; vertex < 12; vertex += 1) {
      const offset = (ring * 12 + vertex) * 3;
      center.add(new Vec3(...member.positions.slice(offset, offset + 3)));
    }

    return center.mulScalar(1 / 12);
  };
  assert.ok(centerAt(0).equalsApprox(new Vec3()));
  assert.ok(centerAt(2).equalsApprox(new Vec3(0, -1, 1)));
  pose.braces = [];
  artwork.update(0.016);
  assert.equal(member.destroyed, true);
});



test("native depth exposes the real truss and never stretches eyes or construction posts", () => {
  const { artwork, meshes, rail, post, eye, web, stringer, wrapper } = fixture(true);
  artwork.setSpanPoses(new Map([[0, {
    position: new Vec3(3, 2, 5),
    start: new Vec3(3, 2, 4.5),
    end: new Vec3(3, 2, 5.5),
    connected: false,
    width: 1.4,
    thickness: 2,
  }]]));
  artwork.update(0.016);
  const skin = meshes[0];
  const top = skin.positions[(3 * 12 + 3) * 3 + 1];
  const bottom = skin.positions[(3 * 12 + 9) * 3 + 1];
  assert.ok(Math.abs(top - 0.003) < 1e-8);
  assert.ok(Math.abs(bottom - (-0.52 + 0.003)) < 1e-8);
  assert.equal(web.enabled, false);
  assert.equal(stringer.enabled, false);
  assert.ok(Math.abs(rail.position.y * wrapper.scale.y - 0.28) < 1e-8);
  assert.ok(Math.abs(post.scale.y * wrapper.scale.y - 0.7) < 1e-8);
  assert.ok(Math.abs(eye.scale.y * wrapper.scale.y - 1) < 1e-8);
  eye.setLocalScale(1, 0.2, 1);
  artwork.update(0.016);
  assert.ok(Math.abs(eye.scale.y * wrapper.scale.y - 0.2) < 1e-8);
  artwork.update(0.016);
  assert.ok(Math.abs(eye.scale.y * wrapper.scale.y - 0.2) < 1e-8);
});


test("living meniscus rounds in sync with native redistribution without leaving its physical envelope", () => {
  const { artwork, meshes } = fixture(true);
  const pose = {
    position: new Vec3(3, 2, 5),
    start: new Vec3(3, 2, 4.5),
    end: new Vec3(3, 2, 5.5),
    connected: false,
    width: 1.2,
    thickness: 1.6,
    redistribution: {
      progress: 0,
      index: 0,
      count: 1,
      direction: 1,
    },
  };
  artwork.setSpanPoses(new Map([[0, pose]]));
  artwork.update(0.016);
  const skin = meshes[0];
  const at = (vertex, component) => skin.positions[(12 * 12 + vertex) * 3 + component];
  const cornerBefore = Math.abs(at(2, 0));
  const outerBefore = Math.abs(at(0, 0));
  const topBefore = at(3, 1);
  pose.redistribution.progress = 0.5;
  artwork.update(0.016);
  assert.ok(Math.abs(at(2, 0)) < cornerBefore);
  assert.equal(Math.abs(at(0, 0)), outerBefore);
  assert.ok(at(3, 1) >= topBefore && at(3, 1) <= 0.0030001);
  assert.ok(skin.positions.filter((_, index) => index % 3 === 0).every((value) => Math.abs(value) <= 0.94 * 1.2 + 1e-8));
});


test("construction rails expose the native gel and truss until final suspension is connected", () => {
  const { artwork, lowerRail, rail, post, wrapper } = fixture(true);
  const pose = {
    position: new Vec3(3, 2, 5),
    start: new Vec3(3, 2, 4.5),
    end: new Vec3(3, 2, 5.5),
    connected: false,
    width: 1.2,
    thickness: 1.7,
  };
  artwork.setSpanPoses(new Map([[0, pose]]));
  artwork.update(0.016);
  assert.equal(lowerRail.enabled, false);
  assert.ok(Math.abs(rail.position.y * wrapper.scale.y - 0.28) < 1e-8);
  assert.ok(Math.abs(post.scale.y * wrapper.scale.y - 0.7) < 1e-8);
  pose.connected = true;
  artwork.update(0.016);
  assert.ok(rail.position.y * wrapper.scale.y > 0.4);
});

function renderedVolume(mesh) {
  let volume = 0;
  for (let triangle = 0; triangle < mesh.indices.length; triangle += 3) {
    const a = mesh.indices[triangle] * 3;
    const b = mesh.indices[triangle + 1] * 3;
    const c = mesh.indices[triangle + 2] * 3;
    const p = mesh.positions;
    volume += p[a] * (p[b + 1] * p[c + 2] - p[b + 2] * p[c + 1]) + p[a + 1] * (p[b + 2] * p[c] - p[b] * p[c + 2]) + p[a + 2] * (p[b] * p[c + 1] - p[b + 1] * p[c]);
  }

  return Math.abs(volume / 6);
}

test("one receiving gel silhouette forms before details and conserves complementary transfer shares", () => {
  const { artwork, meshes, wrapper } = fixture(false, { growing: true });
  artwork.update(SLIME_BRIDGE_GROWTH_SECONDS * 0.25);
  const carrier = meshes[0];
  const span = (component) => {
    const values = carrier.positions.filter((_, index) => index % 3 === component);

    return Math.max(...values) - Math.min(...values);
  };
  const earlyAspect = span(0) / span(1);
  artwork.update(SLIME_BRIDGE_GROWTH_SECONDS * 0.25);
  assert.equal(wrapper.scale.x, 0);
  const columnAspect = span(0) / span(1);
  assert.ok(columnAspect < earlyAspect * 0.8);
  const fullVolume = 0.94 * 0.13 * 0.5 * 8;
  assert.ok(Math.abs(renderedVolume(carrier) / fullVolume - 0.5) < 1e-7);
  artwork.update(SLIME_BRIDGE_GROWTH_SECONDS * 0.4);
  const detailsShare = wrapper.scale.x * wrapper.scale.y * wrapper.scale.z;
  const carrierShare = renderedVolume(carrier) / fullVolume;
  assert.equal(detailsShare, 0);
  assert.ok(carrierShare > 0);
  assert.ok(Math.abs(detailsShare + carrierShare - slimeBridgeTransferProgress(SLIME_BRIDGE_GROWTH_SECONDS * 0.9)) < 1e-7);
  assert.ok(carrier.positions.every(Number.isFinite));
  artwork.setSpanPoses(new Map([[0, {
    position: new Vec3(3, 2, 5),
    start: new Vec3(3, 2, 4.5),
    end: new Vec3(3, 2, 5.5),
    connected: false,
  }]]));
  artwork.update(SLIME_BRIDGE_GROWTH_SECONDS * 0.11);
  assert.equal(carrier.destroyed, true);
  assert.ok(wrapper.scale.equals(new Vec3(1, 1, 1)));
});


test("connected bankward surface markers track real native inflow and never add unsupported movement", () => {
  const { artwork, meshes } = fixture(true);
  const pose = {
    position: new Vec3(3, 2, 5),
    start: new Vec3(3, 2, 4.5),
    end: new Vec3(3, 2, 5.5),
    connected: false,
    width: 1.2,
    thickness: 1.4,
    volume: 1.2,
    anchorDirection: 1,
    redistribution: {
      progress: 0.5,
      index: 0,
      count: 1,
      direction: 1,
      startVolume: 1,
      volumeDelta: 0,
    },
  };
  artwork.setSpanPoses(new Map([[0, pose]]));
  artwork.update(0.016);
  const skin = meshes[0];
  const originalColors = [...skin.colors];
  const originalPositions = [...skin.positions];
  pose.redistribution.volumeDelta = 0.2;
  artwork.update(0.016);
  assert.notDeepEqual(skin.colors, originalColors);
  assert.deepEqual(skin.positions, originalPositions);
  const transportedColors = [...skin.colors];
  artwork.update(1);
  assert.deepEqual(skin.colors, transportedColors);
  pose.redistribution = null;
  artwork.update(0.016);
  assert.deepEqual(skin.colors, transportedColors);
});

test("one connected receiving neck remains inside the live donor on uneven moving supports", () => {
  const { artwork, meshes } = fixture(false, { growing: true });
  const donor = new Vec3(3.2, 1.8, 5.4);
  artwork.setDonorSources(new Map([[0, donor]]));
  artwork.update(SLIME_BRIDGE_GROWTH_SECONDS * 0.5);
  assert.equal(meshes.length, 1);
  const carrier = meshes[0];
  const remainingHeight = Math.cbrt(0.5) * 0.18;
  const neck = () => new Vec3(...carrier.positions.slice(0, 3));
  assert.ok(neck().equalsApprox(new Vec3(0.2, -0.2 + remainingHeight, 0.4)));
  donor.set(3.4, 1.5, 5.6);
  artwork.update(0);
  assert.ok(neck().equalsApprox(new Vec3(0.4, -0.5 + remainingHeight, 0.6)));
  assert.ok(Math.abs(renderedVolume(carrier) - 0.94 * 0.13 * 0.5 * 8 * 0.5) < 1e-7);
  for (let ring = 1; ring < 24; ring += 1) {
    const first = new Vec3(...carrier.positions.slice(ring * 72, ring * 72 + 3));
    const opposite = new Vec3(...carrier.positions.slice(ring * 72 + 36, ring * 72 + 39));
    assert.ok(first.distance(opposite) > 0.0001);
  }
});

test("native structural thirds control the real gel envelope and thickness-dependent opacity", () => {
  const { artwork, meshes } = fixture(true);
  const heights = [0.23, 0.2, 0.17];
  const sections = heights.map((height, index) => ({
    position: new Vec3(3, 2, 5 + (index - 1) / 3),
    rotation: new Quat(),
    halfExtents: new Vec3(0.1222 / height, height, 1 / 6),
    volume: 1 / 3,
  }));
  artwork.setSpanPoses(new Map([[0, {
    position: new Vec3(3, 2.2, 5),
    start: new Vec3(3, 2.2, 4.5),
    end: new Vec3(3, 2.2, 5.5),
    connected: false,
    width: 0.65,
    thickness: 0.2 / 0.13,
    volume: 1,
    sections,
  }]]));
  artwork.update(0.016);
  const skin = meshes[0];
  assert.equal(skin.positions.length, 27 * 12 * 3);
  for (let index = 0; index < 3; index += 1) {
    const ring = index * 9 + 3;
    assert.ok(Math.abs(skin.positions[(ring * 12 + 3) * 3 + 1] - heights[index] - 0.003) < 1e-7);
    assert.ok(Math.abs(skin.positions[(ring * 12) * 3] + sections[index].halfExtents.x) < 1e-8);
  }
  assert.ok(skin.colors[(3 * 12 + 3) * 4 + 3] > skin.colors[(21 * 12 + 3) * 4 + 3]);
  assert.ok(renderedVolume(skin) <= 0.1222 * (1 / 6) * 8 * 3);
});

test("converted thick gel is denser than thin tissue without changing geometry", () => {
  const { artwork, meshes } = fixture(true);
  const pose = {
    position: new Vec3(3, 2, 5),
    start: new Vec3(3, 2, 4.5),
    end: new Vec3(3, 2, 5.5),
    connected: false,
    width: 1.2,
    thickness: 2,
  };
  artwork.setSpanPoses(new Map([[0, pose]]));
  artwork.update(0.016);
  const denseAlpha = meshes[0].colors[3];
  pose.thickness = 0.25;
  artwork.update(0.016);
  const thinAlpha = meshes[0].colors[3];
  assert.ok(denseAlpha > 230 && thinAlpha < 150);
});

test("reference silhouette cups first, rises as an elastic column, and only resolves details late", () => {
  const { artwork, meshes, wrapper } = fixture(false, { growing: true });
  artwork.update(SLIME_BRIDGE_GROWTH_SECONDS * 0.27);
  const body = meshes[0];
  const yAt = (vertex) => body.positions[(18 * 24 + vertex) * 3 + 1];
  assert.ok(Math.min(yAt(3), yAt(9)) - yAt(6) > 0.1);
  artwork.update(SLIME_BRIDGE_GROWTH_SECONDS * 0.23);
  const upper = Math.max(...body.positions.filter((_, index) => index % 3 === 1));
  const lower = Math.min(...body.positions.filter((_, index) => index % 3 === 1));
  assert.ok(upper - lower > 0.8);
  assert.equal(wrapper.scale.x, 0);
  assert.ok(Math.abs(renderedVolume(body) - 0.94 * 0.13 * 0.5 * 8 * 0.5) < 1e-7);
});

test("late native admission never exposes a separate plank or removes the connected forming body", () => {
  const { artwork, meshes, wrapper } = fixture(false, { growing: true });
  const model = wrapper.child;
  artwork.update(SLIME_BRIDGE_GROWTH_SECONDS + 2);
  const carrier = meshes[0];
  assert.equal(model.enabled, false);
  assert.notEqual(carrier.destroyed, true);
  assert.equal(wrapper.scale.x, 0);
  assert.ok(Math.abs(renderedVolume(carrier) - 0.94 * 0.13 * 0.5 * 8 * 0.999) < 1e-7);
  artwork.setSpanPoses(new Map([[0, {
    position: new Vec3(3, 2, 5),
    start: new Vec3(3, 2, 4.5),
    end: new Vec3(3, 2, 5.5),
    connected: false,
  }]]));
  artwork.update(0);
  assert.equal(carrier.destroyed, true);
  assert.equal(model.enabled, true);
  assert.ok(wrapper.scale.equals(new Vec3(1, 1, 1)));
});

test("rounded native skin meets continuously between structural boxes without leaving their envelopes", () => {
  const { artwork, meshes } = fixture(true);
  const sections = [0.23, 0.2, 0.17].map((height, index) => ({
    position: new Vec3(3, 2, 5 + (index - 1) / 3),
    rotation: new Quat(),
    halfExtents: new Vec3(0.1222 / height, height, 1 / 6),
    volume: 1 / 3,
  }));
  artwork.setSpanPoses(new Map([[0, {
    position: new Vec3(3, 2.2, 5),
    start: new Vec3(3, 2.2, 4.5),
    end: new Vec3(3, 2.2, 5.5),
    connected: false,
    sections,
    volume: 1,
  }]]));
  artwork.update(0.016);
  const points = meshes[0].positions;
  const point = (ring, vertex) => new Vec3(...points.slice((ring * 12 + vertex) * 3, (ring * 12 + vertex) * 3 + 3));
  for (const [left, right] of [[8, 9], [17, 18]]) {
    for (let vertex = 0; vertex < 12; vertex += 1) {
      assert.ok(point(left, vertex).distance(point(right, vertex)) < 1e-8);
    }
  }
  for (let ring = 0; ring < 27; ring += 1) {
    const section = Math.floor(ring / 9);
    const half = sections[section].halfExtents;
    for (let vertex = 0; vertex < 12; vertex += 1) {
      const position = point(ring, vertex);
      assert.ok(Math.abs(position.x) <= half.x + 1e-8);
      assert.ok(Math.abs(position.y - 0.003) <= half.y + 1e-8);
      assert.ok(Math.abs(position.z - (section - 1) / 3) <= half.z + 1e-8);
    }
  }
});

test("the connected near-vertical receiving neck has no quarter-turn sheet flip", () => {
  const { artwork, meshes } = fixture(false, {
    growing: true,
    sourcePosition: new Vec3(3, 1, 5),
  });
  artwork.update(SLIME_BRIDGE_GROWTH_SECONDS * 0.5);
  const points = meshes[0].positions;
  let previous = null;
  for (let ring = 1; ring < 24; ring += 1) {
    const first = new Vec3(...points.slice(ring * 72, ring * 72 + 3));
    const opposite = new Vec3(...points.slice(ring * 72 + 36, ring * 72 + 39));
    const across = first.sub(opposite).normalize();
    if (previous) {
      assert.ok(previous.dot(across) > 0.99);
    }
    previous = across;
  }
});

test("temporary bank donors merge and split through one continuous conserved liquid neck", () => {
  const { artwork, meshes } = fixture();
  const owner = {};
  const source = new Vec3(3, 2, 3.2);
  const position = new Vec3(3, 2, 4);
  const donorVolume = 0.94 * 0.13 * 0.5 * 8;
  for (const progress of [0.1, 0.5, 0.9, 0.5, 0.1]) {
    artwork.setPoolTransfers([{
      id: owner,
      station: -1,
      source,
      progress,
    }], () => position);
    artwork.update(0.1);
    const flow = meshes.at(-1);
    assert.ok(Math.abs(renderedVolume(flow) / donorVolume - 1) < 0.015, "the liquid neck contains the whole donating identity throughout melting");
    assert.ok(flow.positions.every(Number.isFinite));
    assert.equal(meshes.length, 1, "the same connected liquid skin survives both transfer directions");
  }
  artwork.setPoolTransfers([], () => position);
  artwork.update(0);
  assert.equal(meshes[0].owner.enabled, false, "finishing inverse morph hides the empty pooled skin");
  artwork.destroy();
});

test("a seven-metre bank donation keeps one bounded closed fluid neck and its exact transferred unit", () => {
  const { artwork, meshes } = fixture(false, {
    growing: true,
    bankFeed: true,
    position: new Vec3(3, 0, 0),
    sourcePosition: new Vec3(-1, 2, 5),
  });
  artwork.update(1.6);
  const mesh = meshes.at(-1);
  const expected = 0.94 * 0.13 * 0.5 * 8;
  assert.ok(Math.abs(renderedVolume(mesh) - expected) < 1e-6);
  assert.ok(mesh.positions.every(Number.isFinite));
  const heights = mesh.positions.filter((_value, index) => index % 3 === 1);
  assert.ok(Math.max(...heights) < 1.2, "a long receiving neck cannot become a large volume-normalization fan");
  assert.ok(Math.min(...heights) > -1.2);
});

test("native fluid mass dissolves creature details then resolves the finished bridge rails without eyes", () => {
  const { artwork, plank, rail, lowerRail, post, eye } = fixture(true);
  for (const connected of [false, true]) {
    artwork.setSpanPoses(new Map([[0, {
      position: new Vec3(3, 2, 5),
      start: new Vec3(3, 2, 4.5),
      end: new Vec3(3, 2, 5.5),
      width: 1,
      thickness: 1,
      volume: 1,
      connected,
      fluid: !connected,
    }]]));
    artwork.update(0);
    assert.equal(plank.enabled, false, "the continuous gel skin forms the walking planks");
    assert.equal(eye.enabled, false);
    assert.equal(lowerRail.enabled, false);
    for (const part of [rail, post]) {
      assert.equal(part.enabled, connected, "gel rail shapes resolve only once both banks are connected");
    }
  }
});

test("a bank contribution pools locally before its shallow leading meniscus moves toward the frontier", () => {
  const { artwork, meshes } = fixture(false, {
    growing: true,
    bankFeed: true,
    position: new Vec3(0, 0, -5),
    sourcePosition: new Vec3(3, 2, 5),
  });
  artwork.update(0.8);
  const mesh = meshes.at(-1);
  const alongBounds = () => meshes.at(-1).positions.filter((_value, index) => index % 3 === 2);
  assert.ok(Math.min(...alongBounds()) > -0.9, "material first collects at the original shore instead of immediately stretching into a pipe");
  assert.ok(Math.abs(renderedVolume(mesh) - 0.4888) < 1e-6);
  artwork.update(1.6);
  assert.ok(Math.min(...alongBounds()) < -2, "the same conserved skin then advances its wet edge toward the next section");
  const rings = meshes.at(-1).positions;
  const across = rings.filter((_value, index) => index % 3 === 0);
  const vertical = rings.filter((_value, index) => index % 3 === 1);
  assert.ok(Math.max(...across) - Math.min(...across) > (Math.max(...vertical) - Math.min(...vertical)) * 1.5,
    "the travelling bolus stays wider than it is tall under surface tension");
});

test("linked liquid sections share their complete wet boundary despite native joint motion", () => {
  const { artwork, meshes } = fixture();
  artwork.setSpanPoses(new Map([
    [0, {
      position: new Vec3(3, 2, 5),
      start: new Vec3(3, 2.1, 4.5),
      end: new Vec3(3, 1.9, 5.5),
      fluid: true,
      width: 1.2,
      thickness: 1.3,
    }],
    [1, {
      position: new Vec3(3, 1.7, 6),
      start: new Vec3(3.02, 1.85, 5.48),
      end: new Vec3(3, 1.55, 6.5),
      fluid: true,
      linkedPrevious: true,
      width: 1,
      thickness: 1,
    }],
  ]));
  artwork.update(0.2);
  assertClosedUnion(meshes[0]);
});

test("forming liquid hides physical truss rods and its final rails emerge progressively", () => {
  const { artwork, meshes, rail } = fixture(true);
  const pose = {
    position: new Vec3(3, 2, 5),
    start: new Vec3(3, 2, 4.5),
    end: new Vec3(3, 2, 5.5),
    fluid: true,
    connected: false,
    braces: [{
      id: "native-test",
      start: new Vec3(3, 2, 5),
      end: new Vec3(3, 1, 6),
      radius: 0.1,
    }],
  };
  artwork.setSpanPoses(new Map([[0, pose]]));
  artwork.update(0.1);
  assert.equal(meshes.length, 1, "native support remains a physics concern while one cohesive liquid skin is visible");
  assert.equal(rail.enabled, false);
  artwork.setSpanPoses(new Map([[0, {
    ...pose,
    fluid: false,
    connected: true,
    braces: [],
  }]]));
  artwork.update(0.3);
  const emerging = rail.scale.length();
  artwork.update(0.9);
  assert.ok(rail.scale.length() > emerging * 3, "final railing grows out of the gel instead of appearing at full size");
});

test("stationary native fluid keeps an asymmetric moving outline at constant measured volume until final settlement", () => {
  const { artwork, meshes } = fixture();
  const pose = {
    position: new Vec3(3, 2, 5),
    start: new Vec3(3, 2, 4.5),
    end: new Vec3(3, 2, 5.5),
    width: 1.2,
    thickness: 1.2,
    fluid: true,
    connected: false,
  };
  artwork.setSpanPoses(new Map([[0, pose]]));
  artwork.update(0.17);
  const first = [...meshes[0].positions];
  const volume = renderedVolume(meshes[0]);
  artwork.update(0.51);
  const second = meshes[0].positions;
  assert.ok(Math.abs(renderedVolume(meshes[0]) - volume) < 1e-6);
  let motion = 0;
  let asymmetry = 0;
  for (let ring = 2; ring < 23; ring++) {
    const left = (ring * 24) * 3;
    const right = (ring * 24 + 12) * 3;
    asymmetry = Math.max(asymmetry, Math.abs(second[left] + second[right]));
    motion = Math.max(motion, Math.abs(second[left] - first[left]), Math.abs(second[right] - first[right]));
  }
  assert.ok(asymmetry > 0.12, "opposing shoulders are independent uneven lobes, not a uniform swept oval");
  assert.ok(motion > 0.08, "the viscous outline moves even while all native support poses remain stationary");
  artwork.setSpanPoses(new Map([[0, {
    ...pose,
    fluid: false,
    connected: true,
  }]]));
  artwork.update(2);
  const settled = meshes.at(-1).positions;
  artwork.update(5);
  assert.deepEqual(meshes.at(-1).positions, settled, "completed gel stops unsolicited fluid motion");
  assert.equal(meshes.at(-1).owner.enabled, true, "the regular deck stays visible on later settled frames");
});

test("a partial helper joins one visible closed bank and deck skin without a second intersecting carrier", () => {
  const { artwork, meshes } = fixture();
  const native = {
    position: new Vec3(3, 2, 5),
    start: new Vec3(3, 2, 4.5),
    end: new Vec3(3, 2, 5.5),
    fluid: true,
    connected: false,
    volume: 1,
  };
  artwork.setSpanPoses(new Map([[0, native]]));
  artwork.setPoolTransfers([{
    id: {},
    station: -1,
    source: new Vec3(3, 2, 3.5),
    progress: 0.5,
  }], () => new Vec3(3, 2, 4));
  artwork.update(0.1);
  const visible = meshes.filter((mesh) => !mesh.destroyed && mesh.owner.enabled);
  assert.equal(visible.length, 1, "incoming and admitted material have a true shared skin rather than intersecting surfaces");
  assert.ok(Math.abs(renderedVolume(visible[0]) - 0.4888 * 2) < 1e-6);
  assertClosedUnion(visible[0]);
  assert.equal(native.liquidJoinPrevious, undefined, "pending visual union never changes native admission metadata");
});

test("a fully liquid-owned first donor has one whole visible unit and no premature deck region", () => {
  const { artwork, meshes } = fixture();
  const owner = { bridgeLiquidVisualOwned: true };
  for (const progress of [0.05, 0.5, 0.95]) {
    artwork.setPoolTransfers([{
      id: owner,
      station: -1,
      source: new Vec3(3, 2, 3.5),
      progress,
    }], () => new Vec3(3, 2, 4));
    artwork.update(0.1);
    const visible = meshes.filter((mesh) => !mesh.destroyed && mesh.owner.enabled);
    assert.equal(visible.length, 1);
    assert.ok(Math.abs(renderedVolume(visible[0]) - 0.4888) < 1e-6, "the hidden prefab's remaining share is in the same fluid unit, never missing or duplicated");
    const along = visible[0].positions.filter((_value, index) => index % 3 === 2);
    assert.ok(Math.max(...along) <= -0.5 + 1e-6, "no missing deck region is admitted by a bank-only donor");
  }
});

test("a connected retained reservoir stops unprompted fluid clocks but still follows native movement and load dents", () => {
  const { artwork, meshes, wrapper } = fixture();
  const bank = {
    position: new Vec3(3, 2, 4),
    start: new Vec3(3, 2, 3.5),
    end: new Vec3(3, 2, 4.5),
    volume: 1,
    reservoir: true,
    fluid: true,
    connected: false,
  };
  const deck = {
    position: new Vec3(3, 2, 5),
    start: new Vec3(3, 2, 4.5),
    end: new Vec3(3, 2, 5.5),
    volume: 1,
    fluid: true,
    connected: false,
    linkedPrevious: true,
  };
  artwork.setSpanPoses(new Map([[-1, bank], [0, deck]]));
  artwork.update(0.2);
  artwork.setSpanPoses(new Map([[-1, {
    ...bank,
    connected: true,
    fluid: false,
  }], [0, {
    ...deck,
    connected: true,
    fluid: false,
  }]]));
  artwork.update(2);
  const settled = [...meshes.at(-1).positions];
  artwork.update(20);
  assert.deepEqual(meshes.at(-1).positions, settled);
  assert.equal(wrapper.child.anim.speed, 0);
  artwork.setLoads(new Map([[0, {
    compression: 0.5,
    bounce: 0,
    across: 0,
    along: 0,
  }]]));
  artwork.update(0.1);
  assert.notDeepEqual(meshes.at(-1).positions, settled, "real contact deformation remains active after spontaneous flow stops");
});

test("render ownership changes only after the first whole liquid mesh has been constructed", () => {
  const { artwork, meshes } = fixture();
  const owner = {
    bridgeLiquidVisualOwned: false,
    /**
     * @param {boolean} owned
     */
    setBridgeLiquidOwnership(owned) {
      this.bridgeLiquidVisualOwned = owned;
    },
  };
  artwork.setPoolTransfers([{
    id: owner,
    station: -1,
    source: new Vec3(3, 2, 3.5),
    progress: 0.00001,
  }], () => new Vec3(3, 2, 4));
  assert.equal(owner.bridgeLiquidVisualOwned, false);
  artwork.update(0);
  assert.equal(owner.bridgeLiquidVisualOwned, true);
  const visible = meshes.filter((mesh) => !mesh.destroyed && mesh.owner.enabled);
  assert.equal(visible.length, 1);
  assert.ok(Math.abs(renderedVolume(visible[0]) - 0.4888) < 1e-6);
});

/**
 * @param {{indices:number[]}} mesh
 */
function assertClosedUnion(mesh) {
  const edges = new Map();
  for (let i = 0; i < mesh.indices.length; i += 3) {
    for (let j = 0; j < 3; j++) {
      const a = mesh.indices[i + j], b = mesh.indices[i + (j + 1) % 3];
      const key = a < b ? `${a}:${b}` : `${b}:${a}`;
      edges.set(key, (edges.get(key) ?? 0) + 1);
    }
  }
  for (const count of edges.values()) {
    assert.equal(count, 2, "the merged implicit surface has no open seam");
  }
}
