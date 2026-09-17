import assert from "node:assert/strict";
import { accessSync, readFileSync } from "node:fs";
import { it } from "node:test";
import { BOOK_ANIMATION } from "../../src/game/enum/BookAnimation.js";
import { HERO_ANIMATION } from "../../src/game/enum/HeroAnimation.js";
import { TREASURE_CHEST_ANIMATION } from "../../src/game/enum/TreasureChestAnimation.js";

function readGlb(relativePath) {
  const url = new URL(`../../${relativePath}`, import.meta.url);
  const buffer = readFileSync(url);
  const jsonLength = buffer.readUInt32LE(12);
  return {
    json: JSON.parse(buffer.subarray(20, 20 + jsonLength)),
    url,
  };
}

function animationTargets(json, name) {
  const animation = json.animations.find((item) => item.name === name);
  assert.ok(animation, `missing embedded animation ${name}`);
  return animation.channels.map(({ target }) => ({
    node: json.nodes[target.node].name,
    path: target.path,
  }));
}

it("stores the treasure chest opening in its editable model", () => {
  const { json, url } = readGlb(
    "src/game/models/treasure/treasure-chest.glb",
  );
  accessSync(new URL(url.href.replace(/\.glb$/, ".blend")));
  const targets = animationTargets(json, TREASURE_CHEST_ANIMATION.OPEN);
  assert.ok(targets.some(({ node, path }) =>
    node === "Treasure chest lid" && path === "rotation"));
  assert.ok(targets.every(({ node }) => node === "Treasure chest lid"));
});

it("stores both book-cover hinges in the book opening clip", () => {
  const { json, url } = readGlb(
    "src/game/models/castle/leisure/open-book.glb",
  );
  accessSync(new URL(url.href.replace(/\.glb$/, ".blend")));
  assert.deepEqual(
    animationTargets(json, BOOK_ANIMATION.OPEN)
      .filter(({ path }) => path === "rotation")
      .map(({ node }) => node)
      .sort(),
    ["Book left cover", "Book right cover"],
  );
});

it("stores fixed hero refusal and blocked-dig reactions in hero.glb", () => {
  const { json, url } = readGlb("src/game/models/hero/hero.glb");
  accessSync(new URL(url.href.replace(/\.glb$/, ".blend")));
  const refusalTargets = animationTargets(json, HERO_ANIMATION.HOLE_REFUSAL);
  assert.ok(refusalTargets.some(({ node, path }) =>
    node === "Hero head" && path === "rotation"));

  const blockedTargets = animationTargets(
    json,
    HERO_ANIMATION.DIG_BLOCKED_ANNOYED,
  );
  assert.ok(blockedTargets.some(({ node, path }) =>
    node === "Hero head" && path === "rotation"));
  for (const node of [
    "Eye",
    "Eye.001",
    "Mouth",
    "Left cyan eyebrow",
    "Right cyan eyebrow",
  ]) {
    assert.ok(blockedTargets.some((target) =>
      target.node === node && target.path === "weights"));
  }
});
