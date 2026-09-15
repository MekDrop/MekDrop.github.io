import { RecordingCanvasUnavailableError } from "../errors/recording/index.js";

/** Composes game pixels and a software cursor; keeps UI borders out of the video. */
export class RecordingCanvas {
  #source;
  #canvas;
  #context;
  #pointer = null;

  constructor(source) {
    this.#source = source;
    if (!source.width || !source.height) {
      throw new RecordingCanvasUnavailableError();
    }
    // Keep native detail up to 4K; avoid enlarging smaller source canvases.
    const scale = Math.min(1, 3840 / source.width, 2160 / source.height);
    this.#canvas = document.createElement("canvas");
    this.#canvas.width = Math.max(2, Math.floor(source.width * scale / 2) * 2);
    this.#canvas.height = Math.max(2, Math.floor(source.height * scale / 2) * 2);
    this.#context = this.#canvas.getContext("2d", { alpha: false });
    if (!this.#context) {
      throw new RecordingCanvasUnavailableError();
    }
    window.addEventListener("pointermove", this.#move, true);
    window.addEventListener("pointerdown", this.#move, true);
    window.addEventListener("blur", this.#leave);
    document.addEventListener("pointerleave", this.#leave);
  }

  get canvas() {
    return this.#canvas;
  }

  #move = (event) => {
    this.#pointer = { x: event.clientX, y: event.clientY };
  };

  #leave = () => {
    this.#pointer = null;
  };

  draw() {
    const context = this.#context;
    const { width, height } = this.#canvas;
    const source = this.#source;
    const scale = Math.min(width / source.width, height / source.height);
    const drawnWidth = source.width * scale;
    const drawnHeight = source.height * scale;
    const left = (width - drawnWidth) / 2;
    const top = (height - drawnHeight) / 2;
    context.fillStyle = "#000";
    context.fillRect(0, 0, width, height);
    context.drawImage(source, left, top, drawnWidth, drawnHeight);
    const rect = source.getBoundingClientRect();
    const pointer = this.#pointer;
    if (!pointer || !rect.width || !rect.height ||
      pointer.x < rect.left || pointer.x >= rect.right ||
      pointer.y < rect.top || pointer.y >= rect.bottom) {
      return;
    }
    const hovered = document.elementFromPoint(pointer.x, pointer.y);
    if (hovered !== source) {
      return;
    }
    const cursor = getComputedStyle(source).cursor;
    if (cursor === "none") {
      return;
    }
    context.save();
    context.translate(
      left + (pointer.x - rect.left) / rect.width * drawnWidth,
      top + (pointer.y - rect.top) / rect.height * drawnHeight,
    );
    const cursorScale = Math.max(0.7, drawnWidth / rect.width);
    context.scale(cursorScale, cursorScale);
    context.lineJoin = "round";
    context.lineWidth = 1.6;
    context.strokeStyle = "#fff";
    context.fillStyle = "#171717";
    if (["grab", "grabbing", "pointer"].includes(cursor)) {
      // A compact hand silhouette for patting and camera dragging.
      context.beginPath();
      context.moveTo(0, 0);
      context.lineTo(0, 11);
      context.lineTo(-3, 8);
      context.quadraticCurveTo(-7, 7, -4, 13);
      context.lineTo(1, 20);
      context.lineTo(11, 20);
      context.quadraticCurveTo(15, 13, 12, 8);
      context.lineTo(4, 6);
      context.lineTo(4, 0);
      context.quadraticCurveTo(2, -3, 0, 0);
      context.closePath();
    } else {
      context.beginPath();
      context.moveTo(0, 0);
      context.lineTo(0, 22);
      context.lineTo(5.5, 16.5);
      context.lineTo(9.5, 25);
      context.lineTo(13, 23);
      context.lineTo(9, 15);
      context.lineTo(17, 15);
      context.closePath();
    }
    context.fill();
    context.stroke();
    context.restore();
  }

  destroy() {
    window.removeEventListener("pointermove", this.#move, true);
    window.removeEventListener("pointerdown", this.#move, true);
    window.removeEventListener("blur", this.#leave);
    document.removeEventListener("pointerleave", this.#leave);
    this.#canvas.width = 0;
    this.#canvas.height = 0;
  }
}
