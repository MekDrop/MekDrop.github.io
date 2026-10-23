describe("Independent ladder and hatch", () => {
  it("climbs to a locked hatch and reverses without crossing the lid", () => {
    cy.visit("/map/test_locked-ladder?camera-test");
    cy.get('.background-canvas[data-game-ready="true"]', { timeout: 120000 }).should("be.visible");
    let ladder;
    cy.window().then(window => {
      ladder = window.gameMovementTest.mapObjects().find(item => item.object === "Ladder");
      window.gameMovementTest.teleport(ladder.bottom);
    });
    cy.wait(1000);
    cy.window().then(window => {
      const camera = window.gameCameraTest.firstPerson(true).firstPersonCamera;
      const yaw = Math.atan2(ladder.position.x - ladder.bottom.x, ladder.position.z - ladder.bottom.z);
      window.gameCameraTest.lookFirstPersonBy((yaw - Math.atan2(camera.direction.x, camera.direction.z)) * 180 / Math.PI, 0);
      window.gameMovementTest.move(0, 1);
    });
    cy.window({ timeout: 15000 }).should(window => expect(window.gameMovementTest.state().position.y).to.be.greaterThan(ladder.bottom.y + 0.5));
    cy.wait(3000);
    cy.window().then(window => {
      expect(window.gameMovementTest.state().position.y).to.be.lessThan(ladder.top.y - 1.7);
      window.gameMovementTest.move(0, 0);
      window.gameCameraTest.lookFirstPersonBy(0, -65);
    });
    cy.wait(350);
    cy.screenshot("hatch-underside-and-lock");
    cy.window().then(window => window.gameMovementTest.move(0, -1));
    cy.window({ timeout: 15000 }).should(window => expect(window.gameMovementTest.state().position.y).to.be.lessThan(ladder.bottom.y + 0.25));
    cy.window().then(window => window.gameMovementTest.move(0, 0));
  });
  it("places a locked independent hatch above the castle library ladder", () => {
    let bottomY, access;
    cy.visit("/map/test_attic-hatch?camera-test");
    cy.get('.background-canvas[data-game-ready="true"]', { timeout: 120000 }).should("be.visible");
    cy.window().then({ timeout: 90000 }, async window => {
      const definitions = window.gameMovementTest.mapObjects();
      const castle = definitions.find(item => item.object === "Castle");
      const ladder = castle.buildPlan.metadata.runtime.residential.atticAccesses[0];
      expect(ladder.locked).to.equal(true);
      const source = await (await window.fetch("/src/game/PlayCanvasRenderer.js")).text();
      const url = source.match(/from ["']([^"']*playcanvas[^"']*)["']/)[1];
      const pc = await window.eval(`import(${JSON.stringify(url)})`);
      const app = Object.values(pc.AppBase._applications).find(Boolean);
      expect(app.root.findByTag("Ladder")).to.have.length(1);
      expect(app.root.findByTag("Hatch")).to.have.length(1);
      expect(app.root.findByTag("Hatch")[0].getPosition().y).to.be.closeTo(ladder.top.y, 0.01);
      window.gameMovementTest.teleport({
        x: ladder.bottom.x + (ladder.bottom.x - ladder.position.x) * 2,
        y: ladder.bottom.y,
        z: ladder.bottom.z + (ladder.bottom.z - ladder.position.z) * 2,
      });
      const camera = window.gameCameraTest.firstPerson(true).firstPersonCamera;
      const yaw = Math.atan2(ladder.position.x - ladder.bottom.x, ladder.position.z - ladder.bottom.z);
      window.gameCameraTest.lookFirstPersonBy((yaw - Math.atan2(camera.direction.x, camera.direction.z)) * 180 / Math.PI, -30);
      bottomY = ladder.bottom.y;
      access = ladder;
      window.gameMovementTest.teleport(ladder.bottom);
      await new Promise(resolve => window.setTimeout(resolve, 1000));
      window.gameMovementTest.move(0, 1);
      const deadline = Date.now() + 30000;
      while (window.gameMovementTest.state().position.y < ladder.top.y - 1.95 && Date.now() < deadline) {
        await new Promise(resolve => window.setTimeout(resolve, 250));
      }
      expect(window.gameMovementTest.state().position.y, JSON.stringify(window.gameMovementTest.state())).to.be.greaterThan(ladder.top.y - 1.95);
      expect(window.gameMovementTest.state().position.y, "stays beneath locked library hatch").to.be.lessThan(ladder.top.y - 1.7);
      window.gameMovementTest.move(0, 0);

    });
    cy.window().then(window => window.gameMovementTest.move(0, -1));
    cy.window({ timeout: 15000 }).should(window => expect(window.gameMovementTest.state().position.y).to.be.lessThan(bottomY + 0.25));
    cy.window().then(window => {
      window.gameMovementTest.move(0, 0);
      const dx = access.position.x - access.bottom.x, dz = access.position.z - access.bottom.z;
      const length = Math.hypot(dx, dz);
      window.gameMovementTest.teleport({
        x: access.bottom.x - dx / length,
        y: access.bottom.y,
        z: access.bottom.z - dz / length,
      });
      const view = window.gameCameraTest.state().firstPersonCamera;
      const yaw = Math.atan2(dx, dz);
      const pitch = Math.asin(view.direction.y) * 180 / Math.PI;
      window.gameCameraTest.lookFirstPersonBy((yaw - Math.atan2(view.direction.x, view.direction.z)) * 180 / Math.PI, pitch - 60);
    });
    cy.window().should(window => expect(window.gameCameraTest.state().firstPersonCamera.direction.y).to.be.greaterThan(0.7));
    cy.wait(3000);
    cy.window().should(window => {
      const foot = window.gameMovementTest.state().position;
      const eye = window.gameCameraTest.state().firstPersonCamera.position;
      expect(Math.hypot(eye.x - foot.x, eye.z - foot.z), "camera follows settled player pose").to.be.lessThan(0.5);
    });
    cy.screenshot("castle-locked-attic-hatch");
  });
  it("renders separate production previews with transparency", () => {
    cy.visit("/map/test_ladder-climb?camera-test");
    cy.get('.background-canvas[data-game-ready="true"]', { timeout: 120000 }).should("be.visible");
    cy.window().then({ timeout: 120000 }, async window => {
      const source = await (await window.fetch("/src/game/PlayCanvasRenderer.js")).text();
      const url = source.match(/from ["']([^"']*playcanvas[^"']*)["']/)[1];
      const pc = await window.eval(`import(${JSON.stringify(url)})`);
      const app = pc.Application.getApplication(window.document.querySelector(".background-canvas").id) ?? Object.values(pc.AppBase._applications).find(Boolean);
      expect(app, `Application namespace ${url}`).to.exist;
      const { RiftcapPreview } = await window.eval('import("/src/game/objects/enemies/riftcap/RiftcapPreview.js")');
      const result = {};
      for (const name of ["Ladder", "Hatch"]) {
        const root = app.root.findByTag(name).find(node => name !== "Hatch" || node.tags.has("standalone-locked-hatch"));
        expect(root, name).to.exist;
        const preview = await RiftcapPreview.capture({
          pc,
          app,
          entity: name === "Hatch" ? {
            findComponents: root.findComponents.bind(root),
            getRotation: () => root.getRotation().clone().mul(new pc.Quat().setFromEulerAngles(180, 0, 0)),
          } : root,
        }, { download: false });
        expect(preview.visible, `${name} visible pixels`).to.be.greaterThan(500);
        expect(preview.transparent, `${name} transparent pixels`).to.be.greaterThan(1000);
        result[name] = preview.dataUrl.split(",")[1];
      }

      return result;
    }).then(result => {
      cy.writeFile("src/game/objects/architecture/ladder/preview.png", result.Ladder, "base64");
      cy.writeFile("src/game/objects/architecture/hatch/preview.png", result.Hatch, "base64");
    });
  });
});
