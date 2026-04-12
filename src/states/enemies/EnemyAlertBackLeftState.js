import { State } from "yuka";

export class EnemyAlertBackLeftState extends State {
  enter(owner) {
    owner.startBackAlert();
  }

  execute(owner) {
    owner.stepBackAlert();
  }
}
