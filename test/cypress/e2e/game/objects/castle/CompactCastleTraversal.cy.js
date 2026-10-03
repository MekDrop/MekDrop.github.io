import { CastleGenerator } from '../../../../../../src/game/generator/castle/CastleGenerator.js';
import { CastleResidentialLayout } from '../../../../../../src/game/objects/castle/CastleResidentialLayout.js';
import {spiralStairRise} from '../../../../../../src/game/objects/shared/SpiralStairCollision.js';
import castleMap from '../../../../../../src/game/maps/tests/castle-seeds.json';

async function walkTo(window, target) {
  const driver = window.gameMovementTest;
  driver.move(0,0);
  const initial=driver.state().position;
  const facing=driver.state().facing;
  const bodyYaw=Math.atan2(facing.x,facing.z)*180/Math.PI;
  const view=window.gameCameraTest.state().firstPersonCamera.direction;
  const current=Math.atan2(view.x,view.z)*180/Math.PI;
  const desired=target.facingYaw ?? Math.atan2(target.x-initial.x,target.z-initial.z)*180/Math.PI;
  const normalize=degrees=>((degrees+540)%360)-180;
  window.gameCameraTest.lookFirstPersonBy(normalize(bodyYaw-current),0);
  await new Promise(resolve=>window.setTimeout(resolve,50));
  const delta=normalize(desired-bodyYaw), extra=Math.sign(delta)*80;
  let remaining=delta+extra;
  while(Math.abs(remaining)>.001){
    const turn=Math.sign(remaining)*Math.min(60,Math.abs(remaining));
    window.gameCameraTest.lookFirstPersonBy(turn,0);
    remaining-=turn;
    await new Promise(resolve=>window.setTimeout(resolve,50));
  }
  window.gameCameraTest.lookFirstPersonBy(-extra,0);
  await new Promise(resolve=>window.setTimeout(resolve,50));
  const start = Date.now();
  while (Date.now() - start < 15000) {
    const state = driver.state();
    const dx = target.x - state.position.x, dz = target.z - state.position.z;
    if (Math.hypot(dx,dz) < (target.tolerance ?? .12)) { driver.move(0,0); return; }
    const camera = window.gameCameraTest.state().firstPersonCamera;
    const distance=Math.hypot(dx,dz), speed=Math.min(.45,distance*.8), forwardLength=Math.hypot(camera.direction.x,camera.direction.z);
    driver.move((camera.right.x*dx+camera.right.z*dz)/distance*speed,
      (camera.direction.x*dx+camera.direction.z*dz)/distance/forwardLength*speed);
    await new Promise(resolve=>window.setTimeout(resolve,30));

  }
  driver.move(0,0);
  throw new Error(JSON.stringify({target,state:{position:driver.state().position,movement:driver.state().movement,facing:driver.state().facing}}));
}

