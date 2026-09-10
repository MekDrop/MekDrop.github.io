export class InvalidGameUiThemeColorError extends Error {
  constructor({ role, value }) {
    super(`Game UI theme received an invalid color for the ${role} role.`);
    this.name = this.constructor.name;
    this.value = value;
  }
}
