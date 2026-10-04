describe("Castle door swing physics", () => {
  it("limits an imported door against live Ammo masonry and releases it when clear", () => {
    let engineUrl;
    cy.request("/src/game/PlayCanvasRenderer.js").then(({ body }) => {
      engineUrl = body.match(/import \* as playCanvas from "([^"]+)"/)[1];
    });
    cy.visit("/en/map/test_flat?camera-test");
    cy.get('.background-canvas[data-game-ready="true"]', { timeout: 60000 }).should("be.visible");
    cy.window().then({ timeout: 60000 }, async (window) => {
      const load = window.Function("url", "return import(url)");
      const pc = await load(engineUrl);
      const { CastleDoor } = await load("/src/game/objects/castle/CastleDoor.js");
      const { ScenePointerInteraction } = await load("/src/game/objects/shared/ScenePointerInteraction.js");
      const { GameModelLibrary } = await load("/src/game/models/GameModelLibrary.js");
      const app = pc.Application.getApplication();
      const library = new GameModelLibrary({ pc, app });
      await library.load(CastleDoor.modelUrls);
      const door = new CastleDoor({ pc, modelLibrary: library,
        castlePosition: { x: 100, z: 100, width: 8, depth: 8, elevation: 20 },
        door: { side: "NORTH", width: 1, offset: 0 },
        placement: { x: 100, y: 20, z: 100, yaw: 0, height: 2.45 } });
      app.root.addChild(door.entity);
      const collider = door.entity.findByName("Castle moving door plank collider");
      expect(collider, "animated leaf collider").to.exist;
      expect(collider.rigidbody.system.dynamicsWorld, "Ammo world").to.exist;
      expect(collider.rigidbody.body, "native Ammo body").to.exist;
      const hinge = door.entity.findByName("Right interior door hinge");
      const layer = door.entity.anim.baseLayer;
      const duration = layer.activeStateDuration;
      const wall = new pc.Entity("Door swing test masonry");
      app.root.addChild(wall);
      // Sample an intermediate exported pose to place a physical obstacle on its path.
      layer.activeStateCurrentTime = duration * .5;
      door.entity.anim.update(0);
      const sample = hinge.getWorldTransform().transformPoint(new pc.Vec3(1.5, 1, 0));
      wall.setPosition(sample);
      wall.addComponent("collision", { type: "box", halfExtents: new pc.Vec3(.15, 1.2, .15) });
      wall.addComponent("rigidbody", { type: "static" });
      layer.activeStateCurrentTime = 0;
      door.entity.anim.update(0);
      try {
        const leafTransform = collider.getWorldTransform();
        const hit = door.getPointerHit(
          leafTransform.transformPoint(new pc.Vec3(0, 0, -1)),
          leafTransform.transformPoint(new pc.Vec3(0, 0, 1)));
        expect(hit?.pointerTarget, "closed leaf click target").to.equal(door);
        const aimRay = {
          start: leafTransform.transformPoint(new pc.Vec3(0, 0, -8)),
          end: leafTransform.transformPoint(new pc.Vec3(0, 0, 8)),
        };
        const interaction = new ScenePointerInteraction({
          canvas: app.graphicsDevice.canvas,
          sceneObjects: [door],
          pointerRay: () => aimRay,
        });
        const click = new window.PointerEvent("pointerdown", { button: 0, cancelable: true });
        // Camera dragging also uses left clicks and may register before scene picking.
        const canvas = app.graphicsDevice.canvas;
        const drag = (event) => event.preventDefault();
        canvas.addEventListener("pointerdown", drag);
        interaction.connect();
        canvas.dispatchEvent(click);
        interaction.disconnect();
        canvas.removeEventListener("pointerdown", drag);
        expect(click.defaultPrevented, "third-person canvas click is handled").to.equal(true);
        door.update(.1);
        expect(layer.activeStateCurrentTime, "manual trigger advances animation").to.be.greaterThan(0);
        door.openTemporarily(10);
        door.update(1);
        const stopped = layer.activeStateCurrentTime;
        expect(stopped, "stops before the wall").to.be.greaterThan(0).and.lessThan(duration * .6);
        door.update(.1);
        expect(layer.activeStateCurrentTime, "does not creep through the wall").to.be.closeTo(stopped, .001);
        wall.destroy();
        door.update(1);
        expect(layer.activeStateCurrentTime, "opens fully after removing the obstacle").to.be.closeTo(duration, .001);
        const openTransform = collider.getWorldTransform();
        expect(door.getPointerHit(
          openTransform.transformPoint(new pc.Vec3(0, 0, -1)),
          openTransform.transformPoint(new pc.Vec3(0, 0, 1)))?.pointerTarget,
        "fully open leaf stays clickable").to.equal(door);
        door.update(20);
        expect(layer.activeStateCurrentTime, "still closes").to.be.closeTo(0, .001);
      } finally {
        if (wall.parent) wall.destroy();
        door.destroy();
      }
    });
  });
  it("opens a room door by a third-person canvas click on the castle map", () => {
    let engineUrl;
    cy.request("/src/game/PlayCanvasRenderer.js").then(({ body }) => {
      engineUrl = body.match(/import \* as playCanvas from "([^"]+)"/)[1];
    });
    cy.visit("/en/map/mut4dgx7_1bjfzvf?camera-test");
    cy.get('.background-canvas[data-game-ready="true"][data-map-name="mut4dgx7_1bjfzvf"]', { timeout: 60000 }).should("be.visible");
    cy.get("[data-game-loading-scene]").should("not.exist");
    cy.window().then(async (window) => {
      window.gameCameraTest.setRotation(2);
      window.gameCameraTest.setZoom(3);
      await new Promise((resolve) => window.requestAnimationFrame(resolve));
      const pc = await window.Function("url", "return import(url)")(engineUrl);
      const app = pc.Application.getApplication();
      const camera = app.root.findComponents("camera").find((component) => component.enabled && component.entity.enabled);
      const door = app.root.findComponents("anim")
        .find((component) => component.entity.name.startsWith("Castle ") && component.entity.getPosition().y > 5);
      expect(door, "upstairs exterior door").to.exist;
      const collider = door.entity.findByName("Castle moving door plank collider");
      const leaves = app.root.findComponents("rigidbody")
        .filter((component) => component.entity.name === "Castle moving door plank collider")
        .map((component) => ({ entity: component.entity, position: component.entity.getPosition().clone() }));
      const center = door.entity.getWorldTransform().transformPoint(new pc.Vec3(0, 1.15, 0));
      const screen = camera.worldToScreen(center);
      const canvas = app.graphicsDevice.canvas;
      const rect = canvas.getBoundingClientRect();
      canvas.dispatchEvent(new window.PointerEvent("pointerdown", {
        button: 0, pointerType: "mouse", bubbles: true, cancelable: true,
        clientX: rect.left + screen.x, clientY: rect.top + screen.y,
      }));
      await new Promise((resolve) => window.setTimeout(resolve, 250));
      expect(leaves.some(({ entity, position }) => entity.getPosition().distance(position) > .01),
        "canvas click moves a door with hero elsewhere").to.equal(true);
    });
  });

});
