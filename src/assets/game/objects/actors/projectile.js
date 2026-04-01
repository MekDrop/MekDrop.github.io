export const createProjectile = ({
  id,
  kind,
  owner,
  x,
  y,
  z,
  vx,
  vy,
  vz,
  radius,
  damage,
  splashRadius,
  life,
}) => {
  return {
    id,
    kind,
    owner,
    x,
    y,
    z,
    vx,
    vy,
    vz,
    radius,
    damage,
    splashRadius,
    life,
    maxLife: life,
  };
};

