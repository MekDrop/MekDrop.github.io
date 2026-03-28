import { State } from "yuka";

export class SnakeLadderSeekState extends State {
  constructor(context) {
    super();
    this.context = context;
  }

  execute() {
    const { snakeAI, snake, patrolSpeed, moveSpeed } = this.context;
    if (!snake.targetLadder) {
      snakeAI.desiredDir = snake.patrolDir;
      snakeAI.desiredSpeed = patrolSpeed;
      return;
    }

    const ladderDx = snake.targetLadder.x - snake.x;
    snakeAI.desiredDir = ladderDx > 0 ? 1 : ladderDx < 0 ? -1 : 0;
    snakeAI.desiredSpeed = moveSpeed;
  }
}
