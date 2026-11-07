import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { it } from "node:test";
import { Vec2 } from "playcanvas";

const root = new URL("../../../../../src/game/objects/scenery/", import.meta.url);
const cloudVoxels = JSON.parse(readFileSync(new URL("CloudVoxelVariants.json", root), "utf8"));
const skySettings = JSON.parse(readFileSync(new URL("CloudSkySettings.json", root), "utf8"));
const source = readFileSync(new URL("CloudShadowMask.js", root), "utf8").replace(/^import .*;\r?\n/gm, "").replace("export class", "class");
const Layout = new Function("cloudVoxels", "Vec2", "skySettings", `${source}; return CloudShadowMask;`)(cloudVoxels, Vec2, skySettings);
const shader = readFileSync(new URL("SkyboxCloud.frag", root), "utf8");
const intervals = shader.match(/vec2 heights = ray.y < 0.0 \? vec2\(([^)]+)\) : vec2\(([^)]+)\)/).slice(1).map((interval) => interval.split(",").map(Number));
const limit = Number(shader.match(/int x = 0; x < (\d+)/)[1]);

it("keeps every original voxel inside the searched cells above and below the horizon", () => {
  let legacyMisses = 0;
  let checked = 0;
  for (let x = -10; x <= 10; x++) {
    for (let z = -10; z <= 10; z++) {
      for (const sign of [-1, 1]) {
        const bank = sign < 0 ? skySettings.lower : skySettings.upper;
        const cloud = Layout.cloud(x, z, bank);
        if (!cloud) {
          continue;
        }
        const [minimumHeight, maximumHeight] = intervals[sign < 0 ? 0 : 1];
        for (const [vx, vy, vz] of cloudVoxels.variants[cloud.variant]) {
          const step = cloudVoxels.cubeStep * cloud.scale;
          // Include a filter footprint beyond the original voxel silhouette.
          const half = cloudVoxels.cubeSize * cloud.scale / 2 + 0.5;
          for (const dx of [-half, half]) {
            for (const dy of [-half, half]) {
              for (const dz of [-half, half]) {
                const px = cloud.x + (vx + vz) * Math.SQRT1_2 * step + dx;
                const pz = cloud.z + (-vx + vz) * Math.SQRT1_2 * step + dz;
                const height = Math.abs(sign * cloud.height + vy * step + dy);
                const length = Math.hypot(px, height, pz);
                if (height / length <= 0.06) {
                  continue;
                }
                for (const [coordinate, expected] of [[px, x], [pz, z]]) {
                  const start = coordinate * minimumHeight / height;
                  const end = coordinate * maximumHeight / height;
                  const minimumCell = Math.floor((Math.min(start, end) - 12) / bank.spacing);
                  const maximumCell = Math.floor((Math.max(start, end) + 12) / bank.spacing);
                  assert.ok(expected >= minimumCell && expected <= maximumCell);
                  assert.ok(maximumCell - minimumCell < limit);
                  if (Math.abs(Math.floor(coordinate * bank.height / height / bank.spacing) - expected) > 1) {
                    legacyMisses++;
                  }
                }
                checked++;
              }
            }
          }
        }
      }
    }
  }
  assert.ok(checked > 10000);
  assert.ok(legacyMisses > 0, "The fixture must expose the original fixed-neighborhood clipping");
});
