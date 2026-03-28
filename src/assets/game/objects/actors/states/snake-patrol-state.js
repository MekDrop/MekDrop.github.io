import { State } from "yuka";

export class SnakePatrolState extends State {
  constructor(context) {
    super();
    this.context = context;
  }

  execute() {
    const { snakeAI, snake, patrolSpeed } = this.context;
    snakeAI.desiredDir = snake.patrolDir;
    snakeAI.desiredSpeed = patrolSpeed;
  }
}
