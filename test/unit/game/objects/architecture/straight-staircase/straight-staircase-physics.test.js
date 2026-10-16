import assert from "node:assert/strict";
import { it } from "node:test";
import { registerHooks } from "node:module";
import { readFileSync } from "node:fs";
import * as pc from "playcanvas";
import Ammo from "sync-ammo/dist/ammo.module.js";
import { castleStraightStairSurfaces, castleStraightStairTreads, castleStraightStairWalls } from "../../../../../../src/game/objects/castle/stairs/CastleStraightStairs.js";

// Keep Vite asset imports as URLs and read the actual masonry shader sources.
const hooks = registerHooks({
  load: (url, context, nextLoad) => {
    if (url.endsWith(".glb?url") || url.endsWith("?raw")) {
      const source = url.endsWith("?raw") ? readFileSync(new URL(url.slice(0, -4)), "utf8") : url;

      return {
        format:"module",
        source:`export default ${JSON.stringify(source)}`,
        shortCircuit:true,
      };
    }
    return nextLoad(url,context);
  },
});
const { StraightStaircase } = await import("../../../../../../src/game/objects/architecture/straight-staircase/StraightStaircase.js");
hooks.deregister();

it("matches every transformed tread query to Ammo, preserves openings and removes owned bodies", () => {
  const previousAmmo = globalThis.Ammo;
  globalThis.Ammo = Ammo;
  const device = new pc.NullGraphicsDevice({
    width:1,
    height:1,
  });
  const app = new pc.AppBase({id:"straight-staircase-physics"});
  app.init({
    graphicsDevice:device,
    componentSystems:[pc.RenderComponentSystem,pc.CollisionComponentSystem,pc.RigidBodyComponentSystem],
    resourceHandlers:[],
  });
  app.systems.rigidbody.onLibraryLoaded();
  const material = new pc.StandardMaterial();
  const mesh = pc.Mesh.fromGeometry(device,new pc.BoxGeometry());
  // Substitute model assets only; hierarchy, mesh support, components and Ammo are real.
  const modelLibrary = {
    instantiate: () => {
      const entity = new pc.Entity();
      entity.addComponent("render",{meshInstances:[new pc.MeshInstance(mesh,material,entity)]});

      return entity;
    },
    instantiateMerged() {
      return this.instantiate();
    },
  };
  try {
    for (const rotation of [0,90,180,270]) {
      for (const continuesAbove of [false,true]) {
        const definition = {
          id:"stairs",
          object:"StraightStaircase",
          position:{
            x:7,
            y:-3,
            z:-5,
          },
          rotation,
          radius:1.35,
          rise:3,
          flightGap:0.5,
          landingLift:0.3,
          flightShift:0.2,
          continuesAbove,
          flightBounds:{
            minX:-1.47,
            maxX:1.38,
            inner:0.12,
          },
          landingBack:-1.7,
          tile:{
            col:0,
            row:0,
          },
        };
        const stair = new StraightStaircase({
          pc,
          app,
          modelLibrary,
          definition,
          runtime:{
            mapData:{
              islandConnectorData:{
                nearIsland:["0,0"],
                farIsland:[],
              },
            },
          },
        });
        app.root.addChild(stair.entity);
        stair.onSceneReady();
        stair.setIslandOffsets(1.25,8);
        app.root.syncHierarchy();
        const root = stair.visualRoots[0];
        const transform = root.getWorldTransform();
        const sample = (x,y,z) => transform.transformPoint(new pc.Vec3(x,y,z));
        const ray = (x,y,z) => {
          const from=sample(x,y,z),to=sample(x,-0.2,z);

          return app.systems.rigidbody.raycastFirst(from,to);
        };
        assert.equal(root.getPosition().y,-1.75,"uses its owning island offset");
        assert.equal(stair.entity.findComponents("collision").length,continuesAbove?2:3);
        for (const surface of castleStraightStairSurfaces(definition)) {
          for (const tread of castleStraightStairTreads(surface)) {
            const x=(surface.minX+surface.maxX)/2,z=(tread.front+tread.rear)/2;
            const point=sample(x,tread.height,z);
            const hit=ray(x,tread.height+0.1,z);
            assert.ok(hit,"every tread has physical support");
            assert.ok(Math.abs(hit.point.y-point.y)<1e-5);
            assert.ok(Math.abs(stair.surfaceHeightAt(point.x,point.z,0,point.y+0.001)-point.y)<1e-5);
            assert.equal(stair.surfaceHeightAt(point.x,point.z,0,point.y-0.01),null,"upper treads cannot capture an actor below");
          }
        }
        const [divider] = castleStraightStairWalls(definition);
        const middle=sample(divider.x,divider.y,divider.z);
        assert.equal(stair.blocksCameraAt(middle.x,middle.y,middle.z,0.1),true);
        const turning=castleStraightStairSurfaces(definition)[1];
        const turn=sample(0,turning.high+0.5,(turning.minZ+turning.maxZ)/2);
        assert.equal(stair.blocksCameraAt(turn.x,turn.y,turn.z,0.05),false,"divider leaves the turning path open");
        const guard=ray(-0.7,4,definition.radius+definition.flightShift-0.0625);
        assert.ok(Math.abs(guard.point.y-(-1.75+(continuesAbove?0.3:3.75)))<1e-5,"only final flights close the opening with a guard");
        const point=sample(-0.7,4,0.8);
        const bottom=sample(-0.7,-0.2,0.8);
        stair.destroy();
        assert.equal(app.systems.rigidbody.raycastFirst(point,bottom),null,"destroy removes all staircase bodies");
        assert.equal(app.hasEvent("update"),false,"destroy releases the masonry frame update");
      }
    }
  } finally {
    app.destroy();
    globalThis.Ammo=previousAmmo;
  }
});
