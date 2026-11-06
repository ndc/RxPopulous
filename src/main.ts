import "./style.css";
import { Automation } from "./automation";
import {
  aiAction,
  command,
  createWorld,
  LEVELS,
  observe,
  population,
  SIDES,
  step,
  type ActionType,
  type Command,
  type Side,
  type World,
} from "./game";
import { GameRenderer } from "./renderer";
import {
  BINDING_NAMES,
  DEFAULT_BINDINGS,
  isBindableCode,
  loadBindings,
  loadProgress,
  type Binding,
  type Bindings,
} from "./settings";

const app = document.querySelector<HTMLDivElement>("#app")!;
app.innerHTML = `
  <header><div><span class="eyebrow">A REACTIVE GOD GAME</span><h1>RxPopulous</h1></div><button id="settings-open" class="secondary">Keyboard settings</button></header>
  <main>
    <section id="menu" class="panel menu">
      <p class="eyebrow">SHAPE THE LAND. LEAD YOUR PEOPLE.</p>
      <h2>Choose your battlefield</h2>
      <p>Raise fertile land, grow settlements, and guide your followers to victory against a rival god.</p>
      <label>Campaign level <select id="level"></select></label>
      <p id="level-description" class="muted"></p>
      <div class="file-grid">
        <label>Player automation <input id="player-script" type="file" accept=".js,text/javascript"></label>
        <label>Opponent automation <input id="enemy-script" type="file" accept=".js,text/javascript"></label>
      </div>
      <p class="warning"><strong>Trusted scripts only.</strong> Selected JavaScript executes with this site's browser-origin privileges. A worker is not a security sandbox. Files stay on this device unless the script itself sends data elsewhere.</p>
      <button id="start" class="primary">Start level</button>
    </section>
    <section id="game" class="game" hidden>
      <div class="game-top panel"><div><span id="level-name" class="eyebrow"></span><h2 id="status">Prepare your people</h2></div><div class="stats"><span id="population"></span><span id="mana"></span><button id="menu-button" class="secondary">Main menu</button></div></div>
      <div class="play-area"><div id="map" class="map"></div>
        <aside class="panel sidebar"><h3>Divine actions</h3><p class="muted">Choose an action, then click a tile. Scroll to zoom; drag to orbit; right-drag to pan.</p>
          <div id="actions" class="actions"></div>
          <p id="feedback" role="status" aria-live="polite">Your people are blue. Your rival is red.</p>
          <p class="muted small">Gather sets a destination for your followers. Settlements grow on level-one land. Disasters affect both sides.</p>
          <details><summary>World intelligence</summary><p class="muted small">Both sides see the entire map and all faction information.</p><pre id="intelligence"></pre></details>
        </aside>
      </div>
    </section>
  </main>
  <dialog id="settings"><form method="dialog"><div class="dialog-heading"><h2>Keyboard shortcuts</h2><button class="secondary">Close</button></div><p>Select a shortcut, then press a key. Modified browser shortcuts remain untouched.</p><div id="bindings" class="bindings"></div><p id="binding-feedback" role="status"></p><button id="reset-bindings" type="button" class="secondary">Reset defaults</button></form></dialog>
`;
const element = <T extends HTMLElement>(id: string) =>
  document.getElementById(id) as T;
const menu = element<HTMLElement>("menu");
const game = element<HTMLElement>("game");
const levelSelect = element<HTMLSelectElement>("level");
const levelDescription = element<HTMLElement>("level-description");
const playerScript = element<HTMLInputElement>("player-script");
const enemyScript = element<HTMLInputElement>("enemy-script");
const feedback = element<HTMLElement>("feedback");
const status = element<HTMLElement>("status");
const settings = element<HTMLDialogElement>("settings");
const bindingsList = element<HTMLElement>("bindings");
const bindingFeedback = element<HTMLElement>("binding-feedback");
let storage: Storage | null = null;
try {
  storage = window.localStorage;
} catch {
  /* The game remains playable without storage. */
}
let bindings: Bindings = storage
  ? loadBindings(storage)
  : { ...DEFAULT_BINDINGS };
