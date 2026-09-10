export class MissingGameUiThemeTokenError extends Error {
  constructor({ token }) {
    super(`Game UI theme requires the Quasar ${token} token.`);
    this.name = this.constructor.name;
  }
}
