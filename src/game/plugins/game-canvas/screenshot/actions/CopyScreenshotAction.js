import { Notify } from "quasar";
import { useClipboardItems } from "@vueuse/core";
import {
  ClipboardCopyBlockedError,
  ScreenshotEncodingError,
  ScreenshotImagePreparationError,
} from "../../../../errors/screenshot/index.js";
import { isFunction } from "../../../../helpers/types.js";

export class CopyScreenshotAction {
  /**
   *
   * @type {{copy: (items: ClipboardItem[]) => Promise<void>, isSupported: boolean}}
   */
  #clipboard = useClipboardItems();
  /**
   *
   * @type {PlayCanvasRenderer}
   */
  #renderer;

  /**
   *
   * @param {PlayCanvasRenderer} renderer
   */
  constructor(renderer) {
    /**
     *
     * @type {PlayCanvasRenderer}
     */
    this.#renderer = renderer;
  }

  invoke() {
    void this.copyScreenshot().catch(/**
     *
     * @param {Error} error
     */
    (error) => {
      console.error("[CopyScreenshotAction] Screenshot failed.", error);
    });
  }

  async copyScreenshot() {
    const canvas = this.#renderer.canvasElement;
    const blob = await new Promise(/**
     *
     * @param {(value?: (value?: void) => void) => void} resolve
     * @param {(reason?: Error) => void} reject
     */
    (resolve, reject) => {
      canvas.toBlob(/**
       *
       * @param {{success: boolean, value?: string|number|boolean}} result
       */
      (result) => {
        if (result) {
          resolve(result);
        } else {
          reject(new ScreenshotEncodingError());
        }
      }, "image/png");
    });

    await this.#copyImage(canvas, blob);
    Notify.create({
      type: "positive",
      position: "bottom-right",
      message: this.#renderer.t("game.notification.screenshot_copied"),
      timeout: 2000,
    });
    return blob;
  }

  /**
   *
   * @param {HTMLCanvasElement} canvas
   * @param {Blob} blob
   */
  async #copyImage(canvas, blob) {
    if (
      isFunction(globalThis.ClipboardItem) &&
      this.#clipboard.isSupported.value
    ) {
      await this.#clipboard.copy([
        new globalThis.ClipboardItem({
          [blob.type]: blob,
        }),
      ]);
      return;
    }

    console.warn(
      "[CopyScreenshotAction] Async Clipboard API unavailable; using legacy image copy.",
    );

    if (!(await this.#copyImageLegacy(canvas))) {
      throw new ClipboardCopyBlockedError();
    }
  }

  /**
   *
   * @param {HTMLCanvasElement} canvas
   */
  async #copyImageLegacy(canvas) {
    if (!isFunction(document.execCommand)) {
      return false;
    }

    const image = new Image();
    image.src = canvas.toDataURL("image/png");
    await new Promise(/**
     *
     * @param {(value?: (value?: void) => void) => void} resolve
     * @param {(reason?: Error) => void} reject
     */
    (resolve, reject) => {
      image.addEventListener("load", resolve, { once: true });
      image.addEventListener(
        "error",
        () => reject(new ScreenshotImagePreparationError()),
        { once: true },
      );
    });

    const wrapper = document.createElement("div");
    wrapper.contentEditable = "true";
    wrapper.style.position = "fixed";
    wrapper.style.left = "-10000px";
    wrapper.style.top = "0";
    wrapper.appendChild(image);
    document.body.appendChild(wrapper);

    const selection = window.getSelection();
    const range = document.createRange();
    range.selectNodeContents(wrapper);
    selection?.removeAllRanges();
    selection?.addRange(range);

    try {
      return document.execCommand("copy");
    } finally {
      selection?.removeAllRanges();
      wrapper.remove();
    }
  }
}
