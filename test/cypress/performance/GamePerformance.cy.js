const GAME_READY_BUDGET_MS = 15000;
const WARMUP_DURATION_MS = 1000;
const SAMPLE_DURATION_MS = 4000;
const MINIMUM_GAME_FPS = 50;
const AVERAGE_FRAME_BUDGET_MS = 20;
const P95_FRAME_BUDGET_MS = 35;
const LONG_FRAME_THRESHOLD_MS = 100;
const MAX_LONG_FRAME_RATIO = 0.05;

function sampleFrameTimes(win, durationMs) {
  return new Cypress.Promise((resolve) => {
    const frameTimes = [];
    const startedAt = win.performance.now();
    let previousFrameAt = startedAt;

    function recordFrame(frameAt) {
      frameTimes.push(frameAt - previousFrameAt);
      previousFrameAt = frameAt;

      if (frameAt - startedAt >= durationMs) {
        resolve(frameTimes);
        return;
      }

      win.requestAnimationFrame(recordFrame);
    }

    win.requestAnimationFrame(recordFrame);
  });
}

function summarizeFrameTimes(frameTimes) {
  const sortedFrameTimes = [...frameTimes].sort((left, right) => left - right);
  const totalFrameTime = frameTimes.reduce(
    (total, frameTime) => total + frameTime,
    0,
  );
  const percentileIndex = Math.min(
    sortedFrameTimes.length - 1,
    Math.ceil(sortedFrameTimes.length * 0.95) - 1,
  );
  const longFrames = frameTimes.filter(
    (frameTime) => frameTime > LONG_FRAME_THRESHOLD_MS,
  );

  return {
    average: totalFrameTime / frameTimes.length,
    p95: sortedFrameTimes[percentileIndex],
    longFrameRatio: longFrames.length / frameTimes.length,
    sampleSize: frameTimes.length,
  };
}

describe("Game performance", () => {
  it("loads within budget and maintains responsive frame pacing", () => {
    const visitStartedAt = Date.now();
    let readyDuration = 0;
    let graphicsBackend = "unknown";

    cy.visit("/", {
      onBeforeLoad(win) {
        cy.stub(win.console, "error").as("consoleError");
      },
    });
    cy.get('.background-canvas[data-game-ready="true"]', {
      timeout: GAME_READY_BUDGET_MS,
    })
      .invoke("attr", "data-graphics-backend")
      .should("match", /^(webgpu|webgl2)$/)
      .then((backend) => {
        graphicsBackend = backend;
        readyDuration = Date.now() - visitStartedAt;
        expect(
          readyDuration,
          `game ready time (${readyDuration} ms)`,
        ).to.be.lessThan(GAME_READY_BUDGET_MS);
        if (backend === "webgl2") {
          cy.get(".site-notice-dialog", { timeout: 5000 })
            .should("be.visible")
            .and("contain.text", "WebGPU is unavailable");
          cy.get(".site-notice-dialog .q-btn").contains("OK").click();
          return;
        }

        cy.get(".site-notice-dialog").should("not.exist");
      });

    cy.window().then((win) => {
      win.dispatchEvent(new KeyboardEvent("keydown", { code: "Pause" }));
    });
    cy.get(".background-canvas").should(
      "have.attr",
      "data-debug-visible",
      "true",
    );
    cy.get(".background-canvas").should(($game) => {
      const framesPerSecond = Number($game.attr("data-game-fps"));
      expect(framesPerSecond, "measured game FPS").to.be.at.least(
        MINIMUM_GAME_FPS,
      );
    });

    cy.window()
      .then((win) => sampleFrameTimes(win, WARMUP_DURATION_MS))
      .then(() => cy.window())
      .then((win) => sampleFrameTimes(win, SAMPLE_DURATION_MS))
      .then((frameTimes) => {
        const metrics = summarizeFrameTimes(frameTimes);
        const summary = [
          `${graphicsBackend} backend`,
          `${readyDuration} ms ready`,
          `${metrics.sampleSize} frames`,
          `${metrics.average.toFixed(1)} ms average`,
          `${metrics.p95.toFixed(1)} ms p95`,
          `${(metrics.longFrameRatio * 100).toFixed(1)}% long frames`,
        ].join(", ");

        cy.log(summary);
        expect(metrics.sampleSize, "captured frame count").to.be.greaterThan(
          0,
        );
        expect(metrics.average, `average frame time (${summary})`).to.be.lessThan(
          AVERAGE_FRAME_BUDGET_MS,
        );
        expect(metrics.p95, `p95 frame time (${summary})`).to.be.lessThan(
          P95_FRAME_BUDGET_MS,
        );
        expect(
          metrics.longFrameRatio,
          `long-frame ratio (${summary})`,
        ).to.be.at.most(MAX_LONG_FRAME_RATIO);
        return cy.task("reportGamePerformance", summary);
      });
    cy.get("@consoleError").then((consoleError) => {
      const messages = consoleError
        .getCalls()
        .map((call) => call.args.map(String).join(" "))
        .join("\n");
      expect(consoleError, `console errors:\n${messages}`).not.to.have.been
        .called;
    });
  });

  it("explains the WebGL fallback and waits for confirmation", () => {
    cy.visit("/", {
      onBeforeLoad(win) {
        Object.defineProperty(win.navigator, "gpu", {
          configurable: true,
          value: undefined,
        });
        cy.stub(win.console, "error").as("consoleError");
      },
    });

    cy.get('.background-canvas[data-game-ready="true"]', {
      timeout: GAME_READY_BUDGET_MS,
    }).should("have.attr", "data-graphics-backend", "webgl2");
    cy.get(".site-notice-dialog")
      .should("be.visible")
      .and("contain.text", "WebGPU is unavailable");
    cy.get(".site-notice-dialog .q-btn").contains("OK").click();
    cy.get(".site-notice-dialog").should("not.exist");
    cy.get("@consoleError").should("not.have.been.called");
  });
});
