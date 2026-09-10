export class MissingGameUiThemeColorRoleError extends Error {
  constructor({ role }) {
    super(`Game UI theme requires the Quasar ${role} color role.`);
    this.name = this.constructor.name;
  }
}
