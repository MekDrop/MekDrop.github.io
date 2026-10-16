import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { it } from "node:test";
import * as pc from "playcanvas";
import { IslandObjectRoots } from "../../../../../../src/game/objects/shared/IslandObjectRoots.js";
const source = readFileSync(new URL("../../../../../../src/game/objects/castle-props/banner/Banner.js", import.meta.url), "utf8").replace(/^import[^\n]*\n/gm, "").replace("export class Banner", "class Banner");
const Banner = new Function(source + "; return Banner;")();
it("publishes castle banners once, preserves overrides, and replaces obsolete castle cloth", () => {
  const castle = {
    id: "castle",
    object: "Castle",
    seed: 1,
    tile: {
      col: 2,
      row: 3,
    },
    buildPlan: {
      geometry: {
        decorations: {
          banners: [{
            x: 2,
            y: 5,
            z: 4,
            width: 2,
            height: 3,
            yaw: 90,
          }],
        },
      },
    },
  };
  const map = {
    objects: [castle, {
      id: "room",
      object: "Banner",
      scale: 2,
    }],
  };
  Banner.prepareMap(map);
  assert.equal(map.objects[1].object, "Banner");
  assert.equal(map.objects[1].scale, 2);
  const banner = map.objects[2];
  assert.deepEqual(banner.position, {
    x: 2,
    y: 5,
    z: 4,
  });
  assert.equal(banner.rotation, 90);
  assert.equal(banner.variant, "cloth");
  banner.width = 4;
  Banner.prepareMap(map);
  assert.equal(map.objects.length, 3);
  assert.equal(map.objects[2].width, 4);
  castle.seed = 2;
  Banner.prepareMap(map);
  assert.equal(map.objects.length, 3);
  assert.equal(map.objects[2].width, 2);
  map.objects.splice(0, 1);
  Banner.prepareMap(map);
  assert.deepEqual(map.objects.map(item => item.id), ["room"]);
});

it("both artwork variants share cloth ownership, picking and pointer gestures", () => {
  class Cloth {
    entity = new pc.Entity("Banner");
    calls = [];
    constructor() {
      Cloth.latest = this;
    }
    add(options) {
      this.calls.push(options); this.entity.addChild(new pc.Entity("Cloth"));
    }
    getBannerHit() {
      return {
        distance: 0.5,
        banner: {},
        point: new pc.Vec3(),
      };
    }
    beginWindGesture(hit) {
      this.calls.push(hit);
    }
    applyMouseWind(...args) {
      this.calls.push(args);
    }
    endWindGesture() {
      this.calls.push("end");
    }
    destroy() {
      this.entity.destroy();
    }
  }
  const NativeBanner = new Function("BannerCloth", "IslandObjectRoots", source + "; return Banner;")(Cloth, IslandObjectRoots);
  for (const variant of [undefined, "cloth"]) {
    const banner = new NativeBanner({
      pc,
      definition: {
        id: "banner",
        object: "Banner",
        variant,
        position: {
          x: 1,
          y: 2,
          z: 3,
        },
      },
    });
    const visual = Cloth.latest;
    assert.equal(visual.calls[0].variant, variant);
    const hit = banner.getPointerHit(new pc.Vec3(), new pc.Vec3());
    assert.equal(hit.pointerTarget, banner);
    assert.deepEqual(banner.handlePointerDown({ hit }), { capturePointer: true });
    assert.equal(visual.calls[1], hit);
    banner.handlePointerMove({
      ray: {
        start: 1,
        end: 2,
      },
      deltaTime: 0.016,
    });
    assert.deepEqual(visual.calls[2], [1, 2, 0.016]);
    banner.handlePointerUp();
    banner.handlePointerCancel();
    assert.deepEqual(visual.calls.slice(-2), ["end", "end"]);
    banner.destroy();
  }
});
