export class MissingGameUiThemeTokenError extends Error {
  /**
   *
   * @param {{token: string}} options
   * @param {string} options.token
   */
  constructor({ token }) {
    super(`Game UI theme requires the Quasar ${token} token.`);
    /**
     *
     * @type {string}
     */
    this.name = this.constructor.name;
  }
}
