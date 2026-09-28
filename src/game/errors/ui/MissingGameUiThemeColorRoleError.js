export class MissingGameUiThemeColorRoleError extends Error {
  /**
   *
   * @param {{role: string}} options
   * @param {string} options.role
   */
  constructor({ role }) {
    super(`Game UI theme requires the Quasar ${role} color role.`);
    /**
     *
     * @type {string}
     */
    this.name = this.constructor.name;
  }
}
