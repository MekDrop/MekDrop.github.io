/**
 * Production-scene audit invoked only by the saved test-map HUD.
 */
export class WreckerBehaviorCheck {
  /**
   * @param {import("./HornedWrecker.js").HornedWrecker} owner
   */
  constructor(owner) {
    this.owner = owner;
  }

  /**
   * @param {number} seconds
   */
  async wait(seconds) {
    let age = 0;
    while (age < seconds) {
      age += await new Promise(/**
                                * @param {(dt:number)=>void} resolve
                                */
        (resolve) => this.owner.app.once("update", resolve));
    }
  }

  /**
   * Fixture setup uses production Ammo teleport; measured motion uses normal updates.
   * @param {import("../shared/Enemy.js").Enemy} actor
   * @param {import("playcanvas").Vec3} position
   */
  place(actor, position) {
    actor.stop();
    actor.entity.rigidbody.teleport(position);
  }

  /**
   * @param {boolean} pursuitOnly
   */
  async run(pursuitOnly = false) {
    const owner = this.owner;
    const checks = owner.checks;
    const results = [];
    const start = owner.position.clone();
    const ally = owner.actors.find(/**
                                    * @param {import("../shared/Enemy.js").EnemyActor} actor
                                    */
      (actor) => actor.definition?.id === "wrecker-ally");
    const hero = owner.actors.find(/**
                                    * @param {import("../shared/Enemy.js").EnemyActor} actor
                                    */
      (actor) => actor.isDefender && typeof actor.teleport === "function");
    const states = [];
    const record = owner.app.on("update", () => {
      if (states.at(-1) !== owner.stateName) {
        states.push(owner.stateName);
      }
    });
    try {
      if (!pursuitOnly) {
        checks.progress = "Audit: bell immunity";
        owner.behavior.changeTo("WreckerPursueState");
        owner.onBellRung({ eventId: "wrecker-audit-primary" });
        const amplified = owner.applyStatus("stun", {
          duration: 4,
          kind: "bell",
          source: { isBellBug: true },
        });
        const confusion = owner.applyStatus("confused", { duration: 4 });
        await this.wait(1.9);
        results.push({
          name: "bell",
          passed: !amplified && !confusion && !owner.statuses.has("confused") && states.includes("WreckerSnortState") && states.includes("WreckerStompState") && states.includes("WreckerRageState"),
          states: [...states],
        });
        owner.applyStatus("stun", {
          duration: 0.4,
          kind: "physical",
        });
        const interrupted = owner.stateName === "WreckerStunState";
        await this.wait(1.2);
        results.push({
          name: "physical interruption",
          passed: interrupted && states.includes("WreckerStunRecoverState"),
        });
        owner.behavior.changeTo("WreckerPlaybackState");
        this.place(owner, start);
        if (hero) {
          checks.progress = "Audit: pickup rejection contact";
          const heroStart = { ...hero.position };
          hero.teleport(start.clone().add(new owner.pc.Vec3(0, 0, -1.15)));
          await this.wait(0.2);
          const accepted = owner.beginCarry(hero);
          await this.wait(0.36);
          results.push({
            name: "pickup headbutt",
            passed: !accepted && !owner.carrier && hero.statusRate === 0,
            statusRate: hero.statusRate,
          });
          hero.teleport(heroStart);
        }
        owner.behavior.changeTo("WreckerPlaybackState");
        if (ally) {
          checks.progress = "Audit: actual allied contact";
          this.place(owner, start);
          this.place(ally, start.clone().add(new owner.pc.Vec3(0, 0, -1.2)));
          await this.wait(0.3);
          const before = ally.health;
          owner.behavior.changeTo("WreckerFistWindupState");
          await this.wait(0.6);
          const beforeContact = ally.health;
          await this.wait(0.25);
          results.push({
            name: "allied fist contact",
            passed: beforeContact === before && ally.health < before,
            before,
            beforeContact,
            after: ally.health,
          });
          ally.receiveDamage(10000);
          await this.wait(2.6);
          results.push({
            name: "ally death cleanup",
            passed: !ally.alive && !ally.entity.parent && !ally.entity.rigidbody,
          });
        }
      }
      owner.behavior.changeTo("WreckerPlaybackState");
      this.place(owner, start);
      checks.progress = "Audit: door and royal pursuit";
      const royal = owner.resolveRoyalTarget();
      const castle = owner.actors.find(/**
                                        * @param {import("../shared/Enemy.js").EnemyActor} actor
                                        */
        (actor) => actor.entranceDoors?.length);
      const doors = castle?.entranceDoors ?? [];
      const interiorDoors = (castle?.destructibleDoors ?? []).filter(/**
       * @param {import("../../architecture/door/Door.js").Door} door
       */ (door) => !door.exteriorEntrance && Math.abs(door.entity.getPosition().y - owner.position.y) < 0.5);
      if (castle) {
        castle.testEntranceOpenAmount = 0;
      }
      const initialDoors = doors.map(/**
                                      * @param {import("../../architecture/door/Door.js").Door} door
                                      */
        (door) => ({
          health: door.health,
          broken: door.broken,
        }));
      owner.behavior.changeTo("WreckerPursueState");
      const samples = [];
      let age = 0;
      const deadline = performance.now() + 180000;
      const live = document.createElement("a");
      live.id = "wrecker-live-route";
      live.hidden = true;
      document.getElementById(live.id)?.remove();
      document.body.appendChild(live);
      while (age < 60 && performance.now() < deadline && royal && !owner.combat.reachedRoyals.has(royal)) {
        await this.wait(1);
        age++;
        samples.push({
          age,
          position: owner.position.clone(),
          velocity: owner.entity.rigidbody.linearVelocity.clone(),
          state: owner.stateName,
          distance: owner.distanceTo(royal),
          navigation: owner.navigation.diagnostics,
        });
        checks.progress = `Royal approach: ${age}s, ${owner.distanceTo(royal).toFixed(2)}m`;
        live.href = `data:application/json,${encodeURIComponent(JSON.stringify(samples.at(-1)))}`;
      }
      results.push({
        name: "door battering",
        passed: doors.some(/**
                                                                 * @param {import("../../architecture/door/Door.js").Door} door
                                                                 */
          (door) => door.broken),
        initialDoors,
        finalDoors: doors.map(/**
                                                                     * @param {import("../../architecture/door/Door.js").Door} door
                                                                     */
          (door) => ({
            health: door.health,
            broken: door.broken,
          })),
      });
      results.push({
        name: "royal pursuit",
        passed: !!royal && owner.combat.reachedRoyals.has(royal),
        samples,
      });
      results.push({
        name: "interior door destruction",
        passed: interiorDoors.some(/**
         * @param {import("../../architecture/door/Door.js").Door} door
         */ (door) => door.broken),
        doors: interiorDoors.map(/**
         * @param {import("../../architecture/door/Door.js").Door} door
         */ (door) => ({
            position: door.entity.getPosition().clone(),
            health: door.health,
            broken: door.broken,
          })),
      });
      checks.progress = "Behavior audit complete";
    } finally {
      record.off();
      checks.download(pursuitOnly ? "horned-wrecker-pursuit.json" : "horned-wrecker-behavior.json", new Blob([JSON.stringify({
        results,
        states,
      })], { type: "application/json" }));
    }
  }
}
