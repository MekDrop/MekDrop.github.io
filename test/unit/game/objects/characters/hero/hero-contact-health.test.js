import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("../../../../../../src/game/objects/characters/hero/Hero.js", import.meta.url), "utf8");
const start = source.indexOf("  receiveDamage(");
const method = source.slice(start, source.indexOf("\n  /**", start));
const Driver = new Function(`return class {
  #lives=3;
  #contactDamage=0;
  #emotionBehavior={reactToScratch:()=>({})};
  #hasMovementInput=false;
  #startAngryEscape(){}
  #actionBehavior={fallingToDeath:false,respawning:false};
  published=[];
  #syncState(){this.published.push(3-this.#contactDamage);}
  get falling(){return this.#actionBehavior.fallingToDeath;}
  ${method}
}`)();

test("idle hero damage immediately publishes fractional health without waiting for movement", () => {
  const hero = new Driver();
  hero.receiveDamage(0.08);
  assert.equal(hero.published.at(-1), 2.92);
  hero.receiveDamage(0.42);
  assert.equal(hero.published.at(-1), 2.5);
  assert.equal(hero.falling, false);
  hero.receiveDamage(0.6);
  assert.equal(hero.published.at(-1), 2);
  assert.equal(hero.falling, true);
  assert.equal(hero.receiveDamage(0.08), 0);
});
