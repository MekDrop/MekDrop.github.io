describe("Tripo castle props", () => {
  for (const batch of [1, 2, 3]) {
    it(`loads all seven textured props on test map ${batch}`, () => {
      let pc;
      let app;
      let definitions;
      cy.readFile(`src/game/maps/tests/castle-props-${batch}.json`).then((map) => {
        definitions = map.objects;
      });
      cy.request("/src/game/PlayCanvasRenderer.js").then(({ body }) => {
        const engineUrl = body.match(/import \* as playCanvas from "([^"]+)"/)[1];
        cy.wrap(engineUrl).as("engineUrl");
      });
      cy.viewport(1280, 720);
      cy.intercept("https://www.googletagmanager.com/**", {
        statusCode: 204,
        body: "",
      });
      cy.visit(`/map/test_castle-props-${batch}?camera-test`);
      cy.get('.background-canvas[data-game-ready="true"]', { timeout: 60000 })
        .should("have.attr", "data-map-name", `test_castle-props-${batch}`);
      cy.get("[data-game-loading-scene]", { timeout: 30000 }).should("not.exist");
      cy.get("@engineUrl").then((engineUrl) => cy.window().then(async (window) => {
        pc = await window.Function("url", "return import(url)")(engineUrl);
        app = pc.Application.getApplication();
        for (const definition of definitions) {
          const visual = app.root.findByTag(definition.id, definition.object)[0];
          expect(visual, definition.id).to.exist;
          const meshes = visual.findComponents("render").flatMap((render) => render.meshInstances);
          expect(meshes.length, `${definition.id} visible geometry`).to.be.greaterThan(0);
          expect(visual.rigidbody?.body, `${definition.id} native Ammo body`).to.exist;
          expect(visual.collision.type, `${definition.id} triangle collision`).to.equal("mesh");
          const instance = meshes[0];
          const positions = [];
          const indices = [];
          instance.mesh.getPositions(positions);
          instance.mesh.getIndices(indices);
          let hit = false;
          for (let triangle = 0; triangle < Math.min(indices.length, 300) && !hit; triangle += 3) {
            const points = indices.slice(triangle, triangle + 3).map((index) =>
              instance.node.getWorldTransform().transformPoint(new pc.Vec3(...positions.slice(index * 3, index * 3 + 3))));
            const normal = new pc.Vec3().cross(points[1].clone().sub(points[0]), points[2].clone().sub(points[0]));
            if (normal.length() < 0.000001) continue;
            normal.normalize().mulScalar(0.05);
            const center = points[0].clone().add(points[1]).add(points[2]).mulScalar(1 / 3);
            hit = app.systems.rigidbody.raycastAll(center.clone().add(normal), center.clone().sub(normal))
              .some((result) => result.entity === visual);
          }
          expect(hit, `${definition.id} actual Ammo surface ray hit`).to.equal(true);
          const minimum = Math.min(...meshes.map((mesh) => mesh.aabb.getMin().y));
          expect(minimum, `${definition.id} ground alignment`).to.be.closeTo(2.002, 0.002);
        }
        window.gameCameraTest.setRotation(0);
        window.gameCameraTest.setZoom(1.8);
        await new window.Promise((resolve) => app.once("postrender", resolve));
        const camera = app.root.findByName("Game camera").camera;
        const point = camera.worldToScreen(new pc.Vec3(0, 2, 0));
        const canvas = app.graphicsDevice.canvas;
        window.gameCameraTest.panBy(canvas.clientWidth / 2 - point.x, canvas.clientHeight / 2 - point.y);
        await new window.Promise((resolve) => app.once("postrender", resolve));
      }));
      cy.get(".background-canvas__surface").should("be.visible");
      cy.screenshot(`castle-props-${batch}-front`);
      cy.window().then(async (window) => {
        window.gameCameraTest.setRotation(2);
        await new window.Promise((resolve) => app.once("postrender", resolve));
      });
      cy.screenshot(`castle-props-${batch}-back`);
      cy.window().then((window) => {
        if (window.gameCameraTest.state().panLimitsEnabled) {
          window.dispatchEvent(new window.KeyboardEvent("keydown", { code: "Pause" }));
          window.dispatchEvent(new window.KeyboardEvent("keyup", { code: "Pause" }));
        }
      });
      cy.then(() => {
        for (const definition of definitions) {
          cy.window().then(async (window) => {
            const visual = app.root.findByTag(definition.id, definition.object)[0];
            const mesh = visual.findComponents("render")[0].meshInstances[0];
            window.gameCameraTest.setRotation(0);
            window.gameCameraTest.setZoom(Math.min(30, 3 / mesh.aabb.halfExtents.y));
            await new window.Promise((resolve) => app.once("postrender", resolve));
            const camera = app.root.findByName("Game camera").camera;
            const point = camera.worldToScreen(mesh.aabb.center);
            const canvas = app.graphicsDevice.canvas;
            window.gameCameraTest.panBy(canvas.clientWidth / 2 - point.x, canvas.clientHeight / 2 - point.y);
            await new window.Promise((resolve) => app.once("postrender", resolve));
            const centered = camera.worldToScreen(mesh.aabb.center);
            expect(centered.x, `${definition.id} screenshot centered X`).to.be.closeTo(canvas.clientWidth / 2, 8);
            expect(centered.y, `${definition.id} screenshot centered Y`).to.be.closeTo(canvas.clientHeight / 2, 8);
          });
          cy.screenshot(`castle-prop-${definition.id}`);
        }
      });
    });
  }
});
