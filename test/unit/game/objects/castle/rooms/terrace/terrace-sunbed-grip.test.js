import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {it} from "node:test";
import * as pc from "playcanvas";
import {FoldingDaybedDelivery} from "../../../../../../../src/game/objects/castle/residents/FoldingDaybedDelivery.js";
import {TerracePropGrip} from "../../../../../../../src/game/objects/castle/rooms/terrace/TerracePropGrip.js";
import {CASTLE_TERRACE_PHASE as PHASE} from "../../../../../../../src/game/enum/CastleTerracePhase.js";
import {BOOK_ANIMATION} from "../../../../../../../src/game/enum/BookAnimation.js";
const source=readFileSync(new URL("../../../../../../../src/game/objects/castle/rooms/terrace/TerraceSunbedActions.js",import.meta.url),"utf8").replace(/^import[^\n]+\r?\n/gm,"");
const Actions=new Function("sunbedUrl","bookUrl","FoldingDaybedDelivery","BOOK_ANIMATION","PHASE","TerracePropGrip",`${source.replace("export class","class")}\nreturn TerraceSunbedActions;`)("sunbed","book",FoldingDaybedDelivery,BOOK_ANIMATION,PHASE,TerracePropGrip);
class AnimatedEntity extends pc.Entity {
  addComponent() {
    this.anim={
      addAnimationState:()=>{},
      baseLayer:{
        play:()=>{},
        activeStateCurrentTime:0,
      },
      speed:0,
    };
  }
}
it("keeps the folded sunbed's authored origin inside the carrier root",()=>{
  const buffer=readFileSync(new URL("../../../../../../../src/game/models/castle/leisure/folding-daybed.glb",import.meta.url));
  const gltf=JSON.parse(buffer.subarray(20,20+buffer.readUInt32LE(12)));
  const sourceRoot=gltf.nodes[gltf.scenes[0].nodes[0]];
  const rails=gltf.nodes.filter(n=>["Walnut folding side rail","Walnut folding side rail.001"].includes(n.name));
  const stage=new pc.Entity();stage.setLocalPosition(3,2,7);stage.setLocalEulerAngles(0,73,0);stage.setLocalScale(.26,.26,.26);
  let model;
  const library={
    instantiate:(url)=>{
      const n=new AnimatedEntity(url);if(url==="sunbed"){
        model=n;n.setLocalPosition(...sourceRoot.translation);for(const r of rails){
          const child=new pc.Entity(r.name);child.setLocalPosition(...r.translation);n.addChild(child);
        }
      }return n;
    },
    getAnimationTracks:(_,names)=>new Map(names.map(name=>[name,{duration:1}])),
  };
  const actor={
    entity:new pc.Entity(),
    leftHand:new pc.Entity(),
    rightHand:new pc.Entity(),
  };
  actor.entity.setLocalPosition(4,2,6);actor.entity.setLocalEulerAngles(0,-31,0);
  actor.leftHand.setPosition(3.8,2.7,6.2);actor.rightHand.setPosition(4.2,2.7,6.2);
  actor.alignHand=(side,p)=>actor[side+"Hand"].setPosition(p);
  const actions=new Actions({
    pc,
    modelLibrary:library,
    stage,
    royal:{},
  });
  actions.sync({
    stagePhase:PHASE.SERVANT_ENTER,
    cargo:"sunbed",
    installedCount:0,
  },{stagePhase:PHASE.DORMANT},actor);
  const carrier=stage.findByName("Terrace sunbed");
  assert.notEqual(carrier,model,"folding animation must not own the carried transform");
  assert.ok(model.getLocalPosition().equals(new pc.Vec3(...sourceRoot.translation)));
  const points=rails.map(r=>model.findByName(r.name).getPosition().clone());
  for(const hand of [actor.leftHand,actor.rightHand]){
    assert.ok(Math.min(...points.map(p=>p.distance(hand.getPosition())))<.00001);
  }
  const before=carrier.getPosition().clone();
  model.setLocalPosition(...sourceRoot.translation);
  assert.ok(carrier.getPosition().equals(before),"evaluating the authored animation cannot reset the carrier position");
  stage.destroy();actor.entity.destroy();actor.leftHand.destroy();actor.rightHand.destroy();
});
