import { describe, expect, it } from "vitest";
import {
  aiAction,
  command,
  createWorld,
  LEVELS,
  observe,
  population,
  step,
  tileAt,
} from "../../src/game";

describe("world rules", () => {
  it("creates consistent levels with both factions", () => {
    const world = createWorld(LEVELS[0]);
    expect(world).toEqual(createWorld(LEVELS[0]));
    expect(population(world, "player")).toBe(12);
    expect(population(world, "enemy")).toBeGreaterThan(0);
    for (const level of LEVELS)
      expect(createWorld(level).tiles).toHaveLength(level.layout.length ** 2);
  });

  it("validates actions before spending mana", () => {
    const world = createWorld(LEVELS[0]);
    const mana = world.factions.player.mana;
    expect(
      command(world, "player", { type: "raise", x: -1, z: 0 }),
    ).toBeTruthy();
    expect(
      command(world, "player", { type: "gather", x: 0, z: 0 }),
    ).toBeTruthy();
    expect(world.factions.player.mana).toBe(mana);
    expect(command(world, "player", { type: "raise", x: 0, z: 0 })).toBeNull();
    expect(tileAt(world, 0, 0)?.height).toBe(1);
    expect(world.factions.player.mana).toBe(mana - 2);
  });

  it("gathers followers and leaves a garrison at their settlement", () => {
    const world = createWorld(LEVELS[0]);
    expect(command(world, "player", { type: "gather", x: 4, z: 2 })).toBeNull();
    for (let i = 0; i < 4; i++) step(world);
    expect(tileAt(world, 2, 2)?.people.player).toBe(2);
    expect(population(world, "player")).toBe(12);
    for (let i = 0; i < 4; i++) step(world);
    expect(tileAt(world, 2, 2)?.people.player).toBeGreaterThanOrEqual(2);
  });

  it("damages both sides with disasters and resolves elimination", () => {
    const world = createWorld(LEVELS[0]);
    const enemy = tileAt(world, world.size - 3, world.size - 3)!;
    enemy.people.player = 5;
    world.factions.player.mana = 100;
    command(world, "player", { type: "flood", x: enemy.x, z: enemy.z });
    expect(enemy.people).toEqual({ player: 0, enemy: 0 });
    expect(enemy.settlement).toBeNull();
    step(world);
    expect(world.winner).toBe("player");
    expect(
      command(world, "player", { type: "raise", x: 1, z: 1 }),
    ).toBeTruthy();
  });

  it("returns detached, faction-labelled observations", () => {
    const world = createWorld(LEVELS[0]);
    const snapshot = observe(world, "enemy");
    snapshot.world.factions.player.mana = 0;
    expect(world.factions.player.mana).not.toBe(0);
    expect(snapshot.side).toBe("enemy");
  });

  it("makes an opponent decision through the same command interface", () => {
    const world = createWorld(LEVELS[0]);
    const action = aiAction(observe(world, "enemy"));
    expect(action).not.toBeNull();
    expect(command(world, "enemy", action!)).toBeNull();
  });
});
