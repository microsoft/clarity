let stopCallbacks: (() => void)[] = [];
let active = false;

export function start(): void {
  active = true;
}

export function stop(): void {
  stopCallbacks.reverse().forEach((callback) => {
    try {
      callback();
    } catch (error) {
      // Do nothing
    }
  });
  stopCallbacks = [];
  active = false;
}

export function register(stopCallback: () => void): void {
  if (active && typeof stopCallback === "function") {
    stopCallbacks.push(stopCallback);
  }
}

export function dynamicEvent(url: string): void {
  if (!active) return;
  load(url);
}

function load(url: string): void {
  if (!active) return;

  try {
    const script = document.createElement("script");
    script.src = url;
    script.async = true;
    document.head.appendChild(script);
  } catch (error) {
    // Do nothing
  }
}
