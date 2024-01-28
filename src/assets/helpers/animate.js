// source: https://animate.style/#javascript
export function animateCSS(element, animation) {
  // We create a Promise and return it
  return new Promise((resolve) => {
    const node =
      element instanceof HTMLElement
        ? element
        : document.querySelector(element);

    node.classList.add("animated", animation);

    // When the animation ends, we clean the classes and resolve the Promise
    function handleAnimationEnd(event) {
      event.stopPropagation();
      node.classList.remove("animated", animation);
      resolve("Animation ended");
    }

    node.addEventListener("animationend", handleAnimationEnd, { once: true });
  });
}
