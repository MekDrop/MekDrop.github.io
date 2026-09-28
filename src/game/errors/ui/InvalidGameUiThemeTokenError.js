export class InvalidGameUiThemeTokenError extends Error {
  /**
   *
   * @param {{token: string, value: number}} options
   * @param {string} options.token
   * @param {number} options.value
   */
  constructor({ token, value }) {
    super(`Game UI theme received an invalid Quasar ${token} token.`);
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
