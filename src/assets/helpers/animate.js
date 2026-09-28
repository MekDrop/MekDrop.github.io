// source: https://animate.style/#javascript
/**
 *
 * @param {HTMLElement|string} element
 * @param {string} animation
 */
export function animateCSS(element, animation) {
  // We create a Promise and return it
  return new Promise(/**
   *
   * @param {(value?: string|PromiseLike<string>) => void} resolve
   */
  (resolve) => {
    const node =
      element instanceof HTMLElement
        ? element
        : document.querySelector(element);

    node.classList.add("animated", animation);

    // When the animation ends, we clean the classes and resolve the Promise
    /**
     *
     * @param {Event} event
     */
    function handleAnimationEnd(event) {
      event.stopPropagation();
      node.classList.remove("animated", animation);
      resolve("Animation ended");
    }

    node.addEventListener("animationend", handleAnimationEnd, { once: true });
  });
}
