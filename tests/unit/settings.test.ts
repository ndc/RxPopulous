import { describe, expect, it } from "vitest";
import {
  DEFAULT_BINDINGS,
  loadBindings,
  loadProgress,
} from "../../src/settings";

function storage(values: Record<string, string>): Storage {
  return { getItem: (key: string) => values[key] ?? null } as Storage;
}

describe("local settings", () => {
  it("rejects invalid and conflicting shortcut data", () => {
    expect(loadBindings(storage({ "rxpopulous.bindings": "{broken" }))).toEqual(
      DEFAULT_BINDINGS,
    );
    expect(
      loadBindings(
        storage({
          "rxpopulous.bindings": JSON.stringify({
            ...DEFAULT_BINDINGS,
            raise: "Digit2",
          }),
        }),
      ),
    ).toEqual(DEFAULT_BINDINGS);
  });
  it("validates unlocked campaign progress", () => {
    expect(loadProgress(storage({ "rxpopulous.progress": "2" }), 3)).toBe(2);
    expect(loadProgress(storage({ "rxpopulous.progress": "100" }), 3)).toBe(1);
    expect(
      loadProgress(
        {
          getItem: () => {
            throw new Error("denied");
          },
        } as unknown as Storage,
        3,
      ),
    ).toBe(1);
  });
});
