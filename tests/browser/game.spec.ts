import { expect, test } from "@playwright/test";

test("starts a level and persists a customized keyboard shortcut", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Keyboard settings" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("button", { name: "Digit1" }).click();
  await page.keyboard.press("KeyZ");
  await expect(dialog.getByText("Shortcut updated.")).toBeVisible();
  await dialog.getByRole("button", { name: "Close" }).click();
  await page.reload();
  await page.getByRole("button", { name: "Start level" }).click();
  await expect(
    page.getByRole("button", { name: "Raise land · 2 [KeyZ]" }),
  ).toBeVisible();
  await page.keyboard.press("Digit2");
  await expect(
    page.getByRole("button", { name: "Lower land · 2 [Digit2]" }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator("#population")).toContainText("People");
});

test("executes selected RxJS controllers for both sides", async ({ page }) => {
  await page.goto("/");
  const player = `registerController(({rxjs, observations$, command}) => observations$.pipe(rxjs.take(1)).subscribe(() => command({type:'gather',x:4,z:2})));`;
  const enemy = `registerController(({rxjs, observations$, command}) => observations$.pipe(rxjs.take(1)).subscribe(() => command({type:'gather',x:8,z:8})));`;
  await page
    .locator("#player-script")
    .setInputFiles({
      name: "player.js",
      mimeType: "text/javascript",
      buffer: Buffer.from(player),
    });
  await page
    .locator("#enemy-script")
    .setInputFiles({
      name: "enemy.js",
      mimeType: "text/javascript",
      buffer: Buffer.from(enemy),
    });
  await page.getByRole("button", { name: "Start level" }).click();
  await expect(page.locator("#status")).toHaveText("Guide your people");
  await expect
    .poll(async () => {
      const text = await page.locator("#intelligence").textContent();
      return text ? JSON.parse(text).factions : null;
    })
    .toMatchObject({
      player: { target: { x: 4, z: 2 } },
      enemy: { target: { x: 8, z: 8 } },
    });
  await page.getByRole("button", { name: "Main menu" }).click();
  await expect(page.getByText("Choose your battlefield")).toBeVisible();
});

test("reports invalid automation instead of falling back to built-in AI", async ({
  page,
}) => {
  await page.goto("/");
  await page
    .locator("#enemy-script")
    .setInputFiles({
      name: "bad.js",
      mimeType: "text/javascript",
      buffer: Buffer.from("const bad = true;"),
    });
  await page.getByRole("button", { name: "Start level" }).click();
  await expect(page.locator("#status")).toHaveText("Automation stopped");
  await expect(page.locator("#feedback")).toContainText(
    "Script must call registerController",
  );
});

test("applies mouse-selected actions to the map", async ({ page }) => {
  await page.goto("/");
  await page
    .locator("#enemy-script")
    .setInputFiles({
      name: "idle.js",
      mimeType: "text/javascript",
      buffer: Buffer.from("registerController(() => {});"),
    });
  await page.getByRole("button", { name: "Start level" }).click();
  await expect(page.locator("#status")).toHaveText("Guide your people");
  await expect(page.locator("#intelligence")).not.toBeEmpty();
  const totalHeight = async () => {
    const world = JSON.parse(
      (await page.locator("#intelligence").textContent())!,
    );
    return world.tiles.reduce(
      (sum: number, tile: { height: number }) => sum + tile.height,
      0,
    );
  };
  const before = await totalHeight();
  await page.locator("#map canvas").click();
  await expect.poll(totalHeight).toBe(before + 1);
});

test("stops automation that exceeds the command limit", async ({ page }) => {
  await page.goto("/");
  const spam = `registerController(({command}) => { for (let i = 0; i < 33; i++) command({type:'gather',x:2,z:2}); });`;
  await page
    .locator("#player-script")
    .setInputFiles({
      name: "spam.js",
      mimeType: "text/javascript",
      buffer: Buffer.from(spam),
    });
  await page.getByRole("button", { name: "Start level" }).click();
  await expect(page.locator("#status")).toHaveText("Automation stopped");
  await expect(page.locator("#feedback")).toContainText("command limit");
});

test("wins a scripted level and persists campaign unlocks", async ({
  page,
}) => {
  await page.goto("/");
  const player = `registerController(({rxjs, observations$, command}) => observations$.pipe(rxjs.take(1)).subscribe(({world}) => {const t = world.tiles.find(t => t.people.enemy); command({type:'flood',x:t.x,z:t.z});}));`;
  // Delay until the player has enough mana for flood.
  const delayed = player.replace(
    "rxjs.take(1)",
    "rxjs.filter(({world}) => world.factions.player.mana >= 25), rxjs.take(1)",
  );
  await page
    .locator("#player-script")
    .setInputFiles({
      name: "win.js",
      mimeType: "text/javascript",
      buffer: Buffer.from(delayed),
    });
  await page
    .locator("#enemy-script")
    .setInputFiles({
      name: "idle.js",
      mimeType: "text/javascript",
      buffer: Buffer.from("registerController(() => {});"),
    });
  await page.getByRole("button", { name: "Start level" }).click();
  await expect(page.locator("#status")).toHaveText("Victory!", {
    timeout: 10000,
  });
  await page.getByRole("button", { name: "Main menu" }).click();
  await page.reload();
  await expect(page.locator("#level option").nth(1)).toBeEnabled();
});
