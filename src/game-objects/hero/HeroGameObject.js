import { GameObject } from "src/game-objects/core/GameObject";
import { StateMachine } from "yuka";
import { HeroAnimationState } from "src/states/heroes/HeroAnimationState";

const clamp = (v, mn, mx) => Math.min(mx, Math.max(mn, v));

export class HeroGameObject extends GameObject {
  constructor(props = {}) {
    super({
      x: 0,
      y: 0,
      vx: 0,
      vy: 0,
      w: 7,
      h: 13,
      facing: 1,
      grounded: false,
      coyote: 0,
      invulnerable: 0,
      anim: 0,
      animationState: "idle",
      deathFacing: 1,
      prevY: 0,
      turnDuration: 0.34,
      turnRemaining: 0,
      deathElapsed: 0,
      previousRunPhase: null,
      stateMachine: null,
      ...props,
    });
  }

  initializeStateMachine(options = {}) {
    this.turnDuration = options.turnDuration ?? this.turnDuration;
    this.stateMachine = new StateMachine(this);
    this.stateMachine.add("idle", new HeroAnimationState("idle"));
    this.stateMachine.add("run", new HeroAnimationState("run"));
    this.stateMachine.add("jump", new HeroAnimationState("jump"));
    this.stateMachine.add("fall", new HeroAnimationState("fall"));
    this.stateMachine.add("hurt", new HeroAnimationState("hurt"));
    this.stateMachine.add("turn", new HeroAnimationState("turn"));
    this.stateMachine.add("death", new HeroAnimationState("death"));
    this.stateMachine.add("clear", new HeroAnimationState("clear"));
    this.resetAnimationState();
  }

  requestTurn() {
    this.turnRemaining = this.turnDuration;
  }

  resetAnimationState() {
    this.turnRemaining = 0;
    this.deathElapsed = 0;
    this.previousRunPhase = null;
    this.stateMachine?.changeTo("idle");
  }

  updateAnimationState(delta, context) {
    if (!this.stateMachine) return;
    const runPhaseChanged = this.previousRunPhase !== null && this.previousRunPhase !== context.runPhase;
    if (runPhaseChanged && context.runPhase !== context.PHASE_DEAD) {
      this.deathElapsed = 0;
    }

    this.previousRunPhase = context.runPhase;
    this.turnRemaining = Math.max(0, this.turnRemaining - delta);
    if (context.runPhase === context.PHASE_DEAD) {
      this.deathElapsed += delta;
    }

    const targetState = this.resolveAnimationState(context);
    if (this.stateMachine.currentState?.name !== targetState) {
      this.stateMachine.changeTo(targetState);
    }

    this.stateMachine.update();
    this.animationState = this.stateMachine.currentState?.name ?? "idle";
  }

  getAnimationFrameIndex(animation) {
    if (!animation || animation.frames <= 1) return 0;
    const animationName = this.animationState ?? "idle";

    if (animationName === "turn") {
      const progress = clamp(1 - this.turnRemaining / this.turnDuration, 0, 0.9999);
      return Math.min(animation.frames - 1, Math.floor(progress * animation.frames));
    }

    if (animationName === "death") {
      return Math.min(animation.frames - 1, Math.floor(this.deathElapsed * animation.fps));
    }

    return Math.floor(this.anim) % animation.frames;
  }

  resolveAnimationState(context) {
    const {
      runPhase,
      PHASE_DEAD,
      PHASE_CLEAR,
      invulnerable,
      grounded,
      vy,
      vx,
    } = context;

    if (runPhase === PHASE_DEAD) return "death";
    if (runPhase === PHASE_CLEAR) return "clear";
    if (invulnerable > 0.9) return "hurt";
    if (this.turnRemaining > 0) return "turn";
    if (!grounded) return vy > 0 ? "jump" : "fall";
    if (Math.abs(vx) > 4) return "run";
    return "idle";
  }
}
