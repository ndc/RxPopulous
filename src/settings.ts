export const DEFAULT_BINDINGS = {
  raise: "Digit1",
  lower: "Digit2",
  gather: "Digit3",
  quake: "Digit4",
  flood: "Digit5",
  volcano: "Digit6",
  rotateLeft: "KeyQ",
  rotateRight: "KeyE",
  zoomIn: "Equal",
  zoomOut: "Minus",
  panLeft: "ArrowLeft",
  panRight: "ArrowRight",
  panUp: "ArrowUp",
  panDown: "ArrowDown",
} as const;
export type Binding = keyof typeof DEFAULT_BINDINGS;
export type Bindings = Record<Binding, string>;
export const BINDING_NAMES: Record<Binding, string> = {
  raise: "Raise land",
  lower: "Lower land",
  gather: "Gather followers",
  quake: "Earthquake",
  flood: "Flood",
  volcano: "Volcano",
  rotateLeft: "Rotate left",
  rotateRight: "Rotate right",
  zoomIn: "Zoom in",
  zoomOut: "Zoom out",
  panLeft: "Pan left",
  panRight: "Pan right",
  panUp: "Pan up",
  panDown: "Pan down",
};
export const isBindableCode = (code: string) =>
  /^(Key[A-Z]|Digit[0-9]|Numpad[0-9]|Arrow(Left|Right|Up|Down)|Minus|Equal|BracketLeft|BracketRight|Backquote|Backslash|Semicolon|Quote|Comma|Period|Slash)$/.test(
    code,
  );

export function loadBindings(storage: Storage): Bindings {
  try {
    const data: unknown = JSON.parse(
      storage.getItem("rxpopulous.bindings") || "null",
    );
    if (data && typeof data === "object") {
      const saved = data as Record<string, unknown>;
      const keys = Object.keys(DEFAULT_BINDINGS) as Binding[];
      if (
        keys.every(
          (key) =>
            typeof saved[key] === "string" &&
            isBindableCode(saved[key] as string),
        ) &&
        new Set(keys.map((key) => saved[key])).size === keys.length
      ) {
        return Object.fromEntries(
          keys.map((key) => [key, saved[key]]),
        ) as Bindings;
      }
    }
  } catch {
    /* Storage can be disabled or contain invalid data. */
  }
  return { ...DEFAULT_BINDINGS };
}

export function loadProgress(storage: Storage, levels: number): number {
  try {
    const value = Number(storage.getItem("rxpopulous.progress"));
    return Number.isInteger(value) && value >= 1 && value <= levels ? value : 1;
  } catch {
    return 1;
  }
}
