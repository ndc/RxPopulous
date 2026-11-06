export type Side = "player" | "enemy";
export type ActionType =
  "raise" | "lower" | "gather" | "quake" | "flood" | "volcano";
export interface Command {
  type: ActionType;
  x: number;
  z: number;
}
export interface Tile {
  x: number;
  z: number;
  height: number;
  people: Record<Side, number>;
  settlement: Side | null;
}
export interface Faction {
  mana: number;
  target: { x: number; z: number } | null;
}
export interface World {
  size: number;
  tick: number;
  tiles: Tile[];
  factions: Record<Side, Faction>;
  winner: Side | "draw" | null;
}
export interface Level {
  name: string;
  description: string;
  layout: string[];
  enemy: number;
}

export const LEVELS: Level[] = [
  {
    name: "First Shores",
    description: "Learn to shape the land and lead your followers.",
    enemy: 10,
    layout: [
      "000000000000",
      "011111111110",
      "011111121110",
      "011211111110",
      "011111011110",
      "011111011110",
      "011111111110",
      "011110111110",
      "011110111210",
      "011121111110",
      "011111111110",
      "000000000000",
    ],
  },
  {
    name: "Divided Lands",
    description: "A stronger rival waits beyond the lowlands.",
    enemy: 14,
    layout: [
      "00000000000000",
      "01111111111110",
      "01111112111110",
      "01121110111110",
      "01111110121110",
      "01111110111110",
      "01111111111110",
      "01111101111110",
      "01111101111110",
      "01121101112110",
      "01111101111110",
      "01111111111110",
      "01111111111110",
      "00000000000000",
    ],
  },
  {
    name: "The Last Valley",
    description: "Unite your people against a powerful opponent.",
    enemy: 18,
    layout: [
      "0000000000000000",
      "0111111111111110",
      "0111112111111110",
      "0111211110111110",
      "0111111110112110",
      "0111111110111110",
      "0111101110111110",
      "0111101111111110",
      "0111101111111110",
      "0111101110111110",
      "0111111110111110",
      "0111112110111110",
      "0111111110112110",
      "0111111111111110",
      "0111111111111110",
      "0000000000000000",
    ],
  },
];
export const COSTS: Record<ActionType, number> = {
  raise: 2,
  lower: 2,
  gather: 0,
  quake: 20,
  flood: 25,
  volcano: 35,
};
export const SIDES: Side[] = ["player", "enemy"];
const other = (side: Side): Side => (side === "player" ? "enemy" : "player");
const distance = (a: { x: number; z: number }, b: { x: number; z: number }) =>
  Math.abs(a.x - b.x) + Math.abs(a.z - b.z);
export const tileAt = (world: World, x: number, z: number): Tile | undefined =>
  Number.isInteger(x) &&
  Number.isInteger(z) &&
  x >= 0 &&
  z >= 0 &&
  x < world.size &&
  z < world.size
    ? world.tiles[z * world.size + x]
    : undefined;

export function createWorld(level: Level): World {
  const size = level.layout.length;
  if (
    !size ||
    level.layout.some((row) => row.length !== size || !/^[012]+$/.test(row))
  )
    throw new Error("Invalid level layout.");
  const tiles: Tile[] = [];
  for (let z = 0; z < size; z++) {
    for (let x = 0; x < size; x++) {
      const height = Number(level.layout[z][x]);
      tiles.push({
        x,
        z,
        height,
        people: { player: 0, enemy: 0 },
        settlement: null,
      });
    }
  }
  const world: World = {
    size,
    tick: 0,
    tiles,
    factions: {
      player: { mana: 24, target: null },
      enemy: { mana: 24, target: null },
    },
    winner: null,
  };
  const player = tileAt(world, 2, 2)!;
  const enemy = tileAt(world, size - 3, size - 3)!;
  player.height = enemy.height = 1;
  player.people.player = 12;
  enemy.people.enemy = level.enemy;
  player.settlement = "player";
  enemy.settlement = "enemy";
  return world;
}

// The whole map is visible to both sides; observations are detached copies.
export function observe(world: World, side: Side) {
  return { version: 1 as const, side, world: structuredClone(world) };
}
export type Observation = ReturnType<typeof observe>;

export function command(
  world: World,
  side: Side,
  action: Command,
): string | null {
  if (world.winner) return "The level has ended.";
  if (
    !action ||
    typeof action !== "object" ||
    !Object.hasOwn(COSTS, action.type)
  )
    return "Unknown action.";
  const tile = tileAt(world, action.x, action.z);
  if (!tile) return "Target is outside the map.";
  if (world.factions[side].mana < COSTS[action.type]) return "Not enough mana.";
  if (action.type === "raise" && tile.height >= 4)
    return "Terrain is already at maximum height.";
  if (action.type === "lower" && tile.height <= 0)
    return "Terrain is already underwater.";
  if (action.type === "gather" && tile.height === 0)
    return "Choose dry land for the gathering point.";
  world.factions[side].mana -= COSTS[action.type];
  if (action.type === "gather")
    world.factions[side].target = { x: tile.x, z: tile.z };
  if (action.type === "raise") tile.height++;
  if (action.type === "lower") tile.height--;
  if (
    action.type === "quake" ||
    action.type === "flood" ||
    action.type === "volcano"
  ) {
    for (const target of world.tiles) {
      if (distance(tile, target) > 1) continue;
      if (action.type === "quake") {
        target.height =
          target.height === 0 ? 0 : Math.max(1, target.height - 1);
        target.people.player = Math.floor(target.people.player * 0.6);
        target.people.enemy = Math.floor(target.people.enemy * 0.6);
        target.settlement = null;
      } else if (action.type === "flood") {
        target.height = 0;
      } else {
        target.height = Math.min(4, target.height + 2);
        target.people.player = Math.floor(target.people.player * 0.3);
        target.people.enemy = Math.floor(target.people.enemy * 0.3);
        target.settlement = null;
      }
    }
  }
  for (const target of world.tiles) {
    if (target.height === 0) {
      target.people.player = 0;
      target.people.enemy = 0;
      target.settlement = null;
    }
  }
  return null;
}

