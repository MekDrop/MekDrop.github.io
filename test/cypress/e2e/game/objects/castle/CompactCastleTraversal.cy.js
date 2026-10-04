import { CastleGenerator } from '../../../../../../src/game/generator/castle/CastleGenerator.js';
import { CastleResidentialLayout } from '../../../../../../src/game/objects/castle/CastleResidentialLayout.js';
import {castleStraightStairHeight, castleStraightStairSurfaces, castleStraightStairStepCount} from '../../../../../../src/game/objects/castle/CastleStraightStairs.js';
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
    const alert = window.document.querySelector('[data-global-exception]');
    if (alert) { expect(false, alert.textContent).to.equal(true); }
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
  expect(false, JSON.stringify({target,state:{position:driver.state().position,movement:driver.state().movement,facing:driver.state().facing}})).to.equal(true);
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
        const r=stair.radius, lane=r/2+(stair.flightGap ?? 0)/2, landing=Math.min(.7,r*.5), apron=Math.min(.15,r*.1);
        const shift=stair.flightShift ?? 0;
        const points=[[-lane,r+shift,0],[-lane,-r+landing+shift,stair.rise/2],
          [-lane,-r+(landing+shift)*.7,stair.rise/2],[lane,-r+(landing+shift)*.7,stair.rise/2],
          [lane,-r+landing+shift,stair.rise/2],[lane,r-apron+shift,stair.rise],[lane,r+shift,stair.rise]];
        const boundaries=[0,9,11,13,15,22,24];
        let segment=boundaries.findIndex((end,index)=>index>0 && step<=end)-1;
        segment=Math.max(0,segment);
        const progress=(step-boundaries[segment])/(boundaries[segment+1]-boundaries[segment]);
        const a=points[segment],b=points[segment+1],lx=a[0]+(b[0]-a[0])*progress,lz=a[1]+(b[1]-a[1])*progress;
        const angle=stair.yaw*Math.PI/180;
        const x=stair.center.x+lx*Math.cos(angle)+lz*Math.sin(angle),z=stair.center.z-lx*Math.sin(angle)+lz*Math.cos(angle);
        const predicted=stair.center.y+a[2]+(b[2]-a[2])*progress;
        const y=castleStraightStairHeight(stair,x,z,predicted) ?? predicted;
        return {x,z,y,tolerance:.075};
      };
      const verifyFlight=async(stair,ascending)=>{
        for(let step=ascending?1:stair.steps-1;ascending?step<=stair.steps:step>=1;step+=ascending?1:-1){
          const target=tread(stair,step);
          await walkTo(window,target);
          expect(window.gameMovementTest.state().position.y,'stair '+stair.id+' step '+step).to.be.closeTo(target.y,.45);
          if (step === 4 || step === 18) {
            const angle=stair.yaw*Math.PI/180;
            const dx=target.x-stair.center.x,dz=target.z-stair.center.z;
            const lx=dx*Math.cos(angle)-dz*Math.sin(angle),lz=dx*Math.sin(angle)+dz*Math.cos(angle);
            const surface=castleStraightStairSurfaces(stair).find(s=>s.high>s.low && lx>=s.minX && lx<=s.maxX && lz>=s.minZ && lz<=s.maxZ);
            const count=castleStraightStairStepCount(surface),run=surface.maxZ-surface.minZ;
            const progress=surface.reverse ? (surface.maxZ-lz)/run : (lz-surface.minZ)/run;
            const index=Math.min(count-1,Math.floor(progress*count));
            const centerZ=surface.reverse ? surface.maxZ-run*(index+.5)/count : surface.minZ+run*(index+.5)/count;
            await walkTo(window,{x:stair.center.x+lx*Math.cos(angle)+centerZ*Math.sin(angle),z:stair.center.z-lx*Math.sin(angle)+centerZ*Math.cos(angle),tolerance:.01});
            window.gameMovementTest.move(0,0);
            await new Promise(resolve=>window.setTimeout(resolve,500));
            const resting=window.gameMovementTest.state().position;
            await new Promise(resolve=>window.setTimeout(resolve,1500));
            const stopped=window.gameMovementTest.state().position;
            expect(Math.hypot(stopped.x-resting.x,stopped.z-resting.z),'idle stair drift').to.be.lessThan(.04);
            expect(stopped.y,'idle stair height').to.be.closeTo(resting.y,.04);
          }
        }
      };
      await walkTo(window,{x:groundDoor.x+1.1,z:groundDoor.z});
      await walkTo(window,{x:groundDoor.x-.7,z:groundDoor.z});
      const entryX=upper.center.x+upper.radius+.55, entryZ=upper.center.z;
      await walkTo(window,{x:entryX,z:entryZ});
      await walkTo(window,tread(upper,0));
      await verifyFlight(upper,true);
      await walkTo(window,{x:entryX,z:tread(upper,24).z});
      await walkTo(window,{x:entryX,z:entryZ});
      await walkTo(window,{x:upperDoor.x-.7,z:upperDoor.z});
      await walkTo(window,{x:upperDoor.x+1.1,z:upperDoor.z});
      expect(window.gameMovementTest.state().position.y).to.be.closeTo(upperDoor.y,.2);
      await walkTo(window,{x:upperDoor.x-.7,z:upperDoor.z});
      await walkTo(window,{x:entryX,z:entryZ});
      await walkTo(window,{x:entryX,z:tread(upper,24).z});
      await verifyFlight(upper,false);
      await walkTo(window,{x:entryX,z:entryZ});
      await verifyFlight(lower,false);
      const basementDoor=plan.metadata.runtime.roomDoors.find(d=>d.roomId==='basement-stair-room');
      await walkTo(window,tread(lower,0));
      await walkTo(window,{x:basementDoor.x-.7,z:tread(lower,0).z,tolerance:.025});
      await walkTo(window,{x:basementDoor.x-.7,z:basementDoor.z,tolerance:.01});
      await walkTo(window,{x:basementDoor.x+1.1,z:basementDoor.z,tolerance:.025});
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
      await walkTo(window,{x:basementDoor.x+1.1,z:basementDoor.z,tolerance:.025});
      await walkTo(window,{x:basementDoor.x-.7,z:basementDoor.z,tolerance:.01});
      expect(window.gameMovementTest.state().position.y).to.be.closeTo(basementDoor.y,.2);
      await walkTo(window,{x:basementDoor.x-.7,z:tread(lower,0).z,tolerance:.025});
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
