describe("Terrace stairhead door", () => {
  it("uses the shared Door for its imported clip, hinge, handle and click interaction", () => {
    let engineUrl;
    cy.request("/src/game/PlayCanvasRenderer.js").then(({ body }) => {
      engineUrl = body.match(/import \* as playCanvas from "([^"]+)"/)[1];
    });
    cy.visit("/en/map/test_flat?camera-test");
    cy.get('.background-canvas[data-game-ready="true"]', { timeout: 60000 }).should("be.visible");
    cy.window().then({ timeout: 60000 }, async (window) => {
      const load = window.Function("url", "return import(url)");
      const pc = await load(engineUrl);
      const { Door } = await load("/src/game/objects/architecture/door/Door.js");
      const { terraceDoorModel } = await load("/src/game/objects/architecture/door/DoorModels.js");
      const { GameModelLibrary } = await load("/src/game/models/GameModelLibrary.js");
      const app = pc.Application.getApplication();
      const library = new GameModelLibrary({
        pc,
        app,
      });
      await library.load([terraceDoorModel.modelUrl, terraceDoorModel.frameModelUrl]);
      let clicks = 0;
      const door = new Door({
        ...terraceDoorModel,
        pc,
        modelLibrary: library,
        onOpen: () => {
          clicks++;

          return true;
        },
      });
      door.entity.setLocalPosition(100, 20, 100);
      app.root.addChild(door.entity);
      try {
        expect(door.constructor.name).to.equal("Door");
        expect(door.entity.findComponents("anim")[0].entity.parent).to.equal(door.entity);
        expect(door.insideHandle).to.exist;
        const closedRotation = door.hingeRotation.clone();
        door.updateHeroPosition({
          x: 100,
          y: 20,
          z: 100,
        });
        door.update(1);
        expect(door.openAmount, "scripted door ignores proximity").to.equal(0);
        expect(door.handlePointerDown()).to.equal(true);
        expect(clicks).to.equal(1);
        door.update(0.5, true, 0.65);
        expect(door.openAmount, "wind opening speed").to.be.closeTo(0.325, 0.00001);
        expect(Math.abs(door.hingeRotation.dot(closedRotation)), "authored hinge rotates").to.be.lessThan(0.999);
        door.update(2, true, 0.65);
        expect(door.openAmount).to.equal(1);
        door.update(1, false);
        expect(door.openAmount).to.equal(0);
        expect(Math.abs(door.hingeRotation.dot(closedRotation)), "authored hinge closes").to.be.closeTo(1, 0.00001);
      } finally {
        door.destroy();
        library.destroy();
      }
    });
  });
});
