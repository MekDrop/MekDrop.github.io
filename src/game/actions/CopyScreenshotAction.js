import { Notify } from "quasar";
import {
  ClipboardCopyBlockedError,
  ScreenshotEncodingError,
  ScreenshotImagePreparationError,
} from "../errors/screenshot/index.js";

export class CopyScreenshotAction {
  #renderer;

  constructor(renderer) {
    this.#renderer = renderer;
  }

  invoke() {
    void this.copyScreenshot().catch((error) => {
      console.error("[CopyScreenshotAction] Screenshot failed.", error);
    });
  }

  async copyScreenshot() {
    const canvas = this.#renderer.canvasElement;
    const blob = await new Promise((resolve, reject) => {
      canvas.toBlob((result) => {
        if (result) resolve(result);
        else reject(new ScreenshotEncodingError());
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

  async #copyImage(canvas, blob) {
    if (
      typeof ClipboardItem !== "undefined" &&
      typeof navigator.clipboard?.write === "function"
    ) {
      await navigator.clipboard.write([
        new ClipboardItem({
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

  async #copyImageLegacy(canvas) {
    if (typeof document.execCommand !== "function") {
      return false;
    }

    const image = new Image();
    image.src = canvas.toDataURL("image/png");
    await new Promise((resolve, reject) => {
      image.addEventListener("load", resolve, { once: true });
      image.addEventListener(
        "error",
        () =>
          reject(new ScreenshotImagePreparationError()),
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
