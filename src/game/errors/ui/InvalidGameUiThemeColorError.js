export class InvalidGameUiThemeColorError extends Error {
  /**
   *
   * @param {{role: string, value: number}} options
   * @param {string} options.role
   * @param {number} options.value
   */
  constructor({ role, value }) {
    super(`Game UI theme received an invalid color for the ${role} role.`);
    /**
     *
     * @type {string}
     */
    this.name = this.constructor.name;
    /**
     *
     * @type {number}
     */
    this.value = value;
  }
}
