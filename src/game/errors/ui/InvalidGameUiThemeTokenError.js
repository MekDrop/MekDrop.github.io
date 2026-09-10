export class InvalidGameUiThemeTokenError extends Error {
  constructor({ token, value }) {
    super(`Game UI theme received an invalid Quasar ${token} token.`);
    this.name = this.constructor.name;
    this.value = value;
  }
}
