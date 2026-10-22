import { WreckerActionState } from "./WreckerActionState.js";

export class WreckerRecoverState extends WreckerActionState {
  constructor() {
    super("charge_stop", 0.75);
  }
}