describe('Compact authored castle traversal', () => {
  it('walks all doors and both stair flights without falling', () => {
    let returnRoute;
    cy.viewport(1280,900);
    cy.visit('/en/map/test_castle-seeds?camera-test');
    cy.get('.background-canvas[data-game-ready="true"]',{timeout:45000}).should('be.visible');
    cy.window().its('gameMovementTest').should('exist');
    cy.window().then({timeout:300000},async window => {
      for(const type of ['mousemove','pointermove']) window.addEventListener(type,event=>event.stopImmediatePropagation(),true);
      window.dispatchEvent(new KeyboardEvent('keydown',{code:'ScrollLock'}));
      window.dispatchEvent(new KeyboardEvent('keyup',{code:'ScrollLock'}));
      const plan=await CastleGenerator.generate(castleMap.objects.find(o=>o.object==='Castle'));
      const layout=new CastleResidentialLayout(plan), origin=layout.origin;
      await walkTo(window,{x:0,z:-8.2});
      await walkTo(window,{x:origin.x,z:-8.2});
      await walkTo(window,{x:origin.x,z:origin.z+.8});
      const doors=plan.metadata.runtime.roomDoors.filter(d=>d.y===origin.y);
      const corridorX=Math.max(...doors.map(door=>door.x))+1.4;
      for(const door of doors) {
        await walkTo(window,{x:corridorX,z:window.gameMovementTest.state().position.z});
        await walkTo(window,{x:corridorX,z:door.z});
        await walkTo(window,{x:door.x-.55,z:door.z});
        expect(window.gameMovementTest.state().position.y,door.roomId).to.be.closeTo(door.y,.2);
        await walkTo(window,{x:corridorX,z:door.z});
      }
      const groundDoor=doors.find(d=>d.roomId==='stair-room');
      const upperDoor=plan.metadata.runtime.roomDoors.find(d=>d.roomId==='upper-stair-room');
      const upper=layout.authoredStairs.find(s=>s.center.y===origin.y);
      const lower=layout.authoredStairs.find(s=>s.center.y<origin.y);
      const tread=(stair,step)=>{
        const progress=step/stair.steps,angle=Math.PI/2-stair.yaw*Math.PI/180-progress*stair.turns*Math.PI*2;
        return {x:stair.center.x+Math.cos(angle)*stair.radius*.375/.65,z:stair.center.z+Math.sin(angle)*stair.radius*.375/.65,y:stair.center.y+stair.rise*spiralStairRise(progress,stair.landingProfile),tolerance:.075};
      };
      const verifyFlight=async(stair,ascending)=>{
        for(let step=ascending?1:stair.steps-1;ascending?step<=stair.steps:step>=1;step+=ascending?1:-1){
          const target=tread(stair,step);
          await walkTo(window,target);
          expect(window.gameMovementTest.state().position.y,'stair '+stair.id+' step '+step).to.be.closeTo(target.y,.45);
        }
      };
      await walkTo(window,{x:groundDoor.x+1.1,z:groundDoor.z});
      await walkTo(window,{x:groundDoor.x-.7,z:groundDoor.z});
      const entryX=upper.center.x+1.4, entryZ=upper.center.z;
      await walkTo(window,{x:entryX,z:entryZ});
      await walkTo(window,tread(upper,0));
      await verifyFlight(upper,true);
      await walkTo(window,{x:entryX,z:entryZ});
      await walkTo(window,{x:upperDoor.x-.7,z:upperDoor.z});
      await walkTo(window,{x:upperDoor.x+1.1,z:upperDoor.z});
      expect(window.gameMovementTest.state().position.y).to.be.closeTo(upperDoor.y,.2);
      await walkTo(window,{x:upperDoor.x-.7,z:upperDoor.z});
      await walkTo(window,{x:entryX,z:entryZ});
      await verifyFlight(upper,false);
      await verifyFlight(lower,false);
      const basementDoor=plan.metadata.runtime.roomDoors.find(d=>d.roomId==='basement-stair-room');
      await walkTo(window,{x:entryX,z:entryZ});
      await walkTo(window,{x:basementDoor.x-.7,z:basementDoor.z});
      await walkTo(window,{x:basementDoor.x+1.1,z:basementDoor.z});
      const kitchen=plan.metadata.runtime.roomDoors.find(d=>d.roomId==='kitchen');
      const serviceCorner=kitchen.z+1.5;
      await walkTo(window,{x:basementDoor.x+1.1,z:serviceCorner,tolerance:.025});
      await walkTo(window,{x:kitchen.x-1.1,z:kitchen.z+1.375,tolerance:.025});
      await walkTo(window,{x:kitchen.x-1.1,z:kitchen.z});
      await walkTo(window,{x:kitchen.x+.55,z:kitchen.z});
      expect(window.gameMovementTest.state().position.y).to.be.closeTo(kitchen.y,.2);
      await walkTo(window,{x:kitchen.x-1.1,z:kitchen.z});
      returnRoute={origin,groundDoor,basementDoor,kitchen,lower,entryX,entryZ,serviceCorner,corridorX,tread,verifyFlight};
    });
    cy.get('.background-canvas').screenshot('compact-basement-doors-crossed');
    cy.window().then({timeout:180000},async window=>{
      const {origin,groundDoor,basementDoor,kitchen,lower,entryX,entryZ,serviceCorner,corridorX,tread,verifyFlight}=returnRoute;
      await walkTo(window,{x:kitchen.x-1.1,z:kitchen.z+1.175,tolerance:.025});
      await walkTo(window,{x:basementDoor.x+1.1,z:serviceCorner,tolerance:.025});
      await walkTo(window,{x:basementDoor.x+1.1,z:basementDoor.z});
      await walkTo(window,{x:basementDoor.x-.7,z:basementDoor.z});
      expect(window.gameMovementTest.state().position.y).to.be.closeTo(basementDoor.y,.2);
      await walkTo(window,{x:entryX,z:entryZ});
      await walkTo(window,tread(lower,0));
      await verifyFlight(lower,true);
      await walkTo(window,{x:entryX,z:entryZ});
      await walkTo(window,{x:groundDoor.x-.7,z:groundDoor.z});
      await walkTo(window,{x:corridorX,z:groundDoor.z});
      expect(window.gameMovementTest.state().position.y).to.be.closeTo(origin.y,.2);
      await walkTo(window,{x:origin.x,z:origin.z+.8});
      await walkTo(window,{x:origin.x,z:-8.2});
      expect(window.gameMovementTest.state().position.y).to.be.closeTo(origin.y,.2);
      window.dispatchEvent(new KeyboardEvent('keydown',{code:'ScrollLock'}));
      window.dispatchEvent(new KeyboardEvent('keyup',{code:'ScrollLock'}));
      window.gameCameraTest.setZoom(2);
    });
    cy.wait(500);
    cy.get('.background-canvas').screenshot('compact-all-doors-crossed');
  });
  it('captures the exterior from all four corners', () => {
    cy.viewport(1280,900);
    cy.visit('/en/map/test_castle-seeds?camera-test');
    cy.get('.background-canvas[data-game-ready="true"]',{timeout:45000}).should('be.visible');
    cy.window().then(window=>{window.gameCameraTest.setZoom(2);window.gameCameraTest.panBy(330,40);});
    for(const rotation of [0,1,2,3]) {
      cy.window().then(window=>{
        window.dispatchEvent(new KeyboardEvent('keydown',{code:'KeyQ'}));
        window.dispatchEvent(new KeyboardEvent('keyup',{code:'KeyQ'}));
      });
      cy.wait(500);
      const offset=[[0,0],[244,66],[334,16],[224,-74]][rotation];
      cy.window().then(window=>window.gameCameraTest.panBy(...offset));
      cy.wait(300);
      cy.get('.background-canvas').screenshot('compact-exterior-'+rotation);
      cy.window().then(window=>window.gameCameraTest.panBy(-offset[0],-offset[1]));
    }
  });
});





















