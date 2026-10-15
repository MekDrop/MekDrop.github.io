/**
 * Adds a static Ammo triangle surface while retaining openings in imported props.
 * @param {typeof import("playcanvas")} pc
 * @param {import("playcanvas").Entity} entity
 * @param {import("playcanvas").Entity} graph
 */
export function addAuthoredMeshPhysics(pc, entity, graph) {
  const model = new pc.Model();
  model.graph = graph;
  model.meshInstances = graph.findComponents("render").flatMap(
    /**
     * @param {import("playcanvas").RenderComponent} render
     */
    (render) => render.meshInstances,
  );
  entity.addComponent("collision", {
    type: "mesh",
    model,
  });
  entity.addComponent("rigidbody", {
    type: "static",
    friction: 0.6,
    restitution: 0,
  });
}
