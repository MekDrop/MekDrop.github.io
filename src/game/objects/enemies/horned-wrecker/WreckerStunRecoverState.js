import { WreckerActionState } from "./WreckerActionState.js";

export class WreckerStunRecoverState extends WreckerActionState {
  constructor() {
    super("external_stun_recover", 0.7);
  }
}
