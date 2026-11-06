import type { Command, Observation, Side } from "./game";

export class Automation {
  private worker: Worker;
  private timeout: ReturnType<typeof setTimeout>;
  private closed = false;
  private messages = 0;

  constructor(
    source: string,
    side: Side,
    onCommand: (command: Command) => void,
    onError: (message: string) => void,
    onReady: () => void,
  ) {
    this.worker = new Worker(
      new URL("./automation.worker.ts", import.meta.url),
      { type: "module" },
    );
    const fail = (message: string) => {
      if (this.closed) return;
      this.stop();
      onError(message);
    };
    this.timeout = setTimeout(
      () => fail("Script did not initialize within 3 seconds."),
      3000,
    );
    this.worker.onmessage = (event) => {
      if (this.closed) return;
      const message = event.data;
      if (message?.type === "ready") {
        clearTimeout(this.timeout);
        onReady();
      } else if (message?.type === "error") {
        fail(String(message.message));
      } else if (message?.type === "command") {
        if (++this.messages > 32)
          return fail("Script exceeded the command limit for one tick.");
        onCommand(message.action);
      }
    };
    this.worker.onerror = (event) => fail(event.message || "Worker failed.");
    this.worker.onmessageerror = () =>
      fail("Worker sent an unreadable message.");
    this.worker.postMessage({ type: "init", side, source });
  }

  update(observation: Observation) {
    if (this.closed) return;
    this.messages = 0;
    this.worker.postMessage({ type: "observation", observation });
  }

  stop() {
    if (this.closed) return;
    this.closed = true;
    clearTimeout(this.timeout);
    this.worker.postMessage({ type: "stop" });
    // Do not allow a broken or infinite-looping script to prevent termination.
    setTimeout(() => this.worker.terminate(), 50);
  }
}
