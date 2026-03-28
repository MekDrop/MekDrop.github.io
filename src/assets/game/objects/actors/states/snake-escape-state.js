import { State } from "yuka";

export class SnakeEscapeState extends State {
  constructor(context) {
    super();
    this.context = context;
  }

  execute() {
    const { snakeAI, snake, patrolSpeed, moveSpeed, escapeSpeedBonus } = this.context;
    if (!snakeAI.escapeTarget) {
      snakeAI.desiredDir = snake.patrolDir;
      snakeAI.desiredSpeed = patrolSpeed;
      return;
    }

    const targetCenter = snakeAI.escapeTarget.x + snakeAI.escapeTarget.w * 0.5;
    const dx = targetCenter - snake.x;
    snakeAI.desiredDir = dx > 0 ? 1 : dx < 0 ? -1 : 0;
    const platformMotion = snake.supportPlatform?.moveDir * snake.supportPlatform?.moveSpeed || 0;
    snakeAI.desiredSpeed = Math.max(moveSpeed, Math.abs(platformMotion) + escapeSpeedBonus);
  }
}
