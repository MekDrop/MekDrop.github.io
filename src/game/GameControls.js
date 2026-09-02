export class GameControls {
  #element;
  #config;
  #actions;
  #dragPointerId = null;
  #dragX = 0;
  #dragY = 0;

  constructor(element, config, actions) {
    this.#element = element;
    this.#config = config;
    this.#actions = actions;
  }

  connect() {
    window.addEventListener("keydown", this.#handleKeydown, true);
    this.#element.addEventListener("wheel", this.#handleWheel, {
      passive: false,
    });
    this.#element.addEventListener("pointerdown", this.#handlePointerDown);
    this.#element.addEventListener("pointermove", this.#handlePointerMove);
    this.#element.addEventListener("pointerup", this.#handlePointerUp);
    this.#element.addEventListener("pointercancel", this.#handlePointerUp);
  }

  disconnect() {
    window.removeEventListener("keydown", this.#handleKeydown, true);
    this.#element.removeEventListener("wheel", this.#handleWheel);
    this.#element.removeEventListener("pointerdown", this.#handlePointerDown);
    this.#element.removeEventListener("pointermove", this.#handlePointerMove);
    this.#element.removeEventListener("pointerup", this.#handlePointerUp);
    this.#element.removeEventListener("pointercancel", this.#handlePointerUp);
  }

  #handleKeydown = (event) => {
    if (this.#matchesKey(event, this.#config.copyScreenshot)) {
      event.preventDefault();
      this.#copyScreenshot();
      return;
    }

    if (this.#isEditable(event.target)) return;

    const bindings = [
      ["zoomIn", () => this.#actions.zoom.zoomIn()],
      ["zoomOut", () => this.#actions.zoom.zoomOut()],
      ["moveUp", () => this.#actions.moveCamera.moveUp()],
      ["moveDown", () => this.#actions.moveCamera.moveDown()],
      ["moveLeft", () => this.#actions.moveCamera.moveLeft()],
      ["moveRight", () => this.#actions.moveCamera.moveRight()],
      [
        "rotateAnticlockwise",
        () => this.#actions.rotateView.rotateAnticlockwise(),
      ],
      ["rotateClockwise", () => this.#actions.rotateView.rotateClockwise()],
      ["toggleArrows", () => this.#actions.toggleArrows.toggleArrows()],
      ["regenerateMap", () => this.#actions.regenerateMap.regenerateMap()],
    ];

    for (const [name, invoke] of bindings) {
      if (!this.#matchesKey(event, this.#config[name])) continue;
      event.preventDefault();
      invoke();
      return;
    }
  };

  #handleWheel = (event) => {
    event.preventDefault();
    const rect = this.#element.getBoundingClientRect();
    const pivot = {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
    };
    const direction = event.deltaY < 0 ? "up" : "down";

    if (this.#config.zoomIn.wheelDirection === direction) {
      this.#actions.zoom.zoomIn(pivot);
    } else if (this.#config.zoomOut.wheelDirection === direction) {
      this.#actions.zoom.zoomOut(pivot);
    }
  };

  #handlePointerDown = (event) => {
    if (event.button !== this.#config.dragCamera.mouseButton) return;

    event.preventDefault();
    this.#dragPointerId = event.pointerId;
    this.#dragX = event.clientX;
    this.#dragY = event.clientY;
    this.#element.setPointerCapture(event.pointerId);
  };

  #handlePointerMove = (event) => {
    if (event.pointerId !== this.#dragPointerId) return;

    const deltaX = event.clientX - this.#dragX;
    const deltaY = event.clientY - this.#dragY;
    this.#dragX = event.clientX;
    this.#dragY = event.clientY;
    this.#actions.moveCamera.moveBy(deltaX, deltaY);
  };

  #handlePointerUp = (event) => {
    if (event.pointerId !== this.#dragPointerId) return;

    this.#dragPointerId = null;
    if (this.#element.hasPointerCapture(event.pointerId)) {
      this.#element.releasePointerCapture(event.pointerId);
    }
  };

  #matchesKey(event, binding) {
    if (!binding?.keys.includes(event.code)) return false;
    if (binding.ctrlKey !== undefined && binding.ctrlKey !== event.ctrlKey) {
      return false;
    }
    return binding.allowRepeat !== false || !event.repeat;
  }

  #copyScreenshot() {
    console.log("[GameControls] Ctrl+S received; capturing screenshot...");
    void this.#actions.copyScreenshot
      .copyScreenshot()
      .then(() => {
        console.log("[GameControls] Screenshot copied to clipboard.");
      })
      .catch((error) => {
        console.error("[GameControls] Screenshot failed.", error);
      });
  }

  #isEditable(target) {
    return (
      target instanceof HTMLElement &&
      (target.isContentEditable ||
        ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName))
    );
  }
}
