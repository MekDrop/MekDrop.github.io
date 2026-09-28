import { GamePanelHud } from "./GamePanelHud.js";
import { gameUiTheme } from "./GameUiTheme.js";

const TEXTURE_SCALE = 4;
const FIRST_PERSON_HEIGHT = 36;
const FIRST_PERSON_TEXT =
  "First-person camera — mouse look, click to pet, WASD/arrows move, Esc releases";
const INTERACTION_HEIGHT = 43;
const INTERACTION_KEY_WIDTH = 25;
const INTERACTION_PIP_WIDTH = 7;
const INTERACTION_PIP_HEIGHT = 13;

export class GameStatusHud extends GamePanelHud {
  #firstPersonPanel = null;
  #firstPersonTexture = null;
  #interactionPanel = null;
  #interactionTexture = null;
  #firstPersonVisible = false;
  #interaction = null;

  constructor({ pc, app }) {
    super({ pc, app, name: "Game status HUD", priority: 105 });
    this.#buildFirstPersonPanel();
    this.#buildInteractionPanel();
    this.syncDrawOrder();
  }

  get state() {
    return {
      firstPersonVisible: this.#firstPersonVisible,
      interaction: this.#interaction ? { ...this.#interaction } : null,
    };
  }

  set firstPersonVisible(visible) {
    this.#firstPersonVisible = Boolean(visible);
    if (this.#firstPersonPanel) {
      this.#firstPersonPanel.enabled = this.#firstPersonVisible;
    }
  }

  setInteraction(target) {
    const interaction = target?.label
      ? {
          label: String(target.label),
          showHealth: Boolean(target.showHealth),
          health: Math.max(0, Math.floor(Number(target.health) || 0)),
          maxHealth: Math.max(0, Math.floor(Number(target.maxHealth) || 0)),
        }
      : null;
    this.#interaction = interaction;
    if (!this.#interactionPanel) {
      return;
    }
    this.#interactionPanel.enabled = interaction !== null;
    if (interaction) {
      this.#drawInteraction(interaction);
    }
  }

  destroy() {
    this.#firstPersonPanel = null;
    this.#firstPersonTexture = null;
    this.#interactionPanel = null;
    this.#interactionTexture = null;
    this.#interaction = null;
    super.destroy();
  }

  #buildFirstPersonPanel() {
    const width = 650;
    this.#firstPersonTexture = this.#createStatusTexture(
      "First-person camera status texture",
      width,
      FIRST_PERSON_HEIGHT,
      (context) => {
        context.font = gameUiTheme.font(700, 12);
        context.textAlign = "center";
        context.textBaseline = "middle";
        context.fillStyle = gameUiTheme.text;
        context.fillText(
          FIRST_PERSON_TEXT.toUpperCase(),
          width / 2,
          FIRST_PERSON_HEIGHT / 2 + 1,
        );
      },
    );
    this.#firstPersonPanel = this.#createCenteredImage({
      name: "First-person camera status",
      anchor: new this.pc.Vec4(0.5, 1, 0.5, 1),
      pivot: new this.pc.Vec2(0.5, 1),
      y: -gameUiTheme.spaceMd,
      width,
      height: FIRST_PERSON_HEIGHT,
      texture: this.#firstPersonTexture,
    });
    this.#firstPersonPanel.enabled = false;
  }

  #buildInteractionPanel() {
    this.#interactionPanel = this.#createCenteredImage({
      name: "Interaction prompt",
      anchor: new this.pc.Vec4(0.5, 0, 0.5, 0),
      pivot: new this.pc.Vec2(0.5, 0),
      y: gameUiTheme.spaceXl + gameUiTheme.spaceLg,
      width: 1,
      height: INTERACTION_HEIGHT,
      texture: null,
    });
    this.#interactionPanel.enabled = false;
  }

  #drawInteraction(interaction) {
    const measureCanvas = document.createElement("canvas");
    const measureContext = measureCanvas.getContext("2d");
    measureContext.font = gameUiTheme.font(700, 13);
    const labelWidth = Math.ceil(measureContext.measureText(interaction.label).width);
    const padding = gameUiTheme.spaceSm;
    const gap = gameUiTheme.spaceSm;
    const healthWidth = interaction.showHealth
      ? gameUiTheme.spaceXs +
        interaction.maxHealth * INTERACTION_PIP_WIDTH +
        Math.max(0, interaction.maxHealth - 1) * gameUiTheme.spaceXs
      : 0;
    const width =
      padding * 2 + INTERACTION_KEY_WIDTH + gap + labelWidth + healthWidth;

    this.releaseTexture(this.#interactionTexture);
    this.#interactionTexture = this.#createStatusTexture(
      "Interaction prompt texture",
      width,
      INTERACTION_HEIGHT,
      (context) => {
        const keyX = padding;
        const keyY = (INTERACTION_HEIGHT - 23) / 2;
        this.roundedRect(context, keyX, keyY, INTERACTION_KEY_WIDTH, 23, 4);
        context.fillStyle = "#d9f6d8";
        context.fill();
        context.fillStyle = "#17331f";
        context.font = gameUiTheme.font(800, 13);
        context.textAlign = "center";
        context.textBaseline = "middle";
        context.fillText("E", keyX + INTERACTION_KEY_WIDTH / 2, keyY + 11.5);

        const labelX = keyX + INTERACTION_KEY_WIDTH + gap;
        context.fillStyle = gameUiTheme.text;
        context.font = gameUiTheme.font(700, 13);
        context.textAlign = "left";
        context.fillText(interaction.label, labelX, INTERACTION_HEIGHT / 2);

        if (!interaction.showHealth) {
          return;
        }
        let pipX = labelX + labelWidth + gameUiTheme.spaceXs;
        const pipY = (INTERACTION_HEIGHT - INTERACTION_PIP_HEIGHT) / 2;
        for (let index = 0; index < interaction.maxHealth; index += 1) {
          this.roundedRect(
            context,
            pipX,
            pipY,
            INTERACTION_PIP_WIDTH,
            INTERACTION_PIP_HEIGHT,
            3,
          );
          context.fillStyle =
            index < interaction.health
              ? gameUiTheme.positive
              : gameUiTheme.textSubtle;
          context.globalAlpha = index < interaction.health ? 1 : 0.45;
          context.fill();
          context.globalAlpha = 1;
          pipX += INTERACTION_PIP_WIDTH + gameUiTheme.spaceXs;
        }
      },
    );
    this.#interactionPanel.element.width = width;
    this.#interactionPanel.element.texture = this.#interactionTexture;
  }

  #createCenteredImage({ name, anchor, pivot, y, width, height, texture }) {
    const entity = new this.pc.Entity(name);
    entity.addComponent("element", {
      type: this.pc.ELEMENTTYPE_IMAGE,
      anchor,
      pivot,
      width,
      height,
      useInput: false,
    });
    entity.element.texture = texture;
    entity.setLocalPosition(0, y, 0);
    this.entity.addChild(entity);
    return entity;
  }

  #createStatusTexture(name, width, height, drawContent) {
    return this.createDrawnTexture(
      name,
      width * TEXTURE_SCALE,
      height * TEXTURE_SCALE,
      (context) => {
        context.scale(TEXTURE_SCALE, TEXTURE_SCALE);
        this.drawPanelFrame(context, width, height);
        drawContent(context);
      },
    );
  }
}
