import { State } from "yuka";

export class SnakeSpikeFearState extends State {
  constructor(context) {
    super();
    this.context = context;
  }

  execute() {
    const { snakeAI, snake, patrolSpeed, moveSpeed, spikeFearSpeed } = this.context;
    if (!snakeAI.spikeThreat) {
      snakeAI.desiredDir = snake.patrolDir;
      snakeAI.desiredSpeed = patrolSpeed;
      return;
    }

    snakeAI.desiredDir = snakeAI.spikeThreat.dx >= 0 ? -1 : 1;
    snakeAI.desiredSpeed = Math.max(moveSpeed, spikeFearSpeed);
  }
}
