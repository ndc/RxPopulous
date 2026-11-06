import * as rxjs from "rxjs";
import type { Command, Observation, Side } from "./game";

type Controller = (api: {
  version: 1;
  side: Side;
  rxjs: typeof rxjs;
  observations$: rxjs.Observable<Observation>;
  command: (action: Command) => void;
}) => void | (() => void) | { unsubscribe: () => void };

const observations = new rxjs.Subject<Observation>();
let cleanup: ReturnType<Controller>;
let initialized = false;

self.onmessage = (event: MessageEvent) => {
  const message = event.data;
  try {
    if (message.type === "init") {
      let controller: Controller | undefined;
      const registerController = (fn: Controller) => {
        if (typeof fn !== "function" || controller)
          throw new Error("Register exactly one controller function.");
        controller = fn;
      };
      // Scripts are explicitly trusted and run with the worker's origin privileges.
      new Function("registerController", '"use strict";\n' + message.source)(
        registerController,
      );
      if (!controller)
        throw new Error("Script must call registerController(function).");
      cleanup = (controller as Controller)({
        version: 1,
        side: message.side,
        rxjs,
        observations$: observations.asObservable(),
        command: (action) => self.postMessage({ type: "command", action }),
      });
      initialized = true;
      self.postMessage({ type: "ready" });
    } else if (message.type === "observation" && initialized) {
      observations.next(message.observation);
    } else if (message.type === "stop") {
      observations.complete();
      if (typeof cleanup === "function") cleanup();
      else cleanup?.unsubscribe();
      self.close();
    }
  } catch (error) {
    self.postMessage({
      type: "error",
      message: error instanceof Error ? error.message : String(error),
    });
  }
};
