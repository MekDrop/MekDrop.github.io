import assert from "node:assert/strict";
import { it } from "node:test";
import { Notify } from "quasar";
import {
  reportGlobalException,
  runtimeErrorDescription,
} from "../../src/boot/runtime-errors.js";

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
  let now = 10_000;
  let notification;
  let intervalCallback;
  let timeoutDelay;
  let reloaded = 0;
  const clearedIntervals = [];
  const clearedTimeouts = [];

  try {
    Notify.create = (options) => {
      notification = options;
      return (updatedOptions) => {
        notification = updatedOptions;
      };
    };
    console.error = () => null;
    Date.now = () => now;
    globalThis.window = {
      clearInterval: (id) => clearedIntervals.push(id),
      clearTimeout: (id) => clearedTimeouts.push(id),
      location: {
        reload: () => {
          reloaded += 1;
        },
      },
      setInterval: (callback) => {
        intervalCallback = callback;
        return 11;
      },
      setTimeout: (_callback, delay) => {
        timeoutDelay = delay;
        return 12;
      },
    };

    reportGlobalException("reload recovery", { context: "Countdown test" });
    assert.equal(notification.actions[0].label, "Refresh (30s)");
    assert.equal(timeoutDelay, 30_000);

    now += 1_001;
    intervalCallback();
    assert.equal(notification.actions[0].label, "Refresh (29s)");

    notification.actions[0].handler();
    assert.equal(reloaded, 1);
    assert.deepEqual(clearedIntervals, [11]);
    assert.deepEqual(clearedTimeouts, [12]);
  } finally {
    Notify.create = originalCreate;
    console.error = originalError;
    Date.now = originalNow;
    globalThis.window = originalWindow;
  }
});

it("reloads automatically when the recovery timer expires", () => {
  const originalCreate = Notify.create;
  const originalError = console.error;
  const originalWindow = globalThis.window;
  let timeoutCallback;
  let reloaded = 0;

  try {
    Notify.create = () => () => null;
    console.error = () => null;
    globalThis.window = {
      clearInterval: () => null,
      clearTimeout: () => null,
      location: {
        reload: () => {
          reloaded += 1;
        },
      },
      setInterval: () => 21,
      setTimeout: (callback) => {
        timeoutCallback = callback;
        return 22;
      },
    };

    reportGlobalException("automatic recovery", { context: "Timer test" });
    timeoutCallback();
    assert.equal(reloaded, 1);
  } finally {
    Notify.create = originalCreate;
    console.error = originalError;
    globalThis.window = originalWindow;
  }
});

it("dismisses the recovery notification and cancels its reload timer", () => {
  const originalCreate = Notify.create;
  const originalError = console.error;
  const originalWindow = globalThis.window;
  let notification;
  let dismissed = 0;
  let reloaded = 0;
  const clearedIntervals = [];
  const clearedTimeouts = [];

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
    globalThis.window = {
      clearInterval: (id) => clearedIntervals.push(id),
      clearTimeout: (id) => clearedTimeouts.push(id),
      location: {
        reload: () => {
          reloaded += 1;
        },
      },
      setInterval: () => 31,
      setTimeout: () => 32,
    };

    reportGlobalException("dismiss recovery", { context: "Dismiss test" });
    assert.equal(notification.actions[1].label, "Dismiss");
    notification.actions[1].handler();

    assert.equal(dismissed, 1);
    assert.equal(reloaded, 0);
    assert.deepEqual(clearedIntervals, [31]);
    assert.deepEqual(clearedTimeouts, [32]);
  } finally {
    Notify.create = originalCreate;
    console.error = originalError;
    globalThis.window = originalWindow;
  }
});
