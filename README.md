# RxPopulous

A browser-based 3D god game inspired by the original Populous. Shape the terrain, grow settlements, and guide your people against a rival god across a short campaign.

## Run

Requires Node.js 20.19+ or 22.12+.

```sh
npm install
npm run dev
```

Open the address printed by Vite. The game runs locally in the browser; it has no backend. Campaign unlocks and keyboard bindings are stored in browser local storage. There is no mid-level save.

## Play

Blue is your faction; red is the opponent. Select a divine action and click a tile. Drag the map to orbit, right-drag to pan, and use the mouse wheel to zoom. Keyboard defaults are shown on the action buttons and can be changed under **Keyboard settings** using unmodified letter, number, arrow, or punctuation keys.

Raising and lowering terrain costs 2 mana. Land height ranges from 0 (water) to 4. A gathering point sends followers toward it, leaving a small garrison in occupied settlements. Followers can move between adjacent dry tiles whose heights differ by at most one; shape a route if they are blocked. Groups of at least five followers form settlements on height-1 land. Occupied settlements grow followers. Opposing followers fight when they meet.

Mana regenerates over time. Earthquake (20) damages followers and settlements and lowers surrounding land without submerging it. Flood (25) submerges the targeted tile and its immediate neighbors. Volcano (35) raises and devastates the targeted tile and its immediate neighbors. Powers affect both factions. A faction wins when the other has no followers. All map and faction information is visible to both sides; open **World intelligence** to inspect the full state.

## RxJS automation

Before starting a level, optionally select one local `.js` file for your faction and one for the opponent. A selected opponent script **replaces** the built-in AI. The files are read locally and run in separate Web Workers. Scripts must be trusted: workers are not security sandboxes, and scripts can use browser APIs with the site's origin privileges, including sending data over the network. A hung worker can be terminated by returning to the main menu.

Each standalone JavaScript file must call `registerController` exactly once. No module imports or local file dependencies are supported. The game supplies RxJS and the following version-1 API:

```js
registerController(({ version, side, rxjs, observations$, command }) => {
  return observations$
    .pipe(rxjs.filter(({ world }) => world.tick % 12 === 0))
    .subscribe(({ world }) => {
      const enemy = side === "player" ? "enemy" : "player";
      const target = world.tiles.find((tile) => tile.people[enemy] > 0);
      if (target) command({ type: "gather", x: target.x, z: target.z });
    });
});
```

- `side` is `"player"` or `"enemy"`. `rxjs` is the bundled RxJS namespace, including operators.
- `observations$` emits `{ version, side, world }` once on startup and after each 250 ms simulation tick. Each world contains `size`, `tick`, `tiles`, `factions`, and `winner`; tile coordinates are `x` and `z`, and each tile contains `height`, `people`, and `settlement`. This is the same full information available in the UI. Observations are detached copies.
- `command({ type, x, z })` queues an action for the script's side at a tick boundary. Types are `raise`, `lower`, `gather`, `quake`, `flood`, and `volcano`. Invalid or unaffordable commands have no effect. Scripts may issue at most 32 commands per tick; exceeding the limit stops automation.
- Return an RxJS subscription, a cleanup function, or nothing. The observation stream completes and cleanup is requested on exit; workers are forcibly terminated shortly afterward. Errors, invalid registration, and initialization timeouts stop the level rather than falling back to another controller. Asynchronous worker timing means script-driven games are not deterministic.

See `examples\player.js` and `examples\opponent.js`. Scripts are not saved across sessions.

## Development

`npm run lint`, `npm run format`, `npm test`, `npm run build`, and `npm run test:e2e` run lint and type checks, formatting, unit tests, the production build, and browser tests respectively. Browser tests require Playwright's Chromium (`npx playwright install chromium`), or set `CHROME_PATH` to an installed Chromium-compatible browser executable.
