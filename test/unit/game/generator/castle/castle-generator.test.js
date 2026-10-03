import assert from "node:assert/strict";
import { it } from "node:test";
import { CastleGenerator } from "../../../../../src/game/generator/castle/CastleGenerator.js";
import { CastleBasePlanGenerator } from "../../../../../src/game/generator/castle/CastleBasePlanGenerator.js";
import { CastleGenerationAbortedError } from "../../../../../src/game/errors/castle/index.js";
const options = {position:{x:-8,z:-14,width:16,depth:28,elevation:3},doors:[{side:"WEST",offset:13,width:2}],seed:42};
it("selects the authored plan directly from the seed, without mode or plan inputs", async()=>{
  const first = await CastleGenerator.generate(options);
  assert.equal(first.layout.basePlanId,(await CastleBasePlanGenerator.generate({seed:42})).basePlanId);
  assert.deepEqual(first,await CastleGenerator.generate(options));
  assert.equal(first.input.basePlanId,undefined);
});
it("always uses quarter-metre brick geometry and finite collision bounds",async()=>{
  const plan = await CastleGenerator.generate(options);
  assert.ok(plan.geometry.boxes.length>0);
  assert.ok(plan.geometry.boxes.every(b=>b.sx<=0.250001&&b.sy<=0.250001&&b.sz<=0.250001));
  assert.ok(plan.metadata.collision.cameraBlocks.every(b=>Object.values(b).every(Number.isFinite)));
});
it("ignores obsolete legacy selectors rather than dispatching to the old generator",async()=>{
  assert.deepEqual(await CastleGenerator.generate({...options,style:"twin-tower",basePlanId:"castle-01"}),await CastleGenerator.generate(options));
});
it("rejects aborted generation before compiling a plan",async()=>{
  const controller=new AbortController();controller.abort();
  await assert.rejects(CastleGenerator.generate({...options,signal:controller.signal}),CastleGenerationAbortedError);
});
