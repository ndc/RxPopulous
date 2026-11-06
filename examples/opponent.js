registerController(({ rxjs, observations$, command }) => {
  return observations$
    .pipe(rxjs.filter(({ world }) => world.tick % 24 === 0))
    .subscribe(({ world, side }) => {
      const enemy = side === "player" ? "enemy" : "player";
      const target = world.tiles.find((tile) => tile.people[enemy] > 0);
      if (target) command({ type: "gather", x: target.x, z: target.z });
    });
});