export function population(world: World, side: Side): number {
  return world.tiles.reduce((sum, tile) => sum + tile.people[side], 0);
}

export function step(world: World): void {
  if (world.winner) return;
  world.tick++;
  for (const side of SIDES) {
    world.factions[side].mana = Math.min(
      100,
      world.factions[side].mana + 0.35 + population(world, side) * 0.015,
    );
  }
  if (world.tick % 8 === 0) {
    for (const tile of world.tiles) {
      if (tile.settlement && tile.people[tile.settlement] > 0)
        tile.people[tile.settlement] = Math.min(
          30,
          tile.people[tile.settlement] + 1,
        );
      for (const side of SIDES) {
        if (
          !tile.settlement &&
          tile.height === 1 &&
          tile.people[side] >= 5 &&
          tile.people[other(side)] === 0
        )
          tile.settlement = side;
      }
    }
  }
  if (world.tick % 4 === 0) {
    const moves: { from: Tile; to: Tile; side: Side; count: number }[] = [];
    for (const side of SIDES) {
      const target = world.factions[side].target;
      if (!target) continue;
      for (const from of world.tiles) {
        const count = from.people[side];
        if (!count || distance(from, target) === 0) continue;
        const choices = [
          [1, 0],
          [-1, 0],
          [0, 1],
          [0, -1],
        ]
          .map(([dx, dz]) => tileAt(world, from.x + dx, from.z + dz))
          .filter(
            (tile): tile is Tile =>
              !!tile &&
              tile.height > 0 &&
              Math.abs(tile.height - from.height) <= 1 &&
              distance(tile, target) < distance(from, target),
          );
        const moving =
          from.settlement === side ? Math.max(0, count - 2) : count;
        if (choices.length && moving)
          moves.push({ from, to: choices[0], side, count: moving });
      }
    }
    for (const move of moves) {
      move.from.people[move.side] -= move.count;
      move.to.people[move.side] += move.count;
    }
  }
  for (const tile of world.tiles) {
    if (tile.people.player && tile.people.enemy) {
      const losses = Math.min(tile.people.player, tile.people.enemy, 2);
      tile.people.player -= losses;
      tile.people.enemy -= losses;
    }
    if (
      tile.settlement &&
      tile.people[other(tile.settlement)] > 0 &&
      tile.people[tile.settlement] === 0
    )
      tile.settlement = null;
  }
  const player = population(world, "player");
  const enemy = population(world, "enemy");
  if (!player || !enemy)
    world.winner = player ? "player" : enemy ? "enemy" : "draw";
}

export function aiAction(observation: Observation): Command | null {
  const { world, side } = observation;
  const enemies = world.tiles.filter((tile) => tile.people[other(side)] > 0);
  const friends = world.tiles
    .filter((tile) => tile.people[side] > 0)
    .sort((a, b) => b.people[side] - a.people[side]);
  if (!enemies.length) return null;
  enemies.sort((a, b) => b.people[other(side)] - a.people[other(side)]);
  const target = enemies[0];
  const friendlyNearby = friends.some((tile) => distance(tile, target) <= 1);
  if (!friendlyNearby && target.people[other(side)] >= 6) {
    if (world.factions[side].mana >= COSTS.volcano && target.height >= 2)
      return { type: "volcano", x: target.x, z: target.z };
    if (
      world.factions[side].mana >= 40 &&
      target.height === 1 &&
      target.settlement
    )
      return { type: "flood", x: target.x, z: target.z };
    if (world.factions[side].mana >= COSTS.quake)
      return { type: "quake", x: target.x, z: target.z };
  }
  const largest = friends[0];
  if (largest && distance(largest, target) > 1) {
    const closer = [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ]
      .map(([dx, dz]) => tileAt(world, largest.x + dx, largest.z + dz))
      .filter(
        (tile): tile is Tile =>
          !!tile && distance(tile, target) < distance(largest, target),
      );
    if (
      closer.length &&
      !closer.some(
        (tile) =>
          tile.height > 0 && Math.abs(tile.height - largest.height) <= 1,
      )
    ) {
      if (closer[0].height === 0)
        return { type: "raise", x: closer[0].x, z: closer[0].z };
      return {
        type: closer[0].height > largest.height ? "lower" : "raise",
        x: closer[0].x,
        z: closer[0].z,
      };
    }
  }
  if (
    !world.factions[side].target ||
    distance(world.factions[side].target!, target) > 2
  )
    return { type: "gather", x: target.x, z: target.z };
  return null;
}
