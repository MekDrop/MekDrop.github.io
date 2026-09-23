import assert from "node:assert/strict";
import { it } from "node:test";
import { Notify } from "quasar";

const importWindow = globalThis.window;
const importDocument = globalThis.document;
globalThis.window = importWindow ?? {};
globalThis.document = importDocument ?? {};
const {
  reportGlobalException,
  runtimeErrorDescription,
} = await import("../../src/boot/runtime-errors.js");
globalThis.window = importWindow;
globalThis.document = importDocument;

it("preserves useful details from global exceptions", () => {
  assert.equal(runtimeErrorDescription(new TypeError("bad animation")),
    "bad animation");
  assert.equal(runtimeErrorDescription({ message: "rejected render" }),
    "rejected render");
  assert.equal(runtimeErrorDescription("plain failure"), "plain failure");
});

it("provides a safe description for unknown rejection values", () => {
  assert.equal(runtimeErrorDescription(null), "An unknown error occurred.");
});

it("counts down and reloads immediately from the recovery action", () => {
  const originalCreate = Notify.create;
  const originalError = console.error;
  const originalNow = Date.now;
  const originalWindow = globalThis.window;
  const originalSetInterval = globalThis.setInterval;
  const originalClearInterval = globalThis.clearInterval;
  let now = 10_000;
  let notification;
  let intervalCallback;
  let reloaded = 0;
  const clearedIntervals = [];

  try {
    Notify.create = (options) => {
      notification = options;
      return (updatedOptions) => {
        notification = updatedOptions;
      };
    };
    console.error = () => null;
    Date.now = () => now;
    globalThis.clearInterval = (id) => clearedIntervals.push(id);
    globalThis.setInterval = (callback) => {
      intervalCallback = callback;
      return 11;
    };
    globalThis.window = {
      location: {
        reload: () => {
          reloaded += 1;
        },
      },
    };

    reportGlobalException("reload recovery", { context: "Countdown test" });
    assert.equal(notification.actions[0].label, "Refresh (30s)");

    now += 1_001;
    intervalCallback();
    assert.equal(notification.actions[0].label, "Refresh (29s)");

    notification.actions[0].handler();
    assert.equal(reloaded, 1);
    assert.deepEqual(clearedIntervals, [11]);
  } finally {
    Notify.create = originalCreate;
    console.error = originalError;
    Date.now = originalNow;
    globalThis.window = originalWindow;
    globalThis.setInterval = originalSetInterval;
    globalThis.clearInterval = originalClearInterval;
  }
});

it("reloads automatically when the recovery timer expires", () => {
  const originalCreate = Notify.create;
  const originalError = console.error;
  const originalWindow = globalThis.window;
  const originalSetInterval = globalThis.setInterval;
  const originalClearInterval = globalThis.clearInterval;
  let intervalCallback;
  let reloaded = 0;

  try {
    Notify.create = () => () => null;
    console.error = () => null;
    globalThis.clearInterval = () => null;
    globalThis.setInterval = (callback) => {
      intervalCallback = callback;
      return 21;
    };
    globalThis.window = {
      location: {
        reload: () => {
          reloaded += 1;
        },
      },
    };

    reportGlobalException("automatic recovery", { context: "Timer test" });
    for (let remainingSeconds = 30; remainingSeconds > 0; remainingSeconds -= 1) {
      intervalCallback();
    }
    assert.equal(reloaded, 1);
  } finally {
    Notify.create = originalCreate;
    console.error = originalError;
    globalThis.window = originalWindow;
    globalThis.setInterval = originalSetInterval;
    globalThis.clearInterval = originalClearInterval;
  }
});

it("dismisses the recovery notification and cancels its reload timer", () => {
  const originalCreate = Notify.create;
  const originalError = console.error;
  const originalWindow = globalThis.window;
  const originalSetInterval = globalThis.setInterval;
  const originalClearInterval = globalThis.clearInterval;
  let notification;
  let dismissed = 0;
  let reloaded = 0;
  const clearedIntervals = [];

  try {
    Notify.create = (options) => {
      notification = options;
      return (updatedOptions) => {
        if (updatedOptions) {
          notification = updatedOptions;
          return;
        }
        dismissed += 1;
      };
    };
    console.error = () => null;
    globalThis.clearInterval = (id) => clearedIntervals.push(id);
    globalThis.setInterval = () => 31;
    globalThis.window = {
      location: {
        reload: () => {
          reloaded += 1;
        },
      },
    };

    reportGlobalException("dismiss recovery", { context: "Dismiss test" });
    assert.equal(notification.actions[1].label, "Dismiss");
    notification.actions[1].handler();

    assert.equal(dismissed, 1);
    assert.equal(reloaded, 0);
    assert.deepEqual(clearedIntervals, [31]);
  } finally {
    Notify.create = originalCreate;
    console.error = originalError;
    globalThis.window = originalWindow;
    globalThis.setInterval = originalSetInterval;
    globalThis.clearInterval = originalClearInterval;
  }
});
