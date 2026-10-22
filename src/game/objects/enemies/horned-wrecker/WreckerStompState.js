import { WreckerActionState } from "./WreckerActionState.js";

export class WreckerStompState extends WreckerActionState {
  constructor() {
    super("warning_stomp", 0.8);
  }
}
