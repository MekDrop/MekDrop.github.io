import { WreckerActionState } from "./WreckerActionState.js";

export class WreckerHeadbuttState extends WreckerActionState {
  constructor() {
    super("headbutt_reject_pickup", 0.8, 0.3);
  }
}