let progress = storage ? loadProgress(storage, LEVELS.length) : 1;
let world: World | null = null;
let renderer: GameRenderer | null = null;
let timer: ReturnType<typeof setInterval> | null = null;
let selected: ActionType = "raise";
let workers: Partial<Record<Side, Automation>> = {};
let queue: { side: Side; action: Command }[] = [];
let waitingFor: Binding | null = null;
let generation = 0;
const actionNames: Record<ActionType, string> = {
  raise: "Raise land · 2",
  lower: "Lower land · 2",
  gather: "Gather · free",
  quake: "Earthquake · 20",
  flood: "Flood · 25",
  volcano: "Volcano · 35",
};

function save(key: string, value: string) {
  try {
    if (!storage) throw new Error();
    storage.setItem(key, value);
  } catch {
    feedback.textContent =
      "Browser storage is unavailable; settings and progress may not persist.";
    bindingFeedback.textContent =
      "Browser storage is unavailable; changes will not persist.";
  }
}

function refreshLevels() {
  levelSelect.replaceChildren(
    ...LEVELS.map((level, index) => {
      const option = document.createElement("option");
      option.value = String(index);
      option.textContent = `${index + 1}. ${level.name}${index >= progress ? " (locked)" : ""}`;
      option.disabled = index >= progress;
      return option;
    }),
  );
  levelDescription.textContent = LEVELS[Number(levelSelect.value)].description;
}
levelSelect.addEventListener("change", () => {
  levelDescription.textContent = LEVELS[Number(levelSelect.value)].description;
});

function renderBindings() {
  bindingsList.replaceChildren(
    ...(Object.keys(DEFAULT_BINDINGS) as Binding[]).map((key) => {
      const row = document.createElement("div");
      const label = document.createElement("span");
      label.textContent = BINDING_NAMES[key];
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = waitingFor === key ? "Press a key…" : bindings[key];
      button.addEventListener("click", () => {
        waitingFor = key;
        bindingFeedback.textContent = "Press a key, or Escape to cancel.";
        renderBindings();
      });
      row.append(label, button);
      return row;
    }),
  );
}
element<HTMLButtonElement>("settings-open").onclick = () => {
  renderBindings();
  settings.showModal();
};
settings.addEventListener("close", () => {
  waitingFor = null;
});
element<HTMLButtonElement>("reset-bindings").onclick = () => {
  bindings = { ...DEFAULT_BINDINGS };
  waitingFor = null;
  save("rxpopulous.bindings", JSON.stringify(bindings));
  renderBindings();
};

function renderActions() {
  const list = element<HTMLElement>("actions");
  list.replaceChildren(
    ...(Object.keys(actionNames) as ActionType[]).map((action) => {
      const button = document.createElement("button");
      button.textContent = `${actionNames[action]} [${bindings[action]}]`;
      button.className = selected === action ? "selected" : "secondary";
      button.setAttribute("aria-pressed", String(selected === action));
      button.onclick = () => {
        selected = action;
        renderActions();
      };
      return button;
    }),
  );
}

document.addEventListener("keydown", (event) => {
  if (waitingFor && settings.open) {
    event.preventDefault();
    if (event.code === "Escape") {
      waitingFor = null;
      renderBindings();
      return;
    }
    if (
      event.ctrlKey ||
      event.altKey ||
      event.metaKey ||
      event.shiftKey ||
      !isBindableCode(event.code)
    ) {
      bindingFeedback.textContent =
        "Choose an unmodified letter, number, arrow, or punctuation key.";
      return;
    }
    if (
      (Object.keys(bindings) as Binding[]).some(
        (key) => key !== waitingFor && bindings[key] === event.code,
      )
    ) {
      bindingFeedback.textContent = "That key is already assigned.";
      return;
    }
    bindings[waitingFor] = event.code;
    waitingFor = null;
    save("rxpopulous.bindings", JSON.stringify(bindings));
    bindingFeedback.textContent = "Shortcut updated.";
    renderBindings();
    renderActions();
    return;
  }
  if (
    settings.open ||
    !world ||
    event.ctrlKey ||
    event.altKey ||
    event.metaKey ||
    event.shiftKey ||
    event.repeat ||
    event.target instanceof HTMLInputElement ||
    event.target instanceof HTMLSelectElement ||
    event.target instanceof HTMLTextAreaElement
  )
    return;
  const binding = (Object.keys(bindings) as Binding[]).find(
    (key) => bindings[key] === event.code,
  );
  if (!binding) return;
  event.preventDefault();
  if (Object.hasOwn(actionNames, binding)) {
    selected = binding as ActionType;
    renderActions();
  } else renderer?.cameraAction(binding);
});

