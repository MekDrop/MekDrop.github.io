export class HeroPatGesture {
  #window = window;
  #canvas;
  #hitTest;
  #pat;
  #pointerId = null;
  #previous = null;
  #distance = 0;

  constructor(canvas, { hitTest, pat }) {
    this.#canvas = canvas;
    this.#hitTest = hitTest;
    this.#pat = pat;
    canvas.addEventListener("pointerdown", this.#down, { capture: true });
    canvas.addEventListener("pointermove", this.#move, { capture: true });
    canvas.addEventListener("pointerup", this.#up, { capture: true });
    canvas.addEventListener("pointercancel", this.#up, { capture: true });
    canvas.addEventListener("lostpointercapture", this.#up, { capture: true });
    this.#window.addEventListener("blur", this.cancel);
  }

  #consume(event) {
    event.preventDefault();
    event.stopImmediatePropagation();
  }

  #down = (event) => {
    if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey
      || event.pointerType !== "mouse" || event.button !== 0
      || this.#pointerId !== null || !this.#hitTest(event)) {
      return;
    }
    this.#consume(event);
    this.#pointerId = event.pointerId;
    this.#previous = { x: event.clientX, y: event.clientY };
    this.#canvas.setPointerCapture(event.pointerId);
    this.#pat();
  };

  #move = (event) => {
    if (event.pointerType !== "mouse") {
      return;
    }
    const overHead = this.#hitTest(event);
    if (event.pointerId !== this.#pointerId) {
      return;
    }
    this.#consume(event);
    if (!(event.buttons & 1)) {
      this.cancel();
      return;
    }
    if (overHead) {
      this.#distance += Math.hypot(
        event.clientX - this.#previous.x, event.clientY - this.#previous.y,
      );
      if (this.#distance >= 14) {
        this.#pat();
        this.#distance = 0;
      }
    } else {
      this.#distance = 0;
    }
    this.#previous = { x: event.clientX, y: event.clientY };
  };

  #up = (event) => {
    if (event.pointerId === this.#pointerId) {
      this.#consume(event);
      this.cancel();
    }
  };

  cancel = () => {
    const pointerId = this.#pointerId;
    this.#pointerId = null;
    this.#previous = null;
    this.#distance = 0;
    if (pointerId !== null && this.#canvas.hasPointerCapture(pointerId)) {
      this.#canvas.releasePointerCapture(pointerId);
    }
  };

  destroy() {
    this.cancel();
    this.#canvas.removeEventListener("pointerdown", this.#down, { capture: true });
    this.#canvas.removeEventListener("pointermove", this.#move, { capture: true });
    this.#canvas.removeEventListener("pointerup", this.#up, { capture: true });
    this.#canvas.removeEventListener("pointercancel", this.#up, { capture: true });
    this.#canvas.removeEventListener("lostpointercapture", this.#up, { capture: true });
    this.#window.removeEventListener("blur", this.cancel);
  }
}
