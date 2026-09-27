export function projectFirstPersonMovement(inputX, inputY, viewDirection) {
  const viewLength = Math.hypot(
    viewDirection?.x ?? 0,
    viewDirection?.z ?? 0,
  );
  if (viewLength <= 0.001) {
    return null;
  }
  const forwardX = viewDirection.x / viewLength;
  const forwardZ = viewDirection.z / viewLength;
  const rightX = viewDirection.right?.x ?? -forwardZ;
  const rightZ = viewDirection.right?.z ?? forwardX;
  return {
    x: rightX * inputX + forwardX * inputY,
    z: rightZ * inputX + forwardZ * inputY,
  };
}
