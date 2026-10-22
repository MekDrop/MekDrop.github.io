import { WreckerActionState } from "./WreckerActionState.js";

export class WreckerFistSwingState extends WreckerActionState {
  constructor() {
    super("fist_swing", 0.3, 0.18);
  }
}
