import { State } from "yuka";

export class SnakeAttackState extends State {
  constructor(context) {
    super();
    this.context = context;
  }

  execute() {
    const { snakeAI, snake, hero, moveSpeed } = this.context;
    snakeAI.desiredDir = hero.x > snake.x ? 1 : hero.x < snake.x ? -1 : 0;
    snakeAI.desiredSpeed = moveSpeed;
  }
}
