export class CopyScreenshotAction {
  #renderer;
  #onCopied;

  constructor(renderer, onCopied = () => {}) {
    this.#renderer = renderer;
    this.#onCopied = onCopied;
  }

  async copyScreenshot() {
    const canvas = this.#renderer.getCanvas();
    const blob = await new Promise((resolve, reject) => {
      canvas.toBlob((result) => {
        if (result) resolve(result);
        else reject(new Error("Could not encode the game screenshot."));
      }, "image/png");
    });

    await this.#copyImage(canvas, blob);
    this.#onCopied(blob);
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
      throw new Error(
        "This browser blocked both Async Clipboard and legacy image copying. " +
          "Open the site over HTTPS or localhost and allow clipboard access.",
      );
    }
  }

  async #copyImageLegacy(canvas) {
    if (typeof document.execCommand !== "function") return false;

    const image = new Image();
    image.src = canvas.toDataURL("image/png");
    await new Promise((resolve, reject) => {
      image.addEventListener("load", resolve, { once: true });
      image.addEventListener(
        "error",
        () =>
          reject(new Error("Could not prepare the screenshot for copying.")),
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
