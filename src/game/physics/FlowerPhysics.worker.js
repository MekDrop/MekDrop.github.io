import { AmmoRuntime } from "./AmmoRuntime.js";
import { FlowerPhysicsSimulation } from "./FlowerPhysicsSimulation.js";
import { FLOWER_WORKER_MESSAGE as MESSAGE } from "../enum/FlowerWorkerMessage.js";

/**
 * @type {FlowerPhysicsSimulation|null}
 */
let simulation = null;

/**
 * @param {MessageEvent} event
 */
self.onmessage = async (event) => {
  const { type } = event.data;
  try {
    if (type === MESSAGE.INITIALIZE) {
      await AmmoRuntime.initialize();
      simulation = new FlowerPhysicsSimulation(event.data.definitions, event.data.gravity);
      self.postMessage({ type: MESSAGE.READY });
    } else if (type === MESSAGE.STEP && simulation) {
      const transforms = simulation.step(event.data);
      self.postMessage({ type: MESSAGE.RESULT, transforms }, [transforms.buffer]);
    }
  } catch (error) {
    self.postMessage({ type: MESSAGE.FAILED, detail: String(error) });
  }
};
