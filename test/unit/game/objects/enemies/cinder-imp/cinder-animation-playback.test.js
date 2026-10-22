import assert from "node:assert/strict";
import test from "node:test";
import { CinderAnimationPlayback } from "../../../../../../src/game/objects/enemies/cinder-imp/CinderAnimationPlayback.js";

test("playback binds every authored track to the instantiated hierarchy, respects loops and restarts", () => {
  const assigned = [];
  const transitions = [];
  const animation = {
    speed:1,
    baseLayer:{
      activeStateCurrentTime:0,
      play:()=>{},
      transition:(...args)=>transitions.push(args),
    },
    addAnimationState:(...args)=>assigned.push(args),
  };
  const model = {
    addComponent:()=>{},
    anim:animation,
  };
  const tracks = new Map([["idle",{duration:2}],["fire_loop",{duration:2/3}]]);
  const library = {getAnimationTracks:()=>tracks};
  const playback = new CinderAnimationPlayback(model,library,"cinder.glb",[{
    name:"idle",
    looping:true,
  },{
    name:"fire_loop",
    looping:true,
  }]);
  assert.equal(assigned.length,2);
  assert.equal(assigned[1][1],tracks.get("fire_loop"));
  assert.equal(assigned[1][3],true);
  playback.play("fire_loop",false,0.65);
  assert.ok(Math.abs(animation.speed-(2/3)/0.65)<1e-8);
  assert.deepEqual(transitions,[['fire_loop',0.1]]);
  playback.play("fire_loop",true);
  assert.deepEqual(transitions.at(-1),['fire_loop',0]);
  assert.equal(playback.play("absent"),false);
  playback.sample(0.5);
  assert.equal(animation.speed,0);
  assert.equal(animation.baseLayer.activeStateCurrentTime,1/3);
});
