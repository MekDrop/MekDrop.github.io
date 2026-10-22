import { WreckerActionState } from "./WreckerActionState.js";

export class WreckerBatterState extends WreckerActionState {
  constructor() {
    super("door_batter", 1.2, 0.6);
  }
}
