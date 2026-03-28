import { State } from "yuka";

export class SnakeClimbState extends State {
  constructor(context) {
    super();
    this.context = context;
  }

  execute() {
    const { snakeAI } = this.context;
    snakeAI.desiredDir = 0;
    snakeAI.desiredSpeed = 0;
  }
}
