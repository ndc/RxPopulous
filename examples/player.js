registerController(({ rxjs, observations$, command }) => {
  return observations$.pipe(rxjs.take(1)).subscribe(() => {
    command({ type: "gather", x: 5, z: 5 });
  });
});
