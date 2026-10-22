import { WreckerActionState } from "./WreckerActionState.js";

export class WreckerSnortState extends WreckerActionState {
  constructor() {
    super("warning_snort", 0.65);
  }
}
