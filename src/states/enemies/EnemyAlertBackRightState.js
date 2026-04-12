import { State } from "yuka";

export class EnemyAlertBackRightState extends State {
  enter(owner) {
    owner.startBackAlert(1);
  }

  execute(owner) {
    owner.stepBackAlert(1);
  }
}
