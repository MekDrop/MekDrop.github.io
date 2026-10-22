/**
 * Runs real interactions from the saved map's HUD and records their outcomes.
 */
export class GobblerBehaviorAudit {
  /**
   * @param {import("./SnackGobbler.js").SnackGobbler} owner
   */
  constructor(owner) {
    this.owner = owner;
  }

  /**
   * @returns {Promise<Array<{check:string,passed:boolean}>>}
   */
  async run() {
    const owner = this.owner;
    const records = [];
    const royal = owner.resolveRoyalTarget();
    const pitcher = owner.runtime.objects.getFirstByClass("PitcherOgre");
    const food = owner.runtime.objects.getFirstByClass("Divecap");
    records.push({
      check: "actual royal actor resolves",
      passed: !!royal?.beginGameOver,
    });
    owner.testPlayClip("idle");
    owner.onBellRung({ eventId: `audit-${owner.elapsed}` });
    records.push({
      check: "direct bell is ignored",
      passed: !owner.statuses.has("confused") && owner.stateName === "GobblerInspectState",
    });
    if (food?.alive) {
      owner.health = 30;
      owner.hungryAt = 0;
      owner.sleepyUntil = 0;
      food.applyStatus("stun", { duration: 3 });
      food.entity.rigidbody.teleport(owner.position.clone().add(new owner.pc.Vec3(0.74, 0, 0)));
      owner.testPlayClip(null);
      await this.#wait(1.6);
      records.push({
        check: "meal kills food and heals",
        passed: !food.alive && owner.health === 65,
      });
      records.push({
        check: "meal removes corpse rendering and collision",
        passed: !food.entity.enabled,
      });
      records.push({
        check: "meal causes sleepy slowdown",
        passed: owner.sleepy && owner.movementSpeed === 0.109,
      });
    } else {
      records.push({
        check: "living meal actor available",
        passed: false,
      });
    }
    if (pitcher?.alive) {
      const health = pitcher.health;
      const carried = owner.beginCarry(pitcher);
      await this.#wait(0.9);
      records.push({
        check: "carrier receives bite damage",
        passed: carried && pitcher.health < health && owner.carrier === pitcher,
      });
      const launched = owner.launch({ velocity: new owner.pc.Vec3(1.2, 4, 0) });
      records.push({
        check: "launch enables Ammo flight",
        passed: launched && owner.airborne && owner.entity.rigidbody.enabled && owner.stateName === "GobblerAirborneState",
      });
      let flightTime = 0;
      while (owner.airborne && flightTime < 6) {
        flightTime += await this.#frame();
      }
      records.push({
        check: "real ground contact angers Gobbler",
        passed: owner.grounded && !owner.airborne && owner.stateName === "GobblerAngryState",
      });
    } else {
      records.push({
        check: "living carrier available",
        passed: false,
      });
    }
    owner.applyStatus("stun", { duration: 1 });
    records.push({
      check: "external stun interrupts",
      passed: owner.stateName === "GobblerStunnedState",
    });
    await this.#wait(1.6);
    records.push({
      check: "external stun recovers",
      passed: owner.stateName !== "GobblerStunnedState" && !owner.statuses.has("stun"),
    });
    owner.receiveDamage(owner.health);
    records.push({
      check: "death enters Yuka death state",
      passed: !owner.alive && owner.stateName === "GobblerDeadState",
    });
    await this.#wait(1.6);
    records.push({
      check: "death removes entity",
      passed: !owner.entity.parent,
    });
    console.info("SnackGobblerBehaviorEvidence", JSON.stringify(records));
    const link = document.createElement("a");
    link.download = "snack-gobbler-behavior.json";
    link.href = URL.createObjectURL(new Blob([JSON.stringify(records, null, 2)], { type: "application/json" }));
    link.click();
    URL.revokeObjectURL(link.href);

    return records;
  }

  /**
   * @param {number} seconds
   */
  async #wait(seconds) {
    let elapsed = 0;
    while (elapsed < seconds) {
      elapsed += await this.#frame();
    }
  }

  /**
   * @returns {Promise<number>}
   */
  #frame() {
    return new Promise(/**
     *
     * @param {(dt:number) => void} resolve
     */
      (resolve) => this.owner.app.once("update", resolve));
  }
}
