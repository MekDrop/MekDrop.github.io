import { defineStore } from "pinia";

const DEFAULT_MAX_LIVES = 3;

export const useHeroStateStore = defineStore("hero-state", {
  state: () => ({
    lives: DEFAULT_MAX_LIVES,
    maxLives: DEFAULT_MAX_LIVES,
    gameOver: false,
    mood: null,
  }),
  actions: {
    sync({ lives, maxLives, gameOver }) {
      this.lives = lives;
      this.maxLives = maxLives;
      this.gameOver = gameOver;
    },
    setMood(mood) {
      this.mood = mood;
    },
  },
});
