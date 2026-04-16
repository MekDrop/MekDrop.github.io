import { State } from "yuka";

export class EnemyDeadState extends State {
  enter(owner) {
    owner.vx = 0;
    owner.vy = 0;
    owner.sprite.stop();
    owner.visible = false;
  }

  execute() {}
}