function stopGame() {
  generation++;
  if (timer) clearInterval(timer);
  timer = null;
  for (const worker of Object.values(workers)) worker?.stop();
  workers = {};
  queue = [];
  renderer?.dispose();
  renderer = null;
  world = null;
}
element<HTMLButtonElement>("menu-button").onclick = () => {
  stopGame();
  game.hidden = true;
  menu.hidden = false;
  refreshLevels();
};

async function startGame() {
  stopGame();
  const run = generation;
  const levelIndex = Number(levelSelect.value);
  const sources: Partial<Record<Side, string>> = {};
  try {
    if (playerScript.files?.[0])
      sources.player = await playerScript.files[0].text();
    if (enemyScript.files?.[0])
      sources.enemy = await enemyScript.files[0].text();
  } catch {
    alert("Could not read the selected script.");
    return;
  }
  if (run !== generation) return;
  world = createWorld(LEVELS[levelIndex]);
  const currentWorld = world;
  menu.hidden = true;
  game.hidden = false;
  feedback.textContent = "Your people are blue. Your rival is red.";
  element<HTMLElement>("level-name").textContent = LEVELS[levelIndex].name;
  status.textContent = "Prepare your people";
  renderActions();
  try {
    renderer = new GameRenderer(element<HTMLElement>("map"), (x, z) => {
      queue.push({ side: "player", action: { type: selected, x, z } });
    });
  } catch {
    stopGame();
    game.hidden = true;
    menu.hidden = false;
    alert(
      "WebGL is unavailable. Try a browser with hardware acceleration enabled.",
    );
    return;
  }
  renderer.update(currentWorld);
  const sides = SIDES.filter((side) => sources[side] !== undefined);
  let ready = 0;
  const begin = () => {
    if (run !== generation || timer) return;
    for (const side of sides)
      workers[side]?.update(observe(currentWorld, side));
    timer = setInterval(() => {
      for (const item of queue.splice(0, 64)) {
        const error = command(currentWorld, item.side, item.action);
        if (error && item.side === "player") feedback.textContent = error;
      }
      queue = [];
      if (
        !sources.enemy &&
        currentWorld.tick > 0 &&
        currentWorld.tick % 24 === 0
      ) {
        const action = aiAction(observe(currentWorld, "enemy"));
        if (action) command(currentWorld, "enemy", action);
      }
      step(currentWorld);
      for (const side of sides)
        workers[side]?.update(observe(currentWorld, side));
      renderer?.update(currentWorld);
      element<HTMLElement>("population").textContent =
        `People ${population(currentWorld, "player")} / ${population(currentWorld, "enemy")}`;
      element<HTMLElement>("mana").textContent =
        `Mana ${Math.floor(currentWorld.factions.player.mana)}`;
      element<HTMLElement>("intelligence").textContent = JSON.stringify(
        currentWorld,
        null,
        2,
      );
      if (currentWorld.winner) {
        if (timer) clearInterval(timer);
        timer = null;
        Object.values(workers).forEach((worker) => worker?.stop());
        workers = {};
        status.textContent =
          currentWorld.winner === "player"
            ? "Victory!"
            : currentWorld.winner === "enemy"
              ? "Defeat"
              : "Draw";
        feedback.textContent =
          currentWorld.winner === "player"
            ? "Your people prevailed. Return to the menu to continue."
            : "The battle is over. Return to the menu to try again.";
        if (
          currentWorld.winner === "player" &&
          levelIndex + 2 > progress &&
          levelIndex + 1 < LEVELS.length
        ) {
          progress = levelIndex + 2;
          save("rxpopulous.progress", String(progress));
        }
      }
    }, 250);
  };
  if (!sides.length) begin();
  else {
    status.textContent = "Starting automation…";
    for (const side of sides) {
      workers[side] = new Automation(
        sources[side]!,
        side,
        (action) => queue.push({ side, action }),
        (message) => {
          if (run !== generation) return;
          if (timer) clearInterval(timer);
          timer = null;
          Object.values(workers).forEach((worker) => worker?.stop());
          workers = {};
          status.textContent = "Automation stopped";
          feedback.textContent = `${side === "player" ? "Player" : "Opponent"} script error: ${message}. Return to the menu to retry.`;
        },
        () => {
          if (++ready === sides.length) {
            status.textContent = "Guide your people";
            begin();
          }
        },
      );
    }
  }
}
element<HTMLButtonElement>("start").onclick = () => {
  void startGame();
};
refreshLevels();
