export class ClipboardCopyBlockedError extends Error {
  constructor() {
    super(
      "This browser blocked both Async Clipboard and legacy image copying. " +
        "Open the site over HTTPS or localhost and allow clipboard access.",
    );
    this.name = this.constructor.name;
  }
}
